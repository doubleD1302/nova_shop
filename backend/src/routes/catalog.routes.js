import { Router } from 'express'
import { getCategories, getProducts, getProductDetail } from '../controllers/catalog.controller.js'

const router = Router()

// GET /api/v1/categories - Lấy danh sách ngành hàng / danh mục công khai
router.get('/categories', getCategories)

// GET /api/v1/products - Danh sách sản phẩm kèm lọc và phân trang
router.get('/products', getProducts)

// GET /api/v1/products/:idOrSlug - Chi tiết sản phẩm theo ID hoặc slug
router.get('/products/:idOrSlug', getProductDetail)

export default router
