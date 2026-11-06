import { Router } from 'express'
import { applyPaymentNotification, getPaymentReviewQueue, getPaymentStatus, reservePayment } from '../controllers/payments.controller.js'

const router = Router()
router.post('/orders/:orderId/payment-session', reservePayment)
router.get('/orders/:orderId/payment-status', getPaymentStatus)
router.post('/payments/notification', applyPaymentNotification)
router.get('/admin/payments/review-queue', getPaymentReviewQueue)
export default router
