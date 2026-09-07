import { Router } from 'express'
import { getReport } from '../controllers/analyticsController'
import { authMiddleware, adminMiddleware } from '../middleware/auth'

const router = Router()

router.get('/report', authMiddleware, adminMiddleware, getReport)

export default router
