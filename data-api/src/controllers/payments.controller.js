import crypto from 'node:crypto'
import { executeQuery, executeTransaction } from '../config/database.js'
import { isValidAmount } from '../utils/money.js'
import { readPagination } from '../utils/pagination.js'

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
const validIdentity = (value) => (typeof value === 'string' || Number.isSafeInteger(value)) && validId(String(value))
const fail = (res, status, code, message) => res.status(status).json({ success: false, message, error: { code } })
const methods = ['momo', 'vnpay']

export async function reservePayment(req, res, next) {
  const orderId = req.params.orderId
  const userId = req.body?.userId
  if (!validId(orderId) || !validIdentity(userId)) return fail(res, 400, 'VALIDATION_ERROR', 'Mã đơn hoặc tài khoản không hợp lệ.')
  try {
    const result = await executeTransaction(async (query) => {
      const orders = await query('SELECT id, buyer_id, payment_method, total_amount FROM orders WHERE id = ? FOR UPDATE', [orderId])
      if (!orders.length || String(orders[0].buyer_id) !== String(userId)) return { error: 'ORDER_NOT_FOUND' }
      const order = orders[0]
      if (!methods.includes(order.payment_method) || !isValidAmount(Number(order.total_amount)) || Number(order.total_amount) < 1000 ||
          (order.payment_method === 'momo' && Number(order.total_amount) > 50000000) ||
          (order.payment_method === 'vnpay' && Number(order.total_amount) > 9999999999)) {
        return { error: 'PAYMENT_UNAVAILABLE' }
      }
      const shops = await query('SELECT id, status FROM shop_orders WHERE order_id = ? FOR UPDATE', [orderId])
      const payments = await query('SELECT p.status FROM payments p JOIN shop_orders so ON so.id = p.shop_order_id WHERE so.order_id = ? FOR UPDATE', [orderId])
      if (!shops.length || payments.length !== shops.length || shops.some((shop) => shop.status === 'cancelled') ||
          payments.some((payment) => payment.status !== 'unpaid')) {
        return { error: 'PAYMENT_UNAVAILABLE' }
      }
      const attempts = await query(
        `SELECT reference, status, amount, created_at, expires_at > UTC_TIMESTAMP(3) AS usable
         FROM payment_attempts WHERE order_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE`, [orderId])
      if (attempts.length && attempts[0].status === 'pending') {
        if (!attempts[0].usable) return { error: 'PAYMENT_PENDING_RECONCILIATION' }
        return { reference: attempts[0].reference, amount: Number(attempts[0].amount),
          method: order.payment_method, createdAt: attempts[0].created_at }
      }
      if (attempts.length && ['review', 'paid'].includes(attempts[0].status)) return { error: 'PAYMENT_PENDING_RECONCILIATION' }
      const reference = `SN${orderId}${crypto.randomBytes(6).toString('hex').toUpperCase()}`
      await query(
        `INSERT INTO payment_attempts (order_id, provider, reference, amount, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE))`,
        [orderId, order.payment_method, reference, order.total_amount])
      const inserted = await query('SELECT created_at FROM payment_attempts WHERE reference = ?', [reference])
      return { reference, amount: Number(order.total_amount), method: order.payment_method, createdAt: inserted[0].created_at }
    })
    if (result.error === 'ORDER_NOT_FOUND') return fail(res, 404, result.error, 'Không tìm thấy đơn hàng của bạn.')
    if (result.error) return fail(res, 409, result.error, 'Đơn hàng chưa thể thanh toán trực tuyến.')
    return res.status(200).json({ success: true, data: result })
  } catch (err) { return next(err) }
}

export async function applyPaymentNotification(req, res, next) {
  const { provider, reference, amount, transactionId, success, resultCode } = req.body || {}
  if (!methods.includes(provider) || typeof reference !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(reference) ||
      !isValidAmount(amount) || typeof transactionId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(transactionId) ||
      typeof success !== 'boolean' || typeof resultCode !== 'string' || resultCode.length > 32) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Thông báo thanh toán không hợp lệ.')
  }
  try {
    const result = await executeTransaction(async (query) => {
      const refs = await query('SELECT order_id FROM payment_attempts WHERE reference = ?', [reference])
      if (!refs.length) return { error: 'PAYMENT_NOT_FOUND' }
      const orders = await query('SELECT id, payment_method, total_amount FROM orders WHERE id = ? FOR UPDATE', [refs[0].order_id])
      const attempts = await query('SELECT id, provider, amount, status, provider_transaction_id FROM payment_attempts WHERE reference = ? FOR UPDATE', [reference])
      const order = orders[0]
      const attempt = attempts[0]
      if (!order || !attempt || order.payment_method !== provider || attempt.provider !== provider ||
          Number(order.total_amount) !== amount || Number(attempt.amount) !== amount) return { error: 'PAYMENT_MISMATCH' }
      if (attempt.status === 'paid') return attempt.provider_transaction_id === transactionId
        ? { status: 'paid' } : { error: 'PAYMENT_MISMATCH' }
      if (attempt.status !== 'pending') {
        if (attempt.status === 'failed' && success) {
          await query(`UPDATE payment_attempts SET status = 'review', provider_transaction_id = ?, result_code = ?,
            processed_at = UTC_TIMESTAMP(3) WHERE id = ?`, [transactionId, resultCode, attempt.id])
          return { status: 'review' }
        }
        return { status: attempt.status }
      }
      const shops = await query('SELECT id, status FROM shop_orders WHERE order_id = ? FOR UPDATE', [order.id])
      const payments = await query('SELECT p.status FROM payments p JOIN shop_orders so ON so.id = p.shop_order_id WHERE so.order_id = ? FOR UPDATE', [order.id])
      const requiresReview = success && (!shops.length || payments.length !== shops.length ||
        shops.some((shop) => shop.status === 'cancelled') ||
        payments.some((payment) => payment.status !== 'unpaid')) ||
        !success && ((provider === 'vnpay' && (resultCode.startsWith('07:') || resultCode.endsWith(':04'))) ||
          (provider === 'momo' && resultCode === '9000'))
      const status = requiresReview ? 'review' : success ? 'paid' : 'failed'
      const attemptUpdate = await query(
        `UPDATE payment_attempts SET status = ?, provider_transaction_id = ?, result_code = ?, processed_at = UTC_TIMESTAMP(3)
         WHERE id = ? AND status = 'pending'`, [status, transactionId, resultCode, attempt.id])
      if (Number(attemptUpdate.affectedRows) !== 1) throw new Error('PAYMENT_ATTEMPT_UPDATE_MISMATCH')
      if (status === 'paid') {
        const paymentUpdate = await query(
          `UPDATE payments p JOIN shop_orders so ON so.id = p.shop_order_id
           SET p.status = 'paid', p.paid_at = UTC_TIMESTAMP(3)
           WHERE so.order_id = ? AND p.status = 'unpaid'`, [order.id])
        if (Number(paymentUpdate.affectedRows) !== shops.length) throw new Error('PAYMENT_UPDATE_MISMATCH')
      }
      return { status }
    })
    if (result.error === 'PAYMENT_NOT_FOUND') return fail(res, 404, result.error, 'Không tìm thấy giao dịch.')
    if (result.error) return fail(res, 409, result.error, 'Thông báo không khớp giao dịch.')
    return res.status(200).json({ success: true, data: result })
  } catch (err) { return next(err) }
}

export async function getPaymentStatus(req, res, next) {
  const orderId = req.params.orderId
  const userId = req.query.userId
  if (!validId(orderId) || !validId(userId)) return fail(res, 400, 'VALIDATION_ERROR', 'Mã đơn hoặc tài khoản không hợp lệ.')
  try {
    const orders = await executeQuery('SELECT id, payment_method, total_amount FROM orders WHERE id = ? AND buyer_id = ?', [orderId, userId])
    if (!orders.length) return fail(res, 404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng của bạn.')
    const payments = await executeQuery('SELECT p.status FROM payments p JOIN shop_orders so ON so.id = p.shop_order_id WHERE so.order_id = ?', [orderId])
    const attempts = await executeQuery(`SELECT status FROM payment_attempts WHERE order_id = ?
      ORDER BY (status = 'review') DESC, id DESC LIMIT 1`, [orderId])
    const status = attempts[0]?.status === 'review' ? 'review'
      : payments.length && payments.every((payment) => payment.status === 'paid') ? 'paid'
      : payments.length && payments.every((payment) => payment.status === 'void') ? 'void'
      : attempts[0]?.status || 'unpaid'
    return res.status(200).json({ success: true, data: { orderId, method: orders[0].payment_method,
      amount: Number(orders[0].total_amount), status } })
  } catch (err) { return next(err) }
}

export async function getPaymentReviewQueue(req, res, next) {
  const userId = req.query.userId
  const page = readPagination(req.query, { defaultLimit: 50 })
  if (!validId(userId) || !page) return fail(res, 400, 'VALIDATION_ERROR', 'Thông tin phân trang hoặc tài khoản không hợp lệ.')
  try {
    const admins = await executeQuery("SELECT id FROM users WHERE id = ? AND role = 'admin' AND status = 'active'", [userId])
    if (!admins.length) return fail(res, 403, 'FORBIDDEN', 'Tài khoản không có quyền quản trị.')
    const rows = await executeQuery(
      `SELECT pa.id, pa.order_id, o.code AS order_code, pa.provider, pa.reference, pa.amount,
              pa.status, pa.result_code, pa.provider_transaction_id, pa.created_at, pa.expires_at,
              pa.processed_at
       FROM payment_attempts pa JOIN orders o ON o.id = pa.order_id
       WHERE pa.status = 'review' OR (pa.status = 'pending' AND pa.expires_at <= UTC_TIMESTAMP(3))
       ORDER BY pa.id DESC LIMIT ? OFFSET ?`, [page.limit, page.offset])
    return res.status(200).json({ success: true, data: { attempts: rows.map((row) => ({
      id: String(row.id), orderId: String(row.order_id), orderCode: row.order_code,
      provider: row.provider, reference: row.reference, amount: Number(row.amount),
      status: row.status, resultCode: row.result_code, transactionId: row.provider_transaction_id,
      createdAt: row.created_at, expiresAt: row.expires_at, processedAt: row.processed_at,
    })), limit: page.limit, offset: page.offset } })
  } catch (err) { return next(err) }
}
