import { Router } from 'express'
import {
  calculateShippingFee,
  updateOrderTracking,
  getOrderTracking,
} from '../controllers/shipping.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Tính phí vận chuyển (Public hoặc Buyer)
router.post('/shipping/calculate', calculateShippingFee)

// Seller cập nhật mã vận đơn cho shop order
router.patch('/seller/orders/:shopOrderId/tracking', authenticate, requireRole('seller', 'admin'), updateOrderTracking)

// Buyer hoặc Seller tra cứu hành trình vận chuyển của đơn hàng
router.get('/orders/:orderId/tracking', authenticate, getOrderTracking)

export default router
