import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

let passedMock = 0
let failedMock = 0

function assertMock(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS [Mock / Contract]: ${testName}`)
    passedMock++
  } else {
    console.error(`  ✗ FAIL [Mock / Contract]: ${testName} ${detail ? `(${detail})` : ''}`)
    failedMock++
  }
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
  })
}

function stopProcess(child, timeoutMs = 6000) {
  if (!child) return Promise.resolve({ exitCode: null, signalCode: null })
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ exitCode: child.exitCode, signalCode: child.signalCode })
  }
  return new Promise((resolve, reject) => {
    let resolved = false
    let sigkillTimer = null
    let failTimer = null

    const cleanupListeners = () => {
      if (typeof child.removeListener === 'function') {
        child.removeListener('exit', onExit)
        child.removeListener('close', onClose)
      }
      if (sigkillTimer) clearTimeout(sigkillTimer)
      if (failTimer) clearTimeout(failTimer)
    }

    const onDone = () => {
      if (!resolved) {
        resolved = true
        cleanupListeners()
        resolve({ exitCode: child.exitCode, signalCode: child.signalCode })
      }
    }

    const onExit = () => onDone()
    const onClose = () => onDone()

    child.once('exit', onExit)
    child.once('close', onClose)

    try {
      child.kill('SIGTERM')
    } catch {}

    const killGraceMs = Math.min(2000, Math.floor(timeoutMs / 2))
    sigkillTimer = setTimeout(() => {
      sigkillTimer = null
      if (!resolved && child.exitCode === null && child.signalCode === null) {
        try {
          child.kill('SIGKILL')
        } catch {}
      }
    }, killGraceMs)

    failTimer = setTimeout(() => {
      failTimer = null
      if (!resolved) {
        if (child.exitCode !== null || child.signalCode !== null) {
          onDone()
        } else {
          resolved = true
          cleanupListeners()
          reject(new Error(`Process cleanup failed: Child process (pid: ${child.pid}) did not exit within ${timeoutMs}ms.`))
        }
      }
    }, timeoutMs)
  })
}

async function startBackendProduction(customEnv = {}) {
  const port = await getAvailablePort()
  const serverPath = path.resolve(rootDir, 'src/server.js')

  return new Promise((resolve, reject) => {
    try {
      const child = spawn(process.execPath, [serverPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          PORT: String(port),
          NODE_ENV: 'test',
          JWT_SECRET: 'test_backend_jwt_secret_min_32_characters_long_for_integration',
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
          reject(new Error(`Backend dừng sớm với mã: ${code}, tín hiệu: ${sig}`))
        }
      })
    } catch (err) {
      reject(err)
    }
  })
}

async function runClientAbortRegressionTests() {
  console.log('=== KIỂM THỬ REGRESSION: CLIENT NGẮT KẾT NỐI VÀ GIỮ CHỖ RATE LIMIT ===\n')

  let spyServer = null
  let backendProc = null
  const heldRequests = []
  let totalUpstreamCalls = 0
  let activeUpstreamCalls = 0
  let maxActiveUpstream = 0
  let upstreamMode = 'hold'

  function releaseHeldRequests(statusCode = 401, body = { success: false, error: { code: 'INVALID_CREDENTIALS' } }) {
    while (heldRequests.length > 0) {
      const item = heldRequests.shift()
      activeUpstreamCalls = Math.max(0, activeUpstreamCalls - 1)
      if (!item.res.writableEnded) {
        item.res.writeHead(statusCode, { 'Content-Type': 'application/json' })
        item.res.end(JSON.stringify(body))
      }
    }
  }

  async function waitForUpstreamHeld(expectedCount, timeoutMs = 5000) {
    const start = Date.now()
    while (heldRequests.length < expectedCount) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Timeout chờ upstream spy nhận đủ ${expectedCount} requests (hiện tại: ${heldRequests.length})`)
      }
      await new Promise((r) => setTimeout(r, 10))
    }
  }

  try {
    const spyPort = await getAvailablePort()

    spyServer = http.createServer((req, res) => {
      if (req.url === '/internal/v1/auth/verify-credentials') {
        totalUpstreamCalls++
        activeUpstreamCalls++
        maxActiveUpstream = Math.max(maxActiveUpstream, activeUpstreamCalls)

        if (upstreamMode === 'hold') {
          heldRequests.push({ req, res })
          return
        }

        if (upstreamMode === 'immediate_500') {
          activeUpstreamCalls = Math.max(0, activeUpstreamCalls - 1)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_SERVER_ERROR' } }))
          return
        }

        activeUpstreamCalls = Math.max(0, activeUpstreamCalls - 1)
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: { code: 'INVALID_CREDENTIALS' } }))
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false }))
    })

    await new Promise((resolve) => spyServer.listen(spyPort, '127.0.0.1', resolve))
    console.log(`[Upstream Spy] Đang lắng nghe trên cổng: ${spyPort}`)

    backendProc = await startBackendProduction({
      DATA_API_URL: `http://127.0.0.1:${spyPort}`,
      DATA_API_KEY: 'test_service_key_for_abort_regression_32_chars!',
    })
    console.log(`[Backend Thật] Đang chạy tại: ${backendProc.baseUrl}`)

    // -----------------------------------------------------------------------------------
    // PHẦN 1: Bắt lỗi R2 khi client hủy kết nối trong lúc upstream đang xử lý
    // -----------------------------------------------------------------------------------
    console.log('\n[1] Gửi 5 yêu cầu đăng nhập và chờ upstream spy xác nhận đã nhận đủ 5...')
    upstreamMode = 'hold'
    heldRequests.length = 0
    totalUpstreamCalls = 0
    activeUpstreamCalls = 0
    maxActiveUpstream = 0

    const clientRequests = []
    for (let i = 0; i < 5; i++) {
      const clientReq = http.request({
        hostname: '127.0.0.1',
        port: backendProc.port,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      clientReq.on('error', () => {})
      clientReq.write(JSON.stringify({ username: 'buyer1', password: `WrongPassword_${i}` }))
      clientReq.end()
      clientRequests.push(clientReq)
    }

    // Chờ upstream xác nhận đã nhận đủ 5 yêu cầu (không dùng sleep cứng 25ms)
    await waitForUpstreamHeld(5, 4000)
    assertMock(heldRequests.length === 5, 'Upstream spy đã nhận và đang giữ chính xác 5 yêu cầu')
    assertMock(activeUpstreamCalls === 5, 'Số yêu cầu đang xử lý tại upstream là 5')

    console.log('\n[2] Hủy kết nối của cả 5 client trong lúc upstream vẫn đang giữ các yêu cầu...')
    for (const req of clientRequests) {
      try {
        req.destroy()
      } catch {}
    }

    // Đợi 50ms để sự kiện socket close truyền tới Backend
    await new Promise((r) => setTimeout(r, 50))

    console.log('\n[3] Gửi yêu cầu đăng nhập thứ 6 từ cùng IP: phải bị chặn 429 và không lọt upstream...')
    const res6 = await fetch(`${backendProc.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'buyer1', password: 'Attempt6_FromSameIP' }),
    })
    const data6 = await res6.json()

    assertMock(res6.status === 429, 'Đợt đăng nhập thứ 6 từ cùng IP bị chặn với HTTP 429 RATE_LIMITED')
    assertMock(data6.error?.code === 'RATE_LIMITED', 'Mã lỗi trả về là RATE_LIMITED')
    assertMock(heldRequests.length === 5, 'Không phát sinh lời gọi upstream mới (upstream vẫn chỉ giữ 5 yêu cầu cũ)')
    assertMock(totalUpstreamCalls === 5, 'Tổng số lời gọi upstream thực tế không vượt quá 5')
    assertMock(maxActiveUpstream <= 5, 'Số công việc upstream đang chạy đồng thời tại mọi thời điểm không vượt quá 5')

    console.log('\n[4] Cho upstream hoàn tất 5 yêu cầu cũ với 401: xác nhận kết quả thất bại vẫn được ghi nhận...')
    releaseHeldRequests(401, { success: false, error: { code: 'INVALID_CREDENTIALS' } })
    await new Promise((r) => setTimeout(r, 100))

    assertMock(activeUpstreamCalls === 0, 'Tất cả 5 yêu cầu cũ đã hoàn tất tại upstream')

    // Request thứ 7 kiểm tra failedAttempts đã được ghi nhận đúng sau khi upstream xong
    const res7 = await fetch(`${backendProc.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'buyer1', password: 'Attempt7_CheckFailedRecorded' }),
    })
    const data7 = await res7.json()
    assertMock(res7.status === 429, 'Request thứ 7 vẫn nhận 429 vì 5 lần thử sai đã được ghi nhận kể cả khi client hủy')
    assertMock(data7.error?.code === 'RATE_LIMITED', 'Mã lỗi vẫn là RATE_LIMITED')

    // -----------------------------------------------------------------------------------
    // PHẦN 2: Nhánh lỗi hệ thống (500) thu hồi phần giữ chỗ đúng một lần và cho phép đăng nhập lại
    // -----------------------------------------------------------------------------------
    console.log('\n[5] Kiểm tra nhánh lỗi hệ thống (500): thu hồi phần giữ chỗ và cho phép đăng nhập lại...')
    await stopProcess(backendProc.child)
    backendProc = await startBackendProduction({
      DATA_API_URL: `http://127.0.0.1:${spyPort}`,
      DATA_API_KEY: 'test_service_key_for_abort_regression_32_chars!',
    })

    upstreamMode = 'hold'
    heldRequests.length = 0
    totalUpstreamCalls = 0
    activeUpstreamCalls = 0
    maxActiveUpstream = 0

    const singleReq = http.request({
      hostname: '127.0.0.1',
      port: backendProc.port,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    singleReq.on('error', () => {})
    singleReq.write(JSON.stringify({ username: 'buyer1', password: 'SingleReqPassword' }))
    singleReq.end()

    await waitForUpstreamHeld(1, 4000)
    assertMock(heldRequests.length === 1, 'Upstream spy đã nhận request lỗi hệ thống')

    // Client hủy kết nối
    try {
      singleReq.destroy()
    } catch {}
    await new Promise((r) => setTimeout(r, 50))

    // Upstream trả lỗi hệ thống 500
    releaseHeldRequests(500, { success: false, error: { code: 'INTERNAL_SERVER_ERROR' } })
    await new Promise((r) => setTimeout(r, 100))

    assertMock(activeUpstreamCalls === 0, 'Yêu cầu lỗi 500 đã kết thúc tại upstream')

    // Chuyển upstream sang trả lời bình thường và gửi request mới từ cùng IP
    upstreamMode = 'immediate_401'
    const recoveryRes = await fetch(`${backendProc.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'buyer1', password: 'PasswordAfterSystemError' }),
    })
    const recoveryData = await recoveryRes.json()

    assertMock(recoveryRes.status === 401, 'Request sau lỗi hệ thống nhận HTTP 401 (không bị kẹt 429 hay rò rỉ chỗ giữ)')
    assertMock(recoveryData.error?.code === 'INVALID_CREDENTIALS', 'Mã lỗi là INVALID_CREDENTIALS do upstream trả về')
  } finally {
    // Dọn dẹp an toàn trong mọi tình huống (kể cả khi assertion ném ngoại lệ)
    releaseHeldRequests(500, { success: false })
    if (backendProc?.child) {
      await stopProcess(backendProc.child)
      backendProc = null
    }
    if (spyServer) {
      await new Promise((resolve) => spyServer.close(resolve)).catch(() => {})
    }
    console.log('\n[Cleanup] Đã dọn dẹp sạch sẽ tiến trình Backend, Upstream Spy Server và các kết nối.')
  }

  console.log('\n=== TỔNG KẾT KIỂM THỬ REGRESSION CLIENT ABORT ===')
  console.log(`Số test vượt qua (PASS): ${passedMock}`)
  console.log(`Số test thất bại (FAIL): ${failedMock}`)

  if (failedMock > 0) {
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ ca kiểm tra Client Abort Regression đều ĐẠT (PASS)!')
  }
}

runClientAbortRegressionTests().catch((err) => {
  console.error('[Fatal Test Error]:', err)
  process.exit(1)
})
