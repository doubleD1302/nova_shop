import { Router } from 'express'
import { listSellerReviews, replySellerReview } from '../controllers/seller-reviews.controller.js'

const router = Router()

// Shop xem và phản hồi đánh giá sản phẩm
router.get('/seller/reviews', listSellerReviews)
router.post('/seller/reviews/:reviewId/reply', replySellerReview)

export default router
