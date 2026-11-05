import { Router } from 'express'
import { listCategories, getCategoryAttributes } from '../controllers/shops.controller.js'
import { getHealth, getReady } from '../controllers/system.controller.js'

const router = Router()
router.get('/categories', listCategories)
router.get('/categories/:categorySlug/attributes', getCategoryAttributes)

// GET /internal/v1/health - Liveness check
router.get('/health', getHealth)

// GET /internal/v1/ready - Readiness check (xác thực kết nối MySQL)
router.get('/ready', getReady)

export default router
