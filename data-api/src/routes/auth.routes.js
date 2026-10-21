import { Router } from 'express'
import { verifyCredentials, getUserAuthProfile, registerUser, changePassword } from '../controllers/auth.controller.js'

const router = Router()

// POST /internal/v1/auth/verify-credentials - Xác minh thông tin đăng nhập
router.post('/auth/verify-credentials', verifyCredentials)

// POST /internal/v1/auth/register - Đăng ký tài khoản người mua/người bán mới
router.post('/auth/register', registerUser)

// GET /internal/v1/users/:userId/auth-profile - Lấy hồ sơ xác thực tài khoản
router.get('/users/:userId/auth-profile', getUserAuthProfile)

// PUT /internal/v1/users/:userId/change-password - Đổi mật khẩu tài khoản
router.put('/users/:userId/change-password', changePassword)

export default router
