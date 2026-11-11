import { Router } from 'express'
import {
  applyShippingWebhookEvent,
  calculateShippingFee,
  dispatchOrderShipment,
  getOrderTracking,
  updateOrderTracking,
} from '../controllers/shipping.controller.js'

const router = Router()

// Tính phí vận chuyển động
router.post('/shipping/calculate', calculateShippingFee)

// Quản lý mã vận đơn cho Seller (thủ công)
router.patch('/seller/orders/:shopOrderId/tracking', updateOrderTracking)

// Tự động đẩy đơn 3PL (tạo mã vận đơn và lịch hẹn bưu tá)
router.post('/seller/orders/:shopOrderId/dispatch', dispatchOrderShipment)

// Webhook cập nhật hành trình tự động từ bưu tá / hãng 3PL
router.post('/shipping/webhook-event', applyShippingWebhookEvent)

// Tra cứu hành trình bưu kiện cho Buyer / Seller
router.get('/orders/:orderId/tracking', getOrderTracking)

export default router
