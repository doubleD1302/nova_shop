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
  runCronJobManually,
  createAdminVoucher,
  deleteAdminVoucher,
} from '../controllers/admin.controller.js'
import { listAdminPayouts, updateAdminPayoutStatus } from '../controllers/seller-payout.controller.js'
import { listAdminReturns, resolveAdminReturnDispute } from '../controllers/returns.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()
router.post('/reports', authenticate, createContentReport)
router.use(['/admin/shops/:shopId/identity-access', '/admin/shops/:shopId/identity-access-events'], (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
router.use('/admin', authenticate, requireRole('admin'))
router.post('/admin/jobs/run', runCronJobManually)
router.get('/admin/email-status', getEmailStatus)
router.get('/admin/shops/:shopId/identity-access-events', async (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  try {
    const data = await callDataApi(`/internal/v1/admin/shops/${encodeURIComponent(req.params.shopId)}/identity-access-events?userId=${encodeURIComponent(req.user.id)}`)
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
})
router.post('/admin/shops/:shopId/identity-access', async (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  try {
    const data = await callDataApi(`/internal/v1/admin/shops/${encodeURIComponent(req.params.shopId)}/identity-access`, {
      method: 'POST', body: { userId: req.user.id, reason: req.body?.reason },
    })
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
})
router.get('/admin/shops/:shopId/registration', async (req, res, next) => {
  try {
    const data = await callDataApi(`/internal/v1/admin/shops/${encodeURIComponent(req.params.shopId)}/registration?userId=${encodeURIComponent(req.user.id)}`)
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
})
router.get('/admin/shops/:shopId/violations', listShopViolations)
router.get('/admin/shops/:id/approval-events', listAdminShopApprovalEvents)
router.post('/admin/violations/:id/retry-email', retryViolationEmail)

// Quản lý chi trả doanh thu cho người bán (Admin Payouts)
router.get('/admin/payouts', listAdminPayouts)
router.patch('/admin/payouts/:id', updateAdminPayoutStatus)

// Quản trị và phân xử khiếu nại trả hàng (Admin Returns & Disputes)
router.get('/admin/returns', listAdminReturns)
router.patch('/admin/returns/:returnId/resolve', resolveAdminReturnDispute)

// Quản lý voucher toàn sàn & hệ thống
router.post('/admin/vouchers', createAdminVoucher)
router.delete('/admin/vouchers/:id', deleteAdminVoucher)

router.get('/admin/:resource', listAdminResource)
router.patch('/admin/products/:id/approval', updateAdminProductApproval)
router.patch('/admin/shops/:id/approval', updateAdminShopApproval)
router.patch('/admin/products/:id/flash-sale', updateAdminProductFlashSale)
router.patch('/admin/:resource/:id/status', updateAdminResource)

export default router
