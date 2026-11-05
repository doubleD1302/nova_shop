import { env } from '../config/env.js'
import { callDataApi } from '../clients/data.client.js'

const disabled = (res) => res.status(404).json({ success: false, message: 'Không tìm thấy chức năng.', error: { code: 'NOT_FOUND' } })
export async function getDemoPayout(req, res, next) {
  if (env.nodeEnv === 'production') return disabled(res)
  try {
    const data = await callDataApi(`/internal/v1/seller/demo-payout?userId=${encodeURIComponent(req.user.id)}`)
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
}
export async function setupDemoPayout(req, res, next) {
  if (env.nodeEnv === 'production') return disabled(res)
  try {
    const data = await callDataApi('/internal/v1/seller/demo-payout/setup', { method: 'POST', body: { userId: req.user.id } })
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
}
export async function createDemoWithdrawal(req, res, next) {
  if (env.nodeEnv === 'production') return disabled(res)
  try {
    const amount = req.body?.amount
    const key = req.headers['idempotency-key']
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000 || typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(key)) {
      return res.status(400).json({ success: false, message: 'Số tiền hoặc khóa yêu cầu không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const data = await callDataApi('/internal/v1/seller/demo-payout/withdrawals', { method: 'POST', body: { userId: req.user.id, amount }, headers: { 'idempotency-key': key } })
    return res.status(data.replay ? 200 : 201).json({ success: true, data })
  } catch (err) { return next(err) }
}
