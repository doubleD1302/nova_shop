import { Router } from 'express'
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

router.get('/cart', getCart)
router.post('/cart/items', addItemToCart)
router.patch('/cart/items/:itemId', updateCartItem)
router.delete('/cart/items/:itemId', removeCartItem)
router.delete('/cart/items', clearCart)
router.delete('/cart', clearCart)
router.post('/cart/sync', syncCart)
router.patch('/cart/selection', updateCartSelection)

export default router
