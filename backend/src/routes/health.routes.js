import { Router } from 'express'
import { getHealth } from '../controllers/health.controller.js'
import { getReady } from '../controllers/ready.controller.js'

const router = Router()

/**
 * Endpoint kiểm tra tình trạng hoạt động của máy chủ (Liveness check)
 * GET /api/v1/health
 */
router.get('/health', getHealth)

/**
 * Endpoint kiểm tra tính sẵn sàng của Backend và các phụ thuộc (Readiness check)
 * GET /api/v1/ready
 */
router.get('/ready', getReady)

export default router
