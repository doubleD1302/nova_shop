import { Router } from 'express'
import { listSellerOrders, updateSellerOrderStatus } from '../controllers/orders.controller.js'
import { archiveSellerProduct, listSellerProducts, saveSellerProduct } from '../controllers/products.controller.js'
import { updateSellerShop } from '../controllers/shops.controller.js'
import { searchProductImages } from '../controllers/image-search.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(authenticate, requireRole('seller', 'admin'))
router.put('/shop', updateSellerShop)
router.get('/images/search', searchProductImages)
router.get('/products', listSellerProducts)
router.post('/products', saveSellerProduct)
router.put('/products/:productId', saveSellerProduct)
router.delete('/products/:productId', archiveSellerProduct)
router.get('/orders', listSellerOrders)
router.patch('/orders/:shopOrderId/status', updateSellerOrderStatus)

export default router
