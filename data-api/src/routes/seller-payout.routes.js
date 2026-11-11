import { Router } from 'express'
import {
  getSellerBankAccount,
  saveSellerBankAccount,
  getSellerEscrowBalance,
  createSellerPayoutRequest,
  listSellerPayoutHistory,
  listAdminPayouts,
  updateAdminPayoutStatus,
} from '../controllers/seller-payout.controller.js'

const router = Router()

// Seller Bank Account & Escrow Payout
router.get('/seller/payout/bank-account', getSellerBankAccount)
router.post('/seller/payout/bank-account', saveSellerBankAccount)
router.get('/seller/payout/balance', getSellerEscrowBalance)
router.post('/seller/payout/request', createSellerPayoutRequest)
router.get('/seller/payout/history', listSellerPayoutHistory)

// Admin Payout Management
router.get('/admin/payouts', listAdminPayouts)
router.patch('/admin/payouts/:id', updateAdminPayoutStatus)

export default router
