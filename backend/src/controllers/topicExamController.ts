import { prisma } from '../lib/prisma'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { gradeAnswer } from './questionController'
import { serializeProgress } from './studentController'

const EXAM_THEORY_SIZE = 9
const EXAM_CODIGO_SIZE = 1
const PASS_RATIO = 0.8
const MODULE_COMPLETE_COINS = 30

// GET /api/topics/:topicId/exam
// Reutiliza preguntas YA verificadas de los 3 videos del tema (mezcladas,
// muestra aleatoria) en vez de generar contenido nuevo con IA — cero riesgo
// de que el examen final traiga un bug de coherencia que las preguntas
// normales del video ya no tienen.
export const getTopicExam = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'No autorizado' })
    const userId = req.user.id
    const { topicId } = req.params

    const allWatches = await prisma.videoWatch.findMany({
      where: { userId, topicId },
      select: { nivel: true },
    })
    const watchedLevels = allWatches.map(w => w.nivel.toLowerCase())
    const required = ['fácil', 'medio', 'avanzado']
    if (!required.every(n => watchedLevels.includes(n))) {
      return res.status(400).json({ success: false, error: 'Primero debes ver los 3 niveles del módulo para tomar el examen final.' })
    }

    const selectFields = {
      id: true, tipo: true, lenguaje: true, enunciado: true,
      opciones: true, codigoInicial: true,
    } as const

    const [theoryPool, codigoPool] = await Promise.all([
      prisma.question.findMany({ where: { topicId, tipo: 'seleccion_multiple' }, select: selectFields }),
      prisma.question.findMany({ where: { topicId, tipo: 'codigo' }, select: selectFields }),
    ])
    if (theoryPool.length === 0 && codigoPool.length === 0) {
      return res.status(404).json({ success: false, error: 'Este módulo todavía no tiene preguntas para el examen.' })
    }

    // 9 preguntas teóricas (selección múltiple) mezcladas + 1 de código al final,
    // reutilizando preguntas YA verificadas — nunca contenido nuevo generado por IA.
    const shuffledTheory = [...theoryPool].sort(() => Math.random() - 0.5)
    const theorySample = shuffledTheory.slice(0, Math.min(EXAM_THEORY_SIZE, shuffledTheory.length))

    const shuffledCodigo = [...codigoPool].sort(() => Math.random() - 0.5)
    const codigoSample = shuffledCodigo.slice(0, Math.min(EXAM_CODIGO_SIZE, shuffledCodigo.length))

    const sample = [...theorySample, ...codigoSample]

    const data = sample.map(q => ({
      id: q.id,
      tipo: q.tipo,
      lenguaje: q.lenguaje,
      enunciado: q.enunciado,
      opciones: q.opciones ? JSON.parse(q.opciones) : null,
      codigoInicial: q.codigoInicial,
    }))

    return res.status(200).json({ success: true, data })
  } catch (error) {
    console.error('Error al generar examen final:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

// POST /api/topics/:topicId/exam/submit
export const submitTopicExam = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'No autorizado' })
    const userId = req.user.id
    const { topicId } = req.params
    const { respuestas } = req.body as { respuestas?: { questionId: string; respuesta: string }[] }

    if (!Array.isArray(respuestas) || respuestas.length === 0) {
      return res.status(400).json({ success: false, error: 'Faltan las respuestas del examen' })
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: respuestas.map(r => r.questionId) }, topicId },
    })
    const byId = new Map(questions.map(q => [q.id, q]))

    // Se consulta antes del bucle (no se modifica durante el examen — ver
    // comentario más abajo) solo para dejar un registro histórico correcto en
    // QuestionAttempt de con qué Elo de estudiante se tomó el examen.
    const existingSkillBefore = await prisma.studentTopicSkill.findUnique({ where: { userId_topicId: { userId, topicId } } })
    const estudianteElo = existingSkillBefore?.elo ?? 1200

    const results: { questionId: string; correcto: boolean; explicacion: string; respuestaCorrecta: string | null }[] = []
    let correctCount = 0
    for (const r of respuestas) {
      const question = byId.get(r.questionId)
      if (!question) continue
      const { correcto, feedback } = await gradeAnswer(question, r.respuesta)
      if (correcto) correctCount++
      // Se revela la respuesta correcta solo ahora que ya se calificó — así el
      // estudiante puede repasar el examen sin que sea "ver las respuestas antes".
      results.push({ questionId: r.questionId, correcto, explicacion: feedback, respuestaCorrecta: question.respuestaCorrecta })

      // El reporte de analíticas (preguntas con mayor tasa de error, precisión
      // por tipo/tema) se basa en estos contadores — sin esto, todo intento
      // hecho en el examen final quedaba invisible para esas métricas, aunque
      // reutilice las mismas preguntas que los videos. No se toca dificultadElo
      // ni el Elo del estudiante aquí: esos alimentan la selección adaptativa
      // de preguntas durante el video, un mecanismo aparte del examen.
      await prisma.question.update({
        where: { id: r.questionId },
        data: {
          vecesRespondida: { increment: 1 },
          vecesCorrecta: correcto ? { increment: 1 } : undefined,
        },
      })

      // Deja un registro de este intento (antes solo los intentos de video se
      // guardaban aquí) — sin esto no había forma de reconstruir series de
      // tiempo o desempeño por estudiante que incluyan también el examen final.
      // Antes/después son iguales a propósito: el examen no reajusta el Elo.
      await prisma.questionAttempt.create({
        data: {
          userId,
          questionId: r.questionId,
          respuestaDada: String(r.respuesta),
          correcto,
          eloEstudianteAntes: estudianteElo,
          eloEstudianteDespues: estudianteElo,
          eloPreguntaAntes: question.dificultadElo,
          eloPreguntaDespues: question.dificultadElo,
        },
      })
    }

    const total = results.length
    const score = total > 0 ? correctCount / total : 0
    const passed = score >= PASS_RATIO

    const existingSkill = existingSkillBefore
    const newBest = Math.max(existingSkill?.examBestScore ?? 0, score)
    const newPassed = (existingSkill?.examPassed ?? false) || passed
    await prisma.studentTopicSkill.upsert({
      where: { userId_topicId: { userId, topicId } },
      update: { examAttempts: { increment: 1 }, examBestScore: newBest, examPassed: newPassed },
      create: { userId, topicId, elo: 1200, examAttempts: 1, examBestScore: newBest, examPassed: newPassed },
    })

    let progress = await prisma.studentProgress.findUnique({ where: { userId } })
    if (!progress) return res.status(404).json({ success: false, error: 'Progreso no encontrado' })

    let coinsGained = 0
    let courseCompleted = false

    if (passed) {
      const completedArr: string[] = JSON.parse(progress.completedTopics || '[]')
      if (!completedArr.includes(topicId)) {
        completedArr.push(topicId)
        coinsGained = MODULE_COMPLETE_COINS

        const updateData: Record<string, any> = {
          completedTopics: JSON.stringify(completedArr),
          coins: { increment: coinsGained },
        }

        // Course completion is one-time and never revoked — same rule as before,
        // just moved here since passing the exam is now what truly finishes a module.
        if (!progress.courseCompletedAt) {
          const totalTopics = await prisma.topic.count()
          if (totalTopics > 0 && completedArr.length >= totalTopics) {
            courseCompleted = true
            updateData.courseCompletedAt = new Date()
          }
        }

        progress = await prisma.studentProgress.update({ where: { userId }, data: updateData })
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        score,
        passed,
        correctCount,
        total,
        coinsGained,
        courseCompleted,
        results,
        progress: serializeProgress(progress),
      },
    })
  } catch (error) {
    console.error('Error al calificar examen final:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}
