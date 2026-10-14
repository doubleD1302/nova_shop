import { Router } from 'express'
import { verifyCredentials, getUserAuthProfile } from '../controllers/auth.controller.js'

const router = Router()

// POST /internal/v1/auth/verify-credentials - Xác minh thông tin đăng nhập
router.post('/auth/verify-credentials', verifyCredentials)

// GET /internal/v1/users/:userId/auth-profile - Lấy hồ sơ xác thực tài khoản
router.get('/users/:userId/auth-profile', getUserAuthProfile)

export default router
