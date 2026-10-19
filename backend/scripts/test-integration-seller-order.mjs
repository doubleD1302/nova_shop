import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

const TEST_JWT_SECRET = 'test_integration_seller_order_jwt_secret_min_32_characters_12345'
const TEST_SERVICE_KEY = 'test_integration_seller_order_service_key_64_characters_entropy_secret_key'

let passed = 0
let failed = 0

function assert(condition, name, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${name} ${detail ? `(${detail})` : ''}`)
    failed++
  }
}

function generateToken(userId, role = 'seller') {
  return jwt.sign(
    {
      sub: String(userId),
      role,
    },
    TEST_JWT_SECRET,
    {
      algorithm: 'HS256',
      issuer: 'shopnova-backend',
      audience: 'shopnova-clients',
      expiresIn: '900s',
    },
  )
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

function startProcess(name, dir, env) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['src/server.js'], {
      cwd: dir,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let resolved = false

    proc.stdout.on('data', (d) => {
      stdout += d.toString()
      if (!resolved && (stdout.includes('lắng nghe') || stdout.includes('running') || stdout.includes('sẵn sàng'))) {
        resolved = true
        resolve(proc)
      }
    })

    proc.stderr.on('data', (d) => {
      stderr += d.toString()
    })

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true
        reject(err)
      }
    })

    proc.on('exit', (code) => {
      if (!resolved) {
        resolved = true
        reject(new Error(`${name} dừng quá sớm với mã ${code}: ${stderr || stdout}`))
      }
    })

    setTimeout(() => {
      if (!resolved) {
        resolved = true
        resolve(proc)
      }
    }, 4000)
  })
}

async function requestJson(url, options = {}) {
  const { method = 'GET', headers = {}, body } = options
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // Không phải JSON
  }

  return { status: res.status, data }
}

async function run() {
  console.log('--- KHỞI ĐỘNG INTEGRATION TEST CHO SELLER ORDERS (BE-007B) ---')

  const dataApiPort = await getAvailablePort()
  const backendPort = await getAvailablePort()

  console.log(`Port Data API: ${dataApiPort}, Port Backend: ${backendPort}`)

  const dataApiProc = await startProcess('Data API', dataApiRootDir, {
    DATA_API_PORT: String(dataApiPort),
    DATA_API_SERVICE_KEY: TEST_SERVICE_KEY,
  })

  const backendProc = await startProcess('Backend', rootDir, {
    PORT: String(backendPort),
    DATA_API_BASE_URL: `http://127.0.0.1:${dataApiPort}`,
    DATA_API_SERVICE_KEY: TEST_SERVICE_KEY,
    JWT_SECRET: TEST_JWT_SECRET,
  })

  const baseUrl = `http://127.0.0.1:${backendPort}/api/v1`

  try {
    await new Promise((r) => setTimeout(r, 1000))

    // 1. Phân quyền truy cập
    console.log('\n[TEST 1] Phân quyền truy cập GET /api/v1/seller/orders')
    const resNoAuth = await requestJson(`${baseUrl}/seller/orders`)
    assert(resNoAuth.status === 401, 'GET /seller/orders không kèm token trả 401 AUTH_REQUIRED')

    // Buyer token (userId = 1 là demo_buyer)
    const buyerToken = generateToken('1', 'buyer')
    const resBuyerForbidden = await requestJson(`${baseUrl}/seller/orders`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    assert(resBuyerForbidden.status === 403, 'GET /seller/orders với buyer token trả 403 FORBIDDEN')

    // Seller token (userId = 2 là demo_seller_a, sở hữu shop 1)
    const sellerToken = generateToken('2', 'seller')
    const sellerHeaders = { Authorization: `Bearer ${sellerToken}` }

    const resSellerOrders = await requestJson(`${baseUrl}/seller/orders`, {
      headers: sellerHeaders,
    })
    assert(resSellerOrders.status === 200, 'GET /seller/orders với seller token trả 200 OK')
    assert(resSellerOrders.data?.success === true, 'Response trả success = true')
    assert(Array.isArray(resSellerOrders.data?.data), 'data là một mảng danh sách đơn hàng')

    // 2. Tạo đơn hàng mới để test luồng chuyển trạng thái
    console.log('\n[TEST 2] Tạo đơn hàng mới qua Buyer API')
    const idempotencyKey = `seller_test_order_${Date.now()}`
    const createOrderRes = await requestJson(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: {
        idempotencyKey,
        recipientName: 'Nguyễn Văn Test',
        recipientPhone: '0987654321',
        province: 'Hà Nội',
        district: 'Cầu Giấy',
        ward: 'Dịch Vọng',
        addressDetail: 'Số 123 Đường Cầu Giấy',
        note: 'Giao giờ hành chính',
        items: [
          {
            variantId: '1',
            qty: 1,
          },
        ],
      },
    })
    assert(createOrderRes.status === 201, 'Buyer tạo đơn hàng mới thành công trả 201')
    const createdOrderId = createOrderRes.data?.data?.id
    assert(Boolean(createdOrderId), `Đã tạo đơn tổng id = ${createdOrderId}`)

    // 3. Seller kiểm tra đơn hàng mới vừa được đặt
    console.log('\n[TEST 3] Seller kiểm tra đơn con vừa tạo')
    const ordersAfterCreate = await requestJson(`${baseUrl}/seller/orders`, {
      headers: sellerHeaders,
    })
    assert(ordersAfterCreate.status === 200, 'Đọc lại danh sách đơn hàng trả 200 OK')

    const newShopOrder = ordersAfterCreate.data?.data?.find(
      (so) => String(so.orderId) === String(createdOrderId),
    )
    assert(Boolean(newShopOrder), 'Tìm thấy đơn con của shop trong danh sách của seller')
    assert(newShopOrder?.status === 'pending', 'Trạng thái ban đầu của đơn con là pending')

    const targetShopOrderId = newShopOrder?.id

    // 4. Kiểm tra chuyển trạng thái đơn hàng:
    console.log('\n[TEST 4] Seller chuyển trạng thái đơn hàng (pending -> confirmed -> shipping -> delivered)')
    if (targetShopOrderId) {
      // 4.1 Thử nhảy cóc từ pending sang delivered (vi phạm luồng)
      const resInvalidTransition = await requestJson(
        `${baseUrl}/seller/orders/${targetShopOrderId}/status`,
        {
          method: 'PATCH',
          headers: sellerHeaders,
          body: { toStatus: 'delivered' },
        },
      )
      assert(
        resInvalidTransition.status === 400,
        'Chuyển trạng thái không hợp lệ (pending -> delivered) bị từ chối trả 400',
      )

      // 4.2 pending -> confirmed
      const resConfirm = await requestJson(
        `${baseUrl}/seller/orders/${targetShopOrderId}/status`,
        {
          method: 'PATCH',
          headers: sellerHeaders,
          body: { toStatus: 'confirmed', note: 'Shop đã tiếp nhận đơn' },
        },
      )
      assert(resConfirm.status === 200, 'Xác nhận đơn hàng (confirmed) trả 200 OK')
      assert(resConfirm.data?.data?.toStatus === 'confirmed', 'toStatus = confirmed')

      // 4.3 confirmed -> shipping
      const resShipping = await requestJson(
        `${baseUrl}/seller/orders/${targetShopOrderId}/status`,
        {
          method: 'PATCH',
          headers: sellerHeaders,
          body: {
            toStatus: 'shipping',
            trackingCode: 'VNP123456789',
            note: 'Đã giao cho bưu tá',
          },
        },
      )
      assert(resShipping.status === 200, 'Chuyển đơn sang đang giao (shipping) trả 200 OK')
      assert(resShipping.data?.data?.toStatus === 'shipping', 'toStatus = shipping')

      // 4.4 shipping -> delivered
      const resDelivered = await requestJson(
        `${baseUrl}/seller/orders/${targetShopOrderId}/status`,
        {
          method: 'PATCH',
          headers: sellerHeaders,
          body: { toStatus: 'delivered', note: 'Khách đã nhận hàng thành công' },
        },
      )
      assert(resDelivered.status === 200, 'Chuyển đơn sang đã giao (delivered) trả 200 OK')
      assert(resDelivered.data?.data?.toStatus === 'delivered', 'toStatus = delivered')
    }

    // 5. Kiểm tra luồng hủy đơn hàng bởi người bán (cancelled kèm hoàn kho)
    console.log('\n[TEST 5] Seller hủy đơn con kèm hoàn kho')
    const cancelOrderIdempotency = `seller_cancel_test_${Date.now()}`
    const orderToCancelRes = await requestJson(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: {
        idempotencyKey: cancelOrderIdempotency,
        recipientName: 'Nguyễn Văn Hủy',
        recipientPhone: '0912345678',
        province: 'Hà Nội',
        district: 'Ba Đình',
        ward: 'Kim Mã',
        addressDetail: 'Số 456 Kim Mã',
        items: [
          {
            variantId: '1',
            qty: 1,
          },
        ],
      },
    })
    assert(orderToCancelRes.status === 201, 'Tạo đơn hàng thứ 2 để test hủy trả 201')
    const cancelOrderId = orderToCancelRes.data?.data?.id

    const ordersToCancelList = await requestJson(`${baseUrl}/seller/orders`, {
      headers: sellerHeaders,
    })
    const shopOrderToCancel = ordersToCancelList.data?.data?.find(
      (so) => String(so.orderId) === String(cancelOrderId),
    )
    assert(Boolean(shopOrderToCancel), 'Tìm thấy đơn con thứ 2 cần hủy')

    if (shopOrderToCancel) {
      const resCancel = await requestJson(
        `${baseUrl}/seller/orders/${shopOrderToCancel.id}/status`,
        {
          method: 'PATCH',
          headers: sellerHeaders,
          body: {
            toStatus: 'cancelled',
            cancelReason: 'Sản phẩm tạm thời hết hàng trong kho',
          },
        },
      )
      assert(resCancel.status === 200, 'Seller hủy đơn hàng thành công trả 200 OK')
      assert(resCancel.data?.data?.toStatus === 'cancelled', 'toStatus = cancelled')
    }
  } catch (err) {
    console.error('Lỗi khi chạy integration test seller order:', err)
    failed++
  } finally {
    console.log('\nDọn dẹp và dừng các tiến trình test...')
    dataApiProc.kill('SIGKILL')
    backendProc.kill('SIGKILL')
  }

  console.log(`\n--- KẾT QUẢ TEST SELLER ORDER: ${passed} PASS, ${failed} FAIL ---`)
  if (failed > 0) {
    process.exit(1)
  }
}

run()
