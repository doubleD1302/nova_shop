import { getDemoPayout, setupDemoPayout, createDemoWithdrawal } from '../controllers/demo-payout.controller.js'
import { Router } from 'express'
import { listSellerOrders, updateSellerOrderStatus } from '../controllers/orders.controller.js'
import { archiveSellerProduct, listSellerProducts, saveSellerProduct, getSellerCategoryAttributes } from '../controllers/products.controller.js'
import { getSellerShop, resubmitSellerShop, updateSellerShop } from '../controllers/shops.controller.js'
import { searchProductImages } from '../controllers/image-search.controller.js'
import {
  listSellerVouchers,
  createSellerVoucher,
  updateSellerVoucherStatus,
  deleteSellerVoucher,
} from '../controllers/vouchers.controller.js'
import {
  listSellerCampaigns,
  registerSellerCampaign,
  listSellerCampaignRegistrations,
  buySellerProductBoost,
  listSellerProductBoosts,
} from '../controllers/marketing.controller.js'
import {
  getSellerRevenueData,
  exportSellerRevenueExcel,
  getSellerInventoryData,
  exportSellerInventoryExcel,
} from '../controllers/reports.controller.js'
import { createSellerShop } from '../controllers/auth.controller.js'
import { getSellerDashboard } from '../controllers/seller-dashboard.controller.js'
import {
  getSellerBankAccount,
  saveSellerBankAccount,
  getSellerEscrowBalance,
  createSellerPayoutRequest,
  listSellerPayoutHistory,
} from '../controllers/seller-payout.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// Đăng ký mở gian hàng từ Mobile App / Web (chấp nhận buyer, seller, admin)
router.post('/register-shop', authenticate, requireRole('buyer', 'seller', 'admin'), createSellerShop)

router.use(authenticate, requireRole('seller', 'admin'))
router.get('/dashboard', getSellerDashboard)

// Chi trả doanh thu thực tế & Tài khoản ngân hàng (Real Payout & Escrow)
router.get('/payout/bank-account', getSellerBankAccount)
router.post('/payout/bank-account', saveSellerBankAccount)
router.get('/payout/balance', getSellerEscrowBalance)
router.post('/payout/request', createSellerPayoutRequest)
router.get('/payout/history', listSellerPayoutHistory)

router.get('/demo-payout', getDemoPayout)
router.post('/demo-payout/setup', setupDemoPayout)
router.post('/demo-payout/withdrawals', createDemoWithdrawal)
router.get('/shop', getSellerShop)
router.put('/shop', updateSellerShop)
router.post('/shop/resubmit', resubmitSellerShop)
router.get('/images/search', searchProductImages)
router.get('/products', listSellerProducts)
router.get('/products/:productId/category-attributes', getSellerCategoryAttributes)
router.post('/products', saveSellerProduct)
router.put('/products/:productId', saveSellerProduct)
router.delete('/products/:productId', archiveSellerProduct)
router.get('/orders', listSellerOrders)
router.patch('/orders/:shopOrderId/status', updateSellerOrderStatus)

// Quản lý mã giảm giá riêng của gian hàng
router.get('/vouchers', listSellerVouchers)
router.post('/vouchers', createSellerVoucher)
router.patch('/vouchers/:id/status', updateSellerVoucherStatus)
router.delete('/vouchers/:id', deleteSellerVoucher)

// Quảng cáo & Chiến dịch Marketing / Flash Sale
router.get('/marketing/campaigns', listSellerCampaigns)
router.post('/marketing/campaigns/register', registerSellerCampaign)
router.get('/marketing/registrations', listSellerCampaignRegistrations)
router.post('/marketing/boost', buySellerProductBoost)
router.get('/marketing/boosts', listSellerProductBoosts)

// Báo cáo & Thống kê nâng cao (JSON & Xuất Excel)
router.get('/reports/revenue', getSellerRevenueData)
router.get('/reports/revenue/export', exportSellerRevenueExcel)
router.get('/reports/inventory', getSellerInventoryData)
router.get('/reports/inventory/export', exportSellerInventoryExcel)

export default router
