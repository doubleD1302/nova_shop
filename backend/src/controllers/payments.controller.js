import { callDataApi } from '../clients/data.client.js'
import { env } from '../config/env.js'
import { buildVnpayUrl, requestMomoPayment, verifyMomoIpn, verifyVnpayIpn } from '../services/payment-gateways.js'

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)

export async function createPaymentSession(req, res, next) {
  if (!validId(req.params.orderId)) return res.status(400).json({ success: false, message: 'Mã đơn không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
  if (!env.paymentGatewaysEnabled) return res.status(503).json({ success: false, message: 'Cổng thanh toán chưa được kích hoạt.', error: { code: 'PAYMENT_UNAVAILABLE' } })
  try {
    const attempt = await callDataApi(`/internal/v1/orders/${req.params.orderId}/payment-session`, {
      method: 'POST', body: { userId: req.user.id },
    })
    const config = env[attempt.method]
    if (!config) return res.status(503).json({ success: false, message: 'Cổng thanh toán chưa được cấu hình.', error: { code: 'PAYMENT_UNAVAILABLE' } })
    let paymentUrl
    if (attempt.method === 'vnpay') {
      const forwarded = req.ip || '127.0.0.1'
      paymentUrl = buildVnpayUrl({ amount: attempt.amount, reference: attempt.reference,
        createdAt: attempt.createdAt, ipAddress: forwarded, config })
    } else {
      try {
        paymentUrl = await requestMomoPayment({ amount: attempt.amount, reference: attempt.reference, config })
      } catch {
        return res.status(503).json({ success: false, message: 'Không thể tạo liên kết MoMo lúc này.', error: { code: 'PAYMENT_GATEWAY_UNAVAILABLE' } })
      }
    }
    return res.status(200).json({ success: true, data: { orderId: req.params.orderId,
      method: attempt.method, amount: attempt.amount, paymentUrl } })
  } catch (err) { return next(err) }
}

export async function getPaymentStatus(req, res, next) {
  if (!validId(req.params.orderId)) return res.status(400).json({ success: false, message: 'Mã đơn không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
  try {
    const data = await callDataApi(`/internal/v1/orders/${req.params.orderId}/payment-status?userId=${encodeURIComponent(req.user.id)}`)
    return res.status(200).json({ success: true, data })
  } catch (err) { return next(err) }
}

export async function getPaymentReviewQueue(req, res, next) {
  try {
    const params = new URLSearchParams({ userId: String(req.user.id) })
    for (const key of ['limit', 'offset']) {
      if (req.query[key] !== undefined) params.set(key, req.query[key])
    }
    const data = await callDataApi(`/internal/v1/admin/payments/review-queue?${params}`)
    return res.status(200).json({ success: true, data })
  } catch (err) { return next(err) }
}

export async function vnpayIpn(req, res) {
  if (!env.vnpay) return res.status(503).json({ RspCode: '99', Message: 'Unavailable' })
  const notification = verifyVnpayIpn(req.query, env.vnpay)
  if (!notification) return res.status(200).json({ RspCode: '97', Message: 'Invalid signature or data' })
  try {
    await callDataApi('/internal/v1/payments/notification', { method: 'POST', body: notification })
    return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' })
  } catch (err) {
    const code = err.code === 'PAYMENT_NOT_FOUND' ? '01' : err.code === 'PAYMENT_MISMATCH' ? '04' : '99'
    return res.status(200).json({ RspCode: code, Message: 'Payment not confirmed' })
  }
}

export async function momoIpn(req, res) {
  if (!env.momo) return res.sendStatus(503)
  const notification = verifyMomoIpn(req.body, env.momo)
  if (!notification) return res.sendStatus(400)
  try {
    await callDataApi('/internal/v1/payments/notification', { method: 'POST', body: notification })
    return res.status(204).end()
  } catch (err) {
    return res.sendStatus(['PAYMENT_NOT_FOUND', 'PAYMENT_MISMATCH'].includes(err.code) ? 409 : 503)
  }
}
