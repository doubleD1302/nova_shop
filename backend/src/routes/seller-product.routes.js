import { Router } from 'express'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/seller-product.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const sellerProductRouter = Router()

// Tất cả route quản lý sản phẩm cho seller đều yêu cầu đăng nhập và có role seller
sellerProductRouter.use(authenticate, requireRole('seller'))

// GET /api/v1/seller/products - Danh sách sản phẩm của shop
sellerProductRouter.get('/products', getProducts)

// POST /api/v1/seller/products - Thêm sản phẩm mới kèm SKU biến thể và ảnh
sellerProductRouter.post('/products', createProduct)

// PUT /api/v1/seller/products/:id - Cập nhật thông tin sản phẩm
sellerProductRouter.put('/products/:id', updateProduct)

// DELETE /api/v1/seller/products/:id - Xóa mềm (chuyển sang archived)
sellerProductRouter.delete('/products/:id', deleteProduct)

export { sellerProductRouter }
