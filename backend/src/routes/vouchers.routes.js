import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import { listWallet, saveVoucher } from '../controllers/vouchers.controller.js'

const router = Router()
router.use(authenticate)
router.get('/wallet', listWallet)
router.post('/wallet', saveVoucher)
export default router
