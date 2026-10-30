import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.NODE_ENV = 'test'
process.env.PORT = '3000'
process.env.DOTENV_CONFIG_PATH = path.resolve(__dirname, '../../data-api/.env')

// 1. Nạp cấu hình Data API và khởi động Data API test server trên port ngẫu nhiên
const { env: dataEnv } = await import('../../data-api/src/config/env.js')
const { default: dataApiApp } = await import('../../data-api/src/app.js')

const dataApiServer = http.createServer(dataApiApp)
await new Promise((resolve, reject) => {
  dataApiServer.listen(0, '127.0.0.1', () => resolve())
  dataApiServer.on('error', reject)
})
const dataApiPort = dataApiServer.address().port
const dataApiUrl = `http://127.0.0.1:${dataApiPort}`

// 2. Thiết lập biến môi trường Backend khớp với Data API đang chạy
process.env.DATA_API_URL = dataApiUrl
process.env.DATA_API_KEY = dataEnv.dataApiKey
process.env.JWT_SECRET = 'post_sales_shipping_chat_jwt_secret_min_32_characters'

// 3. Nạp Backend App và Auth
const { default: backendApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')

// Khởi động Backend test server
const backendServer = http.createServer(backendApp)
await new Promise((resolve, reject) => {
  backendServer.listen(0, '127.0.0.1', () => resolve())
  backendServer.on('error', reject)
})
const backendPort = backendServer.address().port
const baseUrl = `http://127.0.0.1:${backendPort}`

const buyerUser = { id: 1, username: 'demo_buyer', role: 'buyer', shopId: null }
const sellerUser = { id: 2, username: 'demo_seller_a', role: 'seller', shopId: '1' }
const buyerToken = signAccessToken(buyerUser)
const sellerToken = signAccessToken(sellerUser)

let passed = 0
let failed = 0

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`)
    failed++
  }
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, ok: res.ok, body: json }
}

async function runTests() {
  console.log('=== KIỂM THỬ HẬU MÃI, VẬN CHUYỂN VÀ GIAO TIẾP (BACKEND) ===\n')
  console.log(`[Test] Data API: ${dataApiUrl}`)
  console.log(`[Test] Backend:  ${baseUrl}\n`)

  // --- 1. VẬN CHUYỂN (SHIPPING) ---
  console.log('--- 1. Kiểm thử module Vận chuyển (Shipping) ---')

  // 1.1 Tính phí cùng tỉnh
  const sameProvRes = await request('/api/v1/shipping/calculate', {
    method: 'POST',
    body: {
      fromProvince: 'TP. Hồ Chí Minh',
      toProvince: 'TP. Hồ Chí Minh',
      weightGrams: 500,
      subtotal: 350000,
    },
  })
  assert(sameProvRes.status === 200, 'Tính phí vận chuyển cùng tỉnh thành công (status 200)')
  assert(sameProvRes.body?.success === true, 'Response có success === true')
  assert(sameProvRes.body?.data?.isSameProvince === true, 'Được nhận diện là cùng tỉnh (isSameProvince = true)')
  assert(Array.isArray(sameProvRes.body?.data?.options) && sameProvRes.body.data.options.length >= 3, 'Trả về danh sách các gói cước vận chuyển (options >= 3)')

  // 1.2 Tính phí khác tỉnh có freeship khi subtotal >= 1.000.000đ
  const interProvRes = await request('/api/v1/shipping/calculate', {
    method: 'POST',
    body: {
      fromProvince: 'TP. Hồ Chí Minh',
      toProvince: 'Hà Nội',
      weightGrams: 1200,
      subtotal: 1200000,
    },
  })
  assert(interProvRes.status === 200, 'Tính phí vận chuyển liên tỉnh thành công (status 200)')
  assert(interProvRes.body?.data?.isSameProvince === false, 'Được nhận diện là liên tỉnh (isSameProvince = false)')
  const stdOption = interProvRes.body?.data?.options?.find((o) => o.id === 'standard')
  assert(stdOption && stdOption.discount > 0, 'Gói cước tiêu chuẩn được áp dụng giảm giá freeship (discount > 0)')

  // 1.3 Seller cập nhật mã vận đơn thiếu token bị chặn 401
  const trackNoAuth = await request('/api/v1/seller/orders/1/tracking', {
    method: 'PATCH',
    body: { trackingCode: 'VNP-123456' },
  })
  assert(trackNoAuth.status === 401, 'Cập nhật mã vận đơn thiếu token trả HTTP 401')
  assert(trackNoAuth.body?.error?.code === 'AUTH_REQUIRED', 'Mã lỗi là AUTH_REQUIRED')

  // 1.4 Buyer không có quyền seller bị chặn 403
  const trackBuyer = await request('/api/v1/seller/orders/1/tracking', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: { trackingCode: 'VNP-123456' },
  })
  assert(trackBuyer.status === 403, 'Tài khoản buyer không thể cập nhật mã vận đơn của seller (403 FORBIDDEN)')

  // 1.5 Seller gửi mã vận đơn rỗng bị từ chối 400
  const trackEmpty = await request('/api/v1/seller/orders/1/tracking', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${sellerToken}` },
    body: { trackingCode: '' },
  })
  assert(trackEmpty.status === 400, 'Seller gửi mã vận đơn rỗng bị từ chối 400 VALIDATION_ERROR')

  // 1.6 Tra cứu tracking thiếu token bị từ chối 401
  const trackDetailNoAuth = await request('/api/v1/orders/1/tracking')
  assert(trackDetailNoAuth.status === 401, 'Tra cứu hành trình kiện hàng thiếu token bị từ chối 401')

  // --- 2. HẬU MÃI (POST-SALES: RETURNS & REFUNDS) ---
  console.log('\n--- 2. Kiểm thử module Hậu mãi (Returns & Refunds) ---')

  // 2.1 Tạo yêu cầu trả hàng thiếu token bị chặn 401
  const retNoAuth = await request('/api/v1/orders/1/returns', {
    method: 'POST',
    body: { shopOrderId: 1, reason: 'Hàng lỗi' },
  })
  assert(retNoAuth.status === 401, 'Tạo yêu cầu trả hàng thiếu xác thực bị chặn 401')

  // 2.2 Tạo yêu cầu trả hàng thiếu lý do bị từ chối 400
  const retNoReason = await request('/api/v1/orders/1/returns', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: { shopOrderId: 1, reason: '' },
  })
  assert(retNoReason.status === 400, 'Tạo yêu cầu trả hàng thiếu lý do bị từ chối 400')
  assert(retNoReason.body?.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR')

  // 2.3 Tra cứu danh sách trả hàng của đơn hàng thiếu token bị chặn 401
  const listRetNoAuth = await request('/api/v1/orders/1/returns')
  assert(listRetNoAuth.status === 401, 'Tra cứu danh sách trả hàng thiếu token bị chặn 401')

  // 2.4 Seller duyệt yêu cầu hoàn hàng thiếu token bị chặn 401
  const updateRetNoAuth = await request('/api/v1/seller/returns/1/status', {
    method: 'PATCH',
    body: { status: 'approved' },
  })
  assert(updateRetNoAuth.status === 401, 'Seller duyệt yêu cầu hoàn hàng thiếu token bị chặn 401')

  // 2.5 Buyer không có quyền seller xử lý hoàn hàng (403)
  const updateRetBuyer = await request('/api/v1/seller/returns/1/status', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: { status: 'approved' },
  })
  assert(updateRetBuyer.status === 403, 'Buyer không có quyền duyệt yêu cầu hoàn hàng bị chặn 403')

  // 2.6 Seller gửi status không hợp lệ bị từ chối 400
  const updateRetInvalidStatus = await request('/api/v1/seller/returns/1/status', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${sellerToken}` },
    body: { status: 'something_invalid' },
  })
  assert(updateRetInvalidStatus.status === 400, 'Seller gửi trạng thái hoàn hàng không hợp lệ bị từ chối 400')
  assert(updateRetInvalidStatus.body?.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR')

  // --- 3. GIAO TIẾP (CHAT) ---
  console.log('\n--- 3. Kiểm thử module Giao tiếp (Chat) ---')

  // 3.1 Danh sách hội thoại thiếu token bị từ chối 401
  const chatListNoAuth = await request('/api/v1/chat/conversations')
  assert(chatListNoAuth.status === 401, 'Xem danh sách hội thoại thiếu token bị chặn 401')

  // 3.2 Mở hội thoại thiếu shopId hợp lệ bị từ chối 400
  const chatStartInvalid = await request('/api/v1/chat/conversations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: { shopId: 'invalid' },
  })
  assert(chatStartInvalid.status === 400, 'Bắt đầu hội thoại thiếu shopId hợp lệ bị từ chối 400 VALIDATION_ERROR')

  // 3.3 Xem tin nhắn trong hội thoại thiếu token bị từ chối 401
  const chatMsgsNoAuth = await request('/api/v1/chat/conversations/1/messages')
  assert(chatMsgsNoAuth.status === 401, 'Đọc tin nhắn hội thoại thiếu token bị chặn 401')

  // 3.4 Gửi tin nhắn rỗng bị từ chối 400
  const sendEmptyMsg = await request('/api/v1/chat/conversations/1/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: { message: '   ' },
  })
  assert(sendEmptyMsg.status === 400, 'Gửi tin nhắn rỗng bị từ chối 400 VALIDATION_ERROR')

  // 3.5 Bắt đầu hội thoại hợp lệ giữa Buyer và Shop (status 200)
  const chatStartOk = await request('/api/v1/chat/conversations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${buyerToken}` },
    body: { shopId: '1' },
  })
  assert(chatStartOk.status === 200, 'Buyer bắt đầu cuộc trò chuyện với Shop 1 thành công (status 200)')
  assert(chatStartOk.body?.success === true, 'Mở hội thoại có success === true')
  const conversationId = chatStartOk.body?.data?.id
  assert(Boolean(conversationId), 'Nhận được conversationId hợp lệ')

  // 3.6 Gửi tin nhắn hợp lệ trong cuộc hội thoại (status 201)
  if (conversationId) {
    const sendMsgOk = await request(`/api/v1/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: { message: 'Chào Shop, sản phẩm này còn màu đen không ạ?' },
    })
    assert(sendMsgOk.status === 201, 'Gửi tin nhắn trong cuộc trò chuyện thành công (status 201)')
    assert(sendMsgOk.body?.success === true, 'Gửi tin nhắn có success === true')
    assert(sendMsgOk.body?.data?.message === 'Chào Shop, sản phẩm này còn màu đen không ạ?', 'Nội dung tin nhắn gửi đi chính xác')

    // 3.7 Đọc danh sách tin nhắn trong cuộc hội thoại (status 200)
    const readMsgsOk = await request(`/api/v1/chat/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    assert(readMsgsOk.status === 200, 'Đọc lịch sử tin nhắn trong cuộc hội thoại thành công (status 200)')
    assert(Array.isArray(readMsgsOk.body?.data?.messages), 'Tin nhắn trả về dưới dạng mảng (Array)')
    assert(readMsgsOk.body?.data?.messages?.length >= 1, 'Danh sách tin nhắn chứa tin nhắn vừa gửi')
  }

  // 3.8 Lấy danh sách cuộc trò chuyện của Buyer (status 200)
  const listConvOk = await request('/api/v1/chat/conversations', {
    headers: { Authorization: `Bearer ${buyerToken}` },
  })
  assert(listConvOk.status === 200, 'Lấy danh sách các cuộc trò chuyện của Buyer thành công (status 200)')
  assert(Array.isArray(listConvOk.body?.data), 'Danh sách hội thoại trả về dưới dạng mảng (Array)')

  // Dọn dẹp server
  await new Promise((resolve) => backendServer.close(resolve))
  await new Promise((resolve) => dataApiServer.close(resolve))

  console.log(`\n=== TỔNG KẾT KIỂM THỬ: ${passed} bài PASS, ${failed} bài FAIL ===`)
  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('❌ Lỗi ngoại lệ trong kiểm thử:', err)
  backendServer.close()
  dataApiServer.close()
  process.exit(1)
})
