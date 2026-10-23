import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

const TEST_JWT_SECRET = 'test_integration_voucher_jwt_secret_min_32_characters_12345'
const TEST_SERVICE_KEY = 'test_integration_voucher_service_key_64_characters_entropy_secret_key'

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

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.status === 200 || res.status === 401) {
        return true
      }
    } catch {
      // Đang chờ server khởi động
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Server không phản hồi tại ${url} sau ${timeoutMs}ms`)
}

async function run() {
  console.log('--- KHỞI ĐỘNG INTEGRATION TEST CHO VOUCHERS API ---')

  const dataApiPort = await getAvailablePort()
  const backendPort = await getAvailablePort()
  console.log(`Port Data API: ${dataApiPort}, Port Backend: ${backendPort}\n`)

  const dataApiProcess = spawn('node', ['src/server.js'], {
    cwd: dataApiRootDir,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(dataApiPort),
      DATA_API_KEY: TEST_SERVICE_KEY,
    },
    stdio: 'ignore',
  })

  let backendProcess = null

  try {
    await waitForServer(`http://127.0.0.1:${dataApiPort}/internal/v1/health`)

    backendProcess = spawn('node', ['src/server.js'], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(backendPort),
        DATA_API_URL: `http://127.0.0.1:${dataApiPort}`,
        DATA_API_KEY: TEST_SERVICE_KEY,
        JWT_SECRET: TEST_JWT_SECRET,
      },
      stdio: 'ignore',
    })

    await waitForServer(`http://127.0.0.1:${backendPort}/api/v1/health`)

    const backendUrl = `http://127.0.0.1:${backendPort}/api/v1`

    // [TEST 1] GET /api/v1/vouchers - Đọc danh sách voucher công khai
    console.log('[TEST 1] GET /api/v1/vouchers')
    {
      const res = await fetch(`${backendUrl}/vouchers`)
      const body = await res.json()

      assert(res.status === 200, 'GET /vouchers trả HTTP 200 OK')
      assert(body.success === true, 'Response trả success = true')
      assert(Array.isArray(body.data), 'data là một mảng danh sách voucher')
      assert(body.data.length > 0, 'Có ít nhất 1 voucher trong database mẫu')

      const first = body.data[0]
      assert(typeof first.id === 'string', 'Voucher id là string')
      assert(typeof first.code === 'string', 'Voucher code là string')
      assert(typeof first.name === 'string', 'Voucher name là string')
      assert(typeof first.discountAmount === 'number', 'discountAmount là số')
      assert(typeof first.minSubtotal === 'number', 'minSubtotal là số')
      assert(first.isActive === true, 'isActive = true')
    }

    // [TEST 2] GET /api/v1/vouchers?code=NOVA20K - Lọc theo mã query
    console.log('\n[TEST 2] GET /api/v1/vouchers?code=NOVA20K')
    {
      const res = await fetch(`${backendUrl}/vouchers?code=NOVA20K`)
      const body = await res.json()

      assert(res.status === 200, 'Lọc voucher theo query code trả HTTP 200')
      assert(body.success === true, 'Lọc voucher có success = true')
      assert(Array.isArray(body.data), 'data là mảng')
      assert(body.data.length === 1, 'Tìm thấy đúng 1 voucher NOVA20K')
      assert(body.data[0].code === 'NOVA20K', 'Mã voucher đúng là NOVA20K')
      assert(body.data[0].discountAmount === 20000, 'Số tiền giảm đúng là 20.000')
    }

    // [TEST 3] GET /api/v1/vouchers/:code - Chi tiết voucher cụ thể
    console.log('\n[TEST 3] GET /api/v1/vouchers/:code')
    {
      const res = await fetch(`${backendUrl}/vouchers/NOVA20K`)
      const body = await res.json()

      assert(res.status === 200, 'GET /vouchers/NOVA20K trả HTTP 200')
      assert(body.success === true, 'Chi tiết voucher có success = true')
      assert(body.data.code === 'NOVA20K', 'Chi tiết voucher trả đúng mã')
      assert(body.data.minSubtotal === 500000, 'minSubtotal đúng giá trị 500.000')
    }

    // [TEST 4] GET /api/v1/vouchers/:code - Mã không tồn tại trả 404
    console.log('\n[TEST 4] GET /api/v1/vouchers/KHONG_TON_TAI')
    {
      const res = await fetch(`${backendUrl}/vouchers/MA_VOUCHER_AO_KHONG_CO`)
      const body = await res.json()

      assert(res.status === 404, 'Mã không tồn tại trả HTTP 404')
      assert(body.success === false, 'Response có success = false')
      assert(body.error?.code === 'VOUCHER_NOT_FOUND', 'Mã lỗi đúng là VOUCHER_NOT_FOUND')
    }

    console.log(`\n--- KẾT QUẢ TEST: ${passed} PASS, ${failed} FAIL ---`)
  } finally {
    if (backendProcess) backendProcess.kill()
    if (dataApiProcess) dataApiProcess.kill()
  }

  if (failed > 0) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Lỗi khi chạy integration test voucher:', err)
  process.exit(1)
})
