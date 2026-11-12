import { Router } from 'express'
import { searchAdmin } from '../controllers/ai-admin.controller.js'
import {
  createReport,
  getAdminStats,
  listAdminOrders,
  listAdminProducts,
  listAdminReports,
  listAdminReviews,
  listAdminShops,
  listAdminUsers,
  updateAdminProductStatus,
  updateAdminProductApproval,
  updateAdminProductFlashSale,
  updateAdminReportStatus,
  updateAdminReviewStatus,
  updateAdminShopStatus,
  updateAdminShopApproval,
  listAdminShopApprovalEvents,
  updateAdminUserStatus,
  updateViolationEmailStatus,
  getShopViolations,
  getViolationDetail,
  listAdminVouchers,
  createAdminVoucher,
  updateAdminVoucherStatus,
  deleteAdminVoucher,
} from '../controllers/admin.controller.js'

const router = Router()

router.get('/ai/admin/search', searchAdmin)
router.get('/admin/stats', getAdminStats)
router.get('/admin/orders', listAdminOrders)
router.get('/admin/users', listAdminUsers)
router.patch('/admin/users/:userId/status', updateAdminUserStatus)
router.get('/admin/shops', listAdminShops)
router.patch('/admin/shops/:shopId/status', updateAdminShopStatus)
router.patch('/admin/shops/:shopId/approval', updateAdminShopApproval)
router.get('/admin/shops/:shopId/approval-events', listAdminShopApprovalEvents)
router.get('/admin/shops/:shopId/violations', getShopViolations)
router.get('/admin/products', listAdminProducts)
router.patch('/admin/products/:productId/status', updateAdminProductStatus)
router.patch('/admin/products/:productId/approval', updateAdminProductApproval)
router.patch('/admin/products/:productId/flash-sale', updateAdminProductFlashSale)
router.get('/admin/reviews', listAdminReviews)
router.patch('/admin/reviews/:reviewId/status', updateAdminReviewStatus)
router.get('/admin/reports', listAdminReports)
router.patch('/admin/reports/:reportId/status', updateAdminReportStatus)
router.get('/admin/vouchers', listAdminVouchers)
router.post('/admin/vouchers', createAdminVoucher)
router.patch('/admin/vouchers/:voucherId/status', updateAdminVoucherStatus)
router.delete('/admin/vouchers/:voucherId', deleteAdminVoucher)
router.get('/admin/violations/:violationId', getViolationDetail)
router.patch('/admin/violations/:violationId/email-status', updateViolationEmailStatus)
router.post('/reports', createReport)

export default router
