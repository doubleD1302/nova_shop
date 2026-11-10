import { Router } from 'express'
import {
  listCampaigns,
  registerCampaign,
  listSellerCampaignRegistrations,
  buyProductBoost,
  listSellerProductBoosts,
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

export default router
