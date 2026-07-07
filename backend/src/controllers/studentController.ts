import { prisma } from '../lib/prisma'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'

export const getStudentProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params

    const progress = await prisma.studentProgress.findUnique({
      where: { userId: studentId }
    })

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Progreso del estudiante no encontrado'
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        ...progress,
        completedTopics: JSON.parse(progress.completedTopics)
      }
    })
  } catch (error) {
    console.error('Error al obtener progreso:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    })
  }
}

export const updateStudentProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params
    const { completedTopics, currentTopic, xpGained, learningMode } = req.body

    if (req.user?.id !== studentId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      })
    }

    let progress = await prisma.studentProgress.findUnique({
      where: { userId: studentId }
    })

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Progreso del estudiante no encontrado'
      })
    }

    const updateData: any = {}

    if (completedTopics) {
      updateData.completedTopics = JSON.stringify(completedTopics)
    }

    if (currentTopic !== undefined) {
      updateData.currentTopic = currentTopic
    }

    if (xpGained) {
      updateData.totalXP = (progress.totalXP || 0) + xpGained
      updateData.level = Math.floor(((progress.totalXP || 0) + xpGained) / 500) + 1
    }

    if (learningMode) {
      updateData.learningMode = learningMode
    }

    if (req.body.watchedVideo) {
      updateData.videosWatched = (progress.videosWatched || 0) + 1

      // Streak on video watch
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      let newStreak = progress.streak || 0
      if (progress.lastActivityAt) {
        const last = new Date(progress.lastActivityAt)
        const lastStart = new Date(last.getFullYear(), last.getMonth(), last.getDate())
        const daysDiff = Math.floor((todayStart.getTime() - lastStart.getTime()) / 86_400_000)
        if (daysDiff === 1) newStreak += 1
        else if (daysDiff > 1) newStreak = 1
      } else {
        newStreak = 1
      }
      updateData.streak = newStreak
    }

    if (req.body.chatbotSession) {
      updateData.chatbotSessions = (progress.chatbotSessions || 0) + 1
    }

    updateData.lastActivityAt = new Date()

    progress = await prisma.studentProgress.update({
      where: { userId: studentId },
      data: updateData
    })

    return res.status(200).json({
      success: true,
      data: {
        ...progress,
        completedTopics: JSON.parse(progress.completedTopics)
      }
    })
  } catch (error) {
    console.error('Error al actualizar progreso:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    })
  }
}

export const completeTopicChallenge = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, topicId } = req.params
    const { difficulty } = req.body

    if (req.user?.id !== studentId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      })
    }

    let progress = await prisma.studentProgress.findUnique({
      where: { userId: studentId }
    })

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Progreso del estudiante no encontrado'
      })
    }

    const topic = await prisma.topic.findUnique({
      where: { topicId }
    })

    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Tópico no encontrado'
      })
    }

    const completedTopics = JSON.parse(progress.completedTopics)
    if (!completedTopics.includes(topicId)) {
      completedTopics.push(topicId)
    }

    const xpMap: Record<string, number> = {
      'fácil': 50, 'facil': 50, 'easy': 50,
      'medio': 100, 'medium': 100,
      'avanzado': 200, 'advanced': 200,
    }
    const xpReward = xpMap[difficulty?.toLowerCase() ?? ''] ?? 50

    const newTotalXP = (progress.totalXP || 0) + xpReward
    const newLevel = Math.floor(newTotalXP / 500) + 1

    // Streak: increment only on a new calendar day
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    let newStreak = progress.streak || 0
    if (progress.lastActivityAt) {
      const last = new Date(progress.lastActivityAt)
      const lastStart = new Date(last.getFullYear(), last.getMonth(), last.getDate())
      const daysDiff = Math.floor((todayStart.getTime() - lastStart.getTime()) / 86_400_000)
      if (daysDiff === 1) newStreak += 1
      else if (daysDiff > 1) newStreak = 1
      // daysDiff === 0: same day, keep streak as-is
    } else {
      newStreak = 1
    }

    progress = await prisma.studentProgress.update({
      where: { userId: studentId },
      data: {
        completedTopics: JSON.stringify(completedTopics),
        totalXP: newTotalXP,
        level: newLevel,
        streak: newStreak,
        lastActivityAt: new Date()
      }
    })

    return res.status(200).json({
      success: true,
      data: {
        progress: {
          ...progress,
          completedTopics: JSON.parse(progress.completedTopics)
        },
        xpGained: xpReward,
        newLevel
      }
    })
  } catch (error) {
    console.error('Error al completar desafío:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    })
  }
}

export const watchVideo = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, videoId } = req.params
    const { watchedRatio, difficulty, topicId } = req.body

    if (req.user?.id !== studentId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' })
    }

    const ratio = Number(watchedRatio)
    if (isNaN(ratio) || ratio < 0.85) {
      return res.status(400).json({
        success: false,
        error: `Debes ver al menos el 85% del video. Solo viste el ${Math.round((ratio || 0) * 100)}%.`,
        watchedPct: Math.round((ratio || 0) * 100),
      })
    }

    const nivel = difficulty?.toLowerCase() ?? ''

    const existingWatch = await prisma.videoWatch.findUnique({
      where: { userId_videoId: { userId: studentId, videoId } },
    })

    const isFirstWatch = !existingWatch

    const xpMap: Record<string, number> = {
      'fácil': 50, 'facil': 50, 'easy': 50,
      'medio': 100, 'medium': 100,
      'avanzado': 200, 'advanced': 200,
    }
    const baseXP   = xpMap[nivel] ?? 50
    // First watch: full XP. Re-watch: 40% (rounded down, minimum 5 XP)
    const xpGained = isFirstWatch ? baseXP : Math.max(5, Math.floor(baseXP * 0.4))

    if (existingWatch) {
      await prisma.videoWatch.update({
        where: { userId_videoId: { userId: studentId, videoId } },
        data: { watchCount: { increment: 1 }, topicId: topicId ?? existingWatch.topicId, nivel: nivel || existingWatch.nivel },
      })
    } else {
      await prisma.videoWatch.create({
        data: { userId: studentId, videoId, topicId: topicId ?? '', nivel, watchCount: 1 },
      })
    }

    let progress = await prisma.studentProgress.findUnique({ where: { userId: studentId } })
    if (!progress) {
      return res.status(404).json({ success: false, error: 'Progreso no encontrado' })
    }

    const newTotalXP = (progress.totalXP || 0) + xpGained
    const newLevel   = Math.floor(newTotalXP / 500) + 1

    const today      = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    let newStreak    = progress.streak || 0
    if (progress.lastActivityAt) {
      const last      = new Date(progress.lastActivityAt)
      const lastStart = new Date(last.getFullYear(), last.getMonth(), last.getDate())
      const daysDiff  = Math.floor((todayStart.getTime() - lastStart.getTime()) / 86_400_000)
      if (daysDiff === 1) newStreak += 1
      else if (daysDiff > 1) newStreak = 1
    } else {
      newStreak = 1
    }

    const updateData: Record<string, any> = {
      videosWatched:  { increment: 1 },
      totalXP:        newTotalXP,
      level:          newLevel,
      streak:         newStreak,
      lastActivityAt: new Date(),
    }
    if (topicId) updateData.currentTopic = topicId

    // ── Check if all 3 difficulty levels for this topic are now watched ──
    let topicCompleted = false
    let watchedLevels: string[] = []

    if (topicId) {
      const allWatches = await prisma.videoWatch.findMany({
        where: { userId: studentId, topicId },
        select: { nivel: true },
      })
      watchedLevels = allWatches.map(w => w.nivel.toLowerCase())

      const required  = ['fácil', 'medio', 'avanzado']
      topicCompleted  = required.every(n => watchedLevels.includes(n))

      if (topicCompleted) {
        const completedArr: string[] = JSON.parse(progress.completedTopics || '[]')
        if (!completedArr.includes(topicId)) {
          completedArr.push(topicId)
          updateData.completedTopics = JSON.stringify(completedArr)
        }
      }
    }

    progress = await prisma.studentProgress.update({
      where: { userId: studentId },
      data:  updateData,
    })

    return res.status(200).json({
      success: true,
      data: {
        xpGained,
        isFirstWatch,
        topicCompleted,
        watchedLevels,
        watchCount: existingWatch ? existingWatch.watchCount + 1 : 1,
        progress: { ...progress, completedTopics: JSON.parse(progress.completedTopics) },
      },
    })
  } catch (error) {
    console.error('Error al registrar vista de video:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

// GET /api/students/:studentId/watched-videos
// Returns { topicId: string, nivel: string, watchCount: number }[] for the student
export const getWatchedVideos = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params

    if (req.user?.id !== studentId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' })
    }

    const watches = await prisma.videoWatch.findMany({
      where:  { userId: studentId },
      select: { videoId: true, topicId: true, nivel: true, watchCount: true },
      orderBy: { createdAt: 'asc' },
    })

    return res.status(200).json({ success: true, data: watches })
  } catch (error) {
    console.error('Error al obtener videos vistos:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

// POST /api/students/:studentId/daily-login
// Called once per day on app open — updates streak and returns change info
export const dailyLogin = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params

    if (req.user?.id !== studentId) {
      return res.status(403).json({ success: false, error: 'Acceso denegado' })
    }

    const progress = await prisma.studentProgress.findUnique({
      where: { userId: studentId },
    })

    if (!progress) {
      return res.status(404).json({ success: false, error: 'Progreso no encontrado' })
    }

    const today      = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const previousStreak = progress.streak || 0
    let newStreak    = previousStreak
    let daysDiff     = 0

    if (progress.lastActivityAt) {
      const last      = new Date(progress.lastActivityAt)
      const lastStart = new Date(last.getFullYear(), last.getMonth(), last.getDate())
      daysDiff = Math.floor((todayStart.getTime() - lastStart.getTime()) / 86_400_000)
    }

    // Same day → already logged in today, don't change streak
    if (daysDiff === 0) {
      return res.status(200).json({
        success: true,
        data: { changed: false, streak: previousStreak, previousStreak, daysDiff },
      })
    }

    // Yesterday → increment streak
    if (daysDiff === 1) {
      newStreak = previousStreak + 1
    }
    // 2+ days gap → reset streak
    else {
      newStreak = 1
    }

    const updated = await prisma.studentProgress.update({
      where: { userId: studentId },
      data:  { streak: newStreak, lastActivityAt: new Date() },
    })

    return res.status(200).json({
      success: true,
      data: {
        changed:        true,
        streak:         newStreak,
        previousStreak,
        daysDiff,
        wasReset:       daysDiff > 1,
        progress:       { ...updated, completedTopics: JSON.parse(updated.completedTopics) },
      },
    })
  } catch (error) {
    console.error('Error en daily login:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

export const getAllStudents = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado - Se requieren permisos de administrador'
      })
    }

    const students = await prisma.user.findMany({
      where: { role: 'student' }
    })

    const studentsWithProgress = await Promise.all(
      students.map(async (student) => {
        const progress = await prisma.studentProgress.findUnique({
          where: { userId: student.id }
        })
        const topicSkills = await prisma.studentTopicSkill.findMany({
          where: { userId: student.id },
          select: { topicId: true, elo: true }
        })
        return {
          ...student,
          progress: progress ? {
            ...progress,
            completedTopics: JSON.parse(progress.completedTopics)
          } : null,
          topicSkills: topicSkills.map(s => ({ topicId: s.topicId, elo: Math.round(s.elo) }))
        }
      })
    )

    return res.status(200).json({
      success: true,
      data: studentsWithProgress
    })
  } catch (error) {
    console.error('Error al obtener estudiantes:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    })
  }
}

// GET /api/students/:studentId/skills
// Niveles de habilidad (Elo) del estudiante por tema — alimentado por las
// preguntas adaptativas embebidas en los videos.
export const getStudentSkills = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params

    if (req.user?.id !== studentId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' })
    }

    const skills = await prisma.studentTopicSkill.findMany({
      where: { userId: studentId },
      select: { topicId: true, elo: true }
    })

    return res.status(200).json({
      success: true,
      data: skills.map(s => ({ topicId: s.topicId, elo: Math.round(s.elo) }))
    })
  } catch (error) {
    console.error('Error al obtener niveles de habilidad:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

export const getStudentStats = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params

    if (req.user?.id !== studentId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      })
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId }
    })

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Estudiante no encontrado'
      })
    }

    const progress = await prisma.studentProgress.findUnique({
      where: { userId: studentId }
    })

    const topics = await prisma.topic.findMany()

    const completedTopics = progress ? JSON.parse(progress.completedTopics) : []
    const completionPercentage = topics.length > 0
      ? Math.round((completedTopics.length / topics.length) * 100)
      : 0

    return res.status(200).json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          role: student.role
        },
        progress: progress ? {
          ...progress,
          completedTopics
        } : null,
        stats: {
          totalTopics: topics.length,
          completedTopics: completedTopics.length,
          completionPercentage,
          totalXP: progress?.totalXP || 0,
          currentLevel: progress?.level || 1,
          currentStreak: progress?.streak || 0,
          videosWatched: progress?.videosWatched || 0,
          chatbotSessions: progress?.chatbotSessions || 0
        }
      }
    })
  } catch (error) {
    console.error('Error al obtener estadísticas:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    })
  }
}
