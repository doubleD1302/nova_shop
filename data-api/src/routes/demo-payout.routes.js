import { Router } from 'express'
import { getDemoPayout, setupDemoPayout, createDemoWithdrawal } from '../controllers/demo-payout.controller.js'
const router = Router()
router.get('/seller/demo-payout', getDemoPayout)
router.post('/seller/demo-payout/setup', setupDemoPayout)
router.post('/seller/demo-payout/withdrawals', createDemoWithdrawal)
export default router
