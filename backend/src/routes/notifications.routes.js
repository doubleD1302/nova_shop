import { Router } from 'express'
import { authenticateToken } from '../middlewares/auth.middleware.js'
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  registerDeviceToken,
  unregisterDeviceToken,
} from '../controllers/notifications.controller.js'

const router = Router()

// Tất cả các route thông báo đều yêu cầu đăng nhập
router.use('/notifications', authenticateToken)

// 1. Lấy danh sách thông báo in-app
router.get('/notifications', listMyNotifications)

// 2. Đánh dấu tất cả thông báo là đã đọc
router.patch('/notifications/read-all', markAllNotificationsRead)

// 3. Đánh dấu 1 thông báo cụ thể là đã đọc
router.patch('/notifications/:id/read', markNotificationRead)

// 4. Đăng ký & Hủy device token nhận Push Notification
router.post('/notifications/device-token', registerDeviceToken)
router.delete('/notifications/device-token', unregisterDeviceToken)

export default router
