import { Router } from 'express'
import { getProductReviews, createReview } from '../controllers/review.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const reviewRouter = Router()

// GET /api/v1/products/:productId/reviews - Xem đánh giá của một sản phẩm
reviewRouter.get('/products/:productId/reviews', getProductReviews)

// POST /api/v1/reviews - Người mua tạo đánh giá cho sản phẩm đã mua
reviewRouter.post('/reviews', authenticate, requireRole('buyer'), createReview)

export { reviewRouter }
