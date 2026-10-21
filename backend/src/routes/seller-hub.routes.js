import { Router } from 'express'
import { getShop, updateShop, getDashboard, registerShop } from '../controllers/seller-hub.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const sellerHubRouter = Router()

// Yêu cầu đăng nhập trước khi thực hiện bất kỳ thao tác nào
sellerHubRouter.use(authenticate)

// POST /api/v1/seller/register-shop - Đăng ký mở gian hàng (dành cho cả buyer muốn nâng cấp thành seller)
sellerHubRouter.post('/register-shop', registerShop)

// Các route bên dưới yêu cầu role seller
sellerHubRouter.use(requireRole('seller'))

// GET /api/v1/seller/shop - Xem thông tin gian hàng của mình
sellerHubRouter.get('/shop', getShop)

// PUT /api/v1/seller/shop - Cập nhật thông tin gian hàng
sellerHubRouter.put('/shop', updateShop)

// GET /api/v1/seller/dashboard - Thống kê kinh doanh của gian hàng
sellerHubRouter.get('/dashboard', getDashboard)

export { sellerHubRouter }

