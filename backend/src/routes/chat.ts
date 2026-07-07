import { Router } from 'express'
import { sendMessage, getChatHistory, clearChatHistory } from '../controllers/chatController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/message',  authMiddleware, sendMessage)
router.get('/history',   authMiddleware, getChatHistory)
router.delete('/history',authMiddleware, clearChatHistory)

export default router
