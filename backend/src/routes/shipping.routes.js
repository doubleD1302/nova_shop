import { Router } from 'express'
import {
  calculate3PlRates,
  calculateShippingFee,
  carrierWebhook,
  dispatchOrder,
  getOrderTracking,
  updateOrderTracking,
} from '../controllers/shipping.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Tính phí vận chuyển nội bộ ShopNova
router.post('/shipping/calculate', calculateShippingFee)

// Báo giá cước và thời gian giao hàng thực tế theo từng đơn vị vận chuyển 3PL (GHN, GHTK, Viettel Post)
router.post('/shipping/rates-3pl', calculate3PlRates)

// Seller cập nhật mã vận đơn thủ công cho shop order
router.patch('/seller/orders/:shopOrderId/tracking', authenticate, requireRole('seller', 'admin'), updateOrderTracking)

// Seller bấm "Xác nhận gửi hàng" -> Tự động đẩy đơn 3PL (tạo mã vận đơn + lịch hẹn bưu tá lấy hàng)
router.post('/seller/orders/:shopOrderId/dispatch', authenticate, requireRole('seller', 'admin'), dispatchOrder)

// Webhook cập nhật hành trình tự động từ bưu tá (không cần đăng nhập vì là đối tác gọi vào)
router.post('/shipping/webhook/:carrier', carrierWebhook)

// Buyer hoặc Seller tra cứu hành trình vận chuyển của đơn hàng
router.get('/orders/:orderId/tracking', authenticate, getOrderTracking)

export default router
