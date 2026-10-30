import { Router } from 'express'
import {
  verifyCredentials,
  loginWithGoogle,
  getUserAuthProfile,
  registerUser,
  updateUserProfile,
  createSellerShop,
  createSession,
  refreshSession,
  revokeSession,
  revokeAllSessions,
  changePassword,
} from '../controllers/auth.controller.js'
import { updateSellerShop } from '../controllers/shops.controller.js'

const router = Router()

// POST /internal/v1/auth/verify-credentials - Xác minh thông tin đăng nhập
router.post('/auth/verify-credentials', verifyCredentials)
router.post('/auth/google', loginWithGoogle)
router.post('/auth/register', registerUser)

// Quản lý phiên đăng nhập và refresh token
router.post('/auth/sessions', createSession)
router.post('/auth/sessions/refresh', refreshSession)
router.post('/auth/sessions/revoke', revokeSession)
router.post('/auth/sessions/revoke-all', revokeAllSessions)

// GET /internal/v1/users/:userId/auth-profile - Lấy hồ sơ xác thực tài khoản
router.get('/users/:userId/auth-profile', getUserAuthProfile)
router.put('/users/:userId/profile', updateUserProfile)
router.post('/users/:userId/change-password', changePassword)
router.post('/users/:userId/seller-shop', createSellerShop)
router.put('/users/:userId/seller-shop', (req, res, next) => {
  req.body = { ...(req.body || {}), userId: req.params.userId }
  return updateSellerShop(req, res, next)
})

export default router
