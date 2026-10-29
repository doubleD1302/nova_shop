import { Router } from 'express'
import { getShop, listShops } from '../controllers/shops.controller.js'

const router = Router()
router.get('/shops', listShops)
router.get('/shops/:shopId', getShop)

export default router
