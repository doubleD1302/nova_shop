import { executeQuery, executeTransaction, hasColumn } from '../config/database.js'

// Áp giá khuyến mãi của chiến dịch vào sản phẩm đã được duyệt và trả giá gốc khi chiến dịch kết thúc.
//
// - Áp giá: đăng ký `approved`, chiến dịch đang bật và đang chạy (starts_at <= bây giờ < ends_at).
//   Mỗi biến thể đang bán có giá cao hơn `discount_price` được hạ xuống `discount_price`; giá cũ thành giá gạch ngang
//   (`original_price`, giữ giá gạch ngang cũ nếu có). Chiến dịch flash_sale còn bật `products.is_flash_sale`.
// - Hoàn giá: chiến dịch bị tắt hoặc đã kết thúc. Chỉ trả biến thể còn đúng giá khuyến mãi, tức shop chưa tự đổi giá.
// - Giá cũ nằm trong `price_snapshot` của đăng ký để hoàn lại chính xác.
// - Một sản phẩm chỉ chịu một đăng ký đang áp giá; đăng ký khác chờ đến khi đăng ký trước được hoàn giá.
// Hàm idempotent: gọi nhiều lần hoặc từ nhiều nơi (duyệt, sửa chiến dịch, cron) không áp hai lần.

const BATCH = 100

const LOAD_REGISTRATION = `
  SELECT r.id, r.product_id, r.discount_price, r.status, r.applied_at, r.reverted_at, r.price_snapshot,
         c.type AS campaign_type,
         (c.is_active = 1 AND c.starts_at <= UTC_TIMESTAMP(3) AND c.ends_at > UTC_TIMESTAMP(3)) AS running,
         (c.is_active = 0 OR c.ends_at <= UTC_TIMESTAMP(3)) AS finished,
         p.status AS product_status, p.approval_status AS product_approval, p.is_flash_sale
  FROM campaign_registrations r
  JOIN marketing_campaigns c ON c.id = r.campaign_id
  JOIN products p ON p.id = r.product_id
  WHERE r.id = ? FOR UPDATE`

const isApplied = (reg) => reg.applied_at !== null && reg.applied_at !== undefined && (reg.reverted_at === null || reg.reverted_at === undefined)

async function applyOne(query, id) {
  const [reg] = await query(LOAD_REGISTRATION, [id])
  if (!reg || reg.status !== 'approved' || !Number(reg.running) || isApplied(reg)) return 'skipped'
  if (reg.product_status !== 'active' || reg.product_approval !== 'approved') return 'skipped'

  const others = await query(
    'SELECT id FROM campaign_registrations WHERE product_id = ? AND id <> ? AND applied_at IS NOT NULL AND reverted_at IS NULL LIMIT 1',
    [reg.product_id, id],
  )
  if (others.length) return 'skipped'

  const discount = Number(reg.discount_price)
  const variants = await query('SELECT id, price, original_price FROM product_variants WHERE product_id = ? AND is_active = 1 FOR UPDATE', [reg.product_id])
  const changed = variants.filter((variant) => Number(variant.price) > discount)
  const snapshot = {
    variants: changed.map((variant) => ({
      id: String(variant.id),
      price: Number(variant.price),
      originalPrice: variant.original_price === null ? null : Number(variant.original_price),
    })),
    flash: null,
  }
  for (const variant of snapshot.variants) {
    // Giữ giá gạch ngang cũ nếu có; không thì giá đang bán trước khi giảm trở thành giá gạch ngang
    await query('UPDATE product_variants SET price = ?, original_price = ? WHERE id = ?', [discount, variant.originalPrice ?? variant.price, variant.id])
  }
  if (changed.length && reg.campaign_type === 'flash_sale') {
    snapshot.flash = Number(reg.is_flash_sale) ? 1 : 0
    if (!snapshot.flash) await query('UPDATE products SET is_flash_sale = 1 WHERE id = ?', [reg.product_id])
  }
  await query('UPDATE campaign_registrations SET price_snapshot = ?, applied_at = UTC_TIMESTAMP(3), reverted_at = NULL WHERE id = ?', [JSON.stringify(snapshot), id])
  return 'done'
}

function readSnapshot(text) {
  try {
    const value = JSON.parse(text || '{}')
    return { variants: Array.isArray(value.variants) ? value.variants : [], flash: value.flash }
  } catch {
    return { variants: [], flash: null }
  }
}

async function revertOne(query, id) {
  const [reg] = await query(LOAD_REGISTRATION, [id])
  if (!reg || !isApplied(reg) || !Number(reg.finished)) return 'skipped'

  const snapshot = readSnapshot(reg.price_snapshot)
  for (const variant of snapshot.variants) {
    // Chỉ trả khi giá vẫn đúng giá khuyến mãi; nếu shop đã đổi giá thì giữ giá shop đặt
    await query('UPDATE product_variants SET price = ?, original_price = ? WHERE id = ? AND price = ?',
      [variant.price, variant.originalPrice, variant.id, Number(reg.discount_price)])
  }
  if (snapshot.flash === 0) {
    const stillFlash = await query(
      `SELECT o.id FROM campaign_registrations o JOIN marketing_campaigns oc ON oc.id = o.campaign_id
       WHERE o.product_id = ? AND o.id <> ? AND o.applied_at IS NOT NULL AND o.reverted_at IS NULL AND oc.type = 'flash_sale' LIMIT 1`,
      [reg.product_id, id],
    )
    if (!stillFlash.length) await query('UPDATE products SET is_flash_sale = 0 WHERE id = ?', [reg.product_id])
  }
  await query('UPDATE campaign_registrations SET reverted_at = UTC_TIMESTAMP(3) WHERE id = ?', [id])
  return 'done'
}

/**
 * Hoàn giá các chiến dịch đã hết hạn hoặc bị tắt rồi áp giá các chiến dịch đang chạy.
 * Trả { applied, reverted } hoặc { skipped: true } nếu migration cột mới chưa được áp dụng.
 * Mỗi đăng ký chạy trong transaction riêng; lỗi một đăng ký không chặn các đăng ký còn lại.
 */
export async function syncCampaignPrices({ query = executeQuery, transaction = executeTransaction, checkMigration = true } = {}) {
  if (checkMigration && !(await hasColumn('campaign_registrations', 'applied_at', query))) {
    return { skipped: true, reason: 'MIGRATION_PENDING', applied: 0, reverted: 0 }
  }
  const result = { applied: 0, reverted: 0, failed: 0 }

  const toRevert = await query(
    `SELECT r.id FROM campaign_registrations r JOIN marketing_campaigns c ON c.id = r.campaign_id
     WHERE r.applied_at IS NOT NULL AND r.reverted_at IS NULL AND (c.is_active = 0 OR c.ends_at <= UTC_TIMESTAMP(3))
     ORDER BY r.id LIMIT ${BATCH}`,
  )
  const toApply = await query(
    `SELECT r.id FROM campaign_registrations r JOIN marketing_campaigns c ON c.id = r.campaign_id
     WHERE r.status = 'approved' AND (r.applied_at IS NULL OR r.reverted_at IS NOT NULL)
       AND c.is_active = 1 AND c.starts_at <= UTC_TIMESTAMP(3) AND c.ends_at > UTC_TIMESTAMP(3)
     ORDER BY r.id LIMIT ${BATCH}`,
  )

  // Hoàn giá trước để sản phẩm được giải phóng cho đăng ký khác
  for (const [rows, step, key] of [[toRevert, revertOne, 'reverted'], [toApply, applyOne, 'applied']]) {
    for (const row of rows) {
      try {
        if (await transaction((run) => step(run, String(row.id))) === 'done') result[key] += 1
      } catch (err) {
        result.failed += 1
        console.error(`[Campaign Pricing] Đăng ký ${row.id} lỗi:`, err.message)
      }
    }
  }
  return result
}
