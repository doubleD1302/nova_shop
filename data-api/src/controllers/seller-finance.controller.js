import { executeQuery } from '../config/database.js'
import { readPagination } from '../utils/pagination.js'
import { readDateRange } from '../utils/date-range.js'

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
const invalid = (res, msg = 'Dữ liệu không hợp lệ.') =>
  res.status(400).json({ success: false, message: msg, error: { code: 'VALIDATION_ERROR' } })

const TYPES = ['order_income', 'refund', 'payout']

// Ba nguồn được gộp trong bộ nhớ nên chỉ cho xem tối đa 1000 dòng đầu.
const MAX_WINDOW = 1000

// Cùng quy tắc giữ tiền 7 ngày với số dư ở seller-payout.controller.js.
const HOLD_DAYS = 7

function isTableMissingError(err) {
  return err?.original?.code === 'ER_NO_SUCH_TABLE' ||
         err?.code === 'ER_NO_SUCH_TABLE' ||
         String(err?.message || '').includes("doesn't exist")
}

function addRange(where, params, column, range) {
  if (range.from) {
    where += ` AND ${column} >= ?`
    params.push(range.from)
  }
  if (range.to) {
    where += ` AND ${column} <= ?`
    params.push(range.to)
  }
  return where
}

// Tiền đơn đã giao/hoàn tất, cộng vào số dư. 'escrow' = còn đang giữ, 'available' = đã khả dụng.
async function readIncome(shopId, range, take) {
  const params = [shopId]
  const where = addRange("so.shop_id = ? AND so.status IN ('delivered', 'completed')", params, 'so.delivered_at', range)

  const counts = await executeQuery(`SELECT COUNT(*) AS total FROM shop_orders so WHERE ${where}`, params)
  const rows = await executeQuery(
    `SELECT so.id, o.code AS order_code, so.total_amount, so.delivered_at,
            (so.status = 'completed' OR so.delivered_at <= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ${HOLD_DAYS} DAY)) AS past_hold,
            EXISTS (SELECT 1 FROM order_returns ret
                    WHERE ret.shop_order_id = so.id AND ret.status IN ('requested', 'approved', 'disputed')) AS has_open_return
     FROM shop_orders so
     JOIN orders o ON o.id = so.order_id
     WHERE ${where}
     ORDER BY so.delivered_at DESC, so.id DESC
     LIMIT ?`,
    [...params, take],
  )

  return {
    total: Number(counts[0]?.total || 0),
    entries: rows.map((r) => ({
      id: `order_income-${r.id}`,
      type: 'order_income',
      reference: r.order_code,
      description: `Doanh thu đơn ${r.order_code}`,
      amount: Number(r.total_amount),
      status: Number(r.past_hold) === 1 && Number(r.has_open_return) === 0 ? 'available' : 'escrow',
      occurredAt: new Date(r.delivered_at).toISOString(),
    })),
  }
}

// Tiền hoàn cho người mua sau khi trả hàng hoàn tất, trừ khỏi số dư.
async function readRefunds(shopId, range, take) {
  const params = [shopId]
  const where = addRange("ret.shop_id = ? AND ret.status = 'completed'", params, 'ret.updated_at', range)

  const counts = await executeQuery(`SELECT COUNT(*) AS total FROM order_returns ret WHERE ${where}`, params)
  const rows = await executeQuery(
    `SELECT ret.id, ret.refund_amount, ret.updated_at, o.code AS order_code
     FROM order_returns ret
     JOIN shop_orders so ON so.id = ret.shop_order_id
     JOIN orders o ON o.id = so.order_id
     WHERE ${where}
     ORDER BY ret.updated_at DESC, ret.id DESC
     LIMIT ?`,
    [...params, take],
  )

  return {
    total: Number(counts[0]?.total || 0),
    entries: rows.map((r) => ({
      id: `refund-${r.id}`,
      type: 'refund',
      reference: r.order_code,
      description: `Hoàn tiền trả hàng đơn ${r.order_code}`,
      amount: -Number(r.refund_amount),
      status: 'completed',
      occurredAt: new Date(r.updated_at).toISOString(),
    })),
  }
}

// Lệnh rút tiền. Lệnh bị từ chối không làm mất tiền nên không đưa vào lịch sử giao dịch.
async function readPayouts(shopId, range, take) {
  const params = [shopId]
  const where = addRange("pr.shop_id = ? AND pr.status <> 'rejected'", params, 'pr.created_at', range)

  const counts = await executeQuery(`SELECT COUNT(*) AS total FROM seller_payout_requests pr WHERE ${where}`, params)
  const rows = await executeQuery(
    `SELECT pr.id, pr.payout_code, pr.amount, pr.status, pr.created_at
     FROM seller_payout_requests pr
     WHERE ${where}
     ORDER BY pr.created_at DESC, pr.id DESC
     LIMIT ?`,
    [...params, take],
  )

  return {
    total: Number(counts[0]?.total || 0),
    entries: rows.map((r) => ({
      id: `payout-${r.id}`,
      type: 'payout',
      reference: r.payout_code,
      description: `Rút tiền ${r.payout_code}`,
      amount: -Number(r.amount),
      status: r.status,
      occurredAt: new Date(r.created_at).toISOString(),
    })),
  }
}

/**
 * Lịch sử giao dịch của shop: tiền đơn hàng (+), hoàn tiền trả hàng (-) và rút tiền (-).
 * Số tiền dùng cùng cách tính với GET /seller/payout/balance để hai màn hình khớp nhau.
 */
export async function listSellerTransactions(req, res, next) {
  try {
    const { shopId, type } = req.query
    const page = readPagination(req.query)
    const range = readDateRange(req.query)
    if (!validId(shopId) || !page || !range ||
        (type !== undefined && type !== '' && !TYPES.includes(type))) {
      return invalid(res, 'Bộ lọc lịch sử giao dịch không hợp lệ.')
    }
    const { limit, offset } = page
    if (limit + offset > MAX_WINDOW) {
      return invalid(res, `Chỉ xem được tối đa ${MAX_WINDOW} giao dịch gần nhất; hãy thu hẹp khoảng ngày.`)
    }

    const shops = await executeQuery('SELECT id FROM shops WHERE id = ? LIMIT 1', [shopId])
    if (!shops.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng tương ứng.', error: { code: 'SHOP_NOT_FOUND' } })
    }

    const take = limit + offset
    const wanted = type ? [type] : TYPES
    const sources = []
    if (wanted.includes('order_income')) sources.push(await readIncome(shopId, range, take))
    if (wanted.includes('refund')) sources.push(await readRefunds(shopId, range, take))
    if (wanted.includes('payout')) sources.push(await readPayouts(shopId, range, take))

    const merged = sources
      .flatMap((source) => source.entries)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id))

    return res.status(200).json({
      success: true,
      data: {
        items: merged.slice(offset, offset + limit),
        total: sources.reduce((sum, source) => sum + source.total, 0),
        limit,
        offset,
      },
    })
  } catch (err) {
    if (isTableMissingError(err)) {
      return res.status(503).json({ success: false, message: 'Dữ liệu chưa sẵn sàng.', error: { code: 'DATA_STORAGE_UNAVAILABLE' } })
    }
    return next(err)
  }
}
