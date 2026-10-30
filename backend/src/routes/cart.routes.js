import { Router } from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import {
  getCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  syncCart,
  updateCartSelection,
} from '../controllers/cart.controller.js'

const router = Router()

// Mọi thao tác giỏ hàng trên server đều yêu cầu xác thực người dùng
router.use(authenticate)

router.get('/', getCart)
router.post('/items', addItemToCart)
router.patch('/items/:itemId', updateCartItem)
router.delete('/items/:itemId', removeCartItem)
router.delete('/items', clearCart)
router.delete('/', clearCart)
router.post('/sync', syncCart)
router.patch('/selection', updateCartSelection)

export default router
