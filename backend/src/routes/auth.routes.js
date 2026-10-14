import { Router } from 'express'
import { login, getMe } from '../controllers/auth.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { loginRateLimiter } from '../middlewares/rate-limit.middleware.js'

const router = Router()

// POST /api/v1/auth/login - Đăng nhập tài khoản với giới hạn thử tần suất (Rate Limiter)
router.post('/login', loginRateLimiter, login)

// GET /api/v1/auth/me - Lấy thông tin tài khoản hiện tại (bắt buộc Bearer JWT)
router.get('/me', authenticate, getMe)

export default router
