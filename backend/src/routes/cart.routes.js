import { Router } from 'express'
import {
  getCart,
  addItem,
  updateItem,
  deleteItem,
  clearOrRemoveItems,
} from '../controllers/cart.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()

// Toàn bộ các thao tác giỏ hàng đều yêu cầu phiên đăng nhập hợp lệ (Bearer JWT)
router.use(authenticate)

// GET /api/v1/cart - Đọc toàn bộ giỏ hàng của tài khoản hiện tại
router.get('/', getCart)

// POST /api/v1/cart/items - Thêm SKU vào giỏ hàng
router.post('/items', addItem)

// PATCH /api/v1/cart/items/:itemId - Cập nhật số lượng hoặc trạng thái chọn
router.patch('/items/:itemId', updateItem)

// DELETE /api/v1/cart/items/:itemId - Xóa một sản phẩm khỏi giỏ
router.delete('/items/:itemId', deleteItem)

// DELETE /api/v1/cart/items - Xóa nhiều sản phẩm hoặc làm trống giỏ
router.delete('/items', clearOrRemoveItems)

export default router
