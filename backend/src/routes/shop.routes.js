import { Router } from 'express'
import { getShops, getShopDetail, getShopProducts } from '../controllers/shop.controller.js'

const shopRouter = Router()

/**
 * Các route đọc thông tin Shop (/api/v1/shops/*).
 * Quyền: Public (không yêu cầu đăng nhập).
 */
shopRouter.get('/', getShops)
shopRouter.get('/:shopId', getShopDetail)
shopRouter.get('/:shopId/products', getShopProducts)

export { shopRouter }
