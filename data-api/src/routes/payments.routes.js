import { Router } from 'express'
import {
  applyPaymentNotification,
  getPaymentReviewQueue,
  getPaymentStatus,
  getPendingReconcileTransactions,
  processPaymentRefund,
  reconcilePaymentsBatch,
  reservePayment,
} from '../controllers/payments.controller.js'

const router = Router()
router.post('/orders/:orderId/payment-session', reservePayment)
router.get('/orders/:orderId/payment-status', getPaymentStatus)
router.post('/payments/notification', applyPaymentNotification)
router.post('/payments/refund', processPaymentRefund)
router.get('/admin/payments/review-queue', getPaymentReviewQueue)
router.get('/admin/payments/pending-reconcile', getPendingReconcileTransactions)
router.post('/admin/payments/reconcile-batch', reconcilePaymentsBatch)

export default router
