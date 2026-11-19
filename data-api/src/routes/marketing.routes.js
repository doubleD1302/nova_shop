import { Router } from 'express'
import {
  listCampaigns,
  registerCampaign,
  listSellerCampaignRegistrations,
  buyProductBoost,
  listSellerProductBoosts,
  getSellerMarketingAnalytics,
} from '../controllers/marketing.controller.js'

const router = Router()

// Danh sách chiến dịch marketing
router.get('/marketing/campaigns', listCampaigns)

// Seller đăng ký chiến dịch
router.post('/seller/marketing/campaigns/register', registerCampaign)
router.get('/seller/marketing/registrations', listSellerCampaignRegistrations)

// Seller mua gói đẩy sản phẩm
router.post('/seller/marketing/boost', buyProductBoost)
router.get('/seller/marketing/boosts', listSellerProductBoosts)

// Theo dõi hiệu quả quảng cáo
router.get('/seller/marketing/analytics', getSellerMarketingAnalytics)

export default router
