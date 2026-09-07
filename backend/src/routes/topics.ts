import { Router } from 'express'
import {
  getAllTopics,
  getTopicById,
  createTopic,
  updateTopic,
  deleteTopic
} from '../controllers/topicController'
import { getTopicExam, submitTopicExam } from '../controllers/topicExamController'
import { authMiddleware, adminMiddleware } from '../middleware/auth'

const router = Router()

// Rutas públicas
router.get('/', getAllTopics)
router.get('/:topicId', getTopicById)

// Examen final del módulo (estudiante autenticado)
router.get('/:topicId/exam', authMiddleware, getTopicExam)
router.post('/:topicId/exam/submit', authMiddleware, submitTopicExam)

// Rutas protegidas (solo admin)
router.post('/', authMiddleware, adminMiddleware, createTopic)
router.put('/:topicId', authMiddleware, adminMiddleware, updateTopic)
router.delete('/:topicId', authMiddleware, adminMiddleware, deleteTopic)

export default router
