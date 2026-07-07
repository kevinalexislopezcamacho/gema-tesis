import { Router } from 'express'
import { register, login, loginAsAdmin, getCurrentUser, updateProfile } from '../controllers/authController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/login/admin', loginAsAdmin)
router.get('/me', authMiddleware, getCurrentUser)
router.put('/profile', authMiddleware, updateProfile)

export default router
