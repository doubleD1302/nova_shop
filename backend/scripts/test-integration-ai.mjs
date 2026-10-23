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
      assert(resVoucher.body?.data?.vouchers.some((v) => v.code === 'NOVA20K'), 'Tìm thấy voucher NOVA20K')
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
      assert(typeof resOrderAuth.body?.data?.orderData === 'object', 'orderData là một object dữ liệu thật')
      assert(typeof resOrderAuth.body?.data?.orderData?.code === 'string', 'orderData có mã code đơn hàng')
      assert(typeof resOrderAuth.body?.data?.orderData?.status === 'string', 'orderData có status')
      assert(typeof resOrderAuth.body?.data?.orderData?.total === 'number', 'orderData có total tiền')
    }

  } finally {
    console.log('\n[Dọn dẹp] Đang tắt các server kiểm thử...')
    if (backendProc) backendProc.kill()
    if (dataProc) dataProc.kill()
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
