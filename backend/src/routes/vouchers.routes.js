import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import { listPublicVouchers, listWallet, saveVoucher } from '../controllers/vouchers.controller.js'

const router = Router()
router.get('/', listPublicVouchers)
router.get('/wallet', authenticate, listWallet)
router.post('/wallet', authenticate, saveVoucher)
export default router
