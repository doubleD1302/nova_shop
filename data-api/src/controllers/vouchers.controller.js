import { executeQuery, executeTransaction } from '../config/database.js'

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
const invalid = (res) => res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })

export async function listWallet(req, res, next) {
  try {
    const { userId, page = '1' } = req.query
    if (!validId(userId) || typeof page !== 'string' || !/^[1-9]\d{0,3}$/.test(page)) return invalid(res)
    const rows = await executeQuery(
      `SELECT v.id, v.code, v.name, v.discount_amount, v.min_subtotal, v.starts_at, v.ends_at,
        v.is_active, v.usage_limit, v.used_count, v.per_user_limit, w.saved_at,
        (SELECT COUNT(*) FROM voucher_uses u WHERE u.voucher_id = v.id AND u.buyer_id = w.user_id AND u.state = 'applied') AS user_uses,
        (v.starts_at <= UTC_TIMESTAMP(3)) AS started, (v.ends_at <= UTC_TIMESTAMP(3)) AS expired
       FROM voucher_wallet w JOIN vouchers v ON v.id = w.voucher_id
       WHERE w.user_id = ? ORDER BY w.saved_at DESC, v.id DESC LIMIT 21 OFFSET ?`,
      [userId, (Number(page) - 1) * 20],
    )
    const items = rows.slice(0, 20).map((row) => ({
      id: String(row.id), code: row.code, name: row.name,
      discountAmount: Number(row.discount_amount), minSubtotal: Number(row.min_subtotal),
      startsAt: new Date(row.starts_at).toISOString(), endsAt: new Date(row.ends_at).toISOString(),
      savedAt: new Date(row.saved_at).toISOString(),
      status: !row.is_active ? 'inactive' : row.expired ? 'expired' : !row.started ? 'upcoming' :
        Number(row.user_uses) >= Number(row.per_user_limit) ? 'used' :
        row.usage_limit !== null && Number(row.used_count) >= Number(row.usage_limit) ? 'exhausted' : 'available',
    }))
    return res.json({ success: true, data: { items, page: Number(page), hasMore: rows.length > 20 } })
  } catch (err) { return next(err) }
}

export async function saveVoucher(req, res, next) {
  try {
    const { userId, code } = req.body || {}
    if (!validId(userId) || typeof code !== 'string' || !/^[A-Z0-9_-]{1,32}$/.test(code)) return invalid(res)
    const result = await executeTransaction(async (query) => {
      const rows = await query(`SELECT id FROM vouchers WHERE code = ? AND is_active = 1
        AND starts_at <= UTC_TIMESTAMP(3) AND ends_at > UTC_TIMESTAMP(3)
        AND (usage_limit IS NULL OR used_count < usage_limit) FOR UPDATE`, [code])
      if (!rows.length) return null
      const existing = await query('SELECT voucher_id FROM voucher_wallet WHERE user_id = ? AND voucher_id = ?', [userId, rows[0].id])
      if (existing.length) return { code, saved: false }
      await query('INSERT INTO voucher_wallet (user_id, voucher_id) VALUES (?, ?)', [userId, rows[0].id])
      return { code, saved: true }
    })
    if (!result) return res.status(404).json({ success: false, message: 'Voucher không tồn tại hoặc không thể lưu.', error: { code: 'VOUCHER_UNAVAILABLE' } })
    return res.json({ success: true, data: result })
  } catch (err) { return next(err) }
}

export async function listPublicVouchers(req, res, next) {
  try {
    const rows = await executeQuery(
      `SELECT id, code, name, discount_amount, min_subtotal, starts_at, ends_at, usage_limit, per_user_limit, used_count
       FROM vouchers
       WHERE is_active = 1 AND (ends_at IS NULL OR ends_at > UTC_TIMESTAMP(3))
       ORDER BY discount_amount DESC, id DESC LIMIT 50`
    );
    const vouchers = rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      discountAmount: Number(r.discount_amount),
      minSubtotal: Number(r.min_subtotal),
      startsAt: r.starts_at ? new Date(r.starts_at).toISOString() : null,
      endsAt: r.ends_at ? new Date(r.ends_at).toISOString() : null,
      usageLimit: r.usage_limit,
      perUserLimit: r.per_user_limit,
      usedCount: r.used_count,
    }));
    return res.status(200).json({ success: true, data: vouchers });
  } catch (err) {
    return next(err);
  }
}

/**
 * Lấy danh sách mã giảm giá của gian hàng
 */
export async function listSellerVouchers(req, res, next) {
  try {
    const { shopId } = req.query
    if (!validId(shopId)) return invalid(res)

    const rows = await executeQuery(
      `SELECT id, shop_id, code, name, discount_amount, min_subtotal, starts_at, ends_at,
              usage_limit, per_user_limit, used_count, is_active, created_at
       FROM vouchers
       WHERE shop_id = ?
       ORDER BY id DESC`,
      [shopId]
    )

    const items = rows.map((r) => ({
      id: String(r.id),
      shopId: String(r.shop_id),
      code: r.code,
      name: r.name,
      discountAmount: Number(r.discount_amount),
      minSubtotal: Number(r.min_subtotal),
      startsAt: new Date(r.starts_at).toISOString(),
      endsAt: new Date(r.ends_at).toISOString(),
      usageLimit: r.usage_limit ? Number(r.usage_limit) : null,
      perUserLimit: Number(r.per_user_limit),
      usedCount: Number(r.used_count),
      isActive: Boolean(r.is_active),
      createdAt: new Date(r.created_at).toISOString(),
    }))

    return res.status(200).json({ success: true, data: { items } })
  } catch (err) {
    return next(err)
  }
}

/**
 * Tạo mã giảm giá mới cho gian hàng
 */
export async function createSellerVoucher(req, res, next) {
  try {
    const {
      shopId,
      code,
      name,
      discountAmount,
      minSubtotal = 0,
      startsAt,
      endsAt,
      usageLimit = null,
      perUserLimit = 1,
    } = req.body || {}

    if (!validId(shopId)) return invalid(res)
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{3,32}$/.test(code.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Mã voucher phải từ 3 đến 32 ký tự chữ hoặc số.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Tên chương trình voucher không được để trống và tối đa 120 ký tự.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }
    if (typeof discountAmount !== 'number' || isNaN(discountAmount) || discountAmount <= 0 || !Number.isSafeInteger(discountAmount)) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền giảm giá phải lớn hơn 0 VND.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }
    if (typeof minSubtotal !== 'number' || isNaN(minSubtotal) || minSubtotal < 0 || !Number.isSafeInteger(minSubtotal)) {
      return res.status(400).json({
        success: false,
        message: 'Giá trị đơn tối thiểu không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const start = startsAt ? new Date(startsAt) : new Date()
    const end = endsAt ? new Date(endsAt) : new Date(Date.now() + 30 * 24 * 3600 * 1000)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian kết thúc voucher phải sau thời gian bắt đầu.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const normCode = code.trim().toUpperCase()

    // Kiểm tra trùng mã
    const existing = await executeQuery('SELECT id FROM vouchers WHERE code = ?', [normCode])
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Mã voucher "${normCode}" đã tồn tại trên hệ thống. Vui lòng chọn mã khác.`,
        error: { code: 'VOUCHER_CODE_EXISTS' },
      })
    }

    const insertResult = await executeQuery(
      `INSERT INTO vouchers
       (shop_id, code, name, discount_amount, min_subtotal, starts_at, ends_at, usage_limit, per_user_limit, used_count, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [
        shopId,
        normCode,
        name.trim(),
        discountAmount,
        minSubtotal,
        start,
        end,
        usageLimit ? Number(usageLimit) : null,
        perUserLimit ? Number(perUserLimit) : 1,
      ]
    )

    return res.status(201).json({
      success: true,
      message: 'Tạo mã giảm giá cho gian hàng thành công.',
      data: {
        id: String(insertResult.insertId),
        shopId: String(shopId),
        code: normCode,
        name: name.trim(),
        discountAmount,
        minSubtotal,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        isActive: true,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Cập nhật trạng thái bật/tắt mã giảm giá của gian hàng
 */
export async function updateSellerVoucherStatus(req, res, next) {
  try {
    const voucherId = req.params.id
    const { shopId, isActive } = req.body || {}

    if (!validId(voucherId) || !validId(shopId) || typeof isActive !== 'boolean') {
      return invalid(res)
    }

    const rows = await executeQuery('SELECT id, shop_id FROM vouchers WHERE id = ?', [voucherId])
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.', error: { code: 'NOT_FOUND' } })
    }

    if (String(rows[0].shop_id) !== String(shopId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa voucher của shop khác.', error: { code: 'FORBIDDEN' } })
    }

    await executeQuery('UPDATE vouchers SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, voucherId])

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái voucher thành công.',
      data: { id: String(voucherId), isActive },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Xóa voucher của shop nếu chưa có ai sử dụng
 */
export async function deleteSellerVoucher(req, res, next) {
  try {
    const voucherId = req.params.id
    const { shopId } = req.query

    if (!validId(voucherId) || !validId(shopId)) return invalid(res)

    const rows = await executeQuery('SELECT id, shop_id, used_count FROM vouchers WHERE id = ?', [voucherId])
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.', error: { code: 'NOT_FOUND' } })
    }

    if (String(rows[0].shop_id) !== String(shopId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa voucher của shop khác.', error: { code: 'FORBIDDEN' } })
    }

    if (Number(rows[0].used_count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Mã voucher đã phát sinh lượt sử dụng, không thể xóa. Bạn chỉ có thể tắt trạng thái hoạt động.',
        error: { code: 'VOUCHER_ALREADY_USED' },
      })
    }

    await executeTransaction(async (query) => {
      await query('DELETE FROM voucher_wallet WHERE voucher_id = ?', [voucherId])
      await query('DELETE FROM vouchers WHERE id = ?', [voucherId])
    })

    return res.status(200).json({
      success: true,
      message: 'Đã xóa mã voucher thành công.',
      data: { id: String(voucherId) },
    })
  } catch (err) {
    return next(err)
  }
}
