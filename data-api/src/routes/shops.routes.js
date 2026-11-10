import { Router } from 'express'
import {
  getShop,
  listShops,
  getShopFollowStatus,
  followShop,
  unfollowShop,
} from '../controllers/shops.controller.js'

const router = Router()
router.get('/shops', listShops)
router.get('/shops/:shopId/follow', getShopFollowStatus)
router.post('/shops/:shopId/follow', followShop)
router.delete('/shops/:shopId/follow', unfollowShop)
router.get('/shops/:shopId', getShop)

export default router
