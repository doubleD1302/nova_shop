import { Router } from 'express'
import {
  listProducts,
  listProductReviews,
  listEligibleReviewItems,
  createProductReview,
  listSellerProducts,
  saveSellerProduct,
  archiveSellerProduct,
  getSellerCategoryAttributes,
  getPublicCategoryAttributes,
} from '../controllers/products.controller.js'

const router = Router()

router.get('/products', listProducts)
router.get('/products/:productId/category-attributes', getPublicCategoryAttributes)
router.get('/products/:productId/reviews', listProductReviews)
router.get('/products/:productId/reviews/eligible', listEligibleReviewItems)
router.post('/products/:productId/reviews', createProductReview)
router.get('/seller/products', listSellerProducts)
router.get('/seller/products/:productId/category-attributes', getSellerCategoryAttributes)
router.post('/seller/products', saveSellerProduct)
router.put('/seller/products/:productId', saveSellerProduct)
router.delete('/seller/products/:productId', archiveSellerProduct)

export default router
