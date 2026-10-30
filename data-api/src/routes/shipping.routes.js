import { Router } from 'express'
import {
  calculateShippingFee,
  updateOrderTracking,
  getOrderTracking,
} from '../controllers/shipping.controller.js'

const router = Router()

// Tính phí vận chuyển động
router.post('/shipping/calculate', calculateShippingFee)

// Quản lý mã vận đơn cho Seller
router.patch('/seller/orders/:shopOrderId/tracking', updateOrderTracking)

// Tra cứu hành trình bưu kiện cho Buyer / Seller
router.get('/orders/:orderId/tracking', getOrderTracking)

export default router
