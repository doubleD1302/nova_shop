import { Router } from 'express'
import {
  getFeaturedHomeData,
  getProductReviews,
  createReview,
  getFavorites,
  addFavorite,
  removeFavorite,
} from '../controllers/engagement.controller.js'

const engagementRouter = Router()

/**
 * Các route nội bộ quản lý khuyến mãi, đánh giá và sản phẩm yêu thích:
 * - GET /internal/v1/products/featured
 * - GET /internal/v1/products/:productId/reviews
 * - POST /internal/v1/reviews
 * - GET /internal/v1/users/:userId/favorites
 * - POST /internal/v1/users/:userId/favorites/:productId
 * - DELETE /internal/v1/users/:userId/favorites/:productId
 */
engagementRouter.get('/products/featured', getFeaturedHomeData)
engagementRouter.get('/products/:productId/reviews', getProductReviews)
engagementRouter.post('/reviews', createReview)
engagementRouter.get('/users/:userId/favorites', getFavorites)
engagementRouter.post('/users/:userId/favorites/:productId', addFavorite)
engagementRouter.delete('/users/:userId/favorites/:productId', removeFavorite)

export { engagementRouter }
