import { Router } from 'express'
import { getQuestionsForVideo, submitAttempt } from '../controllers/questionController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.get('/videos/:videoId/questions', authMiddleware, getQuestionsForVideo)
router.post('/questions/:id/attempt',    authMiddleware, submitAttempt)

export default router
