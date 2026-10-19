import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

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

/**
 * Tìm cổng mạng TCP ngẫu nhiên khả dụng
 */
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

/**
 * Dừng tiến trình con an toàn
 */
function stopProcess(child, timeoutMs = 6000) {
  if (!child) return Promise.resolve({ exitCode: null, signalCode: null })
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ exitCode: child.exitCode, signalCode: child.signalCode })
  }
  return new Promise((resolve) => {
    let done = false
    const onExit = (code, signal) => {
      if (!done) {
        done = true
        resolve({ exitCode: code ?? child.exitCode, signalCode: signal ?? child.signalCode })
      }
    }
    child.once('exit', onExit)
    child.once('close', onExit)
    try {
      child.kill('SIGTERM')
    } catch {
      return onExit(child.exitCode, child.signalCode)
    }
    setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {}
    }, 2000)
    setTimeout(() => {
      if (!done) {
        done = true
        resolve({ exitCode: child.exitCode, signalCode: child.signalCode })
      }
    }, timeoutMs)
  })
}

/**
 * Đợi server HTTP phản hồi sẵn sàng qua endpoint
 */
async function waitForHttp(url, headers = {}, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(2000) })
      if (res.status === 200) {
        return true
      }
    } catch {
      // Đang chờ khởi động
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

async function runTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP CATALOG (BE-004A) ===\n')

  // Đọc file .env của Data API
  const dataApiEnvConfig = dotenv.parse(
    await import('node:fs').then((fs) => fs.promises.readFile(path.join(dataApiRootDir, '.env'), 'utf8')),
  )

  const dataApiPort = await getAvailablePort()
  const backendPort = await getAvailablePort()
  const serviceKey = dataApiEnvConfig.DATA_API_KEY || 'acc9773aa565602eb7de83b0f36e88d79ed1ee16eeb694d5'

  console.log(`[Khởi động] Data API chạy trên cổng: ${dataApiPort}`)
  console.log(`[Khởi động] Backend chạy trên cổng: ${backendPort}`)

  // 1. Khởi chạy tiến trình Data API production
  const dataApiProcess = spawn(process.execPath, ['src/server.js'], {
    cwd: dataApiRootDir,
    env: {
      ...process.env,
      ...dataApiEnvConfig,
      PORT: String(dataApiPort),
      HOST: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  dataApiProcess.stderr.on('data', (d) => {
    const s = d.toString()
    if (!s.includes('ExperimentalWarning')) {
      // console.error('[Data API stderr]', s.trim())
    }
  })

  // 2. Khởi chạy tiến trình Backend production
  const backendProcess = spawn(process.execPath, ['src/server.js'], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(backendPort),
      NODE_ENV: 'test',
      CORS_ORIGINS: 'http://localhost:5173',
      DATA_API_URL: `http://127.0.0.1:${dataApiPort}`,
      DATA_API_KEY: serviceKey,
      JWT_SECRET: 'test_catalog_jwt_secret_min_32_characters_random_key_123',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  backendProcess.stderr.on('data', (d) => {
    const s = d.toString()
    if (!s.includes('ExperimentalWarning')) {
      // console.error('[Backend stderr]', s.trim())
    }
  })

  try {
    // Chờ Data API sẵn sàng (sử dụng Aiven MySQL)
    console.log('[Kết nối] Đang chờ Data API kết nối MySQL Aiven...')
    const dataApiReady = await waitForHttp(
      `http://127.0.0.1:${dataApiPort}/internal/v1/ready`,
      { 'x-service-key': serviceKey },
      20000,
    )
    if (!dataApiReady) {
      throw new Error('Data API không sẵn sàng trong vòng 20s. Vui lòng kiểm tra kết nối Aiven.')
    }
    console.log('✓ Data API đã sẵn sàng và kết nối thành công với MySQL Aiven.\n')

    // Chờ Backend sẵn sàng
    console.log('[Kết nối] Đang chờ Backend kết nối Data API...')
    const backendReady = await waitForHttp(`http://127.0.0.1:${backendPort}/api/v1/ready`, {}, 15000)
    if (!backendReady) {
      throw new Error('Backend không sẵn sàng trong vòng 15s.')
    }
    console.log('✓ Backend đã sẵn sàng.\n')

    const baseUrl = `http://127.0.0.1:${backendPort}/api/v1`

    // =========================================================================
    // TEST NHÓM 1: GET /api/v1/categories
    // =========================================================================
    console.log('--- 1. Kiểm tra GET /api/v1/categories ---')
    {
      const res = await fetch(`${baseUrl}/categories`)
      const json = await res.json()

      assert(res.status === 200, 'GET /api/v1/categories trả về mã HTTP 200')
      assert(json.success === true, 'Envelope success === true')
      assert(Array.isArray(json.data), 'data là một mảng danh mục')
      assert(json.data.length >= 2, 'Tìm thấy ít nhất 2 danh mục trong cơ sở dữ liệu Aiven')

      const cat1 = json.data.find((c) => c.slug === 'thoi-trang-nam')
      assert(Boolean(cat1), 'Có danh mục "thoi-trang-nam"')
      if (cat1) {
        assert(typeof cat1.id === 'string' && cat1.id === '1', 'ID danh mục là chuỗi "1"')
        assert(cat1.name === 'Thời trang nam', 'Tên danh mục đúng "Thời trang nam"')
        assert(typeof cat1.sortOrder === 'number', 'sortOrder là kiểu số')
      }

      const cat2 = json.data.find((c) => c.slug === 'dien-thoai')
      assert(Boolean(cat2), 'Có danh mục "dien-thoai"')
      if (cat2) {
        assert(typeof cat2.id === 'string' && cat2.id === '2', 'ID danh mục là chuỗi "2"')
      }
    }

    // =========================================================================
    // TEST NHÓM 2: GET /api/v1/products (Danh sách, phân trang, envelope)
    // =========================================================================
    console.log('\n--- 2. Kiểm tra GET /api/v1/products (Danh sách & cấu trúc trường) ---')
    {
      const res = await fetch(`${baseUrl}/products`)
      const json = await res.json()

      assert(res.status === 200, 'GET /api/v1/products trả về HTTP 200')
      assert(json.success === true, 'Envelope success === true')
      assert(Array.isArray(json.data), 'data là mảng sản phẩm')
      assert(typeof json.meta === 'object' && json.meta !== null, 'Có trường meta phân trang')
      assert(json.meta.page === 1, 'meta.page === 1')
      assert(json.meta.limit === 24, 'meta.limit mặc định === 24')
      assert(json.meta.total >= 2, 'meta.total >= 2')

      const p1 = json.data.find((p) => p.slug === 'ao-thun-mau')
      assert(Boolean(p1), 'Tìm thấy sản phẩm "ao-thun-mau"')
      if (p1) {
        assert(typeof p1.id === 'string', 'ID sản phẩm là chuỗi')
        assert(typeof p1.price === 'number' && p1.price === 180000, 'Giá sản phẩm đại diện lấy đúng từ SKU (180.000đ)')
        assert(typeof p1.originalPrice === 'number' && p1.originalPrice === 220000, 'Giá gốc originalPrice là 220.000đ')
        assert(p1.discount === 18, 'Phần trăm giảm giá discount tính đúng (18%)')
        assert(typeof p1.stock === 'number' && p1.stock === 18, 'Tổng tồn kho stock tính đúng (10 + 8 = 18)')
        assert(Array.isArray(p1.badges), 'badges là một mảng')
        assert(typeof p1.shop === 'object' && typeof p1.shop.id === 'string', 'Thông tin shop có ID dạng chuỗi')
        assert(typeof p1.category === 'object' && typeof p1.category.id === 'string', 'Thông tin category có ID dạng chuỗi')
      }
    }

    // =========================================================================
    // TEST NHÓM 3: Phân trang (Pagination)
    // =========================================================================
    console.log('\n--- 3. Kiểm tra Phân trang GET /api/v1/products?page=...&limit=... ---')
    {
      // Trang 1 limit 1
      const res1 = await fetch(`${baseUrl}/products?page=1&limit=1`)
      const json1 = await res1.json()
      assert(res1.status === 200, 'page=1&limit=1 trả về HTTP 200')
      assert(json1.data.length === 1, 'data chỉ chứa đúng 1 sản phẩm')
      assert(json1.meta.page === 1 && json1.meta.limit === 1, 'meta phản ánh đúng page=1, limit=1')

      // Trang 2 limit 1
      const res2 = await fetch(`${baseUrl}/products?page=2&limit=1`)
      const json2 = await res2.json()
      assert(res2.status === 200, 'page=2&limit=1 trả về HTTP 200')
      assert(json2.data.length === 1, 'data trang 2 chỉ chứa đúng 1 sản phẩm')
      assert(json2.meta.page === 2 && json2.meta.limit === 1, 'meta phản ánh đúng page=2, limit=1')
      assert(json1.data[0].id !== json2.data[0].id, 'Sản phẩm ở trang 1 khác sản phẩm ở trang 2')
    }

    // =========================================================================
    // TEST NHÓM 4: Lọc và Tìm kiếm (Filter & Search)
    // =========================================================================
    console.log('\n--- 4. Kiểm tra Bộ lọc & Tìm kiếm ---')
    {
      // Tìm kiếm từ khóa q
      const resQ = await fetch(`${baseUrl}/products?q=thun`)
      const jsonQ = await resQ.json()
      assert(resQ.status === 200, 'Tìm kiếm ?q=thun trả về HTTP 200')
      assert(jsonQ.data.some((p) => p.slug === 'ao-thun-mau'), 'Tìm thấy "ao-thun-mau" khi q=thun')

      // Lọc theo categoryId
      const resCat = await fetch(`${baseUrl}/products?categoryId=1`)
      const jsonCat = await resCat.json()
      assert(resCat.status === 200, 'Lọc ?categoryId=1 trả về HTTP 200')
      assert(
        jsonCat.data.length > 0 && jsonCat.data.every((p) => p.category.id === '1'),
        'Tất cả sản phẩm trả về đều thuộc categoryId = 1',
      )

      // Lọc theo shopId
      const resShop = await fetch(`${baseUrl}/products?shopId=2`)
      const jsonShop = await resShop.json()
      assert(resShop.status === 200, 'Lọc ?shopId=2 trả về HTTP 200')
      assert(
        jsonShop.data.length > 0 && jsonShop.data.every((p) => p.shop.id === '2'),
        'Tất cả sản phẩm trả về đều thuộc shopId = 2',
      )

      // Sắp xếp giá tăng dần (price_asc)
      const resAsc = await fetch(`${baseUrl}/products?sort=price_asc`)
      const jsonAsc = await resAsc.json()
      assert(resAsc.status === 200, 'Sắp xếp ?sort=price_asc trả về HTTP 200')
      if (jsonAsc.data.length >= 2) {
        assert(jsonAsc.data[0].price <= jsonAsc.data[1].price, 'Sản phẩm đầu có giá nhỏ hơn hoặc bằng sản phẩm sau')
      }

      // Sắp xếp giá giảm dần (price_desc)
      const resDesc = await fetch(`${baseUrl}/products?sort=price_desc`)
      const jsonDesc = await resDesc.json()
      assert(resDesc.status === 200, 'Sắp xếp ?sort=price_desc trả về HTTP 200')
      if (jsonDesc.data.length >= 2) {
        assert(jsonDesc.data[0].price >= jsonDesc.data[1].price, 'Sản phẩm đầu có giá lớn hơn hoặc bằng sản phẩm sau')
      }
    }

    // =========================================================================
    // TEST NHÓM 5: Chi tiết sản phẩm hợp lệ (Product Detail Valid)
    // =========================================================================
    console.log('\n--- 5. Kiểm tra Chi tiết sản phẩm GET /api/v1/products/:idOrSlug ---')
    {
      // Tra cứu bằng ID số
      const resById = await fetch(`${baseUrl}/products/1`)
      const jsonById = await resById.json()
      assert(resById.status === 200, 'GET /api/v1/products/1 trả về HTTP 200')
      assert(jsonById.success === true, 'Envelope success === true')
      assert(jsonById.data.id === '1', 'ID sản phẩm là "1"')
      assert(jsonById.data.slug === 'ao-thun-mau', 'Slug sản phẩm là "ao-thun-mau"')
      assert(Array.isArray(jsonById.data.variants) && jsonById.data.variants.length === 2, 'Có 2 biến thể SKU')
      assert(Array.isArray(jsonById.data.specs), 'specs là một mảng [{ label, value }]')
      assert(
        jsonById.data.specs.some((s) => s.label === 'Chất liệu' && s.value === 'Cotton'),
        'Thông số kỹ thuật specs mapping đúng { label: "Chất liệu", value: "Cotton" }',
      )
      assert(jsonById.data.shop.name === 'Shop mẫu A', 'Tên shop là "Shop mẫu A"')

      // Tra cứu bằng Slug
      const resBySlug = await fetch(`${baseUrl}/products/ao-thun-mau`)
      const jsonBySlug = await resBySlug.json()
      assert(resBySlug.status === 200, 'GET /api/v1/products/ao-thun-mau trả về HTTP 200')
      assert(jsonBySlug.data.id === '1', 'Tra cứu bằng slug trả về đúng ID "1"')

      // Tra cứu sản phẩm thứ hai bằng slug
      const resSac = await fetch(`${baseUrl}/products/cu-sac-mau`)
      const jsonSac = await resSac.json()
      assert(resSac.status === 200, 'GET /api/v1/products/cu-sac-mau trả về HTTP 200')
      assert(jsonSac.data.price === 350000, 'Giá củ sạc là 350.000đ')
      assert(jsonSac.data.variants.length === 1, 'Củ sạc có 1 SKU mặc định')
    }

    // =========================================================================
    // TEST NHÓM 6: Chi tiết không tồn tại trả về 404
    // =========================================================================
    console.log('\n--- 6. Kiểm tra Chi tiết không tồn tại (HTTP 404 PRODUCT_NOT_FOUND) ---')
    {
      // ID không tồn tại
      const res404Id = await fetch(`${baseUrl}/products/999999`)
      const json404Id = await res404Id.json()
      assert(res404Id.status === 404, 'Tra cứu ID 999999 trả về HTTP 404')
      assert(json404Id.success === false, 'Envelope success === false')
      assert(json404Id.error?.code === 'PRODUCT_NOT_FOUND', 'Mã lỗi là PRODUCT_NOT_FOUND')

      // Slug không tồn tại
      const res404Slug = await fetch(`${baseUrl}/products/san-pham-khong-ton-tai-abc-xyz`)
      const json404Slug = await res404Slug.json()
      assert(res404Slug.status === 404, 'Tra cứu slug không tồn tại trả về HTTP 404')
      assert(json404Slug.error?.code === 'PRODUCT_NOT_FOUND', 'Mã lỗi là PRODUCT_NOT_FOUND')
    }

    // =========================================================================
    // TEST NHÓM 7: Query sai trả về 400 INVALID_QUERY
    // =========================================================================
    console.log('\n--- 7. Kiểm tra Query sai (HTTP 400 INVALID_QUERY) ---')
    {
      // page = 0
      const resP0 = await fetch(`${baseUrl}/products?page=0`)
      const jsonP0 = await resP0.json()
      assert(resP0.status === 400, 'page=0 trả về HTTP 400')
      assert(jsonP0.error?.code === 'INVALID_QUERY', 'Mã lỗi là INVALID_QUERY')

      // page = abc
      const resPabc = await fetch(`${baseUrl}/products?page=abc`)
      const jsonPabc = await resPabc.json()
      assert(resPabc.status === 400, 'page=abc trả về HTTP 400')
      assert(jsonPabc.error?.code === 'INVALID_QUERY', 'Mã lỗi là INVALID_QUERY')

      // limit = 0
      const resL0 = await fetch(`${baseUrl}/products?limit=0`)
      const jsonL0 = await resL0.json()
      assert(resL0.status === 400, 'limit=0 trả về HTTP 400')
      assert(jsonL0.error?.code === 'INVALID_QUERY', 'Mã lỗi là INVALID_QUERY')

      // limit = 101 (> 100)
      const resL101 = await fetch(`${baseUrl}/products?limit=101`)
      const jsonL101 = await resL101.json()
      assert(resL101.status === 400, 'limit=101 trả về HTTP 400')
      assert(jsonL101.error?.code === 'INVALID_QUERY', 'Mã lỗi là INVALID_QUERY')

      // categoryId = invalid
      const resCInvalid = await fetch(`${baseUrl}/products?categoryId=khong-hop-le`)
      const jsonCInvalid = await resCInvalid.json()
      assert(resCInvalid.status === 400, 'categoryId không phải số nguyên trả về HTTP 400')
      assert(jsonCInvalid.error?.code === 'INVALID_QUERY', 'Mã lỗi là INVALID_QUERY')

      // shopId = invalid
      const resSInvalid = await fetch(`${baseUrl}/products?shopId=khong-hop-le`)
      const jsonSInvalid = await resSInvalid.json()
      assert(resSInvalid.status === 400, 'shopId không phải số nguyên trả về HTTP 400')
      assert(jsonSInvalid.error?.code === 'INVALID_QUERY', 'Mã lỗi là INVALID_QUERY')
    }
  } finally {
    console.log('\n[Dọn dẹp] Đang dừng các tiến trình kiểm thử...')
    await stopProcess(backendProcess)
    await stopProcess(dataApiProcess)
    console.log('[Dọn dẹp] Đã tắt Data API và Backend thành công.')
  }

  console.log('\n=== TỔNG KẾT KẾT QUẢ KIỂM THỬ CATALOG (BE-004A) ===')
  console.log(`Số test vượt qua (PASS): ${passed}`)
  console.log(`Số test thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ bài kiểm tra Catalog API trên dữ liệu Aiven đều ĐẠT (PASS)!')
    process.exit(0)
  }
}

runTests().catch((err) => {
  console.error('[Integration Test Error]:', err)
  process.exit(1)
})
