import { Router } from 'express'
import { getShop, listCategories, listShops, getCategoryAttributes } from '../controllers/shops.controller.js'

const router = Router()
router.get('/categories', listCategories)
router.get('/categories/:categorySlug/attributes', getCategoryAttributes)
router.get('/shops', listShops)
router.get('/shops/:shopId', getShop)

export default router
