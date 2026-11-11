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

const router = Router()

// Yêu cầu và tra cứu trả hàng cho Buyer
router.post('/orders/:orderId/returns', createOrderReturn)
router.get('/orders/:orderId/returns', listOrderReturns)
router.get('/returns', listAllBuyerReturns)
router.patch('/returns/:returnId/cancel', cancelBuyerReturn)
router.post('/returns/:returnId/dispute', disputeBuyerReturn)

// Quản lý trả hàng cho Seller
router.get('/seller/returns', listSellerReturns)
router.patch('/seller/returns/:returnId/status', updateSellerReturnStatus)

// Quản lý và giải quyết tranh chấp cho Admin
router.get('/admin/returns', listAdminReturns)
router.patch('/admin/returns/:returnId/resolve', resolveAdminReturnDispute)

export default router
