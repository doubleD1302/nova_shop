import { Router } from 'express'
import { getShop, updateShop, getDashboard } from '../controllers/seller-hub.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const sellerHubRouter = Router()

// Tất cả route hub seller đều yêu cầu đăng nhập và có role seller
sellerHubRouter.use(authenticate, requireRole('seller'))

// GET /api/v1/seller/shop - Xem thông tin gian hàng của mình
sellerHubRouter.get('/shop', getShop)

// PUT /api/v1/seller/shop - Cập nhật thông tin gian hàng
sellerHubRouter.put('/shop', updateShop)

// GET /api/v1/seller/dashboard - Thống kê kinh doanh của gian hàng
sellerHubRouter.get('/dashboard', getDashboard)

export { sellerHubRouter }
