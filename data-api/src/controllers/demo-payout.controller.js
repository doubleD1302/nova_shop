import { env } from '../config/env.js'
import { executeQuery, executeTransaction } from '../config/database.js'

const validUser = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
const error = (res, status, code, message) => res.status(status).json({ success: false, message, error: { code } })
const notEnabled = (res) => error(res, 404, 'NOT_FOUND', 'Không tìm thấy chức năng.')
const label = 'Tài khoản nhận tiền minh họa'

async function shopForUser(query, userId, lock = false) {
  return query(`SELECT s.id FROM shops s JOIN users u ON u.id = s.owner_id
    WHERE s.owner_id = ? AND s.status = 'active' AND u.status = 'active'${lock ? ' FOR UPDATE' : ''}`, [userId])
}

export async function getDemoPayout(req, res, next) {
  if (env.nodeEnv === 'production') return notEnabled(res)
  try {
    const userId = req.query.userId
    if (!validUser(userId)) return error(res, 400, 'VALIDATION_ERROR', 'Tài khoản không hợp lệ.')
    const shops = await shopForUser(executeQuery, userId)
    if (!shops.length) return error(res, 404, 'SHOP_NOT_FOUND', 'Không tìm thấy gian hàng đang hoạt động.')
    const rows = await executeQuery('SELECT balance FROM demo_seller_payouts WHERE shop_id = ?', [shops[0].id])
    const withdrawals = rows.length ? await executeQuery('SELECT id, amount, balance_after, created_at FROM demo_payout_withdrawals WHERE shop_id = ? ORDER BY id DESC LIMIT 50', [shops[0].id]) : []
    return res.json({ success: true, data: { mode: 'demo', destination: label, ready: rows.length > 0,
      balance: rows.length ? Number(rows[0].balance) : null,
      withdrawals: withdrawals.map((row) => ({ id: String(row.id), amount: Number(row.amount), balanceAfter: Number(row.balance_after), status: 'simulated', createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at) })) } })
  } catch (err) { return next(err) }
}

export async function setupDemoPayout(req, res, next) {
  if (env.nodeEnv === 'production') return notEnabled(res)
  try {
    const userId = req.body?.userId
    if (!validUser(userId)) return error(res, 400, 'VALIDATION_ERROR', 'Tài khoản không hợp lệ.')
    const result = await executeTransaction(async (query) => {
      const shops = await shopForUser(query, userId, true)
      if (!shops.length) return null
      const rows = await query('SELECT balance FROM demo_seller_payouts WHERE shop_id = ? FOR UPDATE', [shops[0].id])
      if (rows.length) return { created: false, balance: Number(rows[0].balance) }
      await query('INSERT INTO demo_seller_payouts (shop_id, balance) VALUES (?, 1000000)', [shops[0].id])
      return { created: true, balance: 1000000 }
    })
    if (!result) return error(res, 404, 'SHOP_NOT_FOUND', 'Không tìm thấy gian hàng đang hoạt động.')
    return res.json({ success: true, data: { mode: 'demo', destination: label, ...result } })
  } catch (err) { return next(err) }
}

export async function createDemoWithdrawal(req, res, next) {
  if (env.nodeEnv === 'production') return notEnabled(res)
  try {
    const { userId, amount } = req.body || {}
    const requestKey = req.headers['idempotency-key']
    if (!validUser(userId) || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000000 ||
        typeof requestKey !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(requestKey)) {
      return error(res, 400, 'VALIDATION_ERROR', 'Số tiền hoặc khóa yêu cầu không hợp lệ.')
    }
    const result = await executeTransaction(async (query) => {
      const shops = await shopForUser(query, userId, true)
      if (!shops.length) return { error: 'SHOP_NOT_FOUND' }
      const accounts = await query('SELECT balance FROM demo_seller_payouts WHERE shop_id = ? FOR UPDATE', [shops[0].id])
      if (!accounts.length) return { error: 'DEMO_NOT_INITIALIZED' }
      const previous = await query('SELECT id, amount, balance_after FROM demo_payout_withdrawals WHERE shop_id = ? AND request_key = ?', [shops[0].id, requestKey])
      if (previous.length) {
        if (Number(previous[0].amount) !== amount) return { error: 'IDEMPOTENCY_CONFLICT' }
        return { id: String(previous[0].id), amount, balanceAfter: Number(previous[0].balance_after), replay: true }
      }
      const balance = Number(accounts[0].balance)
      if (amount > balance) return { error: 'DEMO_INSUFFICIENT_BALANCE' }
      const balanceAfter = balance - amount
      await query('UPDATE demo_seller_payouts SET balance = ? WHERE shop_id = ?', [balanceAfter, shops[0].id])
      const saved = await query('INSERT INTO demo_payout_withdrawals (shop_id, request_key, amount, balance_after) VALUES (?, ?, ?, ?)', [shops[0].id, requestKey, amount, balanceAfter])
      return { id: String(saved.insertId), amount, balanceAfter, replay: false }
    })
    if (result.error) return error(res, result.error === 'SHOP_NOT_FOUND' ? 404 : 409, result.error, 'Không thể thực hiện yêu cầu mô phỏng.')
    return res.status(result.replay ? 200 : 201).json({ success: true, data: { mode: 'demo', status: 'simulated', ...result } })
  } catch (err) { return next(err) }
}
