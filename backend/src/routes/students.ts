import { Router } from 'express'
import {
  getStudentProgress,
  updateStudentProgress,
  completeTopicChallenge,
  watchVideo,
  getWatchedVideos,
  dailyLogin,
  getAllStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentStats,
  getStudentSkills,
  purchaseByteItem,
  updateByteProfile,
  getAchievementsStatus,
  claimAchievement
} from '../controllers/studentController'
import { authMiddleware, adminMiddleware } from '../middleware/auth'

const router = Router()

// Gestión de cuentas de estudiante (solo docente/admin)
router.get('/', authMiddleware, getAllStudents)
router.post('/', authMiddleware, adminMiddleware, createStudent)
router.put('/:studentId', authMiddleware, adminMiddleware, updateStudent)
router.delete('/:studentId', authMiddleware, adminMiddleware, deleteStudent)

// Rutas protegidas
router.get('/:studentId/progress', authMiddleware, getStudentProgress)
router.put('/:studentId/progress', authMiddleware, updateStudentProgress)
router.post('/:studentId/topics/:topicId/complete', authMiddleware, completeTopicChallenge)
router.post('/:studentId/daily-login',              authMiddleware, dailyLogin)
router.post('/:studentId/videos/:videoId/watch',    authMiddleware, watchVideo)
router.get('/:studentId/watched-videos',           authMiddleware, getWatchedVideos)
router.get('/:studentId/stats', authMiddleware, getStudentStats)
router.get('/:studentId/skills', authMiddleware, getStudentSkills)
router.post('/:studentId/byte/purchase',                     authMiddleware, purchaseByteItem)
router.put('/:studentId/byte',                                authMiddleware, updateByteProfile)
router.get('/:studentId/achievements-status',                 authMiddleware, getAchievementsStatus)
router.post('/:studentId/achievements/:achievementId/claim',  authMiddleware, claimAchievement)

export default router
