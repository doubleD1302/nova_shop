import net from 'node:net'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

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
 * Tạo một gói tin MySQL chuẩn: [3 bytes length, 1 byte sequence id, payload]
 */
function makePacket(payload, seq = 0) {
  const header = Buffer.alloc(4)
  header.writeUIntLE(payload.length, 0, 3)
  header.writeUInt8(seq, 3)
  return Buffer.concat([header, payload])
}

/**
 * Tạo gói tin Initial Handshake V10 chuẩn của MySQL Server
 */
function makeHandshakeV10() {
  const parts = []
  parts.push(Buffer.from([10])) // Protocol version 10
  parts.push(Buffer.from('8.4.4-ShopNovaMock\0', 'ascii')) // Server version
  const threadId = Buffer.alloc(4)
  threadId.writeUInt32LE(1, 0)
  parts.push(threadId)
  parts.push(Buffer.from('12345678', 'ascii')) // auth data part 1
  parts.push(Buffer.from([0])) // filler
  const capLow = Buffer.alloc(2)
  capLow.writeUInt16LE(0xf7ff, 0)
  parts.push(capLow)
  parts.push(Buffer.from([33])) // utf8
  const status = Buffer.alloc(2)
  status.writeUInt16LE(2, 0) // AUTOCOMMIT
  parts.push(status)
  const capHigh = Buffer.alloc(2)
  capHigh.writeUInt16LE(0x81ff, 0)
  parts.push(capHigh)
  parts.push(Buffer.from([21])) // auth data length
  parts.push(Buffer.alloc(10, 0)) // reserved
  parts.push(Buffer.from('123456789012\0', 'ascii')) // auth data part 2
  parts.push(Buffer.from('mysql_native_password\0', 'ascii'))
  return makePacket(Buffer.concat(parts), 0)
}

/**
 * Tạo gói tin OK Packet chuẩn của MySQL
 */
function makeOkPacket(seq = 2) {
  return makePacket(Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]), seq)
}

/**
 * Tạo gói tin Result Set chuẩn cho truy vấn 'SELECT 1+1 AS result' (trả về 2)
 */
function makeSelectResultPackets(startSeq = 1) {
  const packets = []
  // 1. Column count = 1
  packets.push(makePacket(Buffer.from([0x01]), startSeq++))

  // 2. Column definition
  const colDef = []
  const writeLenStr = (s) => {
    const b = Buffer.from(s, 'utf8')
    colDef.push(Buffer.from([b.length]))
    colDef.push(b)
  }
  writeLenStr('def')
  writeLenStr('')
  writeLenStr('')
  writeLenStr('')
  writeLenStr('result')
  writeLenStr('result')
  colDef.push(Buffer.from([0x0c]))
  const charset = Buffer.alloc(2)
  charset.writeUInt16LE(63, 0)
  colDef.push(charset)
  const colLen = Buffer.alloc(4)
  colLen.writeUInt32LE(11, 0)
  colDef.push(colLen)
  colDef.push(Buffer.from([0x08])) // LONGLONG
  const flags = Buffer.alloc(2)
  flags.writeUInt16LE(0, 0)
  colDef.push(flags)
  colDef.push(Buffer.from([0x00]))
  packets.push(makePacket(Buffer.concat(colDef), startSeq++))

  // 3. Intermediate EOF packet
  packets.push(makePacket(Buffer.from([0xfe, 0x00, 0x00, 0x02, 0x00]), startSeq++))

  // 4. Row packet: giá trị '2'
  const rowData = [Buffer.from([1]), Buffer.from('2', 'ascii')]
  packets.push(makePacket(Buffer.concat(rowData), startSeq++))

  // 5. Final EOF packet
  packets.push(makePacket(Buffer.from([0xfe, 0x00, 0x00, 0x02, 0x00]), startSeq++))

  return Buffer.concat(packets)
}

/**
 * Tạo gói tin ERR Packet chuẩn của MySQL
 */
function makeErrPacket(errorCode = 1054, sqlState = '42S22', errorMessage = "Unknown column 'timeout' in 'field list'", seq = 1) {
  const parts = []
  parts.push(Buffer.from([0xff])) // ERR packet marker
  const codeBuf = Buffer.alloc(2)
  codeBuf.writeUInt16LE(errorCode, 0)
  parts.push(codeBuf)
  parts.push(Buffer.from('#' + sqlState, 'ascii'))
  parts.push(Buffer.from(errorMessage, 'utf8'))
  return makePacket(Buffer.concat(parts), seq)
}

/**
 * Tạo gói tin Result Set chuẩn cho truy vấn SELECT thông tin user từ bảng users
 */
function makeAuthProfileResultPackets(userId = '1', startSeq = 1) {
  const packets = []
  const columns = ['id', 'username', 'full_name', 'email', 'phone', 'avatar_url', 'role', 'status', 'shop_id']
  packets.push(makePacket(Buffer.from([columns.length]), startSeq++))

  for (const col of columns) {
    const colDef = []
    const writeLenStr = (s) => {
      const b = Buffer.from(s, 'utf8')
      colDef.push(Buffer.from([b.length]))
      colDef.push(b)
    }
    writeLenStr('def')
    writeLenStr('')
    writeLenStr('')
    writeLenStr('')
    writeLenStr(col)
    writeLenStr(col)
    colDef.push(Buffer.from([0x0c]))
    const charset = Buffer.alloc(2)
    charset.writeUInt16LE(33, 0) // utf8
    colDef.push(charset)
    const colLen = Buffer.alloc(4)
    colLen.writeUInt32LE(255, 0)
    colDef.push(colLen)
    colDef.push(Buffer.from([0xfd])) // VAR_STRING
    const flags = Buffer.alloc(2)
    flags.writeUInt16LE(0, 0)
    colDef.push(flags)
    colDef.push(Buffer.from([0x00]))
    packets.push(makePacket(Buffer.concat(colDef), startSeq++))
  }

  // Intermediate EOF
  packets.push(makePacket(Buffer.from([0xfe, 0x00, 0x00, 0x02, 0x00]), startSeq++))

  // Row packet: user buyer1
  const rowVals = [String(userId), 'buyer1', 'Người Mua 1', 'buyer1@shopnova.vn', '0901234567', null, 'buyer', 'active', null]
  const rowBufs = []
  for (const val of rowVals) {
    if (val === null) {
      rowBufs.push(Buffer.from([0xfb])) // NULL marker
    } else {
      const b = Buffer.from(val, 'utf8')
      rowBufs.push(Buffer.from([b.length]))
      rowBufs.push(b)
    }
  }
  packets.push(makePacket(Buffer.concat(rowBufs), startSeq++))

  // Final EOF
  packets.push(makePacket(Buffer.from([0xfe, 0x00, 0x00, 0x02, 0x00]), startSeq++))

  return Buffer.concat(packets)
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

function startProductionService(customEnv = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const httpPort = await getAvailablePort()
      const serverPath = path.resolve(rootDir, 'src/server.js')
      const child = spawn(process.execPath, [serverPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          PORT: String(httpPort),
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
          reject(new Error(`Timeout quá 5000ms chờ Data API khởi động trên cổng ${httpPort}`))
        }
      }, 5000)

      child.stdout.on('data', (chunk) => {
        const msg = chunk.toString()
        if (msg.includes('Server đang chạy tại') && !isStarted) {
          isStarted = true
          clearTimeout(timer)
          resolve({ child, port: httpPort, baseUrl: `http://127.0.0.1:${httpPort}` })
        }
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        if (!isStarted) reject(err)
      })

      child.on('exit', (code, sig) => {
        clearTimeout(timer)
        if (!isStarted) {
          reject(new Error(`Data API dừng sớm với mã: ${code}, tín hiệu: ${sig}`))
        }
      })
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Dừng tiến trình con và xác nhận TIẾN TRÌNH ĐÃ THOÁT THỰC SỰ (lắng nghe sự kiện exit/close, kiểm tra exitCode và signalCode)
 */
function stopProductionService(child, timeoutMs = 5000) {
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
            `Tiến trình Data API (PID ${child.pid}) không thể dừng sau ${timeoutMs}ms (exitCode: ${child.exitCode}, signalCode: ${child.signalCode})`,
          ),
        )
      }
    }, timeoutMs)
  })
}

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms))
}

async function runHangTests() {
  console.log('=== BẮT ĐẦU KIỂM CHỨNG TOÀN DIỆN TIMEOUT READINESS TRÊN TIẾN TRÌNH PRODUCTION ===')
  console.log('Lưu ý: Đây là bài kiểm tra các tình huống lỗi giả lập có kiểm soát (Mock Transport), không tính thành bằng chứng MySQL thật.\n')

  const clientSockets = new Set()
  let serverMode = 'no_handshake'
  const stagesReached = new Set()
  let connectionIndex = 0

  let delayPoolPingMs = 0

  const mockServer = net.createServer((socket) => {
    clientSockets.add(socket)
    const connId = ++connectionIndex
    socket.connId = connId
    socket.isNewSocket = true

    socket.on('error', () => {})
    socket.once('close', () => {
      clientSockets.delete(socket)
    })

    // 1. Chế độ không handshake
    if (serverMode === 'no_handshake') {
      stagesReached.add('stage_no_handshake_connected')
      return
    }

    // 2. Chế độ treo các kết nối mới (dùng để test bảo toàn connection cũ trong pool)
    if (serverMode === 'hang_new_connections') {
      stagesReached.add('stage_hang_new_connected')
      return
    }

    // Gửi Initial Handshake
    stagesReached.add('stage_handshake_sent')
    socket.write(makeHandshakeV10())

    socket.on('data', async (data) => {
      const seq = data[3]
      if (seq === 1) {
        // Client auth response
        stagesReached.add('stage_auth_received')

        if (serverMode === 'slow_acquire_hang_ping') {
          setTimeout(() => {
            if (!socket.destroyed) socket.write(makeOkPacket(2))
          }, 600)
          return
        }

        if (serverMode === 'ownership_order_1') {
          if (socket.orderRole === 'slow') {
            // Connection 1: Auth chậm 450ms
            stagesReached.add('stage_order1_slow_auth')
            await delay(450)
            if (!socket.destroyed) socket.write(makeOkPacket(2))
            return
          }
          if (socket.orderRole === 'fast') {
            // Connection 2: Auth nhanh 10ms
            stagesReached.add('stage_order1_fast_auth')
            await delay(10)
            if (!socket.destroyed) socket.write(makeOkPacket(2))
            return
          }
        }

        if (serverMode === 'ownership_order_2') {
          if (socket.orderRole === 'fast') {
            // Connection 1: Auth nhanh 10ms
            stagesReached.add('stage_order2_fast_auth')
            await delay(10)
            if (!socket.destroyed) socket.write(makeOkPacket(2))
            return
          }
          if (socket.orderRole === 'slow') {
            // Connection 2: Auth chậm 400ms
            stagesReached.add('stage_order2_slow_auth')
            await delay(400)
            if (!socket.destroyed) socket.write(makeOkPacket(2))
            return
          }
        }

        socket.write(makeOkPacket(2))
        return
      }

      if (data[4] === 0x03) {
        // COM_QUERY
        const queryText = data.slice(5).toString('utf8')

        if (queryText.includes('SET time_zone')) {
          stagesReached.add('stage_timezone_received')
          if (serverMode === 'hang_timezone') {
            return
          }
          socket.write(makeOkPacket(1))
          return
        }

        if (queryText.includes('SELECT 1+1')) {
          stagesReached.add('stage_ping_received')
          if (
            serverMode === 'slow_acquire_hang_ping' ||
            serverMode === 'hang_ping' ||
            serverMode === 'hang_timezone' ||
            serverMode === 'hang_all'
          ) {
            return
          }

          if (serverMode === 'ownership_order_1') {
            if (socket.orderRole === 'fast') {
              // Socket fast được giao cho A (FIFO queue) -> ping CỐ TÌNH TREO!
              stagesReached.add('stage_order1_a_ping_hang')
              return
            }
            if (socket.orderRole === 'slow') {
              // Socket slow được giao cho B -> ping trả lời sau khi A timeout (delay 560ms từ lúc nhận)
              stagesReached.add('stage_order1_b_ping_answered')
              await delay(560)
              if (!socket.destroyed) socket.write(makeSelectResultPackets(1))
              return
            }
          }

          if (serverMode === 'ownership_order_2') {
            if (socket.orderRole === 'fast') {
              // Socket fast giao cho A -> ping treo!
              stagesReached.add('stage_order2_a_ping_hang')
              return
            }
            if (socket.orderRole === 'slow') {
              // Socket slow giao cho B -> ping trả lời
              stagesReached.add('stage_order2_b_ping_answered')
              await delay(150)
              if (!socket.destroyed) socket.write(makeSelectResultPackets(1))
              return
            }
          }

          if (delayPoolPingMs > 0 && socket.isPoolSocket) {
            setTimeout(() => {
              if (!socket.destroyed) socket.write(makeSelectResultPackets(1))
            }, delayPoolPingMs)
            return
          }

          socket.write(makeSelectResultPackets(1))
          return
        }

        if (queryText.includes('FROM users')) {
          stagesReached.add('stage_auth_query_received')
          if (serverMode === 'hang_auth_query') {
            stagesReached.add('stage_auth_query_hang')
            // Cố tình im lặng để driver mysql2 kích hoạt query timeout (PROTOCOL_SEQUENCE_TIMEOUT)
            return
          }
          if (serverMode === 'sql_error_timeout_col') {
            stagesReached.add('stage_sql_error_sent')
            socket.write(makeErrPacket(1054, '42S22', "Unknown column 'timeout' in 'field list'", 1))
            return
          }
          socket.write(makeAuthProfileResultPackets('1', 1))
          return
        }
      }
    })
  })

  await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve))
  const mockDbPort = mockServer.address().port
  console.log(`[Mock Server] MySQL Mock Server đang lắng nghe trên cổng: ${mockDbPort}\n`)

  const testTimeoutBudgetMs = 1000
  const serviceKey = 'test-mock-service-key-db002r4'
  let prodService = null

  try {
    prodService = await startProductionService({
      DB_HOST: '127.0.0.1',
      DB_PORT: String(mockDbPort),
      DB_NAME: 'shopnova_mock_db',
      DB_USER: 'shopnova_mock_user',
      DB_PASSWORD: 'mock_password_valid_123',
      DATA_API_KEY: serviceKey,
      DB_READINESS_TIMEOUT_MS: String(testTimeoutBudgetMs),
      DOTENV_CONFIG_PATH: path.join(__dirname, 'non-existent.env'),
    })
    console.log(`[Production Service] Đang chạy tại: ${prodService.baseUrl} (PID: ${prodService.child.pid})\n`)

    async function requestReady() {
      const t0 = Date.now()
      const res = await fetch(`${prodService.baseUrl}/internal/v1/ready`, {
        headers: { 'x-service-key': serviceKey },
        signal: AbortSignal.timeout(6000),
      })
      const duration = Date.now() - t0
      const data = await res.json()
      return { status: res.status, duration, data }
    }

    const requestAuthProfile = async (userId = '1') => {
      const res = await fetch(`${prodService.baseUrl}/internal/v1/users/${userId}/auth-profile`, {
        headers: { 'x-service-key': serviceKey },
        signal: AbortSignal.timeout(testTimeoutBudgetMs + 3000),
      })
      const data = await res.json().catch(() => null)
      return { status: res.status, data }
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 1: Cổng đóng (Dead TCP Port)
    // -----------------------------------------------------------------
    console.log('[1/10] Kiểm tra cổng database đóng (TCP Connection Refused)...')
    const deadDbPort = await getAvailablePort()
    const deadService = await startProductionService({
      DB_HOST: '127.0.0.1',
      DB_PORT: String(deadDbPort),
      DB_NAME: 'shopnova_mock_db',
      DB_USER: 'shopnova_mock_user',
      DB_PASSWORD: 'mock_password_valid_123',
      DATA_API_KEY: serviceKey,
      DB_READINESS_TIMEOUT_MS: String(testTimeoutBudgetMs),
      DOTENV_CONFIG_PATH: path.join(__dirname, 'non-existent.env'),
    })
    try {
      const t0 = Date.now()
      const res = await fetch(`${deadService.baseUrl}/internal/v1/ready`, {
        headers: { 'x-service-key': serviceKey },
        signal: AbortSignal.timeout(5000),
      })
      const elapsed = Date.now() - t0
      const body = await res.json()
      assert(res.status === 503, 'Cổng đóng: trả HTTP 503 Service Unavailable')
      assert(body.error?.code === 'DATABASE_UNAVAILABLE', 'Cổng đóng: mã lỗi là DATABASE_UNAVAILABLE')
      assert(elapsed < 2000, `Cổng đóng: phản hồi lỗi trong thời gian ngắn (${elapsed}ms < 2000ms)`)
    } finally {
      await stopProductionService(deadService.child)
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 2: Thiếu handshake
    // -----------------------------------------------------------------
    console.log('\n[2/10] Kiểm tra thiếu handshake (server kết nối TCP nhưng không gửi greeting)...')
    serverMode = 'no_handshake'
    stagesReached.clear()
    {
      const { status, duration, data } = await requestReady()
      assert(stagesReached.has('stage_no_handshake_connected'), 'Khẳng định test đã đi tới giai đoạn kết nối TCP thiếu handshake')
      assert(status === 503, 'Thiếu handshake: trả HTTP 503')
      assert(data.error?.code === 'DATABASE_UNAVAILABLE', 'Thiếu handshake: mã lỗi là DATABASE_UNAVAILABLE')
      assert(
        duration >= testTimeoutBudgetMs - 200 && duration <= testTimeoutBudgetMs + 800,
        `Thiếu handshake: phản hồi đúng hạn ngân sách (${duration}ms ~ ${testTimeoutBudgetMs}ms)`,
      )
      await delay(100)
      assert(clientSockets.size === 0, 'Tài nguyên socket được thu hồi ngay sau khi lỗi thiếu handshake xảy ra')
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 3: Treo tại SET time_zone
    // -----------------------------------------------------------------
    console.log('\n[3/10] Kiểm tra treo tại câu lệnh khởi tạo SET time_zone...')
    serverMode = 'hang_timezone'
    stagesReached.clear()
    {
      const { status, duration, data } = await requestReady()
      assert(stagesReached.has('stage_timezone_received'), 'Khẳng định test đã gửi và server đã nhận được lệnh SET time_zone')
      assert(status === 503, 'Treo SET time_zone: trả HTTP 503')
      assert(data.error?.code === 'DATABASE_UNAVAILABLE', 'Treo SET time_zone: mã lỗi là DATABASE_UNAVAILABLE')
      assert(
        duration >= testTimeoutBudgetMs - 200 && duration <= testTimeoutBudgetMs + 800,
        `Treo SET time_zone: ngắt kết nối và phản hồi đúng ngân sách (${duration}ms ~ ${testTimeoutBudgetMs}ms)`,
      )
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 4: Acquire chậm rồi ping treo
    // -----------------------------------------------------------------
    console.log('\n[4/10] Kiểm tra acquire chậm (600ms) rồi ping treo (xác nhận deadline bao trùm toàn bộ)...')
    serverMode = 'slow_acquire_hang_ping'
    stagesReached.clear()
    {
      const { status, duration, data } = await requestReady()
      assert(stagesReached.has('stage_ping_received'), 'Khẳng định test đã qua bước acquire chậm và đi tới bước query ping treo')
      assert(status === 503, 'Acquire chậm rồi ping treo: trả HTTP 503')
      assert(data.error?.code === 'DATABASE_UNAVAILABLE', 'Acquire chậm rồi ping treo: mã lỗi DATABASE_UNAVAILABLE')
      assert(
        duration >= testTimeoutBudgetMs - 200 && duration <= testTimeoutBudgetMs + 800,
        `Toàn bộ thời gian xử lý vẫn nằm trong ngân sách chung (${duration}ms <= ${testTimeoutBudgetMs + 800}ms, KHÔNG bị cộng dồn)`,
      )
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 5: Ping treo trên connection pool đã hoạt động
    // -----------------------------------------------------------------
    console.log('\n[5/10] Kiểm tra ping treo trên kết nối pool đã hoạt động...')
    serverMode = 'normal'
    stagesReached.clear()
    {
      const { status, data } = await requestReady()
      assert(status === 200, 'Khởi tạo connection vào pool thành công (HTTP 200)')
      assert(data.data?.database === 'connected', 'Data status database === "connected"')
    }

    serverMode = 'hang_ping'
    stagesReached.clear()
    {
      const { status, duration, data } = await requestReady()
      assert(stagesReached.has('stage_ping_received'), 'Khẳng định test đã tái sử dụng connection và đi tới query ping bị treo')
      assert(status === 503, 'Ping treo trên pool: trả HTTP 503')
      assert(data.error?.code === 'DATABASE_UNAVAILABLE', 'Ping treo trên pool: mã lỗi DATABASE_UNAVAILABLE')
      assert(
        duration >= testTimeoutBudgetMs - 200 && duration <= testTimeoutBudgetMs + 800,
        `Ping treo trên pool: ngắt kết nối đúng ngân sách (${duration}ms ~ ${testTimeoutBudgetMs}ms)`,
      )
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 6: [REGRESSION THỨ TỰ 1] Chuyển giao quyền sở hữu (Conn 1 chậm, Conn 2 nhanh cấp cho A)
    // -----------------------------------------------------------------
    console.log('\n[6/10] [Regression 1] Chuyển giao ownership thứ tự 1: Conn 1 chậm, Conn 2 nhanh cấp cho A...')
    // Đảm bảo pool rỗng trước bài test chuyển giao ownership
    serverMode = 'hang_ping'
    await requestReady().catch(() => {})
    await delay(100)

    serverMode = 'ownership_order_1'
    stagesReached.clear()
    let connCountOrder1 = 0
    const onConnOrder1 = (sock) => {
      connCountOrder1++
      if (connCountOrder1 === 1) sock.orderRole = 'slow'
      else if (connCountOrder1 === 2) sock.orderRole = 'fast'
    }
    mockServer.on('connection', onConnOrder1)

    {
      const reqAPromise = requestReady()
      await delay(150)
      const reqBPromise = requestReady()

      const [resA, resB] = await Promise.all([reqAPromise, reqBPromise])
      mockServer.removeListener('connection', onConnOrder1)

      assert(stagesReached.has('stage_order1_slow_auth'), 'Khẳng định Conn 1 chạy auth chậm')
      assert(stagesReached.has('stage_order1_fast_auth'), 'Khẳng định Conn 2 chạy auth nhanh và được pool cấp cho A')
      assert(stagesReached.has('stage_order1_a_ping_hang'), 'Khẳng định Request A nhận Conn 2 và bị treo ở Ping')
      assert(stagesReached.has('stage_order1_b_ping_answered'), 'Khẳng định Request B nhận Conn 1 và được phục vụ ping')

      assert(resA.status === 503, 'Request A timeout: trả về HTTP 503')
      assert(resA.data.error?.code === 'DATABASE_UNAVAILABLE', 'Request A: mã lỗi DATABASE_UNAVAILABLE')

      assert(resB.status === 200, 'Request B: trả về HTTP 200 OK (không bị A hủy chéo khi A timeout)')
      assert(resB.data.data?.database === 'connected', 'Request B: trạng thái database === "connected"')
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 7: [REGRESSION THỨ TỰ 2] Chuyển giao quyền sở hữu (Conn 1 nhanh cấp cho A, Conn 2 chậm cấp cho B)
    // -----------------------------------------------------------------
    console.log('\n[7/10] [Regression 2] Chuyển giao ownership thứ tự 2: Conn 1 nhanh cấp cho A, Conn 2 chậm cấp cho B...')
    serverMode = 'hang_ping'
    await requestReady().catch(() => {})
    await delay(100)

    serverMode = 'ownership_order_2'
    stagesReached.clear()
    let connCountOrder2 = 0
    const onConnOrder2 = (sock) => {
      connCountOrder2++
      if (connCountOrder2 === 1) sock.orderRole = 'fast'
      else if (connCountOrder2 === 2) sock.orderRole = 'slow'
    }
    mockServer.on('connection', onConnOrder2)

    {
      const reqAPromise = requestReady()
      await delay(100)
      const reqBPromise = requestReady()

      const [resA, resB] = await Promise.all([reqAPromise, reqBPromise])
      mockServer.removeListener('connection', onConnOrder2)

      assert(stagesReached.has('stage_order2_fast_auth'), 'Khẳng định Conn 1 nhanh và được pool cấp cho A')
      assert(stagesReached.has('stage_order2_slow_auth'), 'Khẳng định Conn 2 chậm và được pool cấp cho B')

      assert(resA.status === 503, 'Request A timeout: trả về HTTP 503')
      assert(resB.status === 200, 'Request B hoàn tất: trả về HTTP 200 OK')
      assert(resB.data.data?.database === 'connected', 'Request B: trạng thái database === "connected"')
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 8: Bảo toàn connection khỏe trong pool khi có lỗi mở connection khác
    // -----------------------------------------------------------------
    console.log('\n[8/10] Kiểm tra bảo toàn connection khỏe trong pool khi có lỗi mở connection khác...')
    for (const s of clientSockets) {
      if (!s.destroyed) s.isPoolSocket = true
    }

    serverMode = 'hang_new_connections'
    delayPoolPingMs = 600
    stagesReached.clear()
    {
      const req1Promise = requestReady()
      await delay(100)
      const req2Promise = requestReady()

      const [res1, res2] = await Promise.all([req1Promise, req2Promise])
      delayPoolPingMs = 0

      assert(res2.status === 503, 'Request mở kết nối mới bị treo nhận HTTP 503 đúng hạn timeout')
      assert(res2.data.error?.code === 'DATABASE_UNAVAILABLE', 'Mã lỗi của request mới là DATABASE_UNAVAILABLE')
      assert(res1.status === 200, 'Request dùng connection sẵn có nhận HTTP 200 sau khi hoàn tất')

      serverMode = 'normal'
      stagesReached.clear()
      const req3 = await requestReady()
      assert(req3.status === 200, 'Connection khỏe trong pool vẫn sử dụng tốt sau khi request lỗi dọn dẹp (HTTP 200)')
      assert(req3.data.data?.database === 'connected', 'Trạng thái database vẫn connected')
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 9: [REGRESSION 3] 6 requests đồng thời treo SET time_zone, dọn dẹp sạch sẽ, phục hồi 200 lặp 3 vòng
    // -----------------------------------------------------------------
    console.log('\n[9/10] [Regression 3] 6 requests đồng thời treo SET time_zone, lặp 3 vòng kiểm tra không rò rỉ socket/pool slot...')
    for (let round = 1; round <= 3; round++) {
      serverMode = 'hang_timezone'
      stagesReached.clear()
      const promises = []
      for (let i = 0; i < 6; i++) {
        promises.push(requestReady())
      }
      const results = await Promise.all(promises)

      const all503 = results.every((r) => r.status === 503 && r.data.error?.code === 'DATABASE_UNAVAILABLE')
      assert(all503, `Vòng ${round}: Toàn bộ 6 requests đồng thời đều nhận HTTP 503 DATABASE_UNAVAILABLE`)

      // Đợi ngắn để quá trình dọn dẹp hoàn tất
      await delay(200)
      assert(clientSockets.size === 0, `Vòng ${round}: Xác nhận số socket treo đã được thu hồi sạch sẽ (active sockets: ${clientSockets.size})`)

      // Chuyển sang healthy và xác nhận phục hồi ngay lập tức trên cùng tiến trình
      serverMode = 'normal'
      stagesReached.clear()
      const recoveryRes = await requestReady()
      assert(recoveryRes.status === 200, `Vòng ${round}: Phục hồi về HTTP 200 OK thành công trên CÙNG TIẾN TRÌNH`)
      assert(recoveryRes.data.data?.database === 'connected', `Vòng ${round}: Trạng thái database === "connected"`)
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 10: Phục hồi kiểm tra sau kịch bản 9
    // -----------------------------------------------------------------
    console.log('\n[10/13] Xác nhận service phục hồi sau kịch bản 9...')
    serverMode = 'normal'
    stagesReached.clear()
    {
      const { status, data } = await requestReady()
      assert(status === 200, 'Service production trên CÙNG TIẾN TRÌNH phục hồi: trả HTTP 200')
      assert(data.success === true, 'Phản hồi phục hồi có success === true')
      assert(data.data?.database === 'connected', 'Trạng thái CSDL phục hồi thành "connected"')
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 11: [REGRESSION mysql2 QUERY TIMEOUT] SELECT auth/profile bị treo qua endpoint production
    // -----------------------------------------------------------------
    console.log('\n[11/13] [Regression mysql2 Query Timeout] SELECT auth-profile bị treo qua endpoint production...')
    serverMode = 'hang_auth_query'
    stagesReached.clear()
    for (let i = 1; i <= 3; i++) {
      const { status, data } = await requestAuthProfile('1')
      assert(status === 503, `Lần ${i}: SELECT auth-profile bị treo trả về HTTP 503 đúng hạn`)
      assert(data?.error?.code === 'DATABASE_UNAVAILABLE', `Lần ${i}: Mã lỗi chuẩn hóa thành DATABASE_UNAVAILABLE`)
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 12: [REGRESSION SQL ERROR] Lỗi ER_BAD_FIELD_ERROR có chữ 'timeout' trong tên cột vẫn trả HTTP 500
    // -----------------------------------------------------------------
    console.log('\n[12/13] [Regression SQL Error] Lỗi ER_BAD_FIELD_ERROR có chữ "timeout" vẫn trả HTTP 500...')
    serverMode = 'sql_error_timeout_col'
    stagesReached.clear()
    {
      const { status, data } = await requestAuthProfile('1')
      assert(status === 500, 'Lỗi SQL ER_BAD_FIELD_ERROR có chữ timeout trả về HTTP 500')
      assert(data?.error?.code === 'INTERNAL_SERVER_ERROR', 'Mã lỗi là INTERNAL_SERVER_ERROR (không bị biến thành 503)')
    }

    // -----------------------------------------------------------------
    // KỊCH BẢN 13: Thu hồi đúng connection của yêu cầu lỗi, giữ connection khỏe và phục hồi trên cùng tiến trình
    // -----------------------------------------------------------------
    console.log('\n[13/13] Thu hồi đúng connection lỗi, giữ connection khỏe và phục hồi trên cùng tiến trình...')
    serverMode = 'normal'
    stagesReached.clear()
    {
      const readyRes = await requestReady()
      assert(readyRes.status === 200, 'Endpoint /ready phục hồi thành công trên CÙNG TIẾN TRÌNH (HTTP 200)')
      assert(readyRes.data?.data?.database === 'connected', 'Trạng thái CSDL phục hồi thành "connected"')

      const authRes = await requestAuthProfile('1')
      assert(authRes.status === 200, 'Endpoint auth-profile phục hồi thành công trên CÙNG TIẾN TRÌNH (HTTP 200)')
      assert(authRes.data?.data?.user?.id === '1', 'Dữ liệu auth profile trả về chính xác')
    }
  } finally {
    if (prodService?.child) {
      await stopProductionService(prodService.child)
      console.log('\n[Cleanup] Đã dừng tiến trình production test an toàn.')
    }

    for (const socket of clientSockets) {
      try {
        socket.destroy()
      } catch {}
    }
    clientSockets.clear()

    await new Promise((resolve) => mockServer.close(resolve)).catch(() => {})
    console.log('[Cleanup] Đã đóng Mock MySQL Server an toàn.')
  }

  console.log('\n=== TỔNG KẾT KẾT QUẢ KIỂM TRA TIMEOUT READINESS GIẢ LẬP ===')
  console.log(`Số test vượt qua (PASS): ${passed}`)
  console.log(`Số test thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ kịch bản kiểm tra Timeout và Phục hồi Readiness trên Service Production đều ĐẠT (PASS)!')
  }
}

runHangTests().catch((err) => {
  console.error('[Fatal Test Error]:', err)
  process.exit(1)
})
