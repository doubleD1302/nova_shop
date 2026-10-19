import { Router } from 'express'
import {
  getCart,
  addItem,
  updateItem,
  deleteItem,
  clearOrRemoveItems,
} from '../controllers/cart.controller.js'

const router = Router()

// GET /internal/v1/cart - Đọc toàn bộ giỏ hàng theo userId
router.get('/cart', getCart)

// POST /internal/v1/cart/items - Thêm SKU vào giỏ hàng
router.post('/cart/items', addItem)

// PATCH /internal/v1/cart/items/:itemId - Cập nhật số lượng hoặc trạng thái chọn
router.patch('/cart/items/:itemId', updateItem)

// DELETE /internal/v1/cart/items/:itemId - Xóa một dòng sản phẩm khỏi giỏ
router.delete('/cart/items/:itemId', deleteItem)

// DELETE /internal/v1/cart/items - Xóa nhiều dòng hoặc xóa sạch giỏ
router.delete('/cart/items', clearOrRemoveItems)

export default router
