import { callDataApi } from '../clients/data.client.js'
import { Router } from 'express'
import {
  createContentReport,
  listAdminResource,
  updateAdminProductFlashSale,
  updateAdminProductApproval,
  updateAdminShopApproval,
  listAdminShopApprovalEvents,
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
router.get('/admin/shops/:shopId/registration', async (req, res, next) => {
  try {
    const data = await callDataApi(`/internal/v1/admin/shops/${encodeURIComponent(req.params.shopId)}/registration?userId=${encodeURIComponent(req.user.id)}`)
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
})
router.get('/admin/shops/:shopId/violations', listShopViolations)
router.get('/admin/shops/:id/approval-events', listAdminShopApprovalEvents)
router.post('/admin/violations/:id/retry-email', retryViolationEmail)
router.get('/admin/:resource', listAdminResource)
router.patch('/admin/products/:id/approval', updateAdminProductApproval)
router.patch('/admin/shops/:id/approval', updateAdminShopApproval)
router.patch('/admin/products/:id/flash-sale', updateAdminProductFlashSale)
router.patch('/admin/:resource/:id/status', updateAdminResource)

export default router
