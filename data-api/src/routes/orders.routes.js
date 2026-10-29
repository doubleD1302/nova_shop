import { Router } from 'express'
import {
  cancelOrder,
  createOrder,
  listOrders,
  confirmOrderReceived,
  listSellerOrders,
  updateSellerOrderStatus,
} from '../controllers/orders.controller.js'

const router = Router()

router.post('/orders', createOrder)
router.get('/orders', listOrders)
router.post('/orders/:orderId/confirm-received', confirmOrderReceived)
router.post('/orders/:orderId/cancel', cancelOrder)
router.get('/seller/orders', listSellerOrders)
router.patch('/seller/orders/:shopOrderId/status', updateSellerOrderStatus)

export default router
