import { Router } from 'express'
import {
  listFavorites,
  addFavorite,
  removeFavorite,
} from '../controllers/favorites.controller.js'

const router = Router()

router.get('/users/:userId/favorites', listFavorites)
router.post('/users/:userId/favorites/:productId', addFavorite)
router.delete('/users/:userId/favorites/:productId', removeFavorite)

export default router
