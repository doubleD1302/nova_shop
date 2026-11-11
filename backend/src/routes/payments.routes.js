import { Router } from 'express'
import {
  createPaymentSession,
  getPaymentReviewQueue,
  getPaymentStatus,
  momoIpn,
  reconcilePayments,
  refundPayment,
  vnpayIpn,
  zalopayIpn,
} from '../controllers/payments.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()
router.post('/orders/:orderId/payment-session', authenticate, createPaymentSession)
router.get('/orders/:orderId/payment-status', authenticate, getPaymentStatus)

// IPN Webhooks từ cổng thanh toán
router.get('/payments/vnpay/ipn', vnpayIpn)
router.post('/payments/momo/ipn', momoIpn)
router.post('/payments/zalopay/ipn', zalopayIpn)

// Hoàn tiền tự động (Admin hoặc Seller/Buyer yêu cầu với quyền phù hợp)
router.post('/payments/refund', authenticate, refundPayment)

// Đối soát giao dịch tự động cho Admin
router.get('/admin/payments/review-queue', authenticate, requireRole('admin'), getPaymentReviewQueue)
router.post('/admin/payments/reconcile', authenticate, requireRole('admin'), reconcilePayments)

export default router
