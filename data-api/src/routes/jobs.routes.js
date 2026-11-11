import { Router } from 'express'
import {
  cancelExpiredOrders,
  autoCompleteOrders,
  expireVouchers,
  getReferencedImages,
} from '../controllers/jobs.controller.js'

const router = Router()

// Endpoints nội bộ cho background cron jobs
router.post('/jobs/cancel-expired-orders', cancelExpiredOrders)
router.post('/jobs/auto-complete-orders', autoCompleteOrders)
router.post('/jobs/expire-vouchers', expireVouchers)
router.get('/jobs/referenced-images', getReferencedImages)

export default router
