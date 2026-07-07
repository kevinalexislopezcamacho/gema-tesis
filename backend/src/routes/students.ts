import { Router } from 'express'
import {
  getStudentProgress,
  updateStudentProgress,
  completeTopicChallenge,
  watchVideo,
  getWatchedVideos,
  dailyLogin,
  getAllStudents,
  getStudentStats,
  getStudentSkills
} from '../controllers/studentController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Rutas protegidas
router.get('/:studentId/progress', authMiddleware, getStudentProgress)
router.put('/:studentId/progress', authMiddleware, updateStudentProgress)
router.post('/:studentId/topics/:topicId/complete', authMiddleware, completeTopicChallenge)
router.post('/:studentId/daily-login',              authMiddleware, dailyLogin)
router.post('/:studentId/videos/:videoId/watch',    authMiddleware, watchVideo)
router.get('/:studentId/watched-videos',           authMiddleware, getWatchedVideos)
router.get('/:studentId/stats', authMiddleware, getStudentStats)
router.get('/:studentId/skills', authMiddleware, getStudentSkills)
router.get('/', authMiddleware, getAllStudents)

export default router
