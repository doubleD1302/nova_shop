import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

const TEST_JWT_SECRET = 'test_integration_order_jwt_secret_min_32_characters_12345'
const TEST_SERVICE_KEY = 'test_integration_order_service_key_64_characters_entropy_secret_key'

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

function generateToken(userId, role = 'buyer') {
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

async function requestHttp(baseUrl, endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  return { status: res.status, headers: res.headers, body }
}

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP ĐẶT HÀNG (BE-007 ORDER API) ===\n')

  const dataApiPort = await getAvailablePort()
  const backendPort = await getAvailablePort()

  let dataProc = null
  let backendProc = null

  try {
    dataProc = await startProcess('Data API', dataApiRootDir, {
      PORT: String(dataApiPort),
      DATA_API_KEY: TEST_SERVICE_KEY,
    })
    console.log(`[Khởi động] Data API cổng: ${dataApiPort}`)

    backendProc = await startProcess('Backend', rootDir, {
      PORT: String(backendPort),
      DATA_API_URL: `http://127.0.0.1:${dataApiPort}`,
      DATA_API_KEY: TEST_SERVICE_KEY,
      JWT_SECRET: TEST_JWT_SECRET,
    })
    console.log(`[Khởi động] Backend cổng: ${backendPort}`)

    const backendUrl = `http://127.0.0.1:${backendPort}`
    const tokenUser1 = generateToken('1')
    const tokenUser2 = generateToken('2')

    // 1. Kiểm tra xác thực (Auth Required)
    console.log('\n--- 1. Kiểm tra xác thực (Authentication Required) ---')
    {
      const resNoAuth = await requestHttp(backendUrl, '/api/v1/orders', { method: 'POST', body: {} })
      assert(resNoAuth.status === 401, 'POST /api/v1/orders không có token trả HTTP 401')
      assert(resNoAuth.body?.error?.code === 'AUTH_REQUIRED', 'Mã lỗi là AUTH_REQUIRED khi thiếu token')

      const resListNoAuth = await requestHttp(backendUrl, '/api/v1/orders')
      assert(resListNoAuth.status === 401, 'GET /api/v1/orders không có token trả HTTP 401')
    }

    // 2. Kiểm tra validation khi đặt hàng
    console.log('\n--- 2. Kiểm tra validation khi đặt hàng ---')
    {
      const resEmpty = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {},
      })
      assert(resEmpty.status === 400, 'Thiếu thông tin người nhận trả HTTP 400')
      assert(resEmpty.body?.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR')
    }

    // 3. Đặt hàng thành công
    console.log('\n--- 3. Đặt hàng thành công (POST /api/v1/orders) ---')
    const testIdempotencyKey = 'idempotent-test-key-' + Date.now()
    let createdOrderId = null
    let createdOrderCode = null

    {
      const resOrder = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          idempotencyKey: testIdempotencyKey,
          recipientName: 'Nguyễn Văn Test',
          recipientPhone: '0901234567',
          province: 'TP. Hồ Chí Minh',
          district: 'Quận 1',
          ward: 'Phường Bến Nghé',
          addressDetail: '123 Đường Test',
          note: 'Giao hàng cẩn thận',
          items: [{ variantId: '1', qty: 1 }],
        },
      })

      assert(resOrder.status === 201, 'Đặt hàng hợp lệ trả HTTP 201')
      assert(resOrder.body?.success === true, 'Envelope success === true')
      assert(typeof resOrder.body?.data?.id === 'string', 'Trả về orderId dạng chuỗi')
      assert(typeof resOrder.body?.data?.code === 'string', 'Trả về order code')
      assert(resOrder.body?.data?.code.startsWith('ORD'), 'Mã đơn bắt đầu bằng ORD')
      assert(resOrder.body?.data?.recipientName === 'Nguyễn Văn Test', 'Đúng tên người nhận')
      assert(Array.isArray(resOrder.body?.data?.shopOrders), 'shopOrders là một mảng')
      assert(resOrder.body?.data?.shopOrders.length === 1, 'Đơn gồm 1 shop')
      assert(resOrder.body?.data?.shopOrders[0]?.items.length === 1, 'Shop có 1 sản phẩm')
      assert(typeof resOrder.body?.data?.totalAmount === 'number', 'totalAmount là kiểu số VND')

      createdOrderId = resOrder.body?.data?.id
      createdOrderCode = resOrder.body?.data?.code
    }

    // 4. Kiểm tra Idempotency (Gửi lại cùng key trả về cùng đơn)
    console.log('\n--- 4. Kiểm tra Idempotency (Chống tạo đơn trùng lặp) ---')
    {
      const resRetry = await requestHttp(backendUrl, '/api/v1/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: {
          idempotencyKey: testIdempotencyKey,
          recipientName: 'Nguyễn Văn Test',
          recipientPhone: '0901234567',
          province: 'TP. Hồ Chí Minh',
          addressDetail: '123 Đường Test',
          items: [{ variantId: '1', qty: 1 }],
        },
      })
      assert(resRetry.status === 200 || resRetry.status === 201, 'Gửi lại cùng key thành công HTTP 200/201')
      assert(resRetry.body?.data?.id === createdOrderId, 'Trả về đúng orderId cũ (idempotent)')
    }

    // 5. Danh sách đơn hàng (GET /api/v1/orders)
    console.log('\n--- 5. Kiểm tra danh sách đơn hàng (GET /api/v1/orders) ---')
    {
      const resList = await requestHttp(backendUrl, '/api/v1/orders', {
        headers: { Authorization: `Bearer ${tokenUser1}` },
      })
      assert(resList.status === 200, 'GET /api/v1/orders trả HTTP 200')
      assert(Array.isArray(resList.body?.data), 'Danh sách đơn hàng là mảng')
      assert(resList.body?.data.length > 0, 'Tìm thấy đơn hàng vừa tạo')
      assert(resList.body?.data.some((o) => o.id === createdOrderId), 'Đơn vừa tạo nằm trong danh sách')
    }

    // 6. Chi tiết đơn hàng (GET /api/v1/orders/:orderId) & Phân quyền
    console.log('\n--- 6. Chi tiết đơn hàng và bảo vệ phân quyền ---')
    {
      const resDetail = await requestHttp(backendUrl, `/api/v1/orders/${createdOrderId}`, {
        headers: { Authorization: `Bearer ${tokenUser1}` },
      })
      assert(resDetail.status === 200, 'GET /api/v1/orders/:orderId trả HTTP 200')
      assert(resDetail.body?.data?.id === createdOrderId, 'ID đơn khớp')
      assert(resDetail.body?.data?.code === createdOrderCode, 'Mã code khớp')

      // User 2 không có quyền xem đơn của User 1
      const resOtherUser = await requestHttp(backendUrl, `/api/v1/orders/${createdOrderId}`, {
        headers: { Authorization: `Bearer ${tokenUser2}` },
      })
      assert(resOtherUser.status === 404, 'User khác xem đơn trả HTTP 404 (cô lập an toàn)')
      assert(resOtherUser.body?.error?.code === 'ORDER_NOT_FOUND', 'Mã lỗi là ORDER_NOT_FOUND')
    }

    // 7. Hủy đơn hàng (PATCH /api/v1/orders/:orderId/cancel)
    console.log('\n--- 7. Hủy đơn hàng (PATCH /api/v1/orders/:orderId/cancel) ---')
    {
      const resCancel = await requestHttp(backendUrl, `/api/v1/orders/${createdOrderId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { reason: 'Tôi muốn đổi địa chỉ nhận hàng' },
      })
      assert(resCancel.status === 200, 'Hủy đơn hàng thành công trả HTTP 200')
      assert(resCancel.body?.data?.cancelled === true, 'Trả về cancelled === true')

      // Kiểm tra lại chi tiết đơn: trạng thái phải là cancelled
      const resCheck = await requestHttp(backendUrl, `/api/v1/orders/${createdOrderId}`, {
        headers: { Authorization: `Bearer ${tokenUser1}` },
      })
      assert(resCheck.status === 200, 'Xem lại đơn sau khi hủy trả HTTP 200')
      assert(resCheck.body?.data?.shopOrders[0]?.status === 'cancelled', 'Trạng thái shop_order chuyển thành cancelled')
    }

  } finally {
    console.log('\n[Dọn dẹp] Đang tắt các server kiểm thử...')
    if (backendProc) backendProc.kill()
    if (dataProc) dataProc.kill()
  }

  console.log('\n=== TỔNG KẾT KIỂM THỬ ĐẶT HÀNG (BE-007 ORDER API) ===')
  console.log(`Số bài kiểm tra vượt qua (PASS): ${passed}`)
  console.log(`Số bài kiểm tra thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    console.error('\n❌ Có bài kiểm tra không đạt!')
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ bài kiểm tra Order API đều ĐẠT (PASS)!')
    process.exit(0)
  }
}

run().catch((err) => {
  console.error('Lỗi ngoại lệ khi chạy test:', err)
  process.exit(1)
})
