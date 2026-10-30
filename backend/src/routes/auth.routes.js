import { Router } from 'express'
import {
  login,
  loginWithGoogle,
  getMe,
  register,
  updateProfile,
  createSellerShop,
  refreshToken,
  logout,
  changePassword,
} from '../controllers/auth.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'
import { loginRateLimiter } from '../middlewares/rate-limit.middleware.js'

const router = Router()

// POST /api/v1/auth/login - Đăng nhập tài khoản với giới hạn thử tần suất (Rate Limiter)
router.post('/login', loginRateLimiter, login)
router.post('/google', loginRateLimiter, loginWithGoogle)
router.post('/register', loginRateLimiter, register)

// Làm mới phiên đăng nhập và đăng xuất
router.post('/refresh', refreshToken)
router.post('/logout', logout)

// GET /api/v1/auth/me - Lấy thông tin tài khoản hiện tại (bắt buộc Bearer JWT)
router.get('/me', authenticate, getMe)
router.put('/profile', authenticate, updateProfile)
router.post('/change-password', authenticate, changePassword)
router.post('/seller-shop', authenticate, requireRole('buyer', 'seller', 'admin'), createSellerShop)

export default router
