import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// Thiết lập cấu hình môi trường kiểm thử cô lập ngay từ đầu
// Đảm bảo smoke test chạy hoàn toàn độc lập, không phụ thuộc vào file .env thật và không cần kết nối MySQL thật
process.env.NODE_ENV = 'test'
process.env.HOST = '127.0.0.1'
process.env.PORT = '3001'
process.env.DB_HOST = '127.0.0.1'
process.env.DB_PORT = '3306'
process.env.DB_NAME = 'shopnova_mock_db'
process.env.DB_USER = 'shopnova_mock_user'
process.env.DB_PASSWORD = 'mock_smoke_password_valid_123'
process.env.DATA_API_KEY = 'mock_smoke_service_key_valid_456'
process.env.DB_READINESS_TIMEOUT_MS = '3000'
process.env.DOTENV_CONFIG_PATH = path.join(__dirname, 'non-existent-smoke.env')

// Import các thành phần production thật
const http = await import('node:http')
const { spawn } = await import('node:child_process')
const { default: app } = await import('../src/app.js')
const { env } = await import('../src/config/env.js')
const { errorHandler } = await import('../src/middlewares/error.middleware.js')

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

async function runSmokeTests() {
  console.log('=== BẮT ĐẦU SMOKE TEST CHO DATA API SHOPNOVA ===\n')

  // Sử dụng trực tiếp đối tượng app production thật của ứng dụng
  const server = http.createServer(app)

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve())
    server.on('error', reject)
  })

  const { port } = server.address()
  const baseUrl = `http://127.0.0.1:${port}`
  console.log(`[Smoke Test] Server test production đang chạy tạm thời trên cổng: ${port}\n`)

  try {
    // -------------------------------------------------------------
    // 1. Kiểm tra HTTP cơ bản và định tuyến
    // -------------------------------------------------------------

    // 1.1 Health check với header x-service-key hợp lệ -> HTTP 200
    {
      const res = await fetch(`${baseUrl}/internal/v1/health`, {
        headers: { 'x-service-key': env.dataApiKey },
        signal: AbortSignal.timeout(4000),
      })
      const data = await res.json()
      assert(res.status === 200, 'GET /internal/v1/health với x-service-key hợp lệ trả mã HTTP 200')
      assert(data.success === true, 'Health check có success === true')
      assert(data.data?.service === 'shopnova-data-api', 'Health check data.service đúng: "shopnova-data-api"')
      assert(data.data?.status === 'ok', 'Health check data.status === "ok"')
    }

    // 1.2 Yêu cầu thiếu header x-service-key bị từ chối -> HTTP 401
    {
      const res = await fetch(`${baseUrl}/internal/v1/health`, {
        signal: AbortSignal.timeout(4000),
      })
      const data = await res.json()
      assert(res.status === 401, 'Yêu cầu thiếu x-service-key trả HTTP 401')
      assert(data.success === false, 'Phản hồi thiếu key có success === false')
      assert(data.error?.code === 'SERVICE_UNAUTHORIZED', 'Mã lỗi là SERVICE_UNAUTHORIZED')
    }

    // 1.3 Yêu cầu có header x-service-key sai bị từ chối -> HTTP 401
    {
      const res = await fetch(`${baseUrl}/internal/v1/health`, {
        headers: { 'x-service-key': 'sai-khoa-xac-thuc-dich-vu' },
        signal: AbortSignal.timeout(4000),
      })
      const data = await res.json()
      assert(res.status === 401, 'Yêu cầu với x-service-key sai trả HTTP 401')
      assert(data.success === false, 'Phản hồi sai key có success === false')
      assert(data.error?.code === 'SERVICE_UNAUTHORIZED', 'Mã lỗi là SERVICE_UNAUTHORIZED khi key sai')
    }

    // 1.4 Đường dẫn không tồn tại trong /internal/v1 trả về HTTP 404 JSON
    {
      const res = await fetch(`${baseUrl}/internal/v1/duong-dan-khong-ton-tai`, {
        headers: { 'x-service-key': env.dataApiKey },
        signal: AbortSignal.timeout(4000),
      })
      const data = await res.json()
      assert(res.status === 404, 'URL không tồn tại trong /internal/v1 trả HTTP 404')
      assert(data.success === false, '404 response có success === false')
      assert(data.error?.code === 'NOT_FOUND', '404 error code là NOT_FOUND')
    }

    // 1.5 Đường dẫn ngoài prefix /internal/v1 trả về HTTP 404 JSON
    {
      const res = await fetch(`${baseUrl}/api/v1/health`, {
        signal: AbortSignal.timeout(4000),
      })
      const data = await res.json()
      assert(res.status === 404, 'URL ngoài prefix /internal/v1 trả HTTP 404')
      assert(data.success === false, '404 ngoài prefix có success === false')
      assert(data.error?.code === 'NOT_FOUND', '404 ngoài prefix error code là NOT_FOUND')
    }

    // 1.6 JSON body sai cú pháp trả HTTP 400 với mã BAD_JSON
    {
      const res = await fetch(`${baseUrl}/internal/v1/health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': env.dataApiKey,
        },
        body: '{"invalidJson": ...broken}',
        signal: AbortSignal.timeout(4000),
      })
      const data = await res.json()
      assert(res.status === 400, 'JSON body sai cú pháp trả HTTP 400')
      assert(data.success === false, 'Bad JSON response có success === false')
      assert(data.error?.code === 'BAD_JSON', 'Bad JSON error code là BAD_JSON')
    }

    // 1.7 Body vượt quá giới hạn 1MB trả về HTTP 413 với mã BODY_TOO_LARGE
    {
      const largePayload = JSON.stringify({ data: 'A'.repeat(1.2 * 1024 * 1024) })
      const res = await fetch(`${baseUrl}/internal/v1/health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': env.dataApiKey,
        },
        body: largePayload,
        signal: AbortSignal.timeout(4000),
      })
      const data = await res.json()
      assert(res.status === 413, 'Payload vượt quá giới hạn 1MB trả HTTP 413')
      assert(data.success === false, 'Payload quá lớn có success === false')
      assert(data.error?.code === 'BODY_TOO_LARGE', 'Mã lỗi payload quá lớn là BODY_TOO_LARGE')
    }

    // -------------------------------------------------------------
    // 2. Kiểm tra bảo mật errorHandler với 5 trường nhạy cảm
    //    (Không thêm bất kỳ route test nào vào production app)
    // -------------------------------------------------------------
    console.log('\n--- Kiểm tra bảo mật middleware errorHandler ---')
    {
      const fakeError = new Error('MARKER_MESSAGE_SENSITIVE_LEAK_001')
      fakeError.sql = 'SELECT * FROM secrets WHERE token="MARKER_SQL_SENSITIVE_LEAK_002"'
      fakeError.parameters = ['MARKER_PARAM_SENSITIVE_LEAK_003']
      fakeError.stack = 'Error: Stack at MARKER_STACK_SENSITIVE_LEAK_004 (file.js:1:1)'
      fakeError.cause = new Error('MARKER_CAUSE_SENSITIVE_LEAK_005')

      let capturedLogs = ''
      const originalConsoleError = console.error
      console.error = (...args) => {
        capturedLogs += args.join(' ') + '\n'
      }

      let capturedStatusCode = 0
      let capturedResponseBody = null

      const mockRes = {
        status(code) {
          capturedStatusCode = code
          return this
        },
        json(body) {
          capturedResponseBody = body
          return this
        },
      }

      try {
        errorHandler(fakeError, {}, mockRes, () => {})
      } finally {
        console.error = originalConsoleError
      }

      assert(capturedStatusCode === 500, 'errorHandler trả HTTP status 500 cho lỗi không xác định')
      assert(capturedResponseBody?.error?.code === 'INTERNAL_SERVER_ERROR', 'Mã lỗi response là INTERNAL_SERVER_ERROR')

      const jsonStr = JSON.stringify(capturedResponseBody)
      assert(
        !jsonStr.includes('MARKER_MESSAGE_SENSITIVE_LEAK_001') &&
          !jsonStr.includes('MARKER_SQL_SENSITIVE_LEAK_002') &&
          !jsonStr.includes('MARKER_PARAM_SENSITIVE_LEAK_003') &&
          !jsonStr.includes('MARKER_STACK_SENSITIVE_LEAK_004') &&
          !jsonStr.includes('MARKER_CAUSE_SENSITIVE_LEAK_005'),
        'Response 500 tuyệt đối không để lộ bất kỳ marker nào trong message, sql, parameters, stack, cause',
      )

      assert(
        !capturedLogs.includes('MARKER_MESSAGE_SENSITIVE_LEAK_001') &&
          !capturedLogs.includes('MARKER_SQL_SENSITIVE_LEAK_002') &&
          !capturedLogs.includes('MARKER_PARAM_SENSITIVE_LEAK_003') &&
          !capturedLogs.includes('MARKER_STACK_SENSITIVE_LEAK_004') &&
          !capturedLogs.includes('MARKER_CAUSE_SENSITIVE_LEAK_005'),
        'Console log của errorHandler tuyệt đối không để lộ bất kỳ marker nào trong message, sql, parameters, stack, cause',
      )
    }

    // -------------------------------------------------------------
    // 3. Kiểm tra cấu hình và validation của src/config/env.js
    // -------------------------------------------------------------
    console.log('\n--- Kiểm tra xác thực cấu hình môi trường (src/config/env.js) ---')

    const baseValidTestEnv = {
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: '3001',
      DB_HOST: '127.0.0.1',
      DB_PORT: '3306',
      DB_NAME: 'shopnova_test',
      DB_USER: 'shopnova_test_user',
      DB_PASSWORD: 'valid-test-password-123',
      DATA_API_KEY: 'valid-test-data-api-key-456',
      DB_READINESS_TIMEOUT_MS: '3000',
      DOTENV_CONFIG_PATH: path.join(__dirname, 'non-existent.env'),
    }

    async function runEnvValidationTest(customEnv) {
      let stderrOutput = ''
      const cleanEnv = { ...process.env }
      delete cleanEnv.DB_HOST
      delete cleanEnv.DB_PORT
      delete cleanEnv.DB_NAME
      delete cleanEnv.DB_USER
      delete cleanEnv.DB_PASSWORD
      delete cleanEnv.DATA_API_KEY
      delete cleanEnv.PORT
      delete cleanEnv.HOST
      delete cleanEnv.NODE_ENV
      delete cleanEnv.DB_READINESS_TIMEOUT_MS
      delete cleanEnv.DOTENV_CONFIG_PATH

      return new Promise((resolve) => {
        const proc = spawn(process.execPath, ['src/config/env.js'], {
          cwd: rootDir,
          env: { ...cleanEnv, ...customEnv },
          stdio: ['ignore', 'ignore', 'pipe'],
        })

        const killTimer = setTimeout(() => {
          try {
            proc.kill('SIGKILL')
          } catch {}
          resolve({ exitCode: -1, stderrOutput: 'Timeout running env test' })
        }, 3000)

        proc.stderr.on('data', (d) => {
          stderrOutput += d.toString()
        })

        proc.on('close', (code) => {
          clearTimeout(killTimer)
          resolve({ exitCode: code, stderrOutput })
        })

        proc.on('error', (err) => {
          clearTimeout(killTimer)
          resolve({ exitCode: -1, stderrOutput: err.message })
        })
      })
    }

    // 3.1 Cấu hình PORT sai -> exit code !== 0
    {
      const { exitCode } = await runEnvValidationTest({ ...baseValidTestEnv, PORT: 'not-a-port' })
      assert(exitCode !== 0, 'Cấu hình PORT sai khiến tiến trình dừng lại với mã lỗi khác 0')
    }

    // 3.2 Thiếu DATA_API_KEY -> exit code !== 0
    {
      const envWithoutKey = { ...baseValidTestEnv }
      delete envWithoutKey.DATA_API_KEY
      const { exitCode, stderrOutput } = await runEnvValidationTest(envWithoutKey)
      assert(exitCode !== 0, 'Thiếu DATA_API_KEY khiến tiến trình dừng lại với mã lỗi khác 0')
      assert(stderrOutput.includes('DATA_API_KEY'), 'Thông báo lỗi chỉ rõ biến DATA_API_KEY')
    }

    // 3.3 DATA_API_KEY chỉ chứa khoảng trắng -> exit code !== 0
    {
      const { exitCode, stderrOutput } = await runEnvValidationTest({ ...baseValidTestEnv, DATA_API_KEY: '   ' })
      assert(exitCode !== 0, 'DATA_API_KEY chỉ chứa khoảng trắng bị từ chối')
      assert(stderrOutput.includes('DATA_API_KEY'), 'Thông báo lỗi chỉ rõ biến DATA_API_KEY khi rỗng')
    }

    // 3.4 DATA_API_KEY là placeholder mẫu your_service_key_here -> exit code !== 0
    {
      const { exitCode, stderrOutput } = await runEnvValidationTest({
        ...baseValidTestEnv,
        DATA_API_KEY: 'your_service_key_here',
      })
      assert(exitCode !== 0, 'DATA_API_KEY là placeholder mẫu bị từ chối')
      assert(stderrOutput.includes('DATA_API_KEY'), 'Thông báo lỗi chỉ rõ biến DATA_API_KEY khi dùng placeholder')
    }

    // 3.5 Thiếu DB_PASSWORD -> exit code !== 0
    {
      const envWithoutPass = { ...baseValidTestEnv }
      delete envWithoutPass.DB_PASSWORD
      const { exitCode, stderrOutput } = await runEnvValidationTest(envWithoutPass)
      assert(exitCode !== 0, 'Thiếu DB_PASSWORD khiến tiến trình dừng lại với mã lỗi khác 0')
      assert(stderrOutput.includes('DB_PASSWORD'), 'Thông báo lỗi chỉ rõ biến DB_PASSWORD')
    }

    // 3.6 DB_PASSWORD chỉ chứa khoảng trắng -> exit code !== 0
    {
      const { exitCode, stderrOutput } = await runEnvValidationTest({ ...baseValidTestEnv, DB_PASSWORD: '   ' })
      assert(exitCode !== 0, 'DB_PASSWORD chỉ chứa khoảng trắng bị từ chối')
      assert(stderrOutput.includes('DB_PASSWORD'), 'Thông báo lỗi chỉ rõ biến DB_PASSWORD khi rỗng')
    }

    // 3.7 DB_PASSWORD là placeholder mẫu your_db_password_here -> exit code !== 0
    {
      const { exitCode, stderrOutput } = await runEnvValidationTest({
        ...baseValidTestEnv,
        DB_PASSWORD: 'your_db_password_here',
      })
      assert(exitCode !== 0, 'DB_PASSWORD là placeholder mẫu bị từ chối')
      assert(stderrOutput.includes('DB_PASSWORD'), 'Thông báo lỗi chỉ rõ biến DB_PASSWORD khi dùng placeholder')
    }

    // 3.8 DB_READINESS_TIMEOUT_MS >= 5000 (bằng hoặc vượt trần timeout Backend) -> exit code !== 0
    {
      const { exitCode, stderrOutput } = await runEnvValidationTest({
        ...baseValidTestEnv,
        DB_READINESS_TIMEOUT_MS: '5000',
      })
      assert(exitCode !== 0, 'DB_READINESS_TIMEOUT_MS = 5000 bị từ chối vì không nhỏ hơn Backend timeout')
      assert(stderrOutput.includes('DB_READINESS_TIMEOUT_MS'), 'Thông báo lỗi chỉ rõ biến DB_READINESS_TIMEOUT_MS')
    }

    // 3.9 Cấu hình hợp lệ -> exit code === 0
    {
      const { exitCode } = await runEnvValidationTest(baseValidTestEnv)
      assert(exitCode === 0, 'Cấu hình test hợp lệ vượt qua thẩm định khởi động (exit code 0)')
    }
  } finally {
    // Đảm bảo đóng server kiểm thử giải phóng socket
    await new Promise((resolve) => server.close(resolve))
    console.log('\n[Smoke Test] Đã đóng server kiểm thử thành công.')
  }

  console.log('\n=== TỔNG KẾT KẾT QUẢ SMOKE TEST DATA API ===')
  console.log(`Số test vượt qua (PASS): ${passed}`)
  console.log(`Số test thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('\n🎉 Tất cả bài kiểm tra Smoke Test đều ĐẠT (PASS)!')
  }
}

runSmokeTests().catch((err) => {
  console.error('[Smoke Test Error]:', err)
  process.exit(1)
})
