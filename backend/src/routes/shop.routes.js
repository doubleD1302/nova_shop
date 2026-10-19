import { Router } from 'express'
import {
  getShops,
  getShopDetail,
  getShopProducts,
  getFollowStatus,
  followShopAction,
  unfollowShopAction,
} from '../controllers/shop.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const shopRouter = Router()

/**
 * Các route đọc thông tin Shop (/api/v1/shops/*).
 * Quyền: Public (không yêu cầu đăng nhập).
 */
shopRouter.get('/', getShops)
shopRouter.get('/:shopId', getShopDetail)
shopRouter.get('/:shopId/products', getShopProducts)

// Các route theo dõi shop (yêu cầu đăng nhập)
shopRouter.get('/:shopId/follow', authenticate, getFollowStatus)
shopRouter.post('/:shopId/follow', authenticate, followShopAction)
shopRouter.delete('/:shopId/follow', authenticate, unfollowShopAction)

export { shopRouter }
