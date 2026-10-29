import { Router } from 'express'
import {
  listProducts,
  listProductReviews,
  listEligibleReviewItems,
  createProductReview,
  listSellerProducts,
  saveSellerProduct,
  archiveSellerProduct,
} from '../controllers/products.controller.js'

const router = Router()

router.get('/products', listProducts)
router.get('/products/:productId/reviews', listProductReviews)
router.get('/products/:productId/reviews/eligible', listEligibleReviewItems)
router.post('/products/:productId/reviews', createProductReview)
router.get('/seller/products', listSellerProducts)
router.post('/seller/products', saveSellerProduct)
router.put('/seller/products/:productId', saveSellerProduct)
router.delete('/seller/products/:productId', archiveSellerProduct)

export default router
