import { Router } from 'express'
import { listWallet, saveVoucher, listPublicVouchers } from '../controllers/vouchers.controller.js'

const router = Router()
router.get('/vouchers', listPublicVouchers)
router.get('/vouchers/wallet', listWallet)
router.post('/vouchers/wallet', saveVoucher)
export default router
