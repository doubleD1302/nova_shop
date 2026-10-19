import { Router } from 'express'
import {
  getCategories,
  getProducts,
  getProductDetail,
} from '../controllers/catalog.controller.js'

const router = Router()

// GET /internal/v1/categories - Danh sách danh mục
router.get('/categories', getCategories)

// GET /internal/v1/products - Danh sách sản phẩm kèm lọc và phân trang
router.get('/products', getProducts)

// GET /internal/v1/products/:idOrSlug - Chi tiết sản phẩm
router.get('/products/:idOrSlug', getProductDetail)

export default router
