import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

const TEST_JWT_SECRET = 'test_integration_shop_jwt_secret_min_32_characters_12345'
const TEST_SERVICE_KEY = 'test_integration_shop_service_key_64_characters_entropy_secret_key'

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
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP GIAN HÀNG (BE-004B SHOP API) ===\n')

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

    // 1. Kiểm tra GET /api/v1/shops (Danh sách gian hàng)
    console.log('\n--- 1. Kiểm tra danh sách gian hàng (GET /api/v1/shops) ---')
    {
      const res = await requestHttp(backendUrl, '/api/v1/shops')
      assert(res.status === 200, 'GET /api/v1/shops trả HTTP 200')
      assert(res.body?.success === true, 'Envelope success === true')
      assert(Array.isArray(res.body?.data), 'data là một mảng')
      assert(res.body?.data.length >= 2, 'Tìm thấy ít nhất 2 gian hàng mẫu')

      const firstShop = res.body?.data[0]
      assert(typeof firstShop?.id === 'string', 'ID gian hàng là kiểu chuỗi')
      assert(typeof firstShop?.name === 'string', 'Có trường name kiểu chuỗi')
      assert(typeof firstShop?.slug === 'string', 'Có trường slug kiểu chuỗi')
      assert(typeof firstShop?.province === 'string', 'Có trường province kiểu chuỗi')
      assert(typeof firstShop?.rating === 'number', 'Có trường rating kiểu số')
      assert(typeof firstShop?.followersCount === 'number', 'Có followersCount kiểu số')
      assert(typeof firstShop?.productsCount === 'number', 'Có productsCount kiểu số')
      assert(typeof res.body?.meta?.total === 'number', 'meta.total là số')
      assert(typeof res.body?.meta?.totalPages === 'number', 'meta.totalPages là số')
    }

    // 2. Kiểm tra bộ lọc và phân trang gian hàng
    console.log('\n--- 2. Kiểm tra bộ lọc và phân trang gian hàng ---')
    {
      const resErr = await requestHttp(backendUrl, '/api/v1/shops?page=0')
      assert(resErr.status === 400, 'page=0 trả HTTP 400')
      assert(resErr.body?.error?.code === 'INVALID_QUERY', 'Mã lỗi là INVALID_QUERY')

      const resLimitErr = await requestHttp(backendUrl, '/api/v1/shops?limit=100')
      assert(resLimitErr.status === 400, 'limit=100 vượt 50 trả HTTP 400')

      const resFilter = await requestHttp(backendUrl, '/api/v1/shops?keyword=mẫu')
      assert(resFilter.status === 200, 'Tìm kiếm từ khóa "mẫu" trả HTTP 200')
      assert(resFilter.body?.data.length > 0, 'Tìm thấy kết quả phù hợp từ khóa')

      const resProvince = await requestHttp(backendUrl, '/api/v1/shops?province=Hà%20Nội')
      assert(resProvince.status === 200, 'Lọc tỉnh thành "Hà Nội" trả HTTP 200')
      assert(resProvince.body?.data.every(s => s.province === 'Hà Nội'), 'Tất cả shop trả về đúng tỉnh Hà Nội')
    }

    // 3. Kiểm tra chi tiết gian hàng (GET /api/v1/shops/:shopId)
    console.log('\n--- 3. Kiểm tra chi tiết gian hàng (GET /api/v1/shops/:shopId) ---')
    {
      // Tra cứu theo ID
      const resId = await requestHttp(backendUrl, '/api/v1/shops/1')
      assert(resId.status === 200, 'GET /api/v1/shops/1 trả HTTP 200')
      assert(resId.body?.success === true, 'Envelope success === true')
      assert(resId.body?.data?.id === '1', 'ID gian hàng khớp đúng 1')
      assert(resId.body?.data?.name === 'Shop mẫu A', 'Tên shop khớp "Shop mẫu A"')

      // Tra cứu theo Slug
      const resSlug = await requestHttp(backendUrl, '/api/v1/shops/shop-mau-a')
      assert(resSlug.status === 200, 'GET /api/v1/shops/shop-mau-a theo slug trả HTTP 200')
      assert(resSlug.body?.data?.id === '1', 'Tra cứu theo slug trả đúng shop ID 1')

      // Không tìm thấy gian hàng
      const res404 = await requestHttp(backendUrl, '/api/v1/shops/9999999')
      assert(res404.status === 404, 'Shop không tồn tại trả HTTP 404')
      assert(res404.body?.error?.code === 'SHOP_NOT_FOUND', 'Mã lỗi là SHOP_NOT_FOUND')
    }

    // 4. Kiểm tra sản phẩm của gian hàng (GET /api/v1/shops/:shopId/products)
    console.log('\n--- 4. Kiểm tra sản phẩm của gian hàng ---')
    {
      const resProducts = await requestHttp(backendUrl, '/api/v1/shops/1/products')
      assert(resProducts.status === 200, 'GET /api/v1/shops/1/products trả HTTP 200')
      assert(Array.isArray(resProducts.body?.data), 'Danh sách sản phẩm là một mảng')
      assert(resProducts.body?.data.length > 0, 'Shop 1 có sản phẩm mẫu')

      const prod = resProducts.body?.data[0]
      assert(typeof prod?.id === 'string', 'ID sản phẩm là chuỗi')
      assert(typeof prod?.price === 'number', 'Giá sản phẩm là kiểu số VND')
      assert(prod?.shop?.id === '1', 'Sản phẩm có shop.id === "1"')
      assert(typeof prod?.category?.name === 'string', 'Có tên danh mục')

      // Lấy sản phẩm của shop theo slug
      const resProductsSlug = await requestHttp(backendUrl, '/api/v1/shops/shop-mau-a/products')
      assert(resProductsSlug.status === 200, 'Lấy sản phẩm bằng slug shop trả HTTP 200')

      // Shop không tồn tại
      const resProducts404 = await requestHttp(backendUrl, '/api/v1/shops/9999999/products')
      assert(resProducts404.status === 404, 'Lấy sản phẩm shop không tồn tại trả HTTP 404')
      assert(resProducts404.body?.error?.code === 'SHOP_NOT_FOUND', 'Mã lỗi là SHOP_NOT_FOUND')
    }

  } finally {
    console.log('\n[Dọn dẹp] Đang tắt các server kiểm thử...')
    if (backendProc) backendProc.kill()
    if (dataProc) dataProc.kill()
  }

  console.log('\n=== TỔNG KẾT KIỂM THỬ GIAN HÀNG (BE-004B SHOP API) ===')
  console.log(`Số bài kiểm tra vượt qua (PASS): ${passed}`)
  console.log(`Số bài kiểm tra thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    console.error('\n❌ Có bài kiểm tra không đạt!')
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ bài kiểm tra Shop API đều ĐẠT (PASS)!')
    process.exit(0)
  }
}

run().catch((err) => {
  console.error('Lỗi ngoại lệ khi chạy test:', err)
  process.exit(1)
})
