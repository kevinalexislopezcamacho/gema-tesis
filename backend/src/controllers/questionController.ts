import { prisma } from '../lib/prisma'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { updateElo } from '../utils/elo'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// GET /api/videos/:videoId/questions
// Selección adaptativa: cada slide tiene varias variantes de pregunta (distinta
// dificultadElo). Por cada slide se elige la variante cuya dificultad está más
// cerca del Elo actual del estudiante en ese tema — así la pregunta que ve cada
// estudiante no es siempre la misma, se recalibra con su nivel medido.
export const getQuestionsForVideo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autorizado' })
    }
    const { videoId } = req.params
    const userId = req.user.id

    const allVariants = await prisma.question.findMany({
      where: { videoId },
      orderBy: { triggerTimeSec: 'asc' },
      select: {
        id: true,
        topicId: true,
        slideIndex: true,
        triggerTimeSec: true,
        tipo: true,
        enunciado: true,
        opciones: true,
        codigoInicial: true,
        dificultadElo: true,
      },
    })

    if (allVariants.length === 0) {
      return res.status(200).json({ success: true, data: [] })
    }

    const topicId = allVariants[0].topicId
    const skill = await prisma.studentTopicSkill.findUnique({
      where: { userId_topicId: { userId, topicId } },
    })
    const studentElo = skill?.elo ?? 1200

    // Agrupar variantes por slide y elegir la más cercana al Elo del estudiante
    const porSlide = new Map<number, typeof allVariants>()
    for (const v of allVariants) {
      const grupo = porSlide.get(v.slideIndex) ?? []
      grupo.push(v)
      porSlide.set(v.slideIndex, grupo)
    }

    const seleccionadas = [...porSlide.values()]
      .map(variantes =>
        variantes.reduce((mejor, actual) =>
          Math.abs(actual.dificultadElo - studentElo) < Math.abs(mejor.dificultadElo - studentElo) ? actual : mejor
        )
      )
      .sort((a, b) => a.triggerTimeSec - b.triggerTimeSec)

    const data = seleccionadas.map(q => ({
      id:             q.id,
      slideIndex:     q.slideIndex,
      triggerTimeSec: q.triggerTimeSec,
      tipo:           q.tipo,
      enunciado:      q.enunciado,
      opciones:       q.opciones ? JSON.parse(q.opciones) : null,
      codigoInicial:  q.codigoInicial,
    }))

    return res.status(200).json({ success: true, data })
  } catch (error) {
    console.error('Error al obtener preguntas del video:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function calificarAbierta(enunciado: string, respuestaModelo: string, respuestaEstudiante: string): Promise<{ correcto: boolean; feedback: string }> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Eres un asistente que califica respuestas abiertas de estudiantes de Fundamentos de Programación.

Pregunta: ${enunciado}
Respuesta de referencia (guía, no exigir texto idéntico): ${respuestaModelo}
Respuesta del estudiante: ${respuestaEstudiante}

Evalúa si la respuesta del estudiante demuestra haber entendido el concepto, aunque esté redactada distinto a la referencia.
Responde ÚNICAMENTE un JSON válido sin markdown: {"correcto": boolean, "feedback": "breve retroalimentación en español, máximo 2 oraciones"}`,
      }],
      temperature: 0.3,
      max_tokens: 200,
    })

    let raw = completion.choices[0].message.content?.trim() ?? '{}'
    if (raw.startsWith('```')) {
      raw = raw.split('```')[1].replace(/^json/, '').trim()
    }
    const parsed = JSON.parse(raw)
    return { correcto: !!parsed.correcto, feedback: parsed.feedback ?? '' }
  } catch (error) {
    console.error('Error calificando respuesta abierta:', error)
    return { correcto: false, feedback: 'No se pudo evaluar automáticamente tu respuesta.' }
  }
}

// POST /api/questions/:id/attempt
export const submitAttempt = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autorizado' })
    }
    const userId = req.user.id
    const { id: questionId } = req.params
    const { respuesta } = req.body

    if (respuesta === undefined || respuesta === null || respuesta === '') {
      return res.status(400).json({ success: false, error: 'Falta la respuesta' })
    }

    const question = await prisma.question.findUnique({ where: { id: questionId } })
    if (!question) {
      return res.status(404).json({ success: false, error: 'Pregunta no encontrada' })
    }

    const skill = await prisma.studentTopicSkill.upsert({
      where:  { userId_topicId: { userId, topicId: question.topicId } },
      update: {},
      create: { userId, topicId: question.topicId, elo: 1200 },
    })

    let correcto = false
    let feedback = question.explicacion

    if (question.tipo === 'seleccion_multiple') {
      correcto = String(respuesta) === String(question.respuestaCorrecta)
    } else if (question.tipo === 'codigo') {
      correcto = normalizar(String(respuesta)) === normalizar(question.respuestaCorrecta ?? '')
    } else if (question.tipo === 'abierta') {
      const juicio = await calificarAbierta(question.enunciado, question.respuestaCorrecta ?? '', String(respuesta))
      correcto = juicio.correcto
      feedback = juicio.feedback || question.explicacion
    }

    const { nuevoEstudiante, nuevaPregunta } = updateElo(skill.elo, question.dificultadElo, correcto)

    await prisma.studentTopicSkill.update({
      where: { userId_topicId: { userId, topicId: question.topicId } },
      data:  { elo: nuevoEstudiante },
    })

    await prisma.question.update({
      where: { id: questionId },
      data: {
        dificultadElo:   nuevaPregunta,
        vecesRespondida: { increment: 1 },
        vecesCorrecta:   correcto ? { increment: 1 } : undefined,
      },
    })

    await prisma.questionAttempt.create({
      data: {
        userId,
        questionId,
        respuestaDada:        String(respuesta),
        correcto,
        eloEstudianteAntes:   skill.elo,
        eloEstudianteDespues: nuevoEstudiante,
        eloPreguntaAntes:     question.dificultadElo,
        eloPreguntaDespues:   nuevaPregunta,
      },
    })

    return res.status(200).json({
      success: true,
      data: {
        correcto,
        explicacion:       feedback,
        eloEstudiante:     Math.round(nuevoEstudiante),
        // Revelar la respuesta correcta solo ahora que ya se calificó el intento — sirve
        // para que el estudiante pueda revisar la pregunta sin que sea "hacer trampa".
        respuestaCorrecta: question.respuestaCorrecta,
      },
    })
  } catch (error) {
    console.error('Error al calificar intento de pregunta:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}
