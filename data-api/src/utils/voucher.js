export async function evaluateVoucher(query, { voucherCode, userId, subtotal, lock = false }) {
  if (!voucherCode) return { voucher: null, discountAmount: 0 }
  const vouchers = await query(
    `SELECT id, discount_amount, min_subtotal, usage_limit, per_user_limit, used_count
     FROM vouchers
     WHERE code = ? AND is_active = 1 AND starts_at <= UTC_TIMESTAMP(3) AND ends_at > UTC_TIMESTAMP(3)${lock ? ' FOR UPDATE' : ''}`,
    [voucherCode],
  )
  if (!vouchers.length) return { error: 'VOUCHER_INVALID' }
  const voucher = vouchers[0]
  const usage = await query(
    `SELECT COUNT(*) AS used FROM voucher_uses WHERE voucher_id = ? AND buyer_id = ? AND state = 'applied'`,
    [voucher.id, userId],
  )
  if (subtotal < Number(voucher.min_subtotal) ||
      (voucher.usage_limit !== null && Number(voucher.used_count) >= Number(voucher.usage_limit)) ||
      Number(usage[0].used) >= Number(voucher.per_user_limit)) return { error: 'VOUCHER_UNAVAILABLE' }
  const discountAmount = Math.min(Number(voucher.discount_amount), subtotal)
  return { voucher: discountAmount ? voucher : null, discountAmount }
}
