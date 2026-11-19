import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

// Kiểm tra Backend cho Tài chính, Quảng cáo và Chăm sóc khách hàng của seller.
// Data API được giả lập bằng một HTTP server nhỏ để xem Backend gửi gì sang và trả gì về.
const KEY = 'seller-center-backend-test-key'
const calls = []
let upstream = null // ghi đè phản hồi của Data API cho một bài kiểm tra

const users = {
  1: { id: '1', role: 'seller', shopId: '10' },
  2: { id: '2', role: 'buyer', shopId: null },
  3: { id: '3', role: 'admin', shopId: null },
}

const dataApi = http.createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  res.setHeader('Content-Type', 'application/json')
  const profile = req.url.match(/^\/internal\/v1\/users\/(\d+)\/auth-profile$/)
  if (profile) {
    const user = users[profile[1]]
    if (!user) return res.writeHead(404).end(JSON.stringify({ success: false, error: { code: 'USER_NOT_FOUND' } }))
    return res.end(JSON.stringify({ success: true, data: { user: {
      id: user.id, username: `user${user.id}`, fullName: 'Người dùng', email: null, phone: null, avatarUrl: null,
      role: user.role, status: 'active', shopId: user.shopId,
    } } }))
  }
  calls.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null })
  if (upstream) {
    const answer = upstream
    return res.writeHead(answer.status).end(JSON.stringify(answer.json))
  }
  if (req.url.startsWith('/internal/v1/seller/reviews/') && req.method === 'POST') {
    return res.writeHead(201).end(JSON.stringify({ success: true, data: {
      id: '5', productId: '7', productName: 'Tai nghe', productSlug: 'tai-nghe', buyerId: '9',
      sellerReply: 'Cảm ơn bạn', repliedAt: '2026-11-19T03:00:00.000Z',
    } }))
  }
  return res.end(JSON.stringify({ success: true, data: { items: [], total: 0 } }))
})
await new Promise((resolve) => dataApi.listen(0, '127.0.0.1', resolve))

Object.assign(process.env, {
  NODE_ENV: 'test', DATA_API_KEY: KEY, JWT_SECRET: 'seller-center-backend-test-jwt-secret-0123456789',
  DATA_API_URL: `http://127.0.0.1:${dataApi.address().port}`,
  DOTENV_CONFIG_PATH: path.join(os.tmpdir(), 'missing-seller-center-backend.env'),
})
const { default: app } = await import('../src/app.js')
const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')

const server = http.createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/api/v1`

async function call(method, route, { user, body } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (user) headers.authorization = `Bearer ${signAccessToken({ id: user, role: users[user].role })}`
  const response = await fetch(base + route, { method, headers, ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, body: await response.json() }
}
const upstreamCalls = (prefix) => calls.filter((entry) => entry.url.startsWith(prefix))
// Thông báo in-app là POST đúng vào /internal/v1/notifications; push thiết bị gọi thêm đường dẫn khác chạy nền
const noticeCalls = () => calls.filter((entry) => entry.method === 'POST' && entry.url === '/internal/v1/notifications')

let passed = 0
async function check(name, fn) {
  calls.length = 0
  upstream = null
  await fn()
  passed++
  console.log(`  ✓ ${name}`)
}

const ENDPOINTS = [
  ['GET', '/seller/finance/transactions'],
  ['GET', '/seller/marketing/analytics'],
  ['GET', '/seller/reviews'],
  ['POST', '/seller/reviews/5/reply'],
]

try {
  console.log('--- Phân quyền ---')
  await check('chưa đăng nhập bị chặn (401)', async () => {
    for (const [method, route] of ENDPOINTS) assert.equal((await call(method, route)).status, 401, route)
  })
  await check('người mua bị chặn (403), không gọi Data API', async () => {
    for (const [method, route] of ENDPOINTS) assert.equal((await call(method, route, { user: '2', body: { reply: 'x' } })).status, 403, route)
    assert.equal(calls.length, 0)
  })
  await check('tài khoản không gắn với gian hàng (admin) nhận 403 SHOP_NOT_FOUND', async () => {
    for (const [method, route] of ENDPOINTS) {
      const result = await call(method, route, { user: '3', body: { reply: 'x' } })
      assert.equal(result.status, 403, route)
      assert.equal(result.body.error.code, 'SHOP_NOT_FOUND', route)
    }
    assert.equal(calls.length, 0)
  })

  console.log('--- Tài chính ---')
  await check('lịch sử giao dịch dùng shopId của token, bỏ qua shopId client gửi', async () => {
    const result = await call('GET', '/seller/finance/transactions?shopId=99&type=refund&startDate=2026-11-01&limit=5&offset=10', { user: '1' })
    assert.equal(result.status, 200)
    const url = new URL(upstreamCalls('/internal/v1/seller/finance/transactions')[0].url, 'http://x')
    assert.equal(url.searchParams.get('shopId'), '10')
    assert.equal(url.searchParams.get('type'), 'refund')
    assert.equal(url.searchParams.get('startDate'), '2026-11-01')
    assert.equal(url.searchParams.get('limit'), '5')
    assert.equal(url.searchParams.get('offset'), '10')
  })
  await check('loại giao dịch sai bị từ chối ngay (400), không gọi Data API', async () => {
    const result = await call('GET', '/seller/finance/transactions?type=bank', { user: '1' })
    assert.equal(result.status, 400)
    assert.equal(result.body.error.code, 'VALIDATION_ERROR')
    assert.equal(calls.length, 0)
  })
  await check('lỗi 400 từ Data API (limit sai) được chuyển tiếp, không thành 500', async () => {
    upstream = { status: 400, json: { success: false, message: 'Bộ lọc lịch sử giao dịch không hợp lệ.', error: { code: 'VALIDATION_ERROR' } } }
    const result = await call('GET', '/seller/finance/transactions?limit=9999', { user: '1' })
    assert.equal(result.status, 400)
  })

  console.log('--- Quảng cáo ---')
  await check('báo cáo hiệu quả gửi shopId của token và khoảng ngày', async () => {
    const result = await call('GET', '/seller/marketing/analytics?shopId=99&startDate=2026-11-01&endDate=2026-11-30', { user: '1' })
    assert.equal(result.status, 200)
    const url = new URL(upstreamCalls('/internal/v1/seller/marketing/analytics')[0].url, 'http://x')
    assert.equal(url.searchParams.get('shopId'), '10')
    assert.equal(url.searchParams.get('endDate'), '2026-11-30')
  })
  await check('mua gói đẩy trùng: lỗi 409 của Data API đến được người dùng', async () => {
    upstream = { status: 409, json: { success: false, message: 'Sản phẩm này đang có gói đẩy còn hiệu lực.', error: { code: 'BOOST_ALREADY_ACTIVE' } } }
    const result = await call('POST', '/seller/marketing/boost', { user: '1', body: { productId: '7', packageType: 'basic_1d' } })
    assert.equal(result.status, 409)
    assert.equal(result.body.error.code, 'BOOST_ALREADY_ACTIVE')
  })

  console.log('--- Chăm sóc khách hàng ---')
  await check('danh sách đánh giá gửi bộ lọc và shopId của token', async () => {
    const result = await call('GET', '/seller/reviews?shopId=99&rating=5&replied=false&productId=7&limit=20', { user: '1' })
    assert.equal(result.status, 200)
    const url = new URL(upstreamCalls('/internal/v1/seller/reviews')[0].url, 'http://x')
    assert.equal(url.searchParams.get('shopId'), '10')
    assert.equal(url.searchParams.get('rating'), '5')
    assert.equal(url.searchParams.get('replied'), 'false')
    assert.equal(url.searchParams.get('productId'), '7')
  })
  await check('phản hồi rỗng hoặc quá dài bị từ chối (400), không gọi Data API', async () => {
    for (const reply of ['', '   ', 'a'.repeat(1001), 123, undefined]) {
      assert.equal((await call('POST', '/seller/reviews/5/reply', { user: '1', body: { reply } })).status, 400)
    }
    assert.equal(calls.length, 0)
  })
  await check('phản hồi thành công: gửi đúng shop/người trả lời, không lộ buyerId, thông báo cho người mua', async () => {
    const result = await call('POST', '/seller/reviews/5/reply', { user: '1', body: { reply: '  Cảm ơn bạn  ', shopId: '99', userId: '77' } })
    assert.equal(result.status, 201)
    const forwarded = upstreamCalls('/internal/v1/seller/reviews/5/reply')[0].body
    assert.deepEqual(forwarded, { shopId: '10', userId: '1', reply: 'Cảm ơn bạn' })
    assert.equal(result.body.data.sellerReply, 'Cảm ơn bạn')
    assert.ok(!('buyerId' in result.body.data) && !('productSlug' in result.body.data), 'không trả buyerId/productSlug cho seller')
    assert.deepEqual(Object.keys(result.body.data).sort(), ['id', 'productId', 'productName', 'repliedAt', 'sellerReply'])

    // Thông báo chạy nền sau khi trả lời; chờ tối đa 2 giây
    for (let i = 0; i < 40 && !noticeCalls().length; i++) await new Promise((resolve) => setTimeout(resolve, 50))
    const notice = noticeCalls()[0]
    assert.ok(notice, 'có tạo thông báo')
    assert.equal(notice.body.userId, '9')
    assert.equal(notice.body.link, '/san-pham/tai-nghe')
    await new Promise((resolve) => setTimeout(resolve, 300)) // để phần push nền kết thúc trước bài sau
  })
  await check('Data API cũ không trả productSlug: thông báo không có link /san-pham/undefined', async () => {
    upstream = { status: 201, json: { success: true, data: { id: '5', productId: '7', productName: 'Tai nghe', buyerId: '9', sellerReply: 'Cảm ơn', repliedAt: '2026-11-19T03:00:00.000Z' } } }
    const result = await call('POST', '/seller/reviews/5/reply', { user: '1', body: { reply: 'Cảm ơn' } })
    assert.equal(result.status, 201)
    for (let i = 0; i < 40 && !noticeCalls().length; i++) await new Promise((resolve) => setTimeout(resolve, 50))
    assert.equal(noticeCalls()[0].body.link, null)
    await new Promise((resolve) => setTimeout(resolve, 300))
  })
  await check('đã trả lời rồi: 409 từ Data API đến được người dùng và không gửi thông báo', async () => {
    upstream = { status: 409, json: { success: false, message: 'Đánh giá này đã được phản hồi.', error: { code: 'REVIEW_ALREADY_REPLIED' } } }
    const result = await call('POST', '/seller/reviews/5/reply', { user: '1', body: { reply: 'Cảm ơn' } })
    assert.equal(result.status, 409)
    assert.equal(result.body.error.code, 'REVIEW_ALREADY_REPLIED')
    await new Promise((resolve) => setTimeout(resolve, 200))
    assert.equal(noticeCalls().length, 0)
  })
  await check('sửa phản hồi: gửi PATCH với shop/người dùng từ token, không gửi thông báo', async () => {
    upstream = null
    const result = await call('PATCH', '/seller/reviews/5/reply', { user: '1', body: { reply: '  Nội dung mới  ', shopId: '99', userId: '3' } })
    assert.equal(result.status, 200)
    const sent = upstreamCalls('/internal/v1/seller/reviews/5/reply')[0]
    assert.equal(sent.method, 'PATCH')
    assert.deepEqual(sent.body, { shopId: '10', userId: '1', reply: 'Nội dung mới' })
    await new Promise((resolve) => setTimeout(resolve, 200))
    assert.equal(noticeCalls().length, 0)
  })
  await check('sửa phản hồi: nội dung rỗng/quá dài 400, người mua 403, chưa phản hồi 409 từ Data API', async () => {
    for (const reply of ['   ', 'a'.repeat(1001), 5]) {
      assert.equal((await call('PATCH', '/seller/reviews/5/reply', { user: '1', body: { reply } })).status, 400)
    }
    assert.equal((await call('PATCH', '/seller/reviews/5/reply', { user: '2', body: { reply: 'x' } })).status, 403)
    assert.equal((await call('PATCH', '/seller/reviews/5/reply', { body: { reply: 'x' } })).status, 401)
    assert.equal(upstreamCalls('/internal/v1/seller/reviews/5/reply').length, 0)
    upstream = { status: 409, json: { success: false, message: 'Đánh giá này chưa có phản hồi.', error: { code: 'REVIEW_NOT_REPLIED' } } }
    const result = await call('PATCH', '/seller/reviews/5/reply', { user: '1', body: { reply: 'x' } })
    assert.equal(result.status, 409)
    assert.equal(result.body.error.code, 'REVIEW_NOT_REPLIED')
  })
  await check('xóa phản hồi: gửi DELETE với shop/người dùng từ token; người mua 403; lỗi Data API đến được người dùng', async () => {
    upstream = null
    const result = await call('DELETE', '/seller/reviews/5/reply', { user: '1' })
    assert.equal(result.status, 200)
    const sent = upstreamCalls('/internal/v1/seller/reviews/5/reply')[0]
    assert.equal(sent.method, 'DELETE')
    const url = new URL(sent.url, 'http://x')
    assert.equal(url.searchParams.get('shopId'), '10')
    assert.equal(url.searchParams.get('userId'), '1')
    assert.equal((await call('DELETE', '/seller/reviews/5/reply', { user: '2' })).status, 403)
    assert.equal((await call('DELETE', '/seller/reviews/5/reply')).status, 401)
    upstream = { status: 404, json: { success: false, message: 'Không tìm thấy đánh giá.', error: { code: 'REVIEW_NOT_FOUND' } } }
    assert.equal((await call('DELETE', '/seller/reviews/5/reply', { user: '1' })).status, 404)
  })
  await check('khiếu nại: seller lọc yêu cầu trả hàng disputed qua Backend', async () => {
    const result = await call('GET', '/seller/returns?status=disputed', { user: '1' })
    assert.equal(result.status, 200)
    const url = new URL(upstreamCalls('/internal/v1/seller/returns')[0].url, 'http://x')
    assert.equal(url.searchParams.get('status'), 'disputed')
    assert.equal(url.searchParams.get('userId'), '1')
  })
  await check('cài đặt vận chuyển: chuyển PATCH sang Data API với userId từ token, không tin body', async () => {
    upstream = { status: 200, json: { success: true, data: { pickupAddress: '1 A', province: 'Ha Noi', shippingMethods: ['nhanh'] } } }
    const result = await call('PATCH', '/seller/shop/shipping', { user: '1', body: { shippingMethods: ['nhanh'], userId: '3' } })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body.data.shippingMethods, ['nhanh'])
    const sent = upstreamCalls('/internal/v1/users/1/seller-shop/shipping')[0]
    assert.equal(sent.method, 'PATCH')
    assert.deepEqual(sent.body.shippingMethods, ['nhanh'])
    assert.equal(upstreamCalls('/internal/v1/users/3/').length, 0)
  })
  await check('cài đặt vận chuyển: người mua bị 403, chưa đăng nhập bị 401, lỗi Data API đến được người dùng', async () => {
    assert.equal((await call('PATCH', '/seller/shop/shipping', { user: '2', body: { shippingMethods: ['nhanh'] } })).status, 403)
    assert.equal((await call('PATCH', '/seller/shop/shipping', { body: { shippingMethods: ['nhanh'] } })).status, 401)
    assert.equal(upstreamCalls('/internal/v1/users/2/seller-shop/shipping').length, 0)
    upstream = { status: 409, json: { success: false, message: 'Gian hàng chưa được duyệt.', error: { code: 'SHOP_PROFILE_PENDING' } } }
    const result = await call('PATCH', '/seller/shop/shipping', { user: '1', body: { shippingMethods: ['nhanh'] } })
    assert.equal(result.status, 409)
    assert.equal(result.body.error.code, 'SHOP_PROFILE_PENDING')
  })

  console.log(`\nSeller center Backend: ${passed} kiểm tra PASS (Data API giả lập).`)
} catch (error) {
  console.error('\n✗ THẤT BẠI:', error)
  process.exitCode = 1
} finally {
  // Đóng hẳn tiến trình vì Backend có thể giữ timer/kết nối chạy nền
  server.closeAllConnections?.()
  dataApi.closeAllConnections?.()
  process.exit(process.exitCode || 0)
}
