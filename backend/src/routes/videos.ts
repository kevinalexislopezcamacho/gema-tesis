import { Router } from 'express'
import { generateVideo, getVideos, getVideoById, updateVideo, deleteVideo } from '../controllers/videoController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/generate',  authMiddleware, generateVideo)
router.get('/',           authMiddleware, getVideos)
router.get('/:id',        authMiddleware, getVideoById)
router.put('/:id',        authMiddleware, updateVideo)
router.delete('/:id',     authMiddleware, deleteVideo)

export default router
