import { Router } from 'express'
import {
  listProducts,
  listProductReviews,
  listEligibleReviewItems,
  createProductReview,
} from '../controllers/products.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', listProducts)
router.get('/:productId/reviews', listProductReviews)
router.get('/:productId/reviews/eligible', authenticate, listEligibleReviewItems)
router.post('/:productId/reviews', authenticate, createProductReview)

export default router
