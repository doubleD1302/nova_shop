import { Router } from 'express'
import { createPaymentSession, getPaymentReviewQueue, getPaymentStatus, momoIpn, vnpayIpn } from '../controllers/payments.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()
router.post('/orders/:orderId/payment-session', authenticate, createPaymentSession)
router.get('/orders/:orderId/payment-status', authenticate, getPaymentStatus)
router.get('/payments/vnpay/ipn', vnpayIpn)
router.post('/payments/momo/ipn', momoIpn)
router.get('/admin/payments/review-queue', authenticate, requireRole('admin'), getPaymentReviewQueue)
export default router
