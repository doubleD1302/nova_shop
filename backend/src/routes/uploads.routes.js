import { Router } from 'express'
import { uploadSellerImage } from '../controllers/uploads.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()
router.post('/uploads/images', authenticate, uploadSellerImage)

export default router
