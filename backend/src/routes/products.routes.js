import { Router } from 'express'
import {
  listProducts,
  getFeaturedProducts,
  getProductDetail,
  listProductReviews,
  listEligibleReviewItems,
  createProductReview,
  getPublicCategoryAttributes,
} from '../controllers/products.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', listProducts)
router.get('/featured', getFeaturedProducts)
router.get('/:productId', getProductDetail)
router.get('/:productId/category-attributes', getPublicCategoryAttributes)
router.get('/:productId/reviews', listProductReviews)
router.get('/:productId/reviews/eligible', authenticate, listEligibleReviewItems)
router.post('/:productId/reviews', authenticate, createProductReview)

export default router
