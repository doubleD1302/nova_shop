import { Router } from 'express'
import {
  listWallet,
  saveVoucher,
  listPublicVouchers,
  listSellerVouchers,
  createSellerVoucher,
  updateSellerVoucherStatus,
  deleteSellerVoucher,
} from '../controllers/vouchers.controller.js'

const router = Router()
router.get('/vouchers', listPublicVouchers)
router.get('/vouchers/wallet', listWallet)
router.post('/vouchers/wallet', saveVoucher)

// Seller vouchers
router.get('/seller/vouchers', listSellerVouchers)
router.post('/seller/vouchers', createSellerVoucher)
router.patch('/seller/vouchers/:id/status', updateSellerVoucherStatus)
router.delete('/seller/vouchers/:id', deleteSellerVoucher)

export default router
