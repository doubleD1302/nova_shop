import { callDataApi } from '../clients/data.client.js'

const validId = (value) =>
  (typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))) &&
  /^[1-9]\d{0,19}$/.test(String(value))

/**
 * Lấy danh sách thông báo in-app của người dùng hiện tại
 */
export async function listMyNotifications(req, res, next) {
  try {
    const params = new URLSearchParams({
      userId: String(req.user.id),
    })

    for (const key of ['page', 'limit', 'isRead', 'type']) {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        params.set(key, String(req.query[key]))
      }
    }

    const result = await callDataApi(`/internal/v1/notifications?${params}`)

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách thông báo thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Đánh dấu một thông báo là đã đọc
 */
export async function markNotificationRead(req, res, next) {
  try {
    const id = req.params.id

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Mã thông báo không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi(`/internal/v1/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
      body: {
        userId: String(req.user.id),
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Đánh dấu thông báo đã đọc thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Đánh dấu tất cả thông báo của người dùng là đã đọc
 */
export async function markAllNotificationsRead(req, res, next) {
  try {
    const result = await callDataApi('/internal/v1/notifications/read-all', {
      method: 'PATCH',
      body: {
        userId: String(req.user.id),
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Đăng ký / cập nhật device token (FCM/Web Push)
 */
export async function registerDeviceToken(req, res, next) {
  try {
    const { token, deviceType = 'web' } = req.body || {}

    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Token thiết bị không được để trống.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi('/internal/v1/notifications/device-token', {
      method: 'POST',
      body: {
        userId: String(req.user.id),
        token: token.trim(),
        deviceType,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Đăng ký token thiết bị nhận thông báo thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Xóa device token khi người dùng đăng xuất
 */
export async function unregisterDeviceToken(req, res, next) {
  try {
    const { token } = req.body || {}

    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Token thiết bị không được để trống.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi('/internal/v1/notifications/device-token', {
      method: 'DELETE',
      body: {
        userId: String(req.user.id),
        token: token.trim(),
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Hủy đăng ký token thiết bị thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}
