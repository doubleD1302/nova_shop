import { Router } from 'express'
import { listBanners } from '../controllers/banners.controller.js'

const router = Router()
router.get('/banners', listBanners)

export default router
