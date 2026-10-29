import { callDataApi } from '../clients/data.client.js'

export async function listOrders(req, res, next) {
  try {
    const params = new URLSearchParams({ userId: String(req.user.id) })
    for (const key of ['limit', 'offset', 'orderId']) {
      if (req.query[key] !== undefined && req.query[key] !== '') params.set(key, String(req.query[key]))
    }
    const result = await callDataApi(`/internal/v1/orders?${params}`)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

export async function createOrder(req, res, next) {
  try {
    const idempotencyKey = req.headers['idempotency-key']
    if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(idempotencyKey)) {
      return res.status(400).json({
        success: false,
        message: 'Khóa yêu cầu đặt hàng không hợp lệ.',
        error: { code: 'INVALID_IDEMPOTENCY_KEY' },
      })
    }
    const result = await callDataApi('/internal/v1/orders', {
      method: 'POST',
      body: { ...req.body, userId: req.user.id },
      headers: { 'idempotency-key': idempotencyKey },
    })
    return res.status(201).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

export async function cancelOrder(req, res, next) {
  try {
    const result = await callDataApi(
      `/internal/v1/orders/${encodeURIComponent(req.params.orderId)}/cancel`,
      { method: 'POST', body: { userId: req.user.id } },
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

export async function confirmOrderReceived(req, res, next) {
  try {
    const result = await callDataApi(
      `/internal/v1/orders/${encodeURIComponent(req.params.orderId)}/confirm-received`,
      { method: 'POST', body: { userId: req.user.id } },
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

export async function listSellerOrders(req, res, next) {
  try {
    const params = new URLSearchParams({ userId: String(req.user.id) })
    for (const key of ['limit', 'offset']) {
      if (req.query[key] !== undefined && req.query[key] !== '') params.set(key, String(req.query[key]))
    }
    const result = await callDataApi(`/internal/v1/seller/orders?${params}`)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

export async function updateSellerOrderStatus(req, res, next) {
  try {
    const result = await callDataApi(
      `/internal/v1/seller/orders/${encodeURIComponent(req.params.shopOrderId)}/status`,
      { method: 'PATCH', body: { userId: req.user.id, status: req.body?.status } },
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}
