import { Router } from 'express'
import {
  getSellerShop,
  updateSellerShop,
  getSellerDashboard,
  getShopFollowStatus,
  followShop,
  unfollowShop,
} from '../controllers/seller-hub.controller.js'

const sellerHubRouter = Router()

/**
 * Các route quản lý cấu hình shop, dashboard thống kê và theo dõi shop:
 */
sellerHubRouter.get('/seller/shop', getSellerShop)
sellerHubRouter.put('/seller/shop', updateSellerShop)
sellerHubRouter.get('/seller/dashboard', getSellerDashboard)

sellerHubRouter.get('/shops/:shopId/follow', getShopFollowStatus)
sellerHubRouter.post('/shops/:shopId/follow', followShop)
sellerHubRouter.delete('/shops/:shopId/follow', unfollowShop)

export { sellerHubRouter }
