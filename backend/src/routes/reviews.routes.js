import { Router } from 'express'
import { createProductReview } from '../controllers/products.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()
router.post('/', authenticate, createProductReview)

export default router
