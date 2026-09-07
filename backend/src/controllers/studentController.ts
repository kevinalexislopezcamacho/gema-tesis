import { prisma } from '../lib/prisma'
import { Response } from 'express'
import bcrypt from 'bcryptjs'
import { AuthRequest } from '../middleware/auth'
import { catalogFor, StoreCategory } from '../constants/storeItems'
import { ACHIEVEMENT_RULES, computeStats } from '../constants/achievements'
import { passwordEsDebil } from './authController'

// Every StudentProgress row stores a handful of columns as JSON-stringified
// arrays (same pattern as the pre-existing `completedTopics`). This parses
// all of them consistently so every endpoint below returns real arrays.
export function serializeProgress(progress: any) {
  return {
    ...progress,
    completedTopics: JSON.parse(progress.completedTopics || '[]'),
    ownedColors: JSON.parse(progress.ownedColors || '["azul"]'),
    ownedOutfits: JSON.parse(progress.ownedOutfits || '["ninguno"]'),
    ownedStyles: JSON.parse(progress.ownedStyles || '["feliz"]'),
    claimedAchievements: JSON.parse(progress.claimedAchievements || '[]'),
  }
}

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
      data: serializeProgress(progress)
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
      data: serializeProgress(progress)
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
        progress: serializeProgress(progress),
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
    // Coins: 10% of base XP, first watch only (fácil +5, medio +10, avanzado +20)
    const coinsGained = isFirstWatch ? Math.round(baseXP / 10) : 0

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
    if (coinsGained > 0) updateData.coins = { increment: coinsGained }
    if (topicId) updateData.currentTopic = topicId

    // ── Check if all 3 difficulty levels for this topic are now watched ──
    // Watching all 3 no longer completes the topic by itself — it just makes
    // the module's final exam available. Passing that exam (>=80%, see
    // topicExamController.submitExam) is what actually adds the topic to
    // completedTopics, awards the module bonus, and can complete the course.
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
    }

    progress = await prisma.studentProgress.update({
      where: { userId: studentId },
      data:  updateData,
    })

    return res.status(200).json({
      success: true,
      data: {
        xpGained,
        coinsGained,
        isFirstWatch,
        topicCompleted,
        watchedLevels,
        watchCount: existingWatch ? existingWatch.watchCount + 1 : 1,
        progress: serializeProgress(progress),
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

    // Bonus de monedas cada 5 días de racha (5, 10, 15...) — además del
    // streak en sí, que ya influye en varios logros.
    const STREAK_MILESTONE_COINS = 25
    const coinsGained = newStreak > 0 && newStreak % 5 === 0 ? STREAK_MILESTONE_COINS : 0

    const updated = await prisma.studentProgress.update({
      where: { userId: studentId },
      data:  {
        streak: newStreak,
        lastActivityAt: new Date(),
        ...(coinsGained > 0 ? { coins: { increment: coinsGained } } : {}),
      },
    })

    return res.status(200).json({
      success: true,
      data: {
        changed:        true,
        streak:         newStreak,
        previousStreak,
        daysDiff,
        wasReset:       daysDiff > 1,
        coinsGained,
        progress:       serializeProgress(updated),
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
        const { password, ...studentSinPassword } = student
        return {
          ...studentSinPassword,
          progress: progress ? serializeProgress(progress) : null,
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

// POST /api/students — el docente crea una cuenta de estudiante nueva
// (mismo flujo de validación/hash que el auto-registro, pero sin loguear
// al docente como ese estudiante: no se devuelve token).
export const createStudent = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Falta nombre, email o contraseña' })
    }

    const debilidad = passwordEsDebil(password)
    if (debilidad) {
      return res.status(400).json({ success: false, error: debilidad })
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return res.status(400).json({ success: false, error: 'El email ya está registrado' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const student = await prisma.user.create({
      data: { name, email: email.toLowerCase(), password: hashedPassword, role: 'student' }
    })

    const progress = await prisma.studentProgress.create({
      data: {
        userId: student.id,
        completedTopics: '[]',
        currentTopic: null,
        totalXP: 0,
        level: 1,
        streak: 0,
        videosWatched: 0,
        chatbotSessions: 0,
        learningMode: 'video'
      }
    })

    const { password: _pw, ...studentSinPassword } = student
    return res.status(201).json({
      success: true,
      data: { ...studentSinPassword, progress: serializeProgress(progress), topicSkills: [] }
    })
  } catch (error) {
    console.error('Error al crear estudiante:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

// PUT /api/students/:studentId — el docente edita nombre/email/contraseña
// de la cuenta de un estudiante (los datos de progreso tienen su propio
// endpoint en PUT /:studentId/progress y no se tocan aquí).
export const updateStudent = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params
    const { name, email, password } = req.body

    const student = await prisma.user.findUnique({ where: { id: studentId } })
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Estudiante no encontrado' })
    }

    const updateData: { name?: string; email?: string; password?: string } = {}

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ success: false, error: 'El nombre no puede estar vacío' })
      updateData.name = name.trim()
    }

    if (email !== undefined) {
      const normalized = email.toLowerCase().trim()
      if (!normalized) return res.status(400).json({ success: false, error: 'El email no puede estar vacío' })
      if (normalized !== student.email) {
        const existing = await prisma.user.findUnique({ where: { email: normalized } })
        if (existing) return res.status(400).json({ success: false, error: 'El email ya está registrado' })
      }
      updateData.email = normalized
    }

    if (password) {
      const debilidad = passwordEsDebil(password)
      if (debilidad) return res.status(400).json({ success: false, error: debilidad })
      updateData.password = await bcrypt.hash(password, 10)
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No hay datos para actualizar' })
    }

    const updated = await prisma.user.update({ where: { id: studentId }, data: updateData })
    const progress = await prisma.studentProgress.findUnique({ where: { userId: studentId } })
    const topicSkills = await prisma.studentTopicSkill.findMany({
      where: { userId: studentId },
      select: { topicId: true, elo: true }
    })

    const { password: _pw, ...updatedSinPassword } = updated
    return res.status(200).json({
      success: true,
      data: {
        ...updatedSinPassword,
        progress: progress ? serializeProgress(progress) : null,
        topicSkills: topicSkills.map(s => ({ topicId: s.topicId, elo: Math.round(s.elo) }))
      }
    })
  } catch (error) {
    console.error('Error al actualizar estudiante:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

// DELETE /api/students/:studentId — borra la cuenta y, en cascada (definida
// en el schema de Prisma), todo su progreso, historial de video, intentos
// de preguntas, chat y habilidades por tema.
export const deleteStudent = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params

    const student = await prisma.user.findUnique({ where: { id: studentId } })
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Estudiante no encontrado' })
    }

    await prisma.user.delete({ where: { id: studentId } })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error al eliminar estudiante:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
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
        progress: progress ? serializeProgress(progress) : null,
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

// ── Byte Store ─────────────────────────────────────────────────────────────

// POST /api/students/:studentId/byte/purchase
// body: { category: 'color' | 'outfit' | 'style', itemId: string }
export const purchaseByteItem = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params
    const { category, itemId } = req.body as { category: StoreCategory; itemId: string }

    if (req.user?.id !== studentId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' })
    }

    const catalog = catalogFor(category)
    const item = catalog.find(i => i.id === itemId)
    if (!item) {
      return res.status(404).json({ success: false, error: 'Artículo no encontrado' })
    }

    const progress = await prisma.studentProgress.findUnique({ where: { userId: studentId } })
    if (!progress) {
      return res.status(404).json({ success: false, error: 'Progreso no encontrado' })
    }

    const ownedField   = category === 'color' ? 'ownedColors' : category === 'outfit' ? 'ownedOutfits' : 'ownedStyles'
    const equipField   = category === 'color' ? 'byteColor'   : category === 'outfit' ? 'byteOutfit'   : 'byteStyle'
    const owned: string[] = JSON.parse((progress as any)[ownedField] || '[]')

    const updateData: Record<string, any> = { [equipField]: itemId }

    if (!owned.includes(itemId)) {
      if (progress.coins < item.price) {
        return res.status(400).json({ success: false, error: 'Monedas insuficientes' })
      }
      updateData.coins = progress.coins - item.price
      updateData[ownedField] = JSON.stringify([...owned, itemId])
    }

    const updated = await prisma.studentProgress.update({
      where: { userId: studentId },
      data: updateData,
    })

    return res.status(200).json({ success: true, data: serializeProgress(updated) })
  } catch (error) {
    console.error('Error al comprar artículo de la tienda:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

// PUT /api/students/:studentId/byte
// body: { byteName: string }
export const updateByteProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params
    const { byteName } = req.body as { byteName?: string }

    if (req.user?.id !== studentId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' })
    }

    if (typeof byteName !== 'string' || !byteName.trim()) {
      return res.status(400).json({ success: false, error: 'Nombre inválido' })
    }

    const updated = await prisma.studentProgress.update({
      where: { userId: studentId },
      data: { byteName: byteName.trim().slice(0, 18) },
    })

    return res.status(200).json({ success: true, data: serializeProgress(updated) })
  } catch (error) {
    console.error('Error al actualizar el perfil de Byte:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

// ── Achievements ─────────────────────────────────────────────────────────────

async function computeAchievementStats(studentId: string) {
  const progress = await prisma.studentProgress.findUnique({ where: { userId: studentId } })
  if (!progress) return null

  const watches = await prisma.videoWatch.findMany({
    where: { userId: studentId },
    select: { topicId: true, nivel: true },
  })
  const byTopic: Record<string, Set<string>> = {}
  watches.forEach(w => {
    if (!w.topicId) return
    if (!byTopic[w.topicId]) byTopic[w.topicId] = new Set()
    byTopic[w.topicId].add(w.nivel.toLowerCase())
  })
  const fullyWatchedTopics = Object.values(byTopic).filter(
    s => s.has('fácil') && s.has('medio') && s.has('avanzado')
  ).length

  const stats = computeStats({
    totalXP: progress.totalXP,
    level: progress.level,
    streak: progress.streak,
    videosWatched: progress.videosWatched,
    chatbotSessions: progress.chatbotSessions,
    completedCount: JSON.parse(progress.completedTopics || '[]').length,
    fullyWatchedTopics,
  })

  return { progress, stats }
}

// GET /api/students/:studentId/achievements-status
export const getAchievementsStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params
    if (req.user?.id !== studentId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' })
    }

    const result = await computeAchievementStats(studentId)
    if (!result) {
      return res.status(404).json({ success: false, error: 'Progreso no encontrado' })
    }
    const claimed: string[] = JSON.parse(result.progress.claimedAchievements || '[]')

    const achievements = ACHIEVEMENT_RULES.map(rule => ({
      id: rule.id,
      unlocked: rule.check(result.stats),
      claimed: claimed.includes(rule.id),
      coinReward: rule.coinReward,
    }))

    return res.status(200).json({ success: true, data: { achievements, stats: result.stats } })
  } catch (error) {
    console.error('Error al obtener estado de logros:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

// POST /api/students/:studentId/achievements/:achievementId/claim
export const claimAchievement = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId, achievementId } = req.params
    if (req.user?.id !== studentId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' })
    }

    const rule = ACHIEVEMENT_RULES.find(r => r.id === achievementId)
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Logro no encontrado' })
    }

    const result = await computeAchievementStats(studentId)
    if (!result) {
      return res.status(404).json({ success: false, error: 'Progreso no encontrado' })
    }

    const claimed: string[] = JSON.parse(result.progress.claimedAchievements || '[]')
    if (claimed.includes(achievementId)) {
      return res.status(400).json({ success: false, error: 'Este logro ya fue reclamado' })
    }
    if (!rule.check(result.stats)) {
      return res.status(400).json({ success: false, error: 'Este logro aún no está desbloqueado' })
    }

    const updated = await prisma.studentProgress.update({
      where: { userId: studentId },
      data: {
        coins: result.progress.coins + rule.coinReward,
        claimedAchievements: JSON.stringify([...claimed, achievementId]),
      },
    })

    return res.status(200).json({
      success: true,
      data: { coinsAwarded: rule.coinReward, progress: serializeProgress(updated) },
    })
  } catch (error) {
    console.error('Error al reclamar logro:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}
