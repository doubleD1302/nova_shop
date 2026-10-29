import { Router } from 'express'
import {
  cancelOrder,
  createOrder,
  listOrders,
  confirmOrderReceived,
} from '../controllers/orders.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', authenticate, listOrders)
router.post('/', authenticate, createOrder)
router.post('/:orderId/cancel', authenticate, cancelOrder)
router.post('/:orderId/confirm-received', authenticate, confirmOrderReceived)

export default router
