import { Router } from 'express'
import {
  getShop,
  listCategories,
  listShops,
  getCategoryAttributes,
  getShopFollowStatus,
  followShop,
  unfollowShop,
  getShopProducts,
} from '../controllers/shops.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()
router.get('/categories', listCategories)
router.get('/categories/:categorySlug/attributes', getCategoryAttributes)
router.get('/shops', listShops)
router.get('/shops/:shopId/follow', authenticate, getShopFollowStatus)
router.post('/shops/:shopId/follow', authenticate, followShop)
router.delete('/shops/:shopId/follow', authenticate, unfollowShop)
router.get('/shops/:shopId/products', getShopProducts)
router.get('/shops/:shopId', getShop)

export default router
