import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import {
  createOrder,
  getOrders,
  getOrderDetail,
  cancelOrder,
} from '../controllers/order.controller.js'

const orderRouter = Router()

/**
 * Các route quản lý đơn hàng (/api/v1/orders/*).
 * Toàn bộ router này được bảo vệ bởi middleware authenticate (Bearer JWT).
 */
orderRouter.use(authenticate)

orderRouter.post('/', createOrder)
orderRouter.get('/', getOrders)
orderRouter.get('/:orderId', getOrderDetail)
orderRouter.patch('/:orderId/cancel', cancelOrder)

export { orderRouter }
