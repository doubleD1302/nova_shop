import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// Thiết lập cấu hình môi trường kiểm thử cô lập ngay từ đầu
// Đảm bảo smoke test chạy hoàn toàn độc lập, không phụ thuộc vào file .env thật và không cần Data API thật
process.env.NODE_ENV = 'test'
process.env.PORT = '3000'
process.env.DATA_API_URL = 'http://127.0.0.1:3001'
process.env.DATA_API_KEY = 'test_backend_service_key_valid_123'
process.env.JWT_SECRET = 'smoke_test_jwt_secret_valid_min_32_characters_here'
process.env.DOTENV_CONFIG_PATH = path.join(__dirname, 'non-existent-smoke.env')

// Nạp ứng dụng sau khi đã thiết lập biến môi trường test cô lập
const { default: app } = await import('../src/app.js')

// Khởi chạy server trên cổng ngẫu nhiên khả dụng (port 0) để chạy kiểm thử
const server = http.createServer(app)

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

async function runTests() {
  console.log('=== BẮT ĐẦU SMOKE TEST CHO BACKEND SHOPNOVA ===\n')

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve())
    server.on('error', reject)
  })

  const { port } = server.address()
  const baseUrl = `http://127.0.0.1:${port}`
  console.log(`[Smoke Test] Server test đang chạy tạm thời trên cổng: ${port}\n`)

  try {
    // 1. Kiểm tra GET /api/v1/health trả về 200 và dữ liệu mong đợi
    {
      const res = await fetch(`${baseUrl}/api/v1/health`)
      const data = await res.json()
      assert(res.status === 200, 'GET /api/v1/health trả mã HTTP 200')
      assert(data.success === true, 'Health check có success === true')
      assert(data.data?.service === 'shopnova-backend', 'Health check data.service đúng')
      assert(data.data?.status === 'ok', 'Health check data.status === "ok"')
    }

    // 2. Kiểm tra URL không tồn tại trả về 404 JSON với mã NOT_FOUND
    {
      const res = await fetch(`${baseUrl}/api/v1/duong-dan-khong-ton-tai`)
      const data = await res.json()
      assert(res.status === 404, 'URL không tồn tại trả HTTP 404')
      assert(data.success === false, '404 response có success === false')
      assert(data.error?.code === 'NOT_FOUND', '404 error code là NOT_FOUND')
    }

    // 3. Kiểm tra JSON body sai cú pháp trả HTTP 400 với mã BAD_JSON
    {
      const res = await fetch(`${baseUrl}/api/v1/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"invalidJson": ...broken}',
      })
      const data = await res.json()
      assert(res.status === 400, 'JSON body sai cú pháp trả HTTP 400')
      assert(data.success === false, 'Bad JSON response có success === false')
      assert(data.error?.code === 'BAD_JSON', 'Bad JSON error code là BAD_JSON')
    }

    // 4. Kiểm tra Origin được phép nhận đúng header CORS
    {
      const res = await fetch(`${baseUrl}/api/v1/health`, {
        headers: { Origin: 'http://localhost:5173' },
      })
      const allowOrigin = res.headers.get('access-control-allow-origin')
      assert(
        allowOrigin === 'http://localhost:5173',
        'Origin được phép (http://localhost:5173) nhận đúng header CORS',
        `Nhận được: ${allowOrigin}`,
      )
    }

    // 5. Kiểm tra Origin ngoài danh sách không nhận header CORS cho phép
    {
      const res = await fetch(`${baseUrl}/api/v1/health`, {
        headers: { Origin: 'http://malicious-site.example.com' },
      })
      const allowOrigin = res.headers.get('access-control-allow-origin')
      assert(
        allowOrigin === null,
        'Origin ngoài danh sách không nhận header Access-Control-Allow-Origin',
        `Nhận được: ${allowOrigin}`,
      )
    }

    // 6. Kiểm tra request không có Origin (curl / Postman / native app) vẫn nhận kết quả
    {
      const res = await fetch(`${baseUrl}/api/v1/health`)
      assert(res.status === 200, 'Request không có Origin header hoạt động bình thường (HTTP 200)')
    }

    // 6.1. Auth endpoints smoke: POST /api/v1/auth/login thiếu body trả 400 VALIDATION_ERROR
    {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      assert(res.status === 400, 'POST /api/v1/auth/login thiếu username/password trả HTTP 400')
      assert(data.success === false, 'Phản hồi thất bại có success === false')
      assert(data.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR')
    }

    // 6.2. Auth endpoints smoke: GET /api/v1/auth/me thiếu header Authorization trả 401 AUTH_REQUIRED
    {
      const res = await fetch(`${baseUrl}/api/v1/auth/me`)
      const data = await res.json()
      assert(res.status === 401, 'GET /api/v1/auth/me thiếu Authorization trả HTTP 401')
      assert(data.error?.code === 'AUTH_REQUIRED', 'Mã lỗi là AUTH_REQUIRED khi thiếu token')
    }

    // 6.3. Auth endpoints smoke: GET /api/v1/auth/me với token sai định dạng trả 401 AUTH_INVALID
    {
      const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: 'Bearer not-a-valid-jwt-token' },
      })
      const data = await res.json()
      assert(res.status === 401, 'GET /api/v1/auth/me với token không hợp lệ trả HTTP 401')
      assert(data.error?.code === 'AUTH_INVALID', 'Mã lỗi là AUTH_INVALID khi token sai chữ ký/cú pháp')
    }

    // -------------------------------------------------------------
    // 7. Kiểm tra xác thực cấu hình môi trường (src/config/env.js)
    // -------------------------------------------------------------
    const baseTestEnv = {
      NODE_ENV: 'test',
      PORT: '3000',
      CORS_ORIGINS: 'http://localhost:5173',
      DATA_API_URL: 'http://127.0.0.1:3001',
      DATA_API_KEY: 'test_valid_key_123',
      JWT_SECRET: 'test_valid_jwt_secret_min_32_chars_long_entropy_here',
      DOTENV_CONFIG_PATH: path.join(__dirname, 'non-existent.env'),
    }

    async function testEnvConfig(envOverrides) {
      return new Promise((resolve) => {
        let stdout = ''
        let stderr = ''
        const proc = spawn(process.execPath, ['src/config/env.js'], {
          cwd: rootDir,
          env: {
            ...process.env,
            ...baseTestEnv,
            ...envOverrides,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        proc.stdout.on('data', (d) => {
          stdout += d.toString()
        })
        proc.stderr.on('data', (d) => {
          stderr += d.toString()
        })
        proc.on('close', (code) => resolve({ code, stdout, stderr }))
      })
    }

    // 7.1 Cấu hình PORT sai
    {
      const { code } = await testEnvConfig({ PORT: 'not-a-port' })
      assert(code !== 0, 'Cấu hình PORT sai ("not-a-port") khiến tiến trình dừng lại với mã lỗi khác 0')
    }

    // 7.2 Thiếu DATA_API_KEY
    {
      const { code, stderr } = await testEnvConfig({ DATA_API_KEY: '' })
      assert(code !== 0, 'Thiếu DATA_API_KEY khiến tiến trình dừng lại với mã lỗi khác 0')
      assert(stderr.includes('DATA_API_KEY'), 'Thông báo lỗi chỉ rõ biến DATA_API_KEY khi thiếu')
    }

    // 7.3 DATA_API_KEY chỉ chứa khoảng trắng
    {
      const { code, stderr } = await testEnvConfig({ DATA_API_KEY: '   ' })
      assert(code !== 0, 'DATA_API_KEY chỉ chứa khoảng trắng bị từ chối')
      assert(stderr.includes('DATA_API_KEY'), 'Thông báo lỗi chỉ rõ biến DATA_API_KEY khi chỉ có khoảng trắng')
    }

    // 7.4 DATA_API_KEY là placeholder mẫu
    {
      const { code, stderr } = await testEnvConfig({ DATA_API_KEY: 'your_service_key_here' })
      assert(code !== 0, 'DATA_API_KEY là placeholder mẫu bị từ chối')
      assert(stderr.includes('DATA_API_KEY'), 'Thông báo lỗi chỉ rõ biến DATA_API_KEY khi dùng placeholder')
    }

    // 7.4.1 Thiếu JWT_SECRET
    {
      const { code, stderr } = await testEnvConfig({ JWT_SECRET: '' })
      assert(code !== 0, 'Thiếu JWT_SECRET khiến tiến trình dừng lại với mã lỗi khác 0')
      assert(stderr.includes('JWT_SECRET'), 'Thông báo lỗi chỉ rõ biến JWT_SECRET khi thiếu')
    }

    // 7.4.2 JWT_SECRET ngắn hơn 32 ký tự
    {
      const shortSecret = 'short_secret_under_32_chars'
      const { code, stderr, stdout } = await testEnvConfig({ JWT_SECRET: shortSecret })
      assert(code !== 0, 'JWT_SECRET ngắn hơn 32 ký tự bị từ chối')
      assert(stderr.includes('JWT_SECRET'), 'Thông báo lỗi chỉ rõ biến JWT_SECRET khi độ dài không đủ')
      assert(!stdout.includes(shortSecret) && !stderr.includes(shortSecret), 'Không in giá trị JWT_SECRET ra log khi quá ngắn')
    }

    // 7.4.3 JWT_SECRET là placeholder mẫu
    {
      const { code, stderr } = await testEnvConfig({ JWT_SECRET: 'your_secret_key_here' })
      assert(code !== 0, 'JWT_SECRET là placeholder mẫu bị từ chối')
      assert(stderr.includes('JWT_SECRET'), 'Thông báo lỗi chỉ rõ biến JWT_SECRET khi dùng placeholder')
    }

    // 7.5 DATA_API_URL sai giao thức (ftp://)
    {
      const { code, stderr } = await testEnvConfig({ DATA_API_URL: 'ftp://127.0.0.1:3001' })
      assert(code !== 0, 'DATA_API_URL sai giao thức ftp:// bị từ chối')
      assert(stderr.includes('DATA_API_URL'), 'Thông báo lỗi chỉ rõ biến DATA_API_URL khi sai giao thức')
    }

    // 7.6 Regression: DATA_API_URL sai cú pháp có username/password chứa marker giả
    {
      const fakeUrl = 'http://review_user:REVIEW_FAKE_PW_MARKER_DB003@[broken-host'
      const fakePw = 'REVIEW_FAKE_PW_MARKER_DB003'
      const { code, stdout, stderr } = await testEnvConfig({ DATA_API_URL: fakeUrl })
      assert(code !== 0, 'URL sai cú pháp có credentials bị từ chối với mã khác 0')
      assert(stderr.includes('DATA_API_URL'), 'Thông báo lỗi chỉ rõ biến DATA_API_URL khi URL sai cú pháp')
      assert(!stdout.includes(fakePw) && !stderr.includes(fakePw), 'Stdout và stderr tuyệt đối không chứa password marker khi URL sai cú pháp')
      assert(!stdout.includes(fakeUrl) && !stderr.includes(fakeUrl), 'Stdout và stderr tuyệt đối không in nguyên giá trị URL sai cú pháp')
    }

    // 7.7 Regression: DATA_API_URL sai cú pháp có marker trong query hoặc fragment
    {
      const fakeQuery = 'REVIEW_FAKE_QUERY_MARKER_DB003'
      const fakeHash = 'REVIEW_FAKE_HASH_MARKER_DB003'
      const fakeUrl = `http://[broken-host/base?token=${fakeQuery}#secret=${fakeHash}`
      const { code, stdout, stderr } = await testEnvConfig({ DATA_API_URL: fakeUrl })
      assert(code !== 0, 'URL sai cú pháp có query/fragment bị từ chối với mã khác 0')
      assert(stderr.includes('DATA_API_URL'), 'Thông báo lỗi chỉ rõ biến DATA_API_URL khi có query/fragment trên URL hỏng')
      assert(!stdout.includes(fakeQuery) && !stderr.includes(fakeQuery), 'Stdout và stderr không chứa query marker khi URL sai cú pháp')
      assert(!stdout.includes(fakeHash) && !stderr.includes(fakeHash), 'Stdout và stderr không chứa fragment marker khi URL sai cú pháp')
      assert(!stdout.includes(fakeUrl) && !stderr.includes(fakeUrl), 'Stdout và stderr không in nguyên giá trị URL sai cú pháp')
    }

    // 7.8 Regression: DATA_API_URL có credentials nhưng cú pháp hợp lệ
    {
      const fakeCred = 'REVIEW_FAKE_VALID_SYNTAX_CRED_DB003'
      const fakeUrl = `http://review_user:${fakeCred}@127.0.0.1:3001`
      const { code, stdout, stderr } = await testEnvConfig({ DATA_API_URL: fakeUrl })
      assert(code !== 0, 'DATA_API_URL có credentials cú pháp hợp lệ bị từ chối với mã khác 0')
      assert(stderr.includes('DATA_API_URL'), 'Thông báo lỗi chỉ rõ biến DATA_API_URL khi có credentials')
      assert(!stdout.includes(fakeCred) && !stderr.includes(fakeCred), 'Stdout và stderr không chứa credentials marker khi cú pháp URL hợp lệ')
      assert(!stdout.includes(fakeUrl) && !stderr.includes(fakeUrl), 'Stdout và stderr không in nguyên giá trị URL có credentials')
    }

    // 7.9 DATA_API_URL chứa query string hoặc fragment
    {
      const { code, stderr } = await testEnvConfig({ DATA_API_URL: 'http://127.0.0.1:3001/base?q=1' })
      assert(code !== 0, 'DATA_API_URL chứa query string bị từ chối')
      assert(stderr.includes('DATA_API_URL'), 'Thông báo lỗi chỉ rõ biến DATA_API_URL khi có query')
    }

    // 7.10 DATA_API_URL chứa /internal/v1
    {
      const { code, stderr } = await testEnvConfig({ DATA_API_URL: 'http://127.0.0.1:3001/internal/v1' })
      assert(code !== 0, 'DATA_API_URL chứa /internal/v1 bị từ chối')
      assert(stderr.includes('DATA_API_URL'), 'Thông báo lỗi chỉ rõ biến DATA_API_URL là base URL, không được chứa /internal/v1')
    }

    // 7.11 Regression: DATA_API_URL http và https hợp lệ
    {
      const { code: httpCode } = await testEnvConfig({ DATA_API_URL: 'http://127.0.0.1:3001' })
      assert(httpCode === 0, 'URL http://127.0.0.1:3001 hợp lệ được chấp nhận (exit code 0)')

      const { code: httpsCode } = await testEnvConfig({ DATA_API_URL: 'https://data-api.shopnova.internal:8443' })
      assert(httpsCode === 0, 'URL https://data-api.shopnova.internal:8443 hợp lệ được chấp nhận (exit code 0)')
    }

    // 7.12 Cấu hình mặc định hợp lệ thoát với mã 0
    {
      const { code } = await testEnvConfig({})
      assert(code === 0, 'Cấu hình mặc định hợp lệ vượt qua thẩm định khởi động (exit code 0)')
    }
  } finally {
    // Đảm bảo đóng server và socket giải phóng tài nguyên
    await new Promise((resolve) => server.close(resolve))
    console.log('\n[Smoke Test] Đã đóng server kiểm thử thành công.')
  }

  console.log('\n=== TỔNG KẾT KẾT QUẢ SMOKE TEST ===')
  console.log(`Số test vượt qua (PASS): ${passed}`)
  console.log(`Số test thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('\n🎉 Tất cả bài kiểm tra đều ĐẠT (PASS)!')
    process.exit(0)
  }
}

runTests().catch((err) => {
  console.error('[Smoke Test Error]:', err)
  process.exit(1)
})
