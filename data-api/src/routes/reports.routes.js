import { Router } from 'express'
import { getSellerRevenueReport, getSellerInventoryReport } from '../controllers/reports.controller.js'

const router = Router()

router.get('/seller/reports/revenue', getSellerRevenueReport)
router.get('/seller/reports/inventory', getSellerInventoryReport)

export default router
