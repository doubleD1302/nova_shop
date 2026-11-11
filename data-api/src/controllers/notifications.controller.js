import { executeQuery, executeTransaction } from '../config/database.js'

const validId = (value) =>
  (typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))) &&
  /^[1-9]\d{0,19}$/.test(String(value))

const responseError = (res, status, code, message) =>
  res.status(status).json({ success: false, message, error: { code } })

/**
 * Lấy danh sách thông báo của người dùng kèm số lượng chưa đọc
 */
export async function listNotifications(req, res, next) {
  try {
    const { userId, page = '1', limit = '20', isRead, type } = req.query

    if (!validId(userId)) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Mã người dùng không hợp lệ.')
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const offset = (pageNum - 1) * limitNum

    const whereClauses = ['user_id = ?']
    const params = [userId]

    if (isRead !== undefined && isRead !== '') {
      const boolVal = isRead === 'true' || isRead === '1' || isRead === true ? 1 : 0
      whereClauses.push('is_read = ?')
      params.push(boolVal)
    }

    if (typeof type === 'string' && type.trim()) {
      whereClauses.push('type = ?')
      params.push(type.trim())
    }

    const whereSql = whereClauses.join(' AND ')

    // 1. Đếm số thông báo chưa đọc toàn bộ của user
    const [unreadRow] = await executeQuery(
      `SELECT COUNT(*) AS unreadCount FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId],
    )
    const unreadCount = Number(unreadRow?.unreadCount || 0)

    // 2. Lấy danh sách thông báo phân trang
    const rows = await executeQuery(
      `SELECT id, user_id, title, content, type, link, is_read, read_at, metadata, created_at
       FROM notifications
       WHERE ${whereSql}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset],
    )

    let total = rows.length
    if (rows.length === limitNum || offset > 0) {
      const [countRow] = await executeQuery(
        `SELECT COUNT(*) AS total FROM notifications WHERE ${whereSql}`,
        params,
      )
      total = Number(countRow?.total || 0)
    }

    const items = rows.map((r) => {
      let parsedMeta = null
      if (r.metadata) {
        try {
          parsedMeta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata
        } catch {
          parsedMeta = r.metadata
        }
      }
      return {
        id: String(r.id),
        userId: String(r.user_id),
        title: r.title,
        content: r.content,
        type: r.type,
        link: r.link || null,
        isRead: Boolean(r.is_read),
        readAt: r.read_at ? new Date(r.read_at).toISOString() : null,
        metadata: parsedMeta,
        createdAt: new Date(r.created_at).toISOString(),
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách thông báo thành công.',
      data: {
        items,
        unreadCount,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
        },
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Đánh dấu một thông báo cụ thể là đã đọc
 */
export async function markNotificationAsRead(req, res, next) {
  try {
    const id = req.params.id
    const { userId } = req.body || {}

    if (!validId(id) || !validId(userId)) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Thông tin định danh không hợp lệ.')
    }

    const result = await executeQuery(
      `UPDATE notifications
       SET is_read = 1, read_at = UTC_TIMESTAMP(3)
       WHERE id = ? AND user_id = ? AND is_read = 0`,
      [id, userId],
    )

    if (result.affectedRows === 0) {
      // Kiểm tra xem thông báo có tồn tại hay không
      const existing = await executeQuery(
        'SELECT id, is_read FROM notifications WHERE id = ? AND user_id = ?',
        [id, userId],
      )
      if (existing.length === 0) {
        return responseError(res, 404, 'NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo.')
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Đánh dấu thông báo đã đọc thành công.',
      data: { id: String(id), isRead: true },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Đánh dấu tất cả thông báo của người dùng là đã đọc
 */
export async function markAllNotificationsAsRead(req, res, next) {
  try {
    const { userId } = req.body || {}

    if (!validId(userId)) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Mã người dùng không hợp lệ.')
    }

    const result = await executeQuery(
      `UPDATE notifications
       SET is_read = 1, read_at = UTC_TIMESTAMP(3)
       WHERE user_id = ? AND is_read = 0`,
      [userId],
    )

    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc.',
      data: { updatedCount: result.affectedRows },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Tạo thông báo mới cho người dùng
 */
export async function createNotification(req, res, next) {
  try {
    const { userId, title, content, type = 'system', link = null, metadata = null } = req.body || {}

    if (!validId(userId)) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Mã người nhận không hợp lệ.')
    }
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 255) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Tiêu đề thông báo không hợp lệ (1-255 ký tự).')
    }
    if (typeof content !== 'string' || !content.trim()) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Nội dung thông báo không được để trống.')
    }

    const serializedMeta = metadata ? JSON.stringify(metadata) : null

    const insertResult = await executeQuery(
      `INSERT INTO notifications (user_id, title, content, type, link, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, title.trim(), content.trim(), String(type).trim().slice(0, 50), link ? String(link).slice(0, 255) : null, serializedMeta],
    )

    return res.status(201).json({
      success: true,
      message: 'Tạo thông báo thành công.',
      data: {
        id: String(insertResult.insertId),
        userId: String(userId),
        title: title.trim(),
        content: content.trim(),
        type,
        link: link || null,
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Đăng ký / cập nhật device token cho người dùng (FCM / Web Push)
 */
export async function registerDeviceToken(req, res, next) {
  try {
    const { userId, token, deviceType = 'web' } = req.body || {}

    if (!validId(userId) || typeof token !== 'string' || !token.trim()) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Thông tin token hoặc người dùng không hợp lệ.')
    }

    const cleanToken = token.trim().slice(0, 500)
    const validDeviceTypes = ['web', 'android', 'ios']
    const cleanDeviceType = validDeviceTypes.includes(deviceType) ? deviceType : 'web'

    await executeQuery(
      `INSERT INTO user_device_tokens (user_id, token, device_type, last_used_at)
       VALUES (?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE
         device_type = VALUES(device_type),
         last_used_at = UTC_TIMESTAMP(3),
         updated_at = UTC_TIMESTAMP(3)`,
      [userId, cleanToken, cleanDeviceType],
    )

    return res.status(200).json({
      success: true,
      message: 'Đăng ký token thiết bị thành công.',
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Lấy danh sách FCM device tokens của một người dùng
 */
export async function listDeviceTokens(req, res, next) {
  try {
    const { userId } = req.query
    if (!validId(userId)) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Mã người dùng không hợp lệ.')
    }

    const rows = await executeQuery(
      `SELECT token, device_type FROM user_device_tokens WHERE user_id = ?`,
      [userId],
    )

    return res.status(200).json({
      success: true,
      data: {
        tokens: rows.map((r) => r.token),
        devices: rows.map((r) => ({ token: r.token, deviceType: r.device_type })),
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Xóa device token khi người dùng đăng xuất hoặc token hết hiệu lực
 */
export async function removeDeviceToken(req, res, next) {
  try {
    const { userId, token } = req.body || {}
    if (typeof token !== 'string' || !token.trim()) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Token không được để trống.')
    }

    const params = [token.trim()]
    let sql = 'DELETE FROM user_device_tokens WHERE token = ?'

    if (userId && validId(userId)) {
      sql += ' AND user_id = ?'
      params.push(userId)
    }

    await executeQuery(sql, params)

    return res.status(200).json({
      success: true,
      message: 'Xóa token thiết bị thành công.',
    })
  } catch (err) {
    return next(err)
  }
}
