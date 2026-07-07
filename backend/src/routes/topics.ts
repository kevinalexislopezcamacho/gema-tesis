import { Router } from 'express'
import {
  getAllTopics,
  getTopicById,
  createTopic,
  updateTopic,
  deleteTopic
} from '../controllers/topicController'
import { authMiddleware, adminMiddleware } from '../middleware/auth'

const router = Router()

// Rutas públicas
router.get('/', getAllTopics)
router.get('/:topicId', getTopicById)

// Rutas protegidas (solo admin)
router.post('/', authMiddleware, adminMiddleware, createTopic)
router.put('/:topicId', authMiddleware, adminMiddleware, updateTopic)
router.delete('/:topicId', authMiddleware, adminMiddleware, deleteTopic)

export default router
