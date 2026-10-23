import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

const TEST_JWT_SECRET = 'test_integration_ai_jwt_secret_min_32_characters_12345'
const TEST_SERVICE_KEY = 'test_integration_ai_service_key_64_characters_entropy_secret_key'

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

async function stopProcess(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return
  const closed = new Promise((resolve) => proc.once('close', resolve))
  proc.kill()
  await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 3000))])
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
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP TRỢ LÝ NOVA AI (POST /api/v1/ai/chat) ===\n')

  const dataApiPort = await getAvailablePort()
  const backendPort = await getAvailablePort()

  let dataProc = null
  let backendProc = null
  let mockServer = null
  let mockBackendProc = null

  try {
    // =========================================================================
    // PHẦN 1: TÍCH HỢP HỆ THỐNG THẬT (REAL DATA API + REAL BACKEND)
    // =========================================================================
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

    // 1. Kiểm tra validation tham số đầu vào
    console.log('\n--- 1. Kiểm tra Validation POST /api/v1/ai/chat ---')
    {
      const resEmpty = await requestHttp(backendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: {},
      })
      assert(resEmpty.status === 400, 'Thiếu message trả HTTP 400')
      assert(resEmpty.body?.success === false, 'success === false khi thiếu message')
      assert(resEmpty.body?.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR')
      assert(resEmpty.body?.error?.field === 'message', 'Field lỗi là message')

      const resWhitespace = await requestHttp(backendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: '    ' },
      })
      assert(resWhitespace.status === 400, 'message toàn khoảng trắng trả HTTP 400')
      assert(resWhitespace.body?.error?.code === 'VALIDATION_ERROR', 'Mã lỗi khoảng trắng là VALIDATION_ERROR')

      const resWrongType = await requestHttp(backendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 12345 },
      })
      assert(resWrongType.status === 400, 'message sai kiểu số trả HTTP 400')

      const resObject = await requestHttp(backendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: { text: 'hello' } },
      })
      assert(resObject.status === 400, 'message dạng object trả HTTP 400')

      const resTooLong = await requestHttp(backendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'A'.repeat(2001) },
      })
      assert(resTooLong.status === 400, 'message quá 2000 ký tự trả HTTP 400')
      assert(resTooLong.body?.error?.code === 'MESSAGE_TOO_LONG', 'Mã lỗi là MESSAGE_TOO_LONG')
    }

    // 2. Chào hỏi & Tư vấn chung (Guest - Chưa đăng nhập)
    console.log('\n--- 2. Chào hỏi & Tư vấn chung (Khách vãng lai) ---')
    {
      const resGreeting = await requestHttp(backendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Xin chào Nova AI! Bạn có thể giúp gì cho tôi?' },
      })
      assert(resGreeting.status === 200, 'Chào hỏi trả HTTP 200 OK')
      assert(resGreeting.body?.success === true, 'Envelope success === true')
      assert(typeof resGreeting.body?.data?.reply === 'string', 'Có nội dung câu trả lời text')
      assert(resGreeting.body?.data?.reply.includes('Nova AI'), 'Câu trả lời tự xưng Nova AI')
      assert(resGreeting.body?.data?.intent === 'general_consulting', 'Ý định là general_consulting')
      assert(Array.isArray(resGreeting.body?.data?.suggestions), 'suggestions là một mảng')
      assert(resGreeting.body?.data?.suggestions.length > 0, 'Có ít nhất 1 gợi ý câu hỏi')
    }

    // 3. Tư vấn & Gợi ý sản phẩm (Product Recommendation)
    console.log('\n--- 3. Tư vấn & Gợi ý sản phẩm ---')
    {
      const resProduct = await requestHttp(backendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Gợi ý cho tôi tai nghe bluetooth chống ồn' },
      })
      assert(resProduct.status === 200, 'Hỏi sản phẩm trả HTTP 200 OK')
      assert(resProduct.body?.data?.intent === 'product_recommendation', 'Ý định là product_recommendation')
      assert(typeof resProduct.body?.data?.intentTitle === 'string', 'Có intentTitle')
      assert(Array.isArray(resProduct.body?.data?.products), 'products trả về là một mảng')
      assert(resProduct.body?.data?.products.length > 0, 'Tìm thấy sản phẩm trong danh mục')
      const firstProduct = resProduct.body?.data?.products[0]
      assert(typeof firstProduct.id !== 'undefined', 'Sản phẩm có id')
      assert(typeof firstProduct.name === 'string', 'Sản phẩm có name')
      assert(typeof firstProduct.price === 'number', 'Sản phẩm có price số')
    }

    // 4. Tư vấn phối đồ thời trang (Outfit & Combo)
    console.log('\n--- 4. Tư vấn phối đồ thời trang (Outfit Combo) ---')
    {
      const resOutfit = await requestHttp(backendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Tư vấn cho mình set đồ đi tiệc tối sang trọng dưới 500k' },
      })
      assert(resOutfit.status === 200, 'Hỏi phối đồ trả HTTP 200 OK')
      assert(resOutfit.body?.data?.intent === 'outfit_combo', 'Ý định là outfit_combo')
      assert(typeof resOutfit.body?.data?.outfitCombo === 'object', 'outfitCombo là object')
      assert(resOutfit.body?.data?.outfitCombo?.isOutfitCombo === true, 'isOutfitCombo === true')
      assert(typeof resOutfit.body?.data?.outfitCombo?.comboPrice === 'string', 'Có giá combo')
      if (resOutfit.body?.data?.products?.length > 0) {
        const calculatedSum = resOutfit.body.data.products.reduce((acc, p) => acc + Number(p.price || 0), 0)
        const expectedCombo = Number(calculatedSum).toLocaleString('vi-VN') + ' ₫'
        assert(resOutfit.body.data.outfitCombo.comboPrice === expectedCombo, `Giá combo (${resOutfit.body.data.outfitCombo.comboPrice}) khớp chính xác tổng giá sản phẩm thật (${expectedCombo})`)
      }
    }

    // 5. Khuyến mãi & Mã giảm giá Voucher
    console.log('\n--- 5. Khuyến mãi & Mã giảm giá Voucher ---')
    {
      const resVoucher = await requestHttp(backendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'ShopNova hiện có voucher mã giảm giá nào không?' },
      })
      assert(resVoucher.status === 200, 'Hỏi voucher trả HTTP 200 OK')
      assert(resVoucher.body?.data?.intent === 'promotion_voucher', 'Ý định là promotion_voucher')
      assert(Array.isArray(resVoucher.body?.data?.vouchers), 'vouchers trả về là một mảng')
      for (const v of resVoucher.body?.data?.vouchers || []) {
        assert(v.isActive === true, `Voucher ${v.code} có isActive === true`)
      }
    }

    // 6. Tra cứu đơn hàng khi CHƯA đăng nhập
    console.log('\n--- 6. Tra cứu đơn hàng khi CHƯA đăng nhập ---')
    {
      const resOrderGuest = await requestHttp(backendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Tra cứu giúp tôi đơn hàng đã đặt khi nào giao?' },
      })
      assert(resOrderGuest.status === 200, 'Hỏi đơn hàng khi chưa đăng nhập trả HTTP 200')
      assert(resOrderGuest.body?.data?.intent === 'order_tracking', 'Ý định là order_tracking')
      assert(resOrderGuest.body?.data?.reply.includes('đăng nhập'), 'Nhắc nhở người dùng đăng nhập')
      assert(resOrderGuest.body?.data?.orderData === null, 'orderData là null khi chưa đăng nhập')
    }

    // 7. Tra cứu đơn hàng khi ĐÃ ĐĂNG NHẬP (Cá nhân hóa theo User)
    console.log('\n--- 7. Tra cứu đơn hàng khi ĐÃ ĐĂNG NHẬP (User Token) ---')
    {
      const resOrderAuth = await requestHttp(backendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { message: 'Đơn hàng của tôi đang ở đâu rồi Nova?' },
      })
      assert(resOrderAuth.status === 200, 'Hỏi đơn hàng khi đã đăng nhập trả HTTP 200')
      assert(resOrderAuth.body?.data?.intent === 'order_tracking', 'Ý định là order_tracking')
      if (resOrderAuth.body?.data?.orderData) {
        assert(typeof resOrderAuth.body?.data?.orderData?.code === 'string', 'orderData có mã code đơn hàng')
        assert(typeof resOrderAuth.body?.data?.orderData?.status === 'string', 'orderData có status')
        assert(typeof resOrderAuth.body?.data?.orderData?.total === 'number', 'orderData có total tiền')
      } else {
        assert(resOrderAuth.body?.data?.orderData === null, 'orderData là null khi tài khoản chưa có đơn hàng hoặc upstream gián đoạn')
        assert(
          resOrderAuth.body?.data?.reply.includes('chưa có đơn hàng nào') ||
          /không thể|tạm thời|thử lại|không khả dụng|gián đoạn/i.test(resOrderAuth.body?.data?.reply || ''),
          'Thông báo người dùng chưa có đơn hàng hoặc upstream gián đoạn',
        )
      }
    }

    // =========================================================================
    // PHẦN 2: KIỂM THỬ HỒI QUY CHUYÊN SÂU 5 LỖI REVIEW (MOCK DATA API)
    // =========================================================================
    console.log('\n==================================================================')
    console.log('=== PHẦN 2: KIỂM THỬ HỒI QUY 5 LỖI REVIEW QUA MOCK DATA API ===')
    console.log('==================================================================\n')

    const mockPort = await getAvailablePort()
    const mockBackendPort = await getAvailablePort()

    // Trạng thái dữ liệu giả lập có thể điều khiển linh hoạt theo từng ca kiểm thử
    const mockState = {
      vouchers: [],
      products: [],
      orders: [],
      orderDetailMap: new Map(),
      voucherError: false,
      orderError: false,
      productsError: false,
      profileError: false,
      calls: [],
    }

    mockServer = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://127.0.0.1:${mockPort}`)
      const pathname = parsedUrl.pathname
      mockState.calls.push(pathname + parsedUrl.search)

      // Health check
      if (pathname === '/internal/v1/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: true, service: 'shopnova-data-api', status: 'ok' }))
      }

      // User auth profile endpoint: GET /internal/v1/users/:id/auth-profile
      const userMatch = pathname.match(/^\/internal\/v1\/users\/([^/]+)\/auth-profile$/)
      if (userMatch) {
        if (mockState.profileError) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: { code: 'DATABASE_UNAVAILABLE' } }))
        }
        const id = userMatch[1]
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({
          success: true,
          data: {
            user: {
              id: String(id),
              username: `buyer_${id}`,
              fullName: `Người Mua ${id}`,
              email: `buyer${id}@example.com`,
              phone: null,
              avatarUrl: null,
              role: 'buyer',
              status: 'active',
              shopId: null,
            },
          },
        }))
      }

      // Vouchers endpoint: GET /internal/v1/vouchers
      if (pathname === '/internal/v1/vouchers') {
        if (mockState.voucherError) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: { code: 'DATABASE_UNAVAILABLE' } }))
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: true, data: mockState.vouchers }))
      }

      // Products endpoint: GET /internal/v1/products (hỗ trợ sort price_asc và phân trang)
      if (pathname === '/internal/v1/products') {
        if (mockState.productsError) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: { code: 'DATABASE_UNAVAILABLE' } }))
        }
        const q = parsedUrl.searchParams.get('q')?.toLowerCase() || ''
        const sort = parsedUrl.searchParams.get('sort')
        const page = Number(parsedUrl.searchParams.get('page') || 1)
        const limit = Number(parsedUrl.searchParams.get('limit') || 24)

        let items = mockState.products.filter(p => !q || (p.name + ' ' + (p.description || '')).toLowerCase().includes(q))
        if (sort === 'price_asc') {
          items.sort((a, b) => Number(a.price) - Number(b.price))
        } else if (sort === 'price_desc') {
          items.sort((a, b) => Number(b.price) - Number(a.price))
        }

        const total = items.length
        const totalPages = Math.ceil(total / limit) || 1
        const offset = (page - 1) * limit
        items = items.slice(offset, offset + limit)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({
          success: true,
          data: items,
          meta: {
            total,
            page,
            limit,
            totalPages,
          },
        }))
      }

      // Orders list endpoint: GET /internal/v1/orders
      if (pathname === '/internal/v1/orders') {
        if (mockState.orderError) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: { code: 'DATABASE_UNAVAILABLE' } }))
        }
        const userId = parsedUrl.searchParams.get('userId')
        const limit = Number(parsedUrl.searchParams.get('limit') || 10)
        const filtered = mockState.orders.filter((o) => !userId || String(o.buyerId || o.buyer_id) === String(userId)).slice(0, limit)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: true, data: filtered, meta: { total: filtered.length } }))
      }

      // Order detail endpoint: GET /internal/v1/orders/:orderIdOrCode
      const orderMatch = pathname.match(/^\/internal\/v1\/orders\/([^/]+)$/)
      if (orderMatch) {
        if (mockState.orderError) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: false, error: { code: 'DATABASE_UNAVAILABLE' } }))
        }
        const codeOrId = decodeURIComponent(orderMatch[1]).toUpperCase()
        const userId = parsedUrl.searchParams.get('userId')
        const order = mockState.orderDetailMap.get(codeOrId) || mockState.orders.find(o => (o.code === codeOrId || String(o.id) === codeOrId))

        if (order && (!userId || String(order.buyerId || order.buyer_id) === String(userId))) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ success: true, data: order }))
        }

        res.writeHead(404, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ success: false, message: 'Không tìm thấy thông tin đơn hàng.', error: { code: 'ORDER_NOT_FOUND' } }))
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, message: 'Not found' }))
    })

    await new Promise((resolve) => mockServer.listen(mockPort, '127.0.0.1', resolve))
    console.log(`[Khởi động] Mock Data API cổng: ${mockPort}`)

    mockBackendProc = await startProcess('Mock Backend', rootDir, {
      PORT: String(mockBackendPort),
      DATA_API_URL: `http://127.0.0.1:${mockPort}`,
      DATA_API_KEY: TEST_SERVICE_KEY,
      JWT_SECRET: TEST_JWT_SECRET,
    })
    console.log(`[Khởi động] Mock Backend cổng: ${mockBackendPort}`)

    const mockBackendUrl = `http://127.0.0.1:${mockBackendPort}`

    // -------------------------------------------------------------------------
    // Lỗi 1 [P1]: Đọc đúng danh sách voucher từ mảng, không tự bịa NOVA20K khi kho chỉ có LIVE50 hoặc rỗng
    // -------------------------------------------------------------------------
    console.log('\n--- Kiểm thử Lỗi 1 [P1]: Đọc danh sách voucher thực tế & Bỏ voucher giả ---')
    {
      // Trường hợp 1A: Upstream chỉ có LIVE50
      mockState.vouchers = [
        {
          id: 50,
          code: 'LIVE50',
          name: 'Voucher Livestream 50k',
          discountAmount: 50000,
          minSubtotal: 250000,
          isActive: true,
        },
      ]

      const resLive50 = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Shop có voucher gì hot không?' },
      })
      assert(resLive50.status === 200, 'Hỏi voucher trả HTTP 200')
      assert(Array.isArray(resLive50.body?.data?.vouchers), 'vouchers trả về là một mảng')
      assert(resLive50.body?.data?.vouchers.length === 1, 'Chỉ có đúng 1 voucher LIVE50')
      assert(resLive50.body?.data?.vouchers[0].code === 'LIVE50', 'Mã voucher đúng là LIVE50')
      assert(!resLive50.body?.data?.reply.includes('NOVA20K'), 'Reply tuyệt đối KHÔNG quảng cáo mã giả NOVA20K')
      assert(resLive50.body?.data?.reply.includes('LIVE50'), 'Reply quảng cáo mã thật LIVE50')

      // Trường hợp 1B: Kho rỗng (hoặc lỗi 503)
      mockState.vouchers = []
      const resEmptyVoucher = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Có mã giảm giá nào không?' },
      })
      assert(resEmptyVoucher.status === 200, 'Kho voucher rỗng trả HTTP 200')
      assert(Array.isArray(resEmptyVoucher.body?.data?.vouchers) && resEmptyVoucher.body.data.vouchers.length === 0, 'vouchers là mảng rỗng [] khi kho rỗng')
      assert(!resEmptyVoucher.body?.data?.reply.includes('NOVA20K'), 'Khi kho rỗng tuyệt đối KHÔNG trả mã fallback NOVA20K')
      assert(resEmptyVoucher.body?.data?.reply.includes('chưa có mã giảm giá'), 'Thông báo lịch sự chưa có voucher mở')
    }

    // -------------------------------------------------------------------------
    // Lỗi 2 [P1]: Giá combo dựa trên tổng sản phẩm thực tế (không hardcode 469.000 ₫ / 85.000 ₫)
    // -------------------------------------------------------------------------
    console.log('\n--- Kiểm thử Lỗi 2 [P1]: Giá combo tính từ sản phẩm thật ---')
    {
      // Trường hợp 2A: 2 sản phẩm tổng 1.300.000 ₫
      mockState.products = [
        {
          id: 301,
          name: 'Áo Blazer Hàn Quốc Form Rộng',
          price: 700000,
          originalPrice: 800000,
          shopName: 'Shop Thời Trang Hàn Quốc',
        },
        {
          id: 302,
          name: 'Quần Âu Suông Ống Rộng',
          price: 600000,
          originalPrice: 650000,
          shopName: 'Shop Thời Trang Hàn Quốc',
        },
      ]

      const resOutfit = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Tư vấn cho mình set đồ đi tiệc sang trọng' },
      })
      assert(resOutfit.status === 200, 'Hỏi phối đồ trả HTTP 200')
      assert(resOutfit.body?.data?.outfitCombo?.comboPrice === '1.300.000 ₫', 'Giá combo tính đúng 1.300.000 ₫ (KHÔNG phải 469.000 ₫)')
      assert(resOutfit.body?.data?.outfitCombo?.budgetSaved === 'Tiết kiệm 150.000 ₫', 'Mức tiết kiệm tính đúng 150.000 ₫ (KHÔNG phải 85.000 ₫)')
      assert(resOutfit.body?.data?.reply.includes('1.300.000 ₫'), 'Reply hiển thị đúng tổng chi phí 1.300.000 ₫')

      // Trường hợp 2B: Không có sản phẩm nào trong kho
      mockState.products = []
      const resNoOutfit = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Gợi ý set đồ mặc đi chơi' },
      })
      assert(resNoOutfit.status === 200, 'Không có sản phẩm phối đồ trả HTTP 200')
      assert(resNoOutfit.body?.data?.outfitCombo === null, 'outfitCombo là null khi không có sản phẩm (không tự bịa combo ảo)')
      assert(resNoOutfit.body?.data?.products === null, 'products là null khi không có sản phẩm')
      assert(resNoOutfit.body?.data?.reply.includes('chưa có đủ sản phẩm thời trang'), 'Thông báo rõ ràng chưa có sản phẩm phù hợp')
    }

    // -------------------------------------------------------------------------
    // Lỗi 3 [P2]: Tra cứu đúng mã đơn được hỏi và kiểm tra quyền sở hữu
    // -------------------------------------------------------------------------
    console.log('\n--- Kiểm thử Lỗi 3 [P2]: Tra đúng mã đơn được hỏi & Kiểm tra Owner ---')
    {
      const orderOld = {
        id: 101,
        code: 'ORDOLD123',
        buyerId: 1,
        totalAmount: 250000,
        recipientName: 'Nguyễn Văn A',
        addressDetail: 'Số 10 Lý Tự Trọng',
        province: 'TP.HCM',
        shopOrders: [
          {
            id: 201,
            status: 'shipping',
            shippingName: 'Giao Hàng Nhanh',
            trackingCode: 'GHN-OLD-123',
          },
        ],
      }

      const orderNew = {
        id: 102,
        code: 'ORDNEW456',
        buyerId: 1,
        totalAmount: 500000,
        recipientName: 'Nguyễn Văn A',
        addressDetail: 'Số 10 Lý Tự Trọng',
        province: 'TP.HCM',
        shopOrders: [
          {
            id: 202,
            status: 'confirmed',
          },
        ],
      }

      const orderOtherUser = {
        id: 103,
        code: 'ORDOTHER999',
        buyerId: 2, // Thuộc user 2
        totalAmount: 900000,
        recipientName: 'Người Lạ',
        shopOrders: [{ id: 203, status: 'delivered' }],
      }

      mockState.orders = [orderNew, orderOld] // Đơn mới nhất đứng đầu
      mockState.orderDetailMap.set('ORDOLD123', orderOld)
      mockState.orderDetailMap.set('ORDNEW456', orderNew)
      mockState.orderDetailMap.set('ORDOTHER999', orderOtherUser)

      // Hỏi đích danh mã ORDOLD123 -> Phải trả ORDOLD123, KHÔNG được lấy đơn mới nhất ORDNEW456
      const resAskOld = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { message: 'Kiểm tra giúp mình tình trạng đơn hàng ORDOLD123' },
      })
      assert(resAskOld.status === 200, 'Hỏi ORDOLD123 trả HTTP 200')
      assert(resAskOld.body?.data?.orderData?.code === 'ORDOLD123', 'Trả về đúng đơn ORDOLD123 (KHÔNG bị nhầm sang đơn mới ORDNEW456)')
      assert(resAskOld.body?.data?.orderData?.total === 250000, 'Tổng tiền đúng của ORDOLD123 là 250.000 ₫')

      // Hỏi mã đơn của người khác (ORDOTHER999) -> Phải bị từ chối, trả null
      const resAskOther = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { message: 'Tra cứu đơn hàng #ORDOTHER999' },
      })
      assert(resAskOther.status === 200, 'Tra cứu đơn không sở hữu trả HTTP 200')
      assert(resAskOther.body?.data?.orderData === null, 'orderData là null khi không thuộc tài khoản người dùng')
      assert(resAskOther.body?.data?.reply.includes('ORDOTHER999'), 'Nêu rõ không tìm thấy đơn ORDOTHER999 trong tài khoản')
    }

    // -------------------------------------------------------------------------
    // Lỗi 4 [P2]: Thông tin giao vận trung thực theo trạng thái đơn (đơn cancelled không bịa đang giao)
    // -------------------------------------------------------------------------
    console.log('\n--- Kiểm thử Lỗi 4 [P2]: Thông tin giao vận đơn Cancelled & Chưa xác định ---')
    {
      const orderCancelled = {
        id: 104,
        code: 'ORDCANCEL789',
        buyerId: 1,
        totalAmount: 420000,
        recipientName: 'Nguyễn Văn A',
        shopOrders: [
          {
            id: 204,
            status: 'cancelled',
            cancelReason: 'Khách hàng thay đổi địa chỉ nhận hàng',
          },
        ],
      }

      mockState.orderDetailMap.set('ORDCANCEL789', orderCancelled)

      const resCancelled = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { message: 'Đơn hàng ORDCANCEL789 của tôi bao giờ giao?' },
      })
      assert(resCancelled.status === 200, 'Hỏi đơn cancelled trả HTTP 200')
      assert(resCancelled.body?.data?.orderData?.status === 'cancelled', 'Trạng thái là cancelled')
      assert(resCancelled.body?.data?.orderData?.location === 'Đơn hàng đã hủy', 'location ghi rõ "Đơn hàng đã hủy"')
      assert(resCancelled.body?.data?.orderData?.eta === 'Không áp dụng', 'eta ghi rõ "Không áp dụng"')
      assert(resCancelled.body?.data?.orderData?.shipper === null, 'shipper là null cho đơn đã hủy')
      assert(!resCancelled.body?.data?.reply.includes('trung chuyển'), 'Reply tuyệt đối KHÔNG nói "đang trung chuyển"')
      assert(!resCancelled.body?.data?.reply.includes('1-2 ngày'), 'Reply tuyệt đối KHÔNG nói "giao trong 1-2 ngày"')
      assert(resCancelled.body?.data?.reply.includes('Đã hủy đơn hàng'), 'Reply thông báo đúng trạng thái Đã hủy đơn hàng')
      assert(resCancelled.body?.data?.reply.includes('Khách hàng thay đổi địa chỉ'), 'Reply nêu đúng lý do hủy thực tế')
    }

    // -------------------------------------------------------------------------
    // Lỗi 5 [P2]: Áp dụng giới hạn ngân sách (không trả sản phẩm 2.000.000 ₫ cho câu hỏi dưới 200k)
    // -------------------------------------------------------------------------
    console.log('\n--- Kiểm thử Lỗi 5 [P2]: Áp dụng giới hạn ngân sách ---')
    {
      // Kho chỉ có tai nghe đắt tiền 2.000.000 ₫
      mockState.products = [
        {
          id: 401,
          name: 'Tai nghe Bluetooth Apple AirPods Pro 2',
          price: 2000000,
          shopName: 'Apple Flagship Store',
        },
      ]

      // Hỏi tai nghe dưới 200k -> Tuyệt đối không được trả tai nghe 2.000.000 ₫
      const resOverBudget = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Gợi ý cho mình tai nghe dưới 200k với' },
      })
      assert(resOverBudget.status === 200, 'Hỏi tai nghe dưới 200k trả HTTP 200')
      assert(Array.isArray(resOverBudget.body?.data?.products) && resOverBudget.body.data.products.length === 0, 'products là mảng rỗng [] khi toàn bộ sản phẩm vượt ngân sách')
      assert(resOverBudget.body?.data?.intentTitle === 'Không Tìm Thấy Sản Phẩm Phù Hợp Ngân Sách', 'intentTitle nêu rõ không tìm thấy phù hợp ngân sách')
      assert(resOverBudget.body?.data?.reply.includes('dưới 200.000 ₫'), 'Reply phản hồi rõ ràng về mức giá dưới 200.000 ₫')
      assert(resOverBudget.body?.data?.reply.includes('2.000.000 ₫'), 'Reply thông báo mức giá tối thiểu hiện có là 2.000.000 ₫')

      // Bây giờ bổ sung thêm tai nghe 150.000 ₫ vào kho
      mockState.products = [
        {
          id: 401,
          name: 'Tai nghe Bluetooth Apple AirPods Pro 2',
          price: 2000000,
          shopName: 'Apple Flagship Store',
        },
        {
          id: 402,
          name: 'Tai nghe có dây Jack 3.5mm Hoco',
          price: 150000,
          shopName: 'Phụ Kiện Số 24h',
        },
      ]

      const resWithinBudget = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Tìm tai nghe dưới 200k' },
      })
      assert(resWithinBudget.status === 200, 'Hỏi tai nghe dưới 200k khi có hàng trả HTTP 200')
      assert(resWithinBudget.body?.data?.products?.length === 1, 'Chỉ trả về đúng 1 sản phẩm thỏa mãn ngân sách')
      assert(resWithinBudget.body?.data?.products?.[0]?.id === 402, 'Sản phẩm trả về là Tai nghe Hoco (150.000 ₫)')
      assert(resWithinBudget.body?.data?.products?.[0]?.price <= 200000, 'Giá sản phẩm trả về <= 200.000 ₫')
      assert(!resWithinBudget.body?.data?.products?.some((p) => p.price > 200000), 'Tuyệt đối không lọt tai nghe 2.000.000 ₫ vào kết quả')
    }

    // -------------------------------------------------------------------------
    // HỒI QUY REVIEW V2: Các ca kiểm thử bổ sung bảo đảm 100% đạt chuẩn
    // -------------------------------------------------------------------------
    console.log('\n--- Kiểm thử Hồi quy Review v2 (Các ca kiểm tra bổ sung) ---')
    {
      // 1. Thẩm định JWT: token thiếu exp/iat bị từ chối 401 trên /auth/me
      const noExpiryToken = jwt.sign(
        { sub: '1', role: 'buyer' },
        TEST_JWT_SECRET,
        { algorithm: 'HS256', issuer: 'shopnova-backend', audience: 'shopnova-clients', noTimestamp: true }
      )
      const resStrictAuth = await requestHttp(mockBackendUrl, '/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${noExpiryToken}` },
      })
      assert(resStrictAuth.status === 401, 'Token thiếu exp/iat bị authenticate từ chối HTTP 401')

      // 2. Optional auth: token thiếu exp/iat không gọi upstream orders
      mockState.calls.length = 0
      const resOptionalAuth = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${noExpiryToken}` },
        body: { message: 'Đơn hàng ORDOLD123' },
      })
      assert(resOptionalAuth.status === 200, 'AI chat với invalid optional auth vẫn trả HTTP 200')
      assert(resOptionalAuth.body?.data?.orderData === null, 'orderData là null khi không có user hợp lệ')
      assert(!mockState.calls.some((url) => url.startsWith('/internal/v1/orders')), 'Optional auth không gọi upstream orders khi token lỗi')

      // 3. Fallback tìm kiếm không lọt laptop 20tr khi tìm tai nghe dưới 200k
      mockState.products = [{ id: '10', name: 'Laptop Gaming', price: 20000000, originalPrice: 20000000 }]
      const resEmptySearch = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Tìm tai nghe dưới 200k' },
      })
      assert(
        (resEmptySearch.body?.data?.products || []).every((p) => p.price <= 200000),
        'Không bao giờ lọt sản phẩm vượt ngân sách khi tìm kiếm rỗng',
      )

      // 4. Sản phẩm rẻ ở trang sau (vị trí 13)
      mockState.products = [
        ...Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), name: `Tai nghe ${i + 1}`, price: 2000000 })),
        { id: '13', name: 'Tai nghe 13', price: 150000 },
      ]
      const resNextPage = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Tìm tai nghe dưới 200k' },
      })
      assert(
        resNextPage.body?.data?.products?.some((p) => String(p.id) === '13'),
        'Lấy được sản phẩm phù hợp ngân sách ở sau trang 1 (id 13)',
      )

      // 5. Đọc đúng số tiền dạng kép "1 triệu 50 nghìn" = 1.050.000 ₫
      mockState.products = [{ id: '1', name: 'Tai nghe chụp tai', price: 1200000 }]
      const resCompoundBudget = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Tìm tai nghe dưới 1 triệu 50 nghìn' },
      })
      assert(
        (resCompoundBudget.body?.data?.products || []).every((p) => p.price <= 1050000),
        'Ngân sách 1 triệu 50 nghìn loại bỏ sản phẩm 1.200.000 ₫',
      )

      // 6. Phối đồ vượt ngân sách không trả combo
      mockState.products = [
        { id: '1', name: 'Áo blazer', price: 700000, originalPrice: 800000 },
        { id: '2', name: 'Áo sơ mi', price: 600000, originalPrice: 650000 },
      ]
      const resOutfitOver = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Phối đồ đi tiệc dưới 500k' },
      })
      const outfitSum = (resOutfitOver.body?.data?.products || []).reduce((sum, p) => sum + Number(p.price), 0)
      assert(outfitSum <= 500000, 'Tổng giá sản phẩm outfit không vượt quá ngân sách 500k')

      // 7. Kho chỉ có laptop không gợi ý combo thời trang
      mockState.products = [{ id: '8', name: 'Laptop', price: 15000000 }]
      const resNoClothes = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Phối đồ đi tiệc' },
      })
      assert(resNoClothes.body?.data?.outfitCombo === null, 'Kho chỉ có laptop trả outfitCombo là null')

      // 8. "Tra cứu mã giảm giá LIVE50" là intent promotion_voucher
      mockState.vouchers = [{ id: '1', code: 'LIVE50', name: 'Voucher Live', discountAmount: 50000, minSubtotal: 250000, isActive: true }]
      const resVoucherLookup = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Tra cứu mã giảm giá LIVE50' },
      })
      assert(resVoucherLookup.body?.data?.intent === 'promotion_voucher', '"Tra cứu mã giảm giá LIVE50" nhận đúng intent promotion_voucher')

      // 9. Upstream voucher 503 thông báo gián đoạn
      mockState.voucherError = true
      const resVoucher503 = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Có voucher gì không?' },
      })
      assert(
        /không thể|tạm thời|thử lại|không khả dụng|gián đoạn|chưa thể|không truy cập/i.test(resVoucher503.body?.data?.reply || ''),
        'Voucher upstream 503 trả reply thông báo gián đoạn dịch vụ',
      )
      mockState.voucherError = false

      // 10. "Xem đơn số 101" nhận đúng intent order_tracking
      const oldOrder = {
        id: '101',
        code: 'ORDOLD123',
        buyerId: '1',
        totalAmount: 500000,
        recipientName: 'Review Buyer',
        addressDetail: 'Test Address',
        shopOrders: [{ id: '201', status: 'shipping', shippingName: 'Review Shipping', items: [{ id: '301', qty: 1 }] }],
      }
      mockState.orders = [oldOrder]
      mockState.orderDetailMap.set('101', oldOrder)
      mockState.orderDetailMap.set('ORDOLD123', oldOrder)

      const resOrderNum = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { message: 'Xem đơn số 101' },
      })
      assert(resOrderNum.body?.data?.intent === 'order_tracking', '"Xem đơn số 101" nhận đúng intent order_tracking')
      assert(resOrderNum.body?.data?.orderData?.code === 'ORDOLD123', 'Tra đúng mã đơn ORDOLD123 từ số đơn 101')

      // 11. Đơn đa shop có 1 shop cancelled và 1 shop shipping -> status !== 'cancelled'
      mockState.orders = [
        {
          ...oldOrder,
          shopOrders: [
            { id: '201', status: 'cancelled', items: [] },
            { id: '202', status: 'shipping', shippingName: 'Review Shipping', items: [{ id: '302', qty: 1 }] },
          ],
        },
      ]
      mockState.orderDetailMap.set('ORDOLD123', mockState.orders[0])

      const resMixedOrder = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { message: 'Đơn hàng ORDOLD123' },
      })
      assert(resMixedOrder.body?.data?.orderData?.status !== 'cancelled', 'Đơn có shop shipping không bị đánh đồng là cancelled')

      // 12. Upstream order 503 thông báo gián đoạn, không nói người dùng chưa đăng nhập
      mockState.orderError = true
      const resOrder503 = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { message: 'Đơn hàng ORDOLD123' },
      })
      assert(
        /không thể|tạm thời|thử lại|không khả dụng|gián đoạn|chưa thể|không truy cập/i.test(resOrder503.body?.data?.reply || ''),
        'Order upstream 503 trả reply thông báo gián đoạn dịch vụ',
      )
      assert(!resOrder503.body?.data?.reply.includes('đăng nhập'), 'Order upstream 503 không nói nhầm là chưa đăng nhập')
      mockState.orderError = false

      // -----------------------------------------------------------------------
      // 8 CA KIỂM THỬ MỞ RỘNG TỪ BÁO CÁO REVIEW V3
      // -----------------------------------------------------------------------

      // E1: budget_cheap_product_101 (100 tai nghe đắt 2tr, tai nghe thứ 101 giá 150k)
      mockState.products = [
        ...Array.from({ length: 100 }, (_, i) => ({ id: String(i + 1), name: `Tai nghe ${i + 1}`, price: 2000000 })),
        { id: '101', name: 'Tai nghe 101', price: 150000 },
      ]
      const resBudget101 = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Tìm tai nghe dưới 200k' },
      })
      assert(
        resBudget101.body?.data?.products?.some((p) => String(p.id) === '101'),
        'E1: budget_cheap_product_101 - Tìm thấy tai nghe 150k ở vị trí 101 nhờ sort=price_asc',
      )

      // E2: outfit_affordable_product_101 (100 áo 700k, sau đó 3 món áo/quần/giày 100k/150k/150k)
      mockState.products = [
        ...Array.from({ length: 100 }, (_, i) => ({ id: `expensive_shirt_${i}`, name: `Áo khoác dạ ${i}`, price: 700000 })),
        { id: 'cheap_shirt', name: 'Áo thun cotton', price: 100000 },
        { id: 'cheap_pants', name: 'Quần short kaki', price: 150000 },
        { id: 'cheap_shoes', name: 'Giày sneaker vải', price: 150000 },
      ]
      const resOutfit101 = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Phối đồ đi tiệc dưới 500k' },
      })
      const comboTotal101 = (resOutfit101.body?.data?.products || []).reduce((sum, p) => sum + Number(p.price), 0)
      assert(
        resOutfit101.body?.data?.outfitCombo !== null && comboTotal101 > 0 && comboTotal101 <= 500000,
        'E2: outfit_affordable_product_101 - Tạo được combo thời trang <= 500k khi món rẻ ở sau 100 món đắt',
      )

      // E3: multi_shop_delivered_pending (Shop 1 delivered, Shop 2 pending -> status !== shipping, không nói đang vận chuyển)
      const multiShopDeliveredPending = {
        id: '201',
        code: 'ORDMULTI1',
        buyerId: '1',
        totalAmount: 600000,
        recipientName: 'Review Buyer',
        addressDetail: 'Test Address',
        shopOrders: [
          { id: '301', status: 'delivered', shippingName: 'Giao Hàng Nhanh', items: [{ id: '401', qty: 1 }] },
          { id: '302', status: 'pending', shippingName: 'Tiết Kiệm', items: [{ id: '402', qty: 1 }] },
        ],
      }
      mockState.orders = [multiShopDeliveredPending]
      mockState.orderDetailMap.set('ORDMULTI1', multiShopDeliveredPending)

      const resDeliveredPending = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { message: 'Đơn hàng ORDMULTI1' },
      })
      assert(
        resDeliveredPending.body?.data?.orderData?.status !== 'shipping',
        'E3: multi_shop_delivered_pending - Đơn delivered + pending không bị gán nhầm thành shipping',
      )
      assert(
        !resDeliveredPending.body?.data?.reply.includes('đang trên đường vận chuyển an toàn'),
        'E3: multi_shop_delivered_pending - Reply không bịa câu kiện hàng đang trên đường vận chuyển an toàn',
      )

      // E4: multi_shop_wrong_shipper (Shop 1 confirmed GHN, Shop 2 shipping GHTK -> shipper phải là GHTK)
      const multiShopWrongShipper = {
        id: '202',
        code: 'ORDMULTI2',
        buyerId: '1',
        totalAmount: 700000,
        recipientName: 'Review Buyer',
        addressDetail: 'Test Address',
        shopOrders: [
          { id: '303', status: 'confirmed', shippingName: 'GHN Standard', items: [{ id: '403', qty: 1 }] },
          { id: '304', status: 'shipping', shippingName: 'GHTK Express', estimatedDelivery: '2 ngày tới', items: [{ id: '404', qty: 1 }] },
        ],
      }
      mockState.orders = [multiShopWrongShipper]
      mockState.orderDetailMap.set('ORDMULTI2', multiShopWrongShipper)

      const resWrongShipper = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { message: 'Đơn hàng ORDMULTI2' },
      })
      assert(
        resWrongShipper.body?.data?.orderData?.status === 'shipping',
        'E4: multi_shop_wrong_shipper - Trạng thái đơn tổng thể là shipping',
      )
      assert(
        resWrongShipper.body?.data?.orderData?.shipper === 'GHTK Express',
        'E4: multi_shop_wrong_shipper - Shipper lấy chính xác từ shop đang shipping (GHTK Express), không lấy từ shop confirmed',
      )

      // E5: outfit_upstream_503 (Endpoint products trả 503 khi hỏi outfit -> reply gián đoạn)
      mockState.productsError = true
      const resOutfit503 = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Phối đồ đi tiệc' },
      })
      assert(
        /không thể|tạm thời|thử lại|không khả dụng|gián đoạn|chưa thể|không truy cập/i.test(resOutfit503.body?.data?.reply || ''),
        'E5: outfit_upstream_503 - Khi products lỗi 503, reply thông báo gián đoạn dịch vụ chứ không nói kho rỗng',
      )
      mockState.productsError = false

      // E6: product_upstream_503 (Endpoint products trả 503 khi hỏi tìm sản phẩm -> reply gián đoạn, giữ intent product_recommendation)
      mockState.productsError = true
      const resProduct503 = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Tìm tai nghe dưới 200k' },
      })
      assert(
        resProduct503.body?.data?.intent === 'product_recommendation',
        'E6: product_upstream_503 - Giữ nguyên intent product_recommendation khi products 503',
      )
      assert(
        /không thể|tạm thời|thử lại|không khả dụng|gián đoạn|chưa thể|không truy cập/i.test(resProduct503.body?.data?.reply || ''),
        'E6: product_upstream_503 - Khi products lỗi 503, reply thông báo gián đoạn dịch vụ chứ không nhảy xuống greeting',
      )
      mockState.productsError = false

      // E7: profile_upstream_503 (Token hợp lệ, auth-profile 503 khi hỏi đơn -> reply gián đoạn, không bắt đăng nhập, không gọi orders)
      mockState.calls.length = 0
      mockState.profileError = true
      const resProfile503 = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUser1}` },
        body: { message: 'Đơn hàng ORDOLD123' },
      })
      assert(
        /không thể|tạm thời|thử lại|không khả dụng|gián đoạn|chưa thể|không truy cập/i.test(resProfile503.body?.data?.reply || ''),
        'E7: profile_upstream_503 - Khi auth-profile 503, reply thông báo gián đoạn xác thực tài khoản',
      )
      assert(
        !resProfile503.body?.data?.reply.includes('đăng nhập'),
        'E7: profile_upstream_503 - Tuyệt đối không yêu cầu người dùng đăng nhập khi token hợp lệ',
      )
      assert(
        !mockState.calls.some((url) => url.startsWith('/internal/v1/orders')),
        'E7: profile_upstream_503 - Tuyệt đối không gọi Data API orders khi chưa xác minh được profile',
      )
      mockState.profileError = false

      // E8: voucher_generic_order_threshold (Hỏi "Có mã giảm giá cho đơn hàng từ 500k không?" -> intent promotion_voucher, gọi vouchers)
      mockState.calls.length = 0
      mockState.vouchers = [
        { id: '1', code: 'LIVE50', name: 'Review Voucher', discountAmount: 50000, minSubtotal: 250000, isActive: true },
      ]
      const resVoucherThreshold = await requestHttp(mockBackendUrl, '/api/v1/ai/chat', {
        method: 'POST',
        body: { message: 'Có mã giảm giá cho đơn hàng từ 500k không?' },
      })
      assert(
        resVoucherThreshold.body?.data?.intent === 'promotion_voucher',
        'E8: voucher_generic_order_threshold - Câu hỏi voucher có điều kiện đơn nhận đúng intent promotion_voucher',
      )
      assert(
        mockState.calls.some((url) => url.startsWith('/internal/v1/vouchers')),
        'E8: voucher_generic_order_threshold - Gọi đúng endpoint /internal/v1/vouchers',
      )
      assert(
        resVoucherThreshold.body?.data?.vouchers?.length === 1 && resVoucherThreshold.body.data.vouchers[0].code === 'LIVE50',
        'E8: voucher_generic_order_threshold - Trả về đúng mã giảm giá LIVE50',
      )
    }

  } finally {
    console.log('\n[Dọn dẹp] Đang tắt các server kiểm thử...')
    await stopProcess(backendProc)
    await stopProcess(dataProc)
    await stopProcess(mockBackendProc)
    if (mockServer) {
      await new Promise((resolve) => mockServer.close(resolve))
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  console.log('\n=== TỔNG KẾT KIỂM THỬ TRỢ LÝ NOVA AI ===')
  console.log(`Số bài kiểm tra vượt qua (PASS): ${passed}`)
  console.log(`Số bài kiểm tra thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    console.error('\n❌ Có bài kiểm tra không đạt!')
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ bài kiểm tra Trợ lý Nova AI đều ĐẠT (PASS)!')
    process.exit(0)
  }
}

run().catch((err) => {
  console.error('Lỗi ngoại lệ khi chạy test:', err)
  process.exit(1)
})
