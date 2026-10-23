import { executeQuery } from '../config/database.js'

/**
 * Chuẩn hóa đối tượng Voucher thành định dạng JSON chuẩn theo hợp đồng API.
 */
function formatVoucher(row) {
  return {
    id: String(row.id),
    code: row.code,
    name: row.name,
    discountAmount: Number(row.discount_amount),
    minSubtotal: Number(row.min_subtotal) || 0,
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    usageLimit: row.usage_limit !== null && row.usage_limit !== undefined ? Number(row.usage_limit) : null,
    perUserLimit: Number(row.per_user_limit) || 1,
    usedCount: Number(row.used_count) || 0,
    isActive: Boolean(row.is_active),
  }
}

/**
 * GET /internal/v1/vouchers
 * Lấy danh sách các mã giảm giá đang hoạt động và còn hiệu lực.
 */
export async function getVouchers(req, res, next) {
  try {
    const { code } = req.query || {}

    let sql = `
      SELECT id, code, name, discount_amount, min_subtotal, starts_at, ends_at,
             usage_limit, per_user_limit, used_count, is_active
      FROM vouchers
      WHERE is_active = 1
        AND starts_at <= NOW()
        AND ends_at > NOW()
    `
    const params = []

    if (code && typeof code === 'string' && code.trim().length > 0) {
      sql += ' AND code = ?'
      params.push(code.trim().toUpperCase())
    }

    sql += ' ORDER BY discount_amount DESC, id ASC'

    const rows = await executeQuery(sql, params)
    const vouchers = rows.map(formatVoucher)

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách mã giảm giá thành công.',
      data: vouchers,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /internal/v1/vouchers/:code
 * Tra cứu chi tiết một mã giảm giá cụ thể theo mã (code).
 */
export async function getVoucherByCode(req, res, next) {
  try {
    const { code } = req.params || {}

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mã giảm giá không hợp lệ.',
        error: { code: 'INVALID_CODE' },
      })
    }

    const sql = `
      SELECT id, code, name, discount_amount, min_subtotal, starts_at, ends_at,
             usage_limit, per_user_limit, used_count, is_active
      FROM vouchers
      WHERE code = ?
      LIMIT 1
    `
    const rows = await executeQuery(sql, [code.trim().toUpperCase()])

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy mã giảm giá.',
        error: { code: 'VOUCHER_NOT_FOUND' },
      })
    }

    const voucher = formatVoucher(rows[0])

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin mã giảm giá thành công.',
      data: voucher,
    })
  } catch (err) {
    next(err)
  }
}
