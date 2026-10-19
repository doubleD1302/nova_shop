import { Router } from 'express'
import {
  getSellerProducts,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
} from '../controllers/seller-product.controller.js'

const sellerProductRouter = Router()

/**
 * Các route nội bộ quản lý sản phẩm cho seller (/internal/v1/seller/products/*).
 */
sellerProductRouter.get('/seller/products', getSellerProducts)
sellerProductRouter.post('/seller/products', createSellerProduct)
sellerProductRouter.put('/seller/products/:productId', updateSellerProduct)
sellerProductRouter.delete('/seller/products/:productId', deleteSellerProduct)

export { sellerProductRouter }
