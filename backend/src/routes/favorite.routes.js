import { Router } from 'express'
import { getFavorites, addFavorite, removeFavorite } from '../controllers/favorite.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const favoriteRouter = Router()

// Tất cả route yêu thích đều yêu cầu đăng nhập
favoriteRouter.use('/favorites', authenticate)

// GET /api/v1/favorites - Xem danh sách sản phẩm yêu thích
favoriteRouter.get('/favorites', getFavorites)

// POST /api/v1/favorites/:productId - Thêm sản phẩm vào yêu thích
favoriteRouter.post('/favorites/:productId', addFavorite)

// DELETE /api/v1/favorites/:productId - Xóa sản phẩm khỏi yêu thích
favoriteRouter.delete('/favorites/:productId', removeFavorite)

export { favoriteRouter }
