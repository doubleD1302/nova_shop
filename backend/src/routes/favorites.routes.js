import { Router } from 'express'
import { listFavorites, addFavorite, removeFavorite } from '../controllers/favorites.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(authenticate)

router.get('/', listFavorites)
router.post('/:productId', addFavorite)
router.delete('/:productId', removeFavorite)

export default router
