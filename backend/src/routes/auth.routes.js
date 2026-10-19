import { Router } from 'express'
import { login, register, getMe, updateProfile } from '../controllers/auth.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'
import { loginRateLimiter } from '../middlewares/rate-limit.middleware.js'

const router = Router()

// POST /api/v1/auth/login - Đăng nhập tài khoản với giới hạn thử tần suất (Rate Limiter)
router.post('/login', loginRateLimiter, login)

// POST /api/v1/auth/register - Đăng ký tài khoản người mua hoặc người bán
router.post('/register', loginRateLimiter, register)

// GET /api/v1/auth/me - Lấy thông tin tài khoản hiện tại (bắt buộc Bearer JWT)
router.get('/me', authenticate, getMe)

// PUT /api/v1/auth/profile - Cập nhật thông tin tài khoản (bắt buộc Bearer JWT)
router.put('/profile', authenticate, updateProfile)

export default router
