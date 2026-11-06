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
