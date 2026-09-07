import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { executeCode } from '../controllers/executeController'

const router = Router()

router.post('/execute', authMiddleware, executeCode)

export default router
