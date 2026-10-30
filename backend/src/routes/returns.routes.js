import { Router } from 'express'
import {
  createOrderReturn,
  listOrderReturns,
  listSellerReturns,
  updateSellerReturnStatus,
} from '../controllers/returns.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Buyer gửi và xem yêu cầu trả hàng
router.post('/orders/:orderId/returns', authenticate, createOrderReturn)
router.get('/orders/:orderId/returns', authenticate, listOrderReturns)

// Seller quản lý yêu cầu hoàn hàng của shop
router.get('/seller/returns', authenticate, requireRole('seller', 'admin'), listSellerReturns)
router.patch('/seller/returns/:returnId/status', authenticate, requireRole('seller', 'admin'), updateSellerReturnStatus)

export default router
