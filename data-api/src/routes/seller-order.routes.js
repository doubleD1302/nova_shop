import { Router } from 'express'
import {
  getSellerOrders,
  updateSellerOrderStatus,
} from '../controllers/seller-order.controller.js'

const sellerOrderRouter = Router()

/**
 * Các route nội bộ quản lý đơn hàng của người bán (/internal/v1/seller/orders/*).
 * Toàn bộ route đã được bảo vệ bởi middleware serviceAuthMiddleware ở cấp ứng dụng.
 */
sellerOrderRouter.get('/seller/orders', getSellerOrders)
sellerOrderRouter.patch('/seller/orders/:shopOrderId/status', updateSellerOrderStatus)

export { sellerOrderRouter }
