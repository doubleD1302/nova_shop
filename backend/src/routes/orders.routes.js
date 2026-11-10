import { Router } from 'express'
import { previewCheckout } from '../controllers/checkout-preview.controller.js'
import {
  cancelOrder,
  createOrder,
  listOrders,
  getOrderDetail,
  confirmOrderReceived,
} from '../controllers/orders.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()

router.post('/preview', authenticate, previewCheckout)
router.get('/', authenticate, listOrders)
router.post('/', authenticate, createOrder)
router.get('/:orderId', authenticate, getOrderDetail)
router.post('/:orderId/cancel', authenticate, cancelOrder)
router.patch('/:orderId/cancel', authenticate, cancelOrder)
router.post('/:orderId/confirm-received', authenticate, confirmOrderReceived)

export default router
