import { Router } from 'express'
import { getAdminSettings, updateAdminSettings, getPublicSystemConfig } from '../controllers/settings.controller.js'
import { authenticate, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

// API công khai để client/app kiểm tra runtime (bảo trì, v.v.)
router.get('/system/config', getPublicSystemConfig)

// API cấu hình hệ thống dành riêng cho Quản trị viên
router.get('/admin/settings', authenticate, requireRole('admin'), getAdminSettings)
router.put('/admin/settings', authenticate, requireRole('admin'), updateAdminSettings)

export default router
