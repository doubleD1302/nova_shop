import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

const TEST_JWT_SECRET = 'test_integration_engagement_jwt_secret_min_32_chars_12345'
const TEST_SERVICE_KEY = 'test_integration_engagement_service_key_64_characters_entropy_secret_key'

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
  console.log('--- KHỞI ĐỘNG INTEGRATION TEST CHO ENGAGEMENT (FEATURED, REVIEWS, FAVORITES) ---')

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
    // Chờ 1 giây để server ổn định
    await new Promise((r) => setTimeout(r, 1000))

    // 1. Kiểm tra Featured Products & Flash Sale
    console.log('\n[TEST 1] GET /api/v1/products/featured')
    const resFeatured = await requestJson(`${baseUrl}/products/featured`)
    assert(resFeatured.status === 200, 'GET /products/featured trả HTTP 200 OK')
    assert(resFeatured.data?.success === true, 'Response trả success = true')
    assert(Array.isArray(resFeatured.data?.data?.flashSale), 'flashSale là một mảng')
    assert(Array.isArray(resFeatured.data?.data?.featuredProducts), 'featuredProducts là một mảng')

    // 2. Kiểm tra Reviews của sản phẩm
    console.log('\n[TEST 2] GET /api/v1/products/:id/reviews')
    const resReviews = await requestJson(`${baseUrl}/products/1/reviews`)
    assert(resReviews.status === 200, 'GET /products/1/reviews trả HTTP 200 OK')
    assert(resReviews.data?.success === true, 'Response trả success = true')
    assert(typeof resReviews.data?.data?.averageRating === 'number', 'averageRating là số thực')
    assert(Array.isArray(resReviews.data?.data?.reviews), 'reviews là một mảng')

    const resInvalidReviewProd = await requestJson(`${baseUrl}/products/invalid_id/reviews`)
    assert(resInvalidReviewProd.status === 400, 'GET reviews với productId sai định dạng trả HTTP 400')

    // 3. Kiểm tra bảo vệ Auth cho POST review
    console.log('\n[TEST 3] POST /api/v1/reviews (Auth & Validation)')
    const resNoAuthReview = await requestJson(`${baseUrl}/reviews`, {
      method: 'POST',
      body: { orderItemId: '1', rating: 5, comment: 'Sản phẩm tốt' },
    })
    assert(resNoAuthReview.status === 401, 'POST /reviews không kèm token trả 401 AUTH_REQUIRED')

    // Token cho user test (ví dụ userId = 2 là buyer_hn)
    const buyerToken = generateToken('2', 'buyer')
    const authHeaders = { Authorization: `Bearer ${buyerToken}` }

    const resInvalidRating = await requestJson(`${baseUrl}/reviews`, {
      method: 'POST',
      headers: authHeaders,
      body: { orderItemId: '1', rating: 6, comment: 'Đánh giá 6 sao lỗi' },
    })
    assert(resInvalidRating.status === 400, 'POST /reviews với số sao > 5 trả 400 INVALID_RATING')

    const resEmptyComment = await requestJson(`${baseUrl}/reviews`, {
      method: 'POST',
      headers: authHeaders,
      body: { orderItemId: '1', rating: 5, comment: '   ' },
    })
    assert(resEmptyComment.status === 400, 'POST /reviews với comment rỗng trả 400 VALIDATION_ERROR')

    // 4. Kiểm tra Danh sách Yêu thích (Favorites)
    console.log('\n[TEST 4] Favorites API (GET, POST, DELETE)')
    const resNoAuthFav = await requestJson(`${baseUrl}/favorites`)
    assert(resNoAuthFav.status === 401, 'GET /favorites không kèm token trả 401 AUTH_REQUIRED')

    const resFavList = await requestJson(`${baseUrl}/favorites`, {
      headers: authHeaders,
    })
    assert(resFavList.status === 200, 'GET /favorites có token trả 200 OK')
    assert(Array.isArray(resFavList.data?.data), 'Danh sách yêu thích trả về kiểu mảng')

    // Thêm sản phẩm 1 vào yêu thích
    const resAddFav = await requestJson(`${baseUrl}/favorites/1`, {
      method: 'POST',
      headers: authHeaders,
    })
    assert(resAddFav.status === 200, 'POST /favorites/1 trả 200 OK')
    assert(resAddFav.data?.data?.favorited === true, 'favorited = true')

    // Kiểm tra danh sách sau khi thêm
    const resFavListAfter = await requestJson(`${baseUrl}/favorites`, {
      headers: authHeaders,
    })
    assert(resFavListAfter.status === 200, 'GET /favorites sau khi thêm trả 200 OK')
    const hasProd1 = resFavListAfter.data?.data?.some((p) => String(p.id) === '1')
    assert(hasProd1 === true, 'Sản phẩm 1 đã xuất hiện trong danh sách yêu thích')

    // Xóa sản phẩm 1 khỏi yêu thích
    const resRemoveFav = await requestJson(`${baseUrl}/favorites/1`, {
      method: 'DELETE',
      headers: authHeaders,
    })
    assert(resRemoveFav.status === 200, 'DELETE /favorites/1 trả 200 OK')
    assert(resRemoveFav.data?.data?.favorited === false, 'favorited = false')

    // Kiểm tra danh sách sau khi xóa
    const resFavListAfterDelete = await requestJson(`${baseUrl}/favorites`, {
      headers: authHeaders,
    })
    const stillHasProd1 = resFavListAfterDelete.data?.data?.some((p) => String(p.id) === '1')
    assert(stillHasProd1 === false, 'Sản phẩm 1 đã được xóa khỏi danh sách yêu thích')
  } catch (err) {
    console.error('Lỗi khi chạy integration test:', err)
    failed++
  } finally {
    console.log('\nDọn dẹp và dừng các tiến trình test...')
    dataApiProc.kill('SIGKILL')
    backendProc.kill('SIGKILL')
  }

  console.log(`\n--- KẾT QUẢ TEST: ${passed} PASS, ${failed} FAIL ---`)
  if (failed > 0) {
    process.exit(1)
  }
}

run()
