import { Router } from 'express'
import { getOrders, updateOrderStatus } from '../controllers/seller-order.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const sellerOrderRouter = Router()

// Tất cả route seller orders đều yêu cầu đăng nhập và có vai trò seller
sellerOrderRouter.use(authenticate, requireRole('seller'))

// GET /api/v1/seller/orders - Danh sách đơn hàng thuộc shop
sellerOrderRouter.get('/orders', getOrders)

// PATCH /api/v1/seller/orders/:shopOrderId/status - Đổi trạng thái xử lý đơn
sellerOrderRouter.patch('/orders/:shopOrderId/status', updateOrderStatus)

export { sellerOrderRouter }
