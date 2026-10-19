import { Router } from 'express'
import {
  createOrder,
  getOrders,
  getOrderDetail,
  cancelOrder,
} from '../controllers/order.controller.js'

const orderRouter = Router()

/**
 * Các route nội bộ quản lý đơn hàng (/internal/v1/orders/*).
 * Toàn bộ router này đã được bảo vệ bởi middleware verifyServiceKey ở cấp ứng dụng.
 */
orderRouter.post('/orders', createOrder)
orderRouter.get('/orders', getOrders)
orderRouter.get('/orders/:orderIdOrCode', getOrderDetail)
orderRouter.patch('/orders/:orderIdOrCode/cancel', cancelOrder)

export { orderRouter }
