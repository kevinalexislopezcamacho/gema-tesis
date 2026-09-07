import { prisma } from '../lib/prisma'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

// Cuartiles por interpolación lineal (método usado por numpy/Excel) — sirve
// para dibujar un boxplot real en vez de solo promedio/mediana.
function quartile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base]
}

function boxStats(nums: number[]): { min: number; q1: number; median: number; q3: number; max: number } {
  if (nums.length === 0) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 }
  const sorted = [...nums].sort((a, b) => a - b)
  return {
    min: Math.round(sorted[0] * 10) / 10,
    q1: Math.round(quartile(sorted, 0.25) * 10) / 10,
    median: Math.round(quartile(sorted, 0.5) * 10) / 10,
    q3: Math.round(quartile(sorted, 0.75) * 10) / 10,
    max: Math.round(sorted[sorted.length - 1] * 10) / 10,
  }
}

const NIVEL_LABEL: Record<string, string> = { seleccion_multiple: 'Selección múltiple', codigo: 'Código', abierta: 'Abierta' }

// GET /api/analytics/report — un solo reporte con todas las métricas de la
// clase para el docente. Pensado para respaldar la sección de resultados de
// una tesis: no solo porcentajes, sino dificultad de contenido, ritmo de
// avance y uso real de las herramientas (chat, racha, examen final).
export const getReport = async (req: AuthRequest, res: Response) => {
  try {
    const topics = await prisma.topic.findMany({ orderBy: { createdAt: 'asc' } })
    const topicName = (topicId: string) => topics.find(t => t.topicId === topicId)?.name ?? topicId

    const students = await prisma.user.findMany({ where: { role: 'student' } })
    const studentIds = students.map(s => s.id)
    const progresses = await prisma.studentProgress.findMany({ where: { userId: { in: studentIds } } })
    const progressByUser = new Map(progresses.map(p => [p.userId, p]))

    // ── 1. Resumen general ────────────────────────────────────────────────
    const totalStudents = students.length
    const completedCourse = progresses.filter(p => p.courseCompletedAt !== null)
    const usedChat = progresses.filter(p => p.chatbotSessions > 0)
    const overview = {
      totalStudents,
      studentsCompletedCourse: completedCourse.length,
      pctCompletedCourse: totalStudents ? Math.round((completedCourse.length / totalStudents) * 100) : 0,
      avgXP: Math.round(avg(progresses.map(p => p.totalXP))),
      avgLevel: Math.round(avg(progresses.map(p => p.level)) * 10) / 10,
      avgStreak: Math.round(avg(progresses.map(p => p.streak)) * 10) / 10,
      avgVideosWatched: Math.round(avg(progresses.map(p => p.videosWatched)) * 10) / 10,
      avgChatSessions: Math.round(avg(progresses.map(p => p.chatbotSessions)) * 10) / 10,
      pctUsedChat: totalStudents ? Math.round((usedChat.length / totalStudents) * 100) : 0,
    }

    // ── 2. Examen final por módulo ──────────────────────────────────────────
    const skills = await prisma.studentTopicSkill.findMany({ where: { userId: { in: studentIds } } })
    const attempted = skills.filter(s => s.examAttempts > 0)
    const passed = attempted.filter(s => s.examPassed)
    const passedFirstTry = attempted.filter(s => s.examPassed && s.examAttempts === 1)

    const byTopicMap = new Map<string, typeof skills>()
    for (const s of attempted) {
      const arr = byTopicMap.get(s.topicId) ?? []
      arr.push(s)
      byTopicMap.set(s.topicId, arr)
    }
    const examByTopic = topics
      .map(t => {
        const rows = byTopicMap.get(t.topicId) ?? []
        if (rows.length === 0) return null
        const rowsPassed = rows.filter(r => r.examPassed)
        return {
          topicId: t.topicId,
          topicName: t.name,
          attempts: rows.length,
          passed: rowsPassed.length,
          passRate: Math.round((rowsPassed.length / rows.length) * 100),
          avgAttempts: Math.round(avg(rows.map(r => r.examAttempts)) * 10) / 10,
          avgBestScore: Math.round(avg(rows.map(r => (r.examBestScore ?? 0) * 100))),
          scoreDistribution: boxStats(rows.map(r => (r.examBestScore ?? 0) * 100)),
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const examStats = {
      totalAttempts: attempted.length,
      totalPassed: passed.length,
      overallPassRate: attempted.length ? Math.round((passed.length / attempted.length) * 100) : 0,
      avgAttemptsToPass: Math.round(avg(passed.map(s => s.examAttempts)) * 10) / 10,
      pctPassedFirstTry: attempted.length ? Math.round((passedFirstTry.length / attempted.length) * 100) : 0,
      byTopic: examByTopic,
    }

    // ── 3. Dificultad de contenido (preguntas y tipos) ──────────────────────
    // Umbral mínimo de respuestas para que una pregunta cuente — con muy
    // pocos intentos, un solo estudiante distraído distorsiona la tasa.
    const MIN_ATTEMPTS = 3
    const questions = await prisma.question.findMany({
      where: { vecesRespondida: { gte: MIN_ATTEMPTS } },
      select: { id: true, enunciado: true, tipo: true, nivel: true, topicId: true, vecesRespondida: true, vecesCorrecta: true },
    })
    const hardestQuestions = [...questions]
      .map(q => ({
        id: q.id,
        enunciado: q.enunciado,
        tipo: q.tipo,
        tipoLabel: NIVEL_LABEL[q.tipo] ?? q.tipo,
        nivel: q.nivel,
        topicId: q.topicId,
        topicName: topicName(q.topicId),
        vecesRespondida: q.vecesRespondida,
        vecesCorrecta: q.vecesCorrecta,
        errorRate: Math.round((1 - q.vecesCorrecta / q.vecesRespondida) * 100),
      }))
      .sort((a, b) => b.errorRate - a.errorRate || b.vecesRespondida - a.vecesRespondida)
      .slice(0, 10)

    const allQuestionsForAgg = await prisma.question.findMany({
      where: { vecesRespondida: { gt: 0 } },
      select: { tipo: true, topicId: true, vecesRespondida: true, vecesCorrecta: true },
    })
    const byType = new Map<string, { attempts: number; correct: number }>()
    const byTopicAcc = new Map<string, { attempts: number; correct: number }>()
    for (const q of allQuestionsForAgg) {
      const t = byType.get(q.tipo) ?? { attempts: 0, correct: 0 }
      t.attempts += q.vecesRespondida; t.correct += q.vecesCorrecta
      byType.set(q.tipo, t)

      const tp = byTopicAcc.get(q.topicId) ?? { attempts: 0, correct: 0 }
      tp.attempts += q.vecesRespondida; tp.correct += q.vecesCorrecta
      byTopicAcc.set(q.topicId, tp)
    }
    const accuracyByType = [...byType.entries()].map(([tipo, v]) => ({
      tipo, tipoLabel: NIVEL_LABEL[tipo] ?? tipo,
      accuracy: Math.round((v.correct / v.attempts) * 100),
      attempts: v.attempts,
    }))
    const accuracyByTopic = topics
      .map(t => {
        const v = byTopicAcc.get(t.topicId)
        if (!v || v.attempts === 0) return null
        return { topicId: t.topicId, topicName: t.name, accuracy: Math.round((v.correct / v.attempts) * 100), attempts: v.attempts }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    // ── 4. Dificultad por módulo según Elo adaptativo ───────────────────────
    const eloByTopicMap = new Map<string, number[]>()
    for (const s of skills) {
      const arr = eloByTopicMap.get(s.topicId) ?? []
      arr.push(s.elo)
      eloByTopicMap.set(s.topicId, arr)
    }
    const eloByTopic = topics
      .map(t => {
        const elos = eloByTopicMap.get(t.topicId) ?? []
        if (elos.length === 0) return null
        return { topicId: t.topicId, topicName: t.name, avgElo: Math.round(avg(elos)), students: elos.length }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.avgElo - b.avgElo)

    // ── 5. Ritmo de avance: tiempo hasta completar el curso ─────────────────
    const userById = new Map(students.map(s => [s.id, s]))
    const completions = completedCourse
      .map(p => {
        const user = userById.get(p.userId)
        if (!user) return null
        const days = (p.courseCompletedAt!.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        return { userId: p.userId, name: user.name, days: Math.max(0, Math.round(days * 10) / 10) }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    const completionSpeed = {
      studentsCompleted: completions.length,
      avgDays: Math.round(avg(completions.map(c => c.days)) * 10) / 10,
      medianDays: Math.round(median(completions.map(c => c.days)) * 10) / 10,
      fastest: [...completions].sort((a, b) => a.days - b.days).slice(0, 5),
      distribution: boxStats(completions.map(c => c.days)),
    }

    // ── 6. Progreso por módulo (embudo, en orden curricular) ────────────────
    const moduleProgress = topics.map(t => {
      const count = progresses.filter(p => {
        try { return (JSON.parse(p.completedTopics || '[]') as string[]).includes(t.topicId) } catch { return false }
      }).length
      return { topicId: t.topicId, topicName: t.name, studentsCompleted: count, pct: totalStudents ? Math.round((count / totalStudents) * 100) : 0 }
    })

    return res.status(200).json({
      success: true,
      data: { overview, examStats, questionDifficulty: { hardestQuestions, accuracyByType, accuracyByTopic }, topicDifficulty: { byElo: eloByTopic }, completionSpeed, moduleProgress },
    })
  } catch (error) {
    console.error('Error al generar reporte de analíticas:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}
