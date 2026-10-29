import { Router } from 'express'
import {
  createContentReport,
  listAdminResource,
  updateAdminProductFlashSale,
  updateAdminProductApproval,
  updateAdminResource,
  retryViolationEmail,
  listShopViolations,
  getEmailStatus,
} from '../controllers/admin.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()
router.post('/reports', authenticate, createContentReport)
router.use('/admin', authenticate, requireRole('admin'))
router.get('/admin/email-status', getEmailStatus)
router.get('/admin/shops/:shopId/violations', listShopViolations)
router.post('/admin/violations/:id/retry-email', retryViolationEmail)
router.get('/admin/:resource', listAdminResource)
router.patch('/admin/products/:id/approval', updateAdminProductApproval)
router.patch('/admin/products/:id/flash-sale', updateAdminProductFlashSale)
router.patch('/admin/:resource/:id/status', updateAdminResource)

export default router
