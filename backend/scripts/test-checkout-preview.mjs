import assert from 'node:assert/strict'
import http from 'node:http'

const serviceKey = 'local_test_checkout_service_key_1234567890'
let forwarded
const mock = http.createServer(async (req, res) => {
  assert.equal(req.headers['x-service-key'], serviceKey)
  res.setHeader('content-type', 'application/json')
  if (req.url === '/internal/v1/users/1/auth-profile') {
    res.end(JSON.stringify({ success: true, data: { user: { id: '1', username: 'buyer', fullName: 'Buyer', email: null, phone: null, avatarUrl: null, role: 'buyer', status: 'active', shopId: null, address: null } } }))
    return
  }
  if (req.url === '/internal/v1/orders/preview') {
    let body = ''
    for await (const chunk of req) body += chunk
    forwarded = JSON.parse(body)
    if (forwarded.voucherCode === 'BAD') {
      res.statusCode = 400
      res.end(JSON.stringify({ success: false, message: 'Mã giảm giá không hợp lệ.', error: { code: 'VOUCHER_INVALID' } }))
    } else {
      res.end(JSON.stringify({ success: true, data: { subtotal: 100000, shippingFee: 16500, discountAmount: 20000, total: 96500, voucherCode: 'NOVA20K', shops: [] } }))
    }
    return
  }
  res.statusCode = 404
  res.end(JSON.stringify({ success: false, message: 'Not found' }))
})
await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve))
process.env.NODE_ENV = 'test'
process.env.DATA_API_URL = `http://127.0.0.1:${mock.address().port}`
process.env.DATA_API_KEY = serviceKey
process.env.JWT_SECRET = 'checkout_test_jwt_secret_minimum_32_chars'
process.env.DOTENV_CONFIG_PATH = 'nonexistent-checkout-test.env'
const { default: app } = await import('../src/app.js')
const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')
const server = http.createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}/api/v1/orders/preview`
try {
  const anonymous = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(anonymous.status, 401)
  const token = signAccessToken({ id: '1', role: 'buyer' })
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}` }
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ userId: '999', items: [{ variantId: '2', qty: 1 }], shippingMethod: 'tietkiem', voucherCode: 'NOVA20K', subtotal: 1 }) })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.data.total, 96500)
  assert.equal(forwarded.userId, '1')
  const invalid = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ voucherCode: 'BAD' }) })
  assert.equal(invalid.status, 400)
  assert.equal((await invalid.json()).error.code, 'VOUCHER_INVALID')
  console.log('Backend preview HTTP: xác thực, định danh và chuyển tiếp lỗi đạt (Data API mock).')
} finally {
  await new Promise((resolve) => server.close(resolve))
  await new Promise((resolve) => mock.close(resolve))
}
