import { Router } from 'express'
import { getShop, listCategories, listShops } from '../controllers/shops.controller.js'

const router = Router()
router.get('/categories', listCategories)
router.get('/shops', listShops)
router.get('/shops/:shopId', getShop)

export default router
