import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

const TEST_JWT_SECRET = 'test_integration_seller_hub_jwt_secret_min_32_characters_12345'
const TEST_SERVICE_KEY = 'test_integration_seller_hub_service_key_64_characters_entropy_secret_key'

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
  console.log('--- KHỞI ĐỘNG INTEGRATION TEST CHO SELLER HUB & SHOP FOLLOW ---')

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

    // 1. Phân quyền truy cập GET /api/v1/seller/shop
    console.log('\n[TEST 1] Phân quyền truy cập GET /api/v1/seller/shop')
    const resNoAuth = await requestJson(`${baseUrl}/seller/shop`)
    assert(resNoAuth.status === 401, 'GET /seller/shop không kèm token trả 401 AUTH_REQUIRED')

    // Buyer token (userId = 1)
    const buyerToken = generateToken('1', 'buyer')
    const resBuyerForbidden = await requestJson(`${baseUrl}/seller/shop`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    })
    assert(resBuyerForbidden.status === 403, 'GET /seller/shop với buyer token trả 403 FORBIDDEN')

    // Seller token (userId = 2, shopId = 1)
    const sellerToken = generateToken('2', 'seller')
    const sellerHeaders = { Authorization: `Bearer ${sellerToken}` }

    const resSellerShop = await requestJson(`${baseUrl}/seller/shop`, {
      headers: sellerHeaders,
    })
    assert(resSellerShop.status === 200, 'GET /seller/shop với seller token trả 200 OK')
    assert(resSellerShop.data?.success === true, 'Response trả success = true')
    assert(String(resSellerShop.data?.data?.id) === '1', 'Shop ID khớp chính xác với shop của seller')

    // 2. Cập nhật thông tin gian hàng qua PUT /api/v1/seller/shop
    console.log('\n[TEST 2] Cập nhật thông tin gian hàng qua PUT /api/v1/seller/shop')
    const updateShopRes = await requestJson(`${baseUrl}/seller/shop`, {
      method: 'PUT',
      headers: sellerHeaders,
      body: {
        tagline: 'Uy tín hàng đầu ShopNova',
        description: 'Gian hàng chuyên cung cấp sản phẩm cao cấp',
      },
    })
    assert(updateShopRes.status === 200, 'PUT /seller/shop trả 200 OK')
    assert(updateShopRes.data?.data?.updated === true, 'updated = true')

    // 3. Thống kê Dashboard qua GET /api/v1/seller/dashboard
    console.log('\n[TEST 3] Thống kê Dashboard qua GET /api/v1/seller/dashboard')
    const resDashboard = await requestJson(`${baseUrl}/seller/dashboard`, {
      headers: sellerHeaders,
    })
    assert(resDashboard.status === 200, 'GET /seller/dashboard trả 200 OK')
    assert(resDashboard.data?.success === true, 'Response dashboard success = true')
    assert(typeof resDashboard.data?.data?.revenue?.totalDelivered === 'number', 'totalDelivered là số')
    assert(typeof resDashboard.data?.data?.orders?.total === 'number', 'total orders là số')
    assert(typeof resDashboard.data?.data?.products?.total === 'number', 'total products là số')
    assert(Array.isArray(resDashboard.data?.data?.lowStockAlerts), 'lowStockAlerts là mảng cảnh báo SKU')

    // 4. Theo dõi gian hàng (Shop Follow)
    console.log('\n[TEST 4] Theo dõi gian hàng qua /api/v1/shops/:shopId/follow')
    const buyerHeaders = { Authorization: `Bearer ${buyerToken}` }

    // Kiểm tra trạng thái ban đầu
    const resFollowInitial = await requestJson(`${baseUrl}/shops/1/follow`, {
      headers: buyerHeaders,
    })
    assert(resFollowInitial.status === 200, 'GET /shops/1/follow trả 200 OK')

    // Theo dõi shop 1
    const resFollow = await requestJson(`${baseUrl}/shops/1/follow`, {
      method: 'POST',
      headers: buyerHeaders,
    })
    assert(resFollow.status === 200, 'POST /shops/1/follow trả 200 OK')
    assert(resFollow.data?.data?.isFollowing === true, 'isFollowing = true sau khi bấm theo dõi')

    // Kiểm tra lại sau khi theo dõi
    const resFollowCheck = await requestJson(`${baseUrl}/shops/1/follow`, {
      headers: buyerHeaders,
    })
    assert(resFollowCheck.data?.data?.isFollowing === true, 'GET kiểm tra lại xác nhận đã theo dõi')

    // Hủy theo dõi shop 1
    const resUnfollow = await requestJson(`${baseUrl}/shops/1/follow`, {
      method: 'DELETE',
      headers: buyerHeaders,
    })
    assert(resUnfollow.status === 200, 'DELETE /shops/1/follow trả 200 OK')
    assert(resUnfollow.data?.data?.isFollowing === false, 'isFollowing = false sau khi hủy theo dõi')

    // Kiểm tra lại sau khi hủy theo dõi
    const resFollowCheckAfterUnfollow = await requestJson(`${baseUrl}/shops/1/follow`, {
      headers: buyerHeaders,
    })
    assert(resFollowCheckAfterUnfollow.data?.data?.isFollowing === false, 'Xác nhận trạng thái đã hủy theo dõi thành công')
  } catch (err) {
    console.error('Lỗi khi chạy integration test seller hub:', err)
    failed++
  } finally {
    console.log('\nDọn dẹp và dừng các tiến trình test...')
    dataApiProc.kill('SIGKILL')
    backendProc.kill('SIGKILL')
  }

  console.log(`\n--- KẾT QUẢ TEST SELLER HUB & SHOP FOLLOW: ${passed} PASS, ${failed} FAIL ---`)
  if (failed > 0) {
    process.exit(1)
  }
}

run()
