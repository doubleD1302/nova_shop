import { getMessaging } from 'firebase-admin/messaging'
import { getFirebaseAdminApp } from './firebase-admin.js'
import { callDataApi } from '../clients/data.client.js'
import { broadcastToUser } from './chat-ws.service.js'

/**
 * Gửi thông báo đẩy (FCM / Web Push) tới các thiết bị của một người dùng
 */
export async function sendPushNotification({ userId, title, body, data = {}, link = null }) {
  if (!userId || !title || !body) return { success: false, reason: 'MISSING_PARAMS' }

  try {
    // 1. Lấy danh sách tokens đã đăng ký của người dùng từ Data API
    const tokensRes = await callDataApi(
      `/internal/v1/notifications/device-tokens?userId=${encodeURIComponent(String(userId))}`,
    )

    const tokens = Array.isArray(tokensRes?.tokens) ? tokensRes.tokens : []
    if (tokens.length === 0) {
      return { success: true, sentCount: 0, reason: 'NO_DEVICE_TOKENS' }
    }

    // 2. Lấy Firebase Messaging instance
    const app = getFirebaseAdminApp()
    if (!app) {
      // Firebase Admin chưa được cấu hình (ví dụ môi trường test/dev)
      return { success: true, sentCount: 0, simulated: true }
    }

    const messaging = getMessaging(app)

    // 3. Chuẩn bị payload gửi FCM
    const stringData = {}
    for (const [key, val] of Object.entries(data)) {
      stringData[key] = typeof val === 'string' ? val : JSON.stringify(val)
    }
    if (link) stringData.link = String(link)

    const payload = {
      tokens,
      notification: {
        title: String(title),
        body: String(body),
      },
      data: stringData,
      webpush: link
        ? {
            fcmOptions: {
              link: String(link),
            },
          }
        : undefined,
    }

    // 4. Bắn multicast đến tất cả thiết bị
    const response = await messaging.sendEachForMulticast(payload)

    // 5. Kiểm tra nếu có token hết hạn hoặc không hợp lệ -> tự động dọn dẹp
    if (response.failureCount > 0) {
      const invalidTokens = []
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx])
          }
        }
      })

      // Dọn dẹp token hỏng trong nền
      for (const token of invalidTokens) {
        callDataApi('/internal/v1/notifications/device-token', {
          method: 'DELETE',
          body: { userId: String(userId), token },
        }).catch(() => {})
      }
    }

    return {
      success: true,
      sentCount: response.successCount,
      failureCount: response.failureCount,
    }
  } catch (err) {
    console.error(`[Push Notification] Không thể gửi thông báo tới user ${userId}:`, err.message)
    return { success: false, error: err.message }
  }
}

/**
 * Tạo thông báo In-app và tự động bắn Push Notification & WebSocket Realtime
 */
export async function notifyUser({ userId, title, content, type = 'system', link = null, metadata = null }) {
  if (!userId || !title || !content) return null

  try {
    // 1. Tạo bản ghi thông báo trong ứng dụng (In-app Notification)
    const inAppResult = await callDataApi('/internal/v1/notifications', {
      method: 'POST',
      body: {
        userId: String(userId),
        title,
        content,
        type,
        link,
        metadata,
      },
    })

    // 2. Phát sự kiện WebSocket Realtime cho người dùng nếu đang online
    broadcastToUser(userId, {
      type: 'new_notification',
      notification: inAppResult,
    })

    // 3. Bắn FCM Push Notification tới thiết bị người dùng (chạy background, không chặn response)
    sendPushNotification({
      userId,
      title,
      body: content,
      data: {
        type,
        notificationId: inAppResult?.id ? String(inAppResult.id) : '',
        ...(metadata || {}),
      },
      link,
    }).catch(() => {})

    return inAppResult
  } catch (err) {
    console.error(`[Notification Service] Lỗi tạo thông báo cho user ${userId}:`, err.message)
    return null
  }
}
