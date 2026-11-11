import { Router } from 'express'
import { getSellerRevenueReport, getSellerInventoryReport } from '../controllers/reports.controller.js'
import { getSellerDashboard } from '../controllers/seller-dashboard.controller.js'

const router = Router()

router.get('/seller/dashboard', getSellerDashboard)
router.get('/seller/reports/revenue', getSellerRevenueReport)
router.get('/seller/reports/inventory', getSellerInventoryReport)

export default router
