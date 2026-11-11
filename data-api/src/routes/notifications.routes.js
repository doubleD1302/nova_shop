import { Router } from 'express'
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
  registerDeviceToken,
  listDeviceTokens,
  removeDeviceToken,
} from '../controllers/notifications.controller.js'

const router = Router()

// Quản lý thông báo in-app
router.get('/notifications', listNotifications)
router.post('/notifications', createNotification)
router.patch('/notifications/read-all', markAllNotificationsAsRead)
router.patch('/notifications/:id/read', markNotificationAsRead)

// Quản lý FCM / Push Device Tokens
router.get('/notifications/device-tokens', listDeviceTokens)
router.post('/notifications/device-token', registerDeviceToken)
router.delete('/notifications/device-token', removeDeviceToken)

export default router
