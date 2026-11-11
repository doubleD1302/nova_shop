import { Router } from 'express'
import {
  createOrderReturn,
  listOrderReturns,
  listAllBuyerReturns,
  cancelBuyerReturn,
  disputeBuyerReturn,
  listSellerReturns,
  updateSellerReturnStatus,
  listAdminReturns,
  resolveAdminReturnDispute,
} from '../controllers/returns.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Buyer gửi và xem yêu cầu trả hàng
router.post('/orders/:orderId/returns', authenticate, createOrderReturn)
router.get('/orders/:orderId/returns', authenticate, listOrderReturns)
router.get('/returns', authenticate, listAllBuyerReturns)
router.patch('/returns/:returnId/cancel', authenticate, cancelBuyerReturn)
router.post('/returns/:returnId/dispute', authenticate, disputeBuyerReturn)

// Seller quản lý yêu cầu hoàn hàng của shop
router.get('/seller/returns', authenticate, requireRole('seller', 'admin'), listSellerReturns)
router.patch('/seller/returns/:returnId/status', authenticate, requireRole('seller', 'admin'), updateSellerReturnStatus)

// Admin quản trị và giải quyết tranh chấp khiếu nại trả hàng
router.get('/admin/returns', authenticate, requireRole('admin'), listAdminReturns)
router.patch('/admin/returns/:returnId/resolve', authenticate, requireRole('admin'), resolveAdminReturnDispute)

export default router
