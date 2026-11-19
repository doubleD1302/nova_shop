import { Router } from 'express'
import { listSellerTransactions } from '../controllers/seller-finance.controller.js'

const router = Router()

// Lịch sử giao dịch: tiền đơn hàng, hoàn tiền và rút tiền của shop
router.get('/seller/finance/transactions', listSellerTransactions)

export default router
