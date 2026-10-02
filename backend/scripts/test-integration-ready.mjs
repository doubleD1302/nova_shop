import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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
 * Dừng tiến trình con và xác nhận thoát thực sự qua sự kiện exit/close
 */
function stopProcess(child, timeoutMs = 6000) {
  if (!child) return Promise.resolve()
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ exitCode: child.exitCode, signalCode: child.signalCode })
  }
  return new Promise((resolve, reject) => {
    let isDone = false
    let forceTimer = null
    let failTimer = null

    const onExit = (code, signal) => {
      if (!isDone) {
        isDone = true
        if (forceTimer) clearTimeout(forceTimer)
        if (failTimer) clearTimeout(failTimer)
        resolve({ exitCode: code ?? child.exitCode, signalCode: signal ?? child.signalCode })
      }
    }

    child.once('exit', onExit)
    child.once('close', onExit)

    try {
      child.kill('SIGTERM')
    } catch {
      if (child.exitCode !== null || child.signalCode !== null) {
        return onExit(child.exitCode, child.signalCode)
      }
    }

    forceTimer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {}
    }, 2000)

    failTimer = setTimeout(() => {
      if (!isDone) {
        child.removeListener('exit', onExit)
        child.removeListener('close', onExit)
        reject(
          new Error(
            `Tiến trình (PID ${child.pid}) không thể dừng sau ${timeoutMs}ms (exitCode: ${child.exitCode}, signalCode: ${child.signalCode})`,
          ),
        )
      }
    }, timeoutMs)
  })
}

/**
 * Khởi động tiến trình Backend production thật
 */
async function startBackendProduction(customEnv = {}) {
  const port = await getAvailablePort()
  const serverPath = path.resolve(rootDir, 'src/server.js')

  let stdout = ''
  let stderr = ''

  return new Promise((resolve, reject) => {
    try {
      const child = spawn(process.execPath, [serverPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          PORT: String(port),
          NODE_ENV: 'test',
          ...customEnv,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      child.stdout.on('data', (c) => {
        stdout += c.toString()
      })
      child.stderr.on('data', (c) => {
        stderr += c.toString()
      })

      let isStarted = false
      const timer = setTimeout(() => {
        if (!isStarted) {
          try {
            child.kill('SIGKILL')
          } catch {}
          reject(new Error(`Timeout quá 6000ms chờ Backend khởi động trên cổng ${port}`))
        }
      }, 6000)

      child.stdout.on('data', (chunk) => {
        const msg = chunk.toString()
        if (msg.includes('Server đang chạy tại') && !isStarted) {
          isStarted = true
          clearTimeout(timer)
          resolve({
            child,
            port,
            baseUrl: `http://127.0.0.1:${port}`,
            getStdout: () => stdout,
            getStderr: () => stderr,
          })
        }
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        if (!isStarted) reject(err)
      })

      child.on('exit', (code, sig) => {
        clearTimeout(timer)
        if (!isStarted) {
          reject(new Error(`Tiến trình Backend dừng trước khi sẵn sàng (code: ${code}, sig: ${sig}, stderr: ${stderr})`))
        }
      })
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Khởi động tiến trình Data API production thật
 */
async function startDataApiProduction(customEnv = {}) {
  const port = await getAvailablePort()
  const serverPath = path.resolve(dataApiRootDir, 'src/server.js')

  return new Promise((resolve, reject) => {
    try {
      const child = spawn(process.execPath, [serverPath], {
        cwd: dataApiRootDir,
        env: {
          ...process.env,
          PORT: String(port),
          NODE_ENV: 'test',
          ...customEnv,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let isStarted = false
      const timer = setTimeout(() => {
        if (!isStarted) {
          try {
            child.kill('SIGKILL')
          } catch {}
          reject(new Error(`Timeout quá 6000ms chờ Data API khởi động trên cổng ${port}`))
        }
      }, 6000)

      child.stdout.on('data', (chunk) => {
        const msg = chunk.toString()
        if (msg.includes('Server đang chạy tại') && !isStarted) {
          isStarted = true
          clearTimeout(timer)
          resolve({
            child,
            port,
            baseUrl: `http://127.0.0.1:${port}`,
          })
        }
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        if (!isStarted) reject(err)
      })

      child.on('exit', (code, sig) => {
        clearTimeout(timer)
        if (!isStarted) {
          reject(new Error(`Tiến trình Data API dừng trước khi sẵn sàng (code: ${code}, sig: ${sig})`))
        }
      })
    } catch (err) {
      reject(err)
    }
  })
}

async function runAllTests() {
  console.log('=== BẮT ĐẦU KIỂM CHỨNG TOÀN DIỆN KẾT NỐI DATA API & READINESS TRÊN BACKEND ===\n')

  const validKey = 'test_backend_data_api_valid_key_123'
  const upstreamSensitiveMarker = 'UPSTREAM_SENSITIVE_SECRET_MARKER_DB003_XYZ'

  // -----------------------------------------------------------------
  // Thiết lập Mock HTTP Server cho Data API
  // -----------------------------------------------------------------
  let mockMode = 'healthy_ready'
  let mock500BranchExecuted = false
  const mockSockets = new Set()

  const mockServer = http.createServer((req, res) => {
    const keyHeader = req.headers['x-service-key']

    if (mockMode === 'unauthorized_401' || (keyHeader && keyHeader !== validKey)) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, message: 'Sai khóa', error: { code: 'SERVICE_UNAUTHORIZED' } }))
      return
    }

    if (mockMode === 'healthy_ready') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: true,
          message: 'Data API sẵn sàng.',
          data: { service: 'shopnova-data-api', database: 'connected' },
        }),
      )
      return
    }

    if (mockMode === 'db_unavailable_503') {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: false,
          message: 'CSDL không kết nối được.',
          error: { code: 'DATABASE_UNAVAILABLE' },
        }),
      )
      return
    }

    if (mockMode === 'no_headers_hang') {
      // Treo socket không gửi headers
      return
    }

    if (mockMode === 'partial_body_hang') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.write('{"success": true, "data": { "service": "shopnova-data-api", "database":')
      // Treo không gọi res.end()
      return
    }

    if (mockMode === 'bad_json') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('this is not json { [ broken')
      return
    }

    if (mockMode === 'wrong_envelope_missing_success') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, data: { service: 'shopnova-data-api', database: 'connected' } }))
      return
    }

    if (mockMode === 'wrong_envelope_missing_data') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
      return
    }

    if (mockMode === 'wrong_service') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: true,
          data: { service: 'wrong-service-name', database: 'connected' },
        }),
      )
      return
    }

    if (mockMode === 'wrong_database_status') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: true,
          data: { service: 'shopnova-data-api', database: 'disconnected' },
        }),
      )
      return
    }

    if (mockMode === 'redirect') {
      res.writeHead(302, { Location: 'http://127.0.0.1:59999/other' })
      res.end()
      return
    }

    if (mockMode === 'status_outside_contract_500') {
      mock500BranchExecuted = true
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: false,
          message: `Lỗi truy vấn nội bộ với marker: ${upstreamSensitiveMarker}`,
          error: {
            code: 'INTERNAL_ERROR',
            sql: `SELECT * FROM users WHERE secret_token = '${upstreamSensitiveMarker}'`,
            parameters: [upstreamSensitiveMarker],
            stack: `Error: query failed with ${upstreamSensitiveMarker} at Database.query (db.js:10:15)`,
            cause: `Underlying connection failure for ${upstreamSensitiveMarker}`,
          },
        }),
      )
      return
    }

    if (mockMode === 'body_too_large') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      const hugePadding = 'a'.repeat(1024 * 1024 + 1000) // ~1.001 MiB
      res.end(
        JSON.stringify({
          success: true,
          data: { service: 'shopnova-data-api', database: 'connected', padding: hugePadding },
        }),
      )
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }))
  })

  mockServer.on('connection', (sock) => {
    mockSockets.add(sock)
    sock.once('close', () => mockSockets.delete(sock))
  })

  await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve))
  const mockPort = mockServer.address().port
  const mockBaseUrl = `http://127.0.0.1:${mockPort}`

  console.log(`[Mock Server] Data API Mock Server đang chạy tại: ${mockBaseUrl}\n`)

  try {
    // =================================================================
    // PHẦN 1: Kiểm thử tích hợp với MySQL 8.4 thật và Data API Production thật
    // =================================================================
    console.log('--- PHẦN 1: Kiểm thử tích hợp với MySQL 8.4 thật và Data API Production thật ---')

    // 1.1 MySQL thật sống -> Data API sống -> Backend sống: ready 200
    console.log('[1.1] Kiểm tra Backend ready 200 khi Data API và MySQL 8.4.4 thật đều đang hoạt động...')
    let realDataApi = null
    let realBackend = null
    try {
      realDataApi = await startDataApiProduction({
        DATA_API_KEY: validKey,
      })

      realBackend = await startBackendProduction({
        DATA_API_URL: realDataApi.baseUrl,
        DATA_API_KEY: validKey,
        DOTENV_CONFIG_PATH: path.join(__dirname, 'non-existent.env'),
      })

      const resHealth = await fetch(`${realBackend.baseUrl}/api/v1/health`)
      const healthData = await resHealth.json()
      assert(resHealth.status === 200, 'Live stack: Backend health trả HTTP 200')
      assert(healthData.data?.service === 'shopnova-backend', 'Live stack: Health service đúng')

      const resReady = await fetch(`${realBackend.baseUrl}/api/v1/ready`)
      const readyData = await resReady.json()
      assert(resReady.status === 200, 'Live stack: Backend ready trả HTTP 200 khi MySQL thật sẵn sàng')
      assert(readyData.success === true, 'Live stack: Ready success === true')
      assert(readyData.data?.service === 'shopnova-backend', 'Live stack: Ready service === "shopnova-backend"')
      assert(readyData.data?.status === 'ready', 'Live stack: Ready status === "ready"')
      assert(readyData.data?.dataApi === 'connected', 'Live stack: Ready dataApi === "connected"')
      assert(readyData.data?.database === 'connected', 'Live stack: Ready database === "connected"')
    } finally {
      if (realBackend) await stopProcess(realBackend.child)
      if (realDataApi) await stopProcess(realDataApi.child)
    }

    // 1.2 Data API còn hoạt động nhưng DB port đóng: Backend health 200, ready 503
    console.log('\n[1.2] Kiểm tra Data API còn chạy nhưng DB port đóng: Backend health 200, ready 503...')
    let deadDbDataApi = null
    let deadDbBackend = null
    try {
      const deadDbPort = await getAvailablePort()
      deadDbDataApi = await startDataApiProduction({
        DB_PORT: String(deadDbPort),
        DATA_API_KEY: validKey,
        DB_READINESS_TIMEOUT_MS: '2000',
      })

      deadDbBackend = await startBackendProduction({
        DATA_API_URL: deadDbDataApi.baseUrl,
        DATA_API_KEY: validKey,
        DOTENV_CONFIG_PATH: path.join(__dirname, 'non-existent.env'),
      })

      const resHealth = await fetch(`${deadDbBackend.baseUrl}/api/v1/health`)
      assert(resHealth.status === 200, 'Dead DB: Backend health vẫn trả HTTP 200 (liveness độc lập)')

      const resReady = await fetch(`${deadDbBackend.baseUrl}/api/v1/ready`)
      const readyData = await resReady.json()
      assert(resReady.status === 503, 'Dead DB: Backend ready trả HTTP 503 Service Unavailable')
      assert(readyData.success === false, 'Dead DB: Ready success === false')
      assert(readyData.error?.code === 'DATA_API_UNAVAILABLE', 'Dead DB: Error code được map thành DATA_API_UNAVAILABLE')
      assert(typeof readyData.message === 'string' && readyData.message.length > 0, 'Dead DB: Message lỗi tiếng Việt cố định')
    } finally {
      if (deadDbBackend) await stopProcess(deadDbBackend.child)
      if (deadDbDataApi) await stopProcess(deadDbDataApi.child)
    }

    // 1.3 Data API port đóng hoàn toàn (Connection Refused): Backend health 200, ready 503
    console.log('\n[1.3] Kiểm tra Data API port đóng hoàn toàn: Backend health 200, ready 503...')
    let closedDataApiBackend = null
    try {
      const closedPort = await getAvailablePort()
      closedDataApiBackend = await startBackendProduction({
        DATA_API_URL: `http://127.0.0.1:${closedPort}`,
        DATA_API_KEY: validKey,
        DOTENV_CONFIG_PATH: path.join(__dirname, 'non-existent.env'),
      })

      const resHealth = await fetch(`${closedDataApiBackend.baseUrl}/api/v1/health`)
      assert(resHealth.status === 200, 'Closed Data API: Backend health vẫn trả HTTP 200')

      const t0 = Date.now()
      const resReady = await fetch(`${closedDataApiBackend.baseUrl}/api/v1/ready`)
      const elapsed = Date.now() - t0
      const readyData = await resReady.json()

      assert(resReady.status === 503, 'Closed Data API: Backend ready trả HTTP 503')
      assert(readyData.error?.code === 'DATA_API_UNAVAILABLE', 'Closed Data API: Error code là DATA_API_UNAVAILABLE')
      assert(elapsed < 2000, `Closed Data API: Phản hồi lỗi kết nối nhanh (${elapsed}ms < 2000ms)`)
    } finally {
      if (closedDataApiBackend) await stopProcess(closedDataApiBackend.child)
    }

    // =================================================================
    // PHẦN 2: Kiểm thử xác thực khóa dịch vụ nội bộ (Service Key)
    // =================================================================
    console.log('\n--- PHẦN 2: Kiểm thử xác thực khóa dịch vụ nội bộ (Service Key) ---')
    let wrongKeyBackend = null
    try {
      mockMode = 'healthy_ready' // Mock chấp nhận validKey, nhưng Backend dùng wrongKey
      wrongKeyBackend = await startBackendProduction({
        DATA_API_URL: mockBaseUrl,
        DATA_API_KEY: 'wrong_secret_service_key_999',
        DOTENV_CONFIG_PATH: path.join(__dirname, 'non-existent.env'),
      })

      const res = await fetch(`${wrongKeyBackend.baseUrl}/api/v1/ready`)
      const data = await res.json()
      assert(res.status === 502, 'Sai service key: Backend trả HTTP 502 Bad Gateway (không trả public 401)')
      assert(data.error?.code === 'DATA_API_AUTH_FAILED', 'Sai service key: Error code là DATA_API_AUTH_FAILED')
    } finally {
      if (wrongKeyBackend) await stopProcess(wrongKeyBackend.child)
    }

    // =================================================================
    // PHẦN 3: Kiểm thử Deadline Timeout 5000ms (Toàn diện trước và trong khi nhận body)
    // =================================================================
    console.log('\n--- PHẦN 3: Kiểm thử Deadline Timeout 5000ms (Trước và trong khi nhận body) ---')
    let timeoutBackend = null
    try {
      timeoutBackend = await startBackendProduction({
        DATA_API_URL: mockBaseUrl,
        DATA_API_KEY: validKey,
        DOTENV_CONFIG_PATH: path.join(__dirname, 'non-existent.env'),
      })

      // 3.1 Upstream không gửi headers (hang before headers)
      console.log('[3.1] Kiểm tra Upstream treo không gửi headers...')
      mockMode = 'no_headers_hang'
      {
        const t0 = Date.now()
        const res = await fetch(`${timeoutBackend.baseUrl}/api/v1/ready`, { signal: AbortSignal.timeout(8000) })
        const elapsed = Date.now() - t0
        const data = await res.json()

        assert(res.status === 504, 'Treo headers: Backend trả HTTP 504 Gateway Timeout')
        assert(data.error?.code === 'DATA_API_TIMEOUT', 'Treo headers: Error code là DATA_API_TIMEOUT')
        assert(
          elapsed >= 4700 && elapsed <= 6200,
          `Treo headers: Hết hạn đúng ngân sách 5000ms (${elapsed}ms ~ 5000ms)`,
        )
      }

      // 3.2 Upstream gửi headers và một phần JSON rồi treo body (partial body hang)
      console.log('[3.2] Kiểm tra Upstream gửi headers và một phần JSON rồi treo body...')
      mockMode = 'partial_body_hang'
      {
        const t0 = Date.now()
        const res = await fetch(`${timeoutBackend.baseUrl}/api/v1/ready`, { signal: AbortSignal.timeout(8000) })
        const elapsed = Date.now() - t0
        const data = await res.json()

        assert(res.status === 504, 'Treo body: Backend trả HTTP 504 Gateway Timeout')
        assert(data.error?.code === 'DATA_API_TIMEOUT', 'Treo body: Error code là DATA_API_TIMEOUT')
        assert(
          elapsed >= 4700 && elapsed <= 6200,
          `Treo body: Hết hạn đúng cùng ngân sách 5000ms (${elapsed}ms ~ 5000ms)`,
        )
      }
    } finally {
      if (timeoutBackend) await stopProcess(timeoutBackend.child)
    }

    // =================================================================
    // PHẦN 4: Kiểm thử thẩm định Response Payload, Envelope & HTTP Contract
    // =================================================================
    console.log('\n--- PHẦN 4: Kiểm thử thẩm định Response Payload, Envelope & HTTP Contract ---')
    let contractBackend = null
    try {
      contractBackend = await startBackendProduction({
        DATA_API_URL: mockBaseUrl,
        DATA_API_KEY: validKey,
        DOTENV_CONFIG_PATH: path.join(__dirname, 'non-existent.env'),
      })

      // 4.1 JSON sai cú pháp
      mockMode = 'bad_json'
      {
        const res = await fetch(`${contractBackend.baseUrl}/api/v1/ready`)
        const data = await res.json()
        assert(res.status === 502, 'Bad JSON: Backend trả HTTP 502 Bad Gateway')
        assert(data.error?.code === 'DATA_API_BAD_RESPONSE', 'Bad JSON: Error code là DATA_API_BAD_RESPONSE')
      }

      // 4.2 Envelope thiếu success: true
      mockMode = 'wrong_envelope_missing_success'
      {
        const res = await fetch(`${contractBackend.baseUrl}/api/v1/ready`)
        const data = await res.json()
        assert(res.status === 502, 'Thiếu success: Backend trả HTTP 502')
        assert(data.error?.code === 'DATA_API_BAD_RESPONSE', 'Thiếu success: Error code là DATA_API_BAD_RESPONSE')
      }

      // 4.3 Envelope thiếu data
      mockMode = 'wrong_envelope_missing_data'
      {
        const res = await fetch(`${contractBackend.baseUrl}/api/v1/ready`)
        const data = await res.json()
        assert(res.status === 502, 'Thiếu data: Backend trả HTTP 502')
        assert(data.error?.code === 'DATA_API_BAD_RESPONSE', 'Thiếu data: Error code là DATA_API_BAD_RESPONSE')
      }

      // 4.4 Service sai
      mockMode = 'wrong_service'
      {
        const res = await fetch(`${contractBackend.baseUrl}/api/v1/ready`)
        const data = await res.json()
        assert(res.status === 502, 'Sai service: Backend trả HTTP 502')
        assert(data.error?.code === 'DATA_API_BAD_RESPONSE', 'Sai service: Error code là DATA_API_BAD_RESPONSE')
      }

      // 4.5 Database status sai
      mockMode = 'wrong_database_status'
      {
        const res = await fetch(`${contractBackend.baseUrl}/api/v1/ready`)
        const data = await res.json()
        assert(res.status === 502, 'Sai status database: Backend trả HTTP 502')
        assert(data.error?.code === 'DATA_API_BAD_RESPONSE', 'Sai status: Error code là DATA_API_BAD_RESPONSE')
      }

      // 4.6 Redirect (302)
      mockMode = 'redirect'
      {
        const res = await fetch(`${contractBackend.baseUrl}/api/v1/ready`)
        const data = await res.json()
        assert(res.status === 502, 'Redirect 302: Backend trả HTTP 502 (không tự ý theo redirect)')
        assert(data.error?.code === 'DATA_API_BAD_RESPONSE', 'Redirect: Error code là DATA_API_BAD_RESPONSE')
      }

      // 4.7 Status ngoài contract (500)
      mockMode = 'status_outside_contract_500'
      {
        const res = await fetch(`${contractBackend.baseUrl}/api/v1/ready`)
        const data = await res.json()
        assert(res.status === 502, 'Upstream 500: Backend trả HTTP 502 Bad Gateway')
        assert(data.error?.code === 'DATA_API_BAD_RESPONSE', 'Upstream 500: Error code là DATA_API_BAD_RESPONSE')
      }

      // 4.8 Body vượt giới hạn 1MiB
      mockMode = 'body_too_large'
      {
        const res = await fetch(`${contractBackend.baseUrl}/api/v1/ready`)
        const data = await res.json()
        assert(res.status === 502, 'Body quá 1MiB: Backend trả HTTP 502')
        assert(data.error?.code === 'DATA_API_BAD_RESPONSE', 'Body quá 1MiB: Error code là DATA_API_BAD_RESPONSE')
      }

      // ===============================================================
      // PHẦN 5: Kiểm thử phục hồi trên CÙNG tiến trình Backend sau chuỗi lỗi
      // ===============================================================
      console.log('\n--- PHẦN 5: Kiểm thử phục hồi trên CÙNG tiến trình Backend sau chuỗi lỗi ---')
      mockMode = 'healthy_ready'
      {
        const res = await fetch(`${contractBackend.baseUrl}/api/v1/ready`)
        const data = await res.json()
        assert(res.status === 200, 'Phục hồi: Request khỏe trên CÙNG TIẾN TRÌNH Backend thành công trả HTTP 200 OK')
        assert(data.data?.dataApi === 'connected', 'Phục hồi: dataApi === "connected"')
        assert(data.data?.database === 'connected', 'Phục hồi: database === "connected"')
      }
    } finally {
      if (contractBackend) await stopProcess(contractBackend.child)
    }

    // =================================================================
    // PHẦN 6: Kiểm thử bảo mật (Secret Marker & Log Security)
    // =================================================================
    console.log('\n--- PHẦN 6: Kiểm thử bảo mật (Secret Marker & Log Security) ---')
    let markerBackend = null
    try {
      // Backend sử dụng service key được mock server chấp nhận
      markerBackend = await startBackendProduction({
        DATA_API_URL: mockBaseUrl,
        DATA_API_KEY: validKey,
        DOTENV_CONFIG_PATH: path.join(__dirname, 'non-existent.env'),
      })

      // Gây ra lỗi HTTP 500 từ upstream chứa dữ liệu nhạy cảm
      mock500BranchExecuted = false
      mockMode = 'status_outside_contract_500'

      const res = await fetch(`${markerBackend.baseUrl}/api/v1/ready`)
      const bodyText = await res.text()
      let data = null
      try {
        data = JSON.parse(bodyText)
      } catch {}

      assert(mock500BranchExecuted === true, 'Xác nhận Mock Data API đã chạy nhánh trả HTTP 500 (chứng minh service key hợp lệ)')
      assert(res.status === 502, 'Upstream 500: Backend trả HTTP 502 Bad Gateway')
      assert(data?.error?.code === 'DATA_API_BAD_RESPONSE', 'Upstream 500: Error code là DATA_API_BAD_RESPONSE')
      assert(!bodyText.includes(upstreamSensitiveMarker), 'Bảo mật response: Tuyệt đối không để lộ upstream sensitive marker trong body response')

      const stdout = markerBackend.getStdout()
      const stderr = markerBackend.getStderr()
      assert(!stdout.includes(upstreamSensitiveMarker), 'Bảo mật stdout: Tuyệt đối không in upstream sensitive marker ra stdout')
      assert(!stderr.includes(upstreamSensitiveMarker), 'Bảo mật stderr: Tuyệt đối không in upstream sensitive marker ra stderr')

      // Kiểm tra thêm bảo mật cho chính service key
      assert(!bodyText.includes(validKey), 'Bảo mật response: Tuyệt đối không để lộ service key trong body response')
      assert(!stdout.includes(validKey), 'Bảo mật stdout: Tuyệt đối không in service key ra stdout')
      assert(!stderr.includes(validKey), 'Bảo mật stderr: Tuyệt đối không in service key ra stderr')

      // Request khỏe tiếp theo trên CÙNG TIẾN TRÌNH Backend vẫn thành công bình thường
      mockMode = 'healthy_ready'
      const healthyRes = await fetch(`${markerBackend.baseUrl}/api/v1/ready`)
      const healthyData = await healthyRes.json()
      assert(healthyRes.status === 200, 'Phục hồi bảo mật: Request khỏe tiếp theo trên CÙNG TIẾN TRÌNH Backend thành công trả HTTP 200 OK')
      assert(healthyData.data?.dataApi === 'connected', 'Phục hồi bảo mật: dataApi === "connected"')
      assert(healthyData.data?.database === 'connected', 'Phục hồi bảo mật: database === "connected"')
    } finally {
      if (markerBackend) await stopProcess(markerBackend.child)
    }
  } finally {
    // Đóng tất cả socket còn lại của mock server và đóng server an toàn
    for (const sock of mockSockets) {
      try {
        if (!sock.destroyed) sock.destroy()
      } catch {}
    }
    mockSockets.clear()
    await new Promise((resolve) => mockServer.close(resolve))
    console.log('\n[Cleanup] Đã đóng Mock HTTP Server an toàn.')
  }

  console.log('\n=== TỔNG KẾT KẾT QUẢ KIỂM CHỨNG TÍCH HỢP READINESS ===')
  console.log(`Số test vượt qua (PASS): ${passed}`)
  console.log(`Số test thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ kiểm thử tích hợp Backend Readiness và kết nối Data API đều ĐẠT (PASS)!')
    process.exit(0)
  }
}

runAllTests().catch((err) => {
  console.error('[Integration Test Fatal Error]:', err)
  process.exit(1)
})
