import { Router } from 'express'
import {
  createOrderReturn,
  listOrderReturns,
  listSellerReturns,
  updateSellerReturnStatus,
} from '../controllers/returns.controller.js'

const router = Router()

// Yêu cầu và tra cứu trả hàng cho Buyer
router.post('/orders/:orderId/returns', createOrderReturn)
router.get('/orders/:orderId/returns', listOrderReturns)

// Quản lý trả hàng cho Seller
router.get('/seller/returns', listSellerReturns)
router.patch('/seller/returns/:returnId/status', updateSellerReturnStatus)

export default router
