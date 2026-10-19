import { executeQuery, executeTransaction } from '../config/database.js'

/**
 * Định dạng đối tượng địa chỉ trả về.
 */
function formatAddress(row) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    recipientName: row.recipient_name,
    phone: row.phone,
    province: row.province,
    district: row.district || null,
    ward: row.ward || null,
    detail: row.detail,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }
}

/**
 * PUT /internal/v1/users/:userId/profile
 * Cập nhật thông tin hồ sơ người dùng.
 */
export async function updateProfile(req, res, next) {
  try {
    const { userId } = req.params
    const { fullName, phone, email, avatarUrl } = req.body || {}

    if (!userId || !/^\d+$/.test(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã tài khoản không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    const numericUserId = BigInt(userId)

    // Kiểm tra user tồn tại
    const userRows = await executeQuery('SELECT id, email FROM users WHERE id = ? LIMIT 1', [numericUserId])
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
        error: { code: 'USER_NOT_FOUND' },
      })
    }

    const updates = []
    const params = []

    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim().length === 0 || fullName.trim().length > 120) {
        return res.status(400).json({
          success: false,
          message: 'Họ tên không hợp lệ (tối đa 120 ký tự).',
          error: { code: 'INVALID_FULLNAME' },
        })
      }
      updates.push('full_name = ?')
      params.push(fullName.trim())
    }

    if (phone !== undefined) {
      const cleanPhone = phone ? String(phone).trim().slice(0, 20) : null
      updates.push('phone = ?')
      params.push(cleanPhone)
    }

    if (avatarUrl !== undefined) {
      const cleanAvatar = avatarUrl ? String(avatarUrl).trim().slice(0, 1024) : null
      updates.push('avatar_url = ?')
      params.push(cleanAvatar)
    }

    if (email !== undefined) {
      const cleanEmail = email && typeof email === 'string' && email.trim().length > 0 ? email.trim().toLowerCase() : null
      if (cleanEmail) {
        // Kiểm tra email có trùng với user khác không
        const dupRows = await executeQuery('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [cleanEmail, numericUserId])
        if (dupRows && dupRows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Email đã được sử dụng bởi tài khoản khác.',
            error: { code: 'EMAIL_EXISTS' },
          })
        }
      }
      updates.push('email = ?')
      params.push(cleanEmail)
    }

    if (updates.length > 0) {
      const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
      params.push(numericUserId)
      await executeQuery(sql, params)
    }

    // Lấy lại thông tin user mới nhất
    const updatedUserRows = await executeQuery(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.avatar_url, u.role, u.status, s.id AS shop_id
       FROM users u
       LEFT JOIN shops s ON s.owner_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [numericUserId],
    )
    const u = updatedUserRows[0]

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin hồ sơ thành công.',
      data: {
        user: {
          id: String(u.id),
          username: u.username,
          fullName: u.full_name,
          email: u.email || null,
          phone: u.phone || null,
          avatarUrl: u.avatar_url || null,
          role: u.role,
          status: u.status,
          shopId: u.shop_id ? String(u.shop_id) : null,
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /internal/v1/users/:userId/addresses
 * Lấy danh sách sổ địa chỉ nhận hàng của người dùng.
 */
export async function getAddresses(req, res, next) {
  try {
    const { userId } = req.params

    if (!userId || !/^\d+$/.test(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã tài khoản không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    const numericUserId = BigInt(userId)
    const sql = `
      SELECT id, user_id, recipient_name, phone, province, district, ward, detail, is_default, created_at, updated_at
      FROM addresses
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY is_default DESC, id DESC
    `

    const rows = await executeQuery(sql, [numericUserId])
    const addresses = rows.map(formatAddress)

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách địa chỉ nhận hàng thành công.',
      data: addresses,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /internal/v1/users/:userId/addresses
 * Thêm địa chỉ nhận hàng mới.
 */
export async function createAddress(req, res, next) {
  try {
    const { userId } = req.params
    const { recipientName, phone, province, district, ward, detail, isDefault = false } = req.body || {}

    if (!userId || !/^\d+$/.test(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã tài khoản không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    if (!recipientName || !phone || !province || !detail) {
      return res.status(400).json({
        success: false,
        message: 'Họ tên, số điện thoại, tỉnh thành và địa chỉ chi tiết không được để trống.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const numericUserId = BigInt(userId)

    const createdAddress = await executeTransaction(async (query) => {
      // Đếm số lượng địa chỉ hiện có chưa xóa
      const countRows = await query(
        'SELECT COUNT(*) AS total FROM addresses WHERE user_id = ? AND deleted_at IS NULL',
        [numericUserId],
      )
      const count = Number(countRows[0]?.total || 0)

      // Nếu là địa chỉ đầu tiên hoặc isDefault = true -> set default
      const willBeDefault = isDefault || count === 0

      if (willBeDefault) {
        await query(
          'UPDATE addresses SET is_default = 0 WHERE user_id = ? AND deleted_at IS NULL',
          [numericUserId],
        )
      }

      const insertSql = `
        INSERT INTO addresses (user_id, recipient_name, phone, province, district, ward, detail, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      const result = await query(insertSql, [
        numericUserId,
        recipientName.trim().slice(0, 120),
        phone.trim().slice(0, 20),
        province.trim().slice(0, 120),
        district ? district.trim().slice(0, 120) : null,
        ward ? ward.trim().slice(0, 120) : null,
        detail.trim().slice(0, 255),
        willBeDefault ? 1 : 0,
      ])

      const newId = result.insertId
      const selectRows = await query(
        'SELECT id, user_id, recipient_name, phone, province, district, ward, detail, is_default, created_at, updated_at FROM addresses WHERE id = ?',
        [newId],
      )

      return formatAddress(selectRows[0])
    })

    return res.status(201).json({
      success: true,
      message: 'Thêm địa chỉ nhận hàng thành công.',
      data: createdAddress,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /internal/v1/users/:userId/addresses/:addressId/default
 * Đặt địa chỉ làm mặc định.
 */
export async function setDefaultAddress(req, res, next) {
  try {
    const { userId, addressId } = req.params

    if (!userId || !/^\d+$/.test(String(userId)) || !addressId || !/^\d+$/.test(String(addressId))) {
      return res.status(400).json({
        success: false,
        message: 'Tham số không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    const numericUserId = BigInt(userId)
    const numericAddressId = BigInt(addressId)

    const updated = await executeTransaction(async (query) => {
      // Kiểm tra địa chỉ tồn tại và thuộc quyền sở hữu
      const checkRows = await query(
        'SELECT id FROM addresses WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
        [numericAddressId, numericUserId],
      )

      if (!checkRows || checkRows.length === 0) {
        const err = new Error('Không tìm thấy địa chỉ nhận hàng.')
        err.status = 404
        err.code = 'ADDRESS_NOT_FOUND'
        throw err
      }

      // Xóa cờ mặc định của tất cả địa chỉ cũ
      await query(
        'UPDATE addresses SET is_default = 0 WHERE user_id = ? AND deleted_at IS NULL',
        [numericUserId],
      )

      // Bật cờ mặc định cho địa chỉ được chọn
      await query('UPDATE addresses SET is_default = 1 WHERE id = ?', [numericAddressId])

      const rows = await query(
        'SELECT id, user_id, recipient_name, phone, province, district, ward, detail, is_default, created_at, updated_at FROM addresses WHERE id = ?',
        [numericAddressId],
      )
      return formatAddress(rows[0])
    })

    return res.status(200).json({
      success: true,
      message: 'Đặt địa chỉ mặc định thành công.',
      data: updated,
    })
  } catch (err) {
    if (err.status && err.code) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        error: { code: err.code },
      })
    }
    next(err)
  }
}

/**
 * DELETE /internal/v1/users/:userId/addresses/:addressId
 * Xóa mềm địa chỉ nhận hàng.
 */
export async function deleteAddress(req, res, next) {
  try {
    const { userId, addressId } = req.params

    if (!userId || !/^\d+$/.test(String(userId)) || !addressId || !/^\d+$/.test(String(addressId))) {
      return res.status(400).json({
        success: false,
        message: 'Tham số không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    const numericUserId = BigInt(userId)
    const numericAddressId = BigInt(addressId)

    await executeTransaction(async (query) => {
      // Kiểm tra địa chỉ tồn tại
      const checkRows = await query(
        'SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
        [numericAddressId, numericUserId],
      )

      if (!checkRows || checkRows.length === 0) {
        const err = new Error('Không tìm thấy địa chỉ cần xóa.')
        err.status = 404
        err.code = 'ADDRESS_NOT_FOUND'
        throw err
      }

      const wasDefault = Boolean(checkRows[0].is_default)

      // Xóa mềm: gán is_default = 0 và deleted_at = NOW()
      await query(
        'UPDATE addresses SET is_default = 0, deleted_at = NOW(3) WHERE id = ?',
        [numericAddressId],
      )

      // Nếu địa chỉ bị xóa là mặc định, tự động gán địa chỉ còn lại mới nhất làm mặc định
      if (wasDefault) {
        const nextRows = await query(
          'SELECT id FROM addresses WHERE user_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1',
          [numericUserId],
        )
        if (nextRows && nextRows.length > 0) {
          await query('UPDATE addresses SET is_default = 1 WHERE id = ?', [nextRows[0].id])
        }
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Xóa địa chỉ nhận hàng thành công.',
      data: { deleted: true },
    })
  } catch (err) {
    if (err.status && err.code) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        error: { code: err.code },
      })
    }
    next(err)
  }
}
