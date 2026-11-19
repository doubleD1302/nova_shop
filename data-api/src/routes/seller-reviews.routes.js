import { Router } from 'express'
import { deleteSellerReviewReply, listSellerReviews, replySellerReview, updateSellerReviewReply } from '../controllers/seller-reviews.controller.js'

const router = Router()

// Shop xem và phản hồi đánh giá sản phẩm
router.get('/seller/reviews', listSellerReviews)
router.post('/seller/reviews/:reviewId/reply', replySellerReview)
router.patch('/seller/reviews/:reviewId/reply', updateSellerReviewReply)
router.delete('/seller/reviews/:reviewId/reply', deleteSellerReviewReply)

export default router
