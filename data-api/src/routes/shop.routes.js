import { Router } from 'express'
import { getShops, getShopDetail, getShopProducts } from '../controllers/shop.controller.js'

const shopRouter = Router()

/**
 * Các route nội bộ quản lý và đọc thông tin Shop (/internal/v1/shops/*).
 * Toàn bộ router này đã được bảo vệ bởi middleware verifyServiceKey ở cấp ứng dụng.
 */
shopRouter.get('/shops', getShops)
shopRouter.get('/shops/:idOrSlug', getShopDetail)
shopRouter.get('/shops/:idOrSlug/products', getShopProducts)

export { shopRouter }
