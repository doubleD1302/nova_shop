import net from 'node:net'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Sequelize } from 'sequelize'
import { env } from '../src/config/env.js'

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
 * Tìm một cổng TCP khả dụng trên localhost
 */
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

/**
 * Danh sách socket cấp mạng cho client Sequelize trong check:db
 */
const checkDbSockets = new Set()

/**
 * Khởi tạo Sequelize instance riêng cho check-db với stream hook quản lý socket
 */
const checkDbSequelize = new Sequelize(env.dbName, env.dbUser, env.dbPassword, {
  host: env.dbHost,
  port: env.dbPort,
  dialect: 'mysql',
  timezone: '+00:00',
  databaseVersion: '8.4.4',
  logging: false,
  pool: { max: 3, min: 0, acquire: 5000, idle: 10000 },
  dialectOptions: {
    connectTimeout: 5000,
    stream: (opts) => {
      const sock = net.connect(opts.config.port, opts.config.host)
      checkDbSockets.add(sock)
      sock.once('close', () => checkDbSockets.delete(sock))
      sock.once('error', () => checkDbSockets.delete(sock))
      return sock
    },
  },
})

/**
 * Cơ chế thực thi truy vấn có Master Deadline và thu hồi socket/connection thực sự.
 * Không phụ thuộc vào tùy chọn options.timeout của Sequelize (vốn bị dialect nuốt mất).
 * Truyền trực tiếp tùy chọn timeout xuống driver mysql2 conn.query({ sql, timeout })
 * và ngắt kết nối mạng ngay lập tức nếu quá thời hạn ngân sách.
 */
async function queryWithDeadline(sql, timeoutMs = 5000, seqInstance = checkDbSequelize, trackingSockets = checkDbSockets) {
  const deadline = Date.now() + timeoutMs
  let timer = null
  let isDone = false
  let acquiredConn = null
  const sessionSockets = new Set()

  const abortOp = () => {
    // 1. Hủy các socket được theo dõi trong session và dialect
    for (const sock of sessionSockets) {
      try {
        if (!sock.destroyed) sock.destroy(new Error(`Query deadline exceeded: ${timeoutMs}ms`))
      } catch {}
    }
    sessionSockets.clear()

    if (trackingSockets) {
      for (const sock of trackingSockets) {
        try {
          if (!sock.destroyed) sock.destroy(new Error(`Query deadline exceeded: ${timeoutMs}ms`))
        } catch {}
      }
    }

    // 2. Hủy connection nếu đã acquire thành công
    if (acquiredConn) {
      try {
        if (acquiredConn.stream && !acquiredConn.stream.destroyed) {
          acquiredConn.stream.destroy(new Error(`Query deadline exceeded: ${timeoutMs}ms`))
        }
        if (typeof acquiredConn.destroy === 'function') acquiredConn.destroy()
        seqInstance.connectionManager.pool.destroy(acquiredConn)
      } catch {}
      acquiredConn = null
    }
  }

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (isDone) return
      isDone = true
      abortOp()
      const err = new Error(`Query deadline exceeded after ${timeoutMs}ms: ${sql}`)
      err.code = 'ETIMEDOUT'
      reject(err)
    }, timeoutMs)
  })

  const workPromise = (async () => {
    // 1. Acquire connection từ pool
    const conn = await seqInstance.connectionManager.getConnection()
    if (isDone) {
      try {
        if (conn.stream && !conn.stream.destroyed) conn.stream.destroy()
        seqInstance.connectionManager.pool.destroy(conn)
      } catch {}
      return null
    }
    acquiredConn = conn
    if (conn.stream) sessionSockets.add(conn.stream)

    // 2. Tính thời gian còn lại cho câu query
    const remainingTime = Math.max(50, deadline - Date.now())

    // 3. Thực hiện truy vấn với timeout truyền trực tiếp vào driver mysql2
    const rows = await new Promise((resolve, reject) => {
      conn.query({ sql, timeout: remainingTime }, (err, results) => {
        if (isDone) return
        if (err) return reject(err)
        resolve(results)
      })
    })

    return rows
  })()

  try {
    const results = await Promise.race([workPromise, timeoutPromise])
    isDone = true
    if (timer) clearTimeout(timer)
    if (acquiredConn) {
      await seqInstance.connectionManager.releaseConnection(acquiredConn)
      acquiredConn = null
    }
    return results
  } catch (err) {
    isDone = true
    if (timer) clearTimeout(timer)
    abortOp()
    throw err
  }
}

/**
 * Cơ chế xác thực kết nối có Master Deadline bao trùm
 */
async function authenticateWithDeadline(timeoutMs = 5000, seqInstance = checkDbSequelize) {
  return queryWithDeadline('SELECT 1+1 AS result', timeoutMs, seqInstance)
}

/**
 * Khởi chạy tiến trình Data API production (src/server.js) độc lập
 */
function startProductionService(customEnv = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const port = await getAvailablePort()
      const serverPath = path.resolve(rootDir, 'src/server.js')
      const child = spawn(process.execPath, [serverPath], {
        cwd: rootDir,
        env: {
          ...process.env,
          PORT: String(port),
          ...customEnv,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let isStarted = false
      const startTimer = setTimeout(() => {
        if (!isStarted) {
          try {
            child.kill('SIGKILL')
          } catch {}
          reject(new Error(`Timeout quá 5000ms chờ Data API production khởi động trên cổng ${port}`))
        }
      }, 5000)

      child.stdout.on('data', (chunk) => {
        const msg = chunk.toString()
        if (msg.includes('Server đang chạy tại') && !isStarted) {
          isStarted = true
          clearTimeout(startTimer)
          resolve({
            child,
            port,
            baseUrl: `http://127.0.0.1:${port}`,
          })
        }
      })

      child.on('error', (err) => {
        clearTimeout(startTimer)
        if (!isStarted) reject(err)
      })

      child.on('exit', (code, sig) => {
        clearTimeout(startTimer)
        if (!isStarted) {
          reject(new Error(`Tiến trình Data API dừng đột ngột trước khi sẵn sàng (code: ${code}, sig: ${sig})`))
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

    // Nếu không xác nhận được tiến trình đã thoát thực sự, báo lỗi thất bại rõ ràng (không dùng timer để giả lập exit)
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

/**
 * Test giả lập truy vấn treo không trả lời để chứng minh cơ chế deadline có hiệu lực thực sự
 */
async function testMockQueryHangDeadline() {
  console.log('[Test Giả Lập] Kiểm tra cơ chế deadline khi truy vấn không trả lời (Mock Query Hang)...')
  const mockSockets = new Set()
  let mockServer = null

  // Tạo mock server thực hiện handshake OK nhưng treo ở câu query
  const makePacket = (payload, seq = 0) => {
    const h = Buffer.alloc(4)
    h.writeUIntLE(payload.length, 0, 3)
    h.writeUInt8(seq, 3)
    return Buffer.concat([h, payload])
  }

  const makeHandshake = () => {
    const p = [
      Buffer.from([10]),
      Buffer.from('8.4.4-Mock\0', 'ascii'),
      Buffer.alloc(4, 1),
      Buffer.from('12345678', 'ascii'),
      Buffer.from([0]),
      Buffer.from([0xff, 0xf7]),
      Buffer.from([33]),
      Buffer.from([0x02, 0x00]),
      Buffer.from([0xff, 0x81]),
      Buffer.from([21]),
      Buffer.alloc(10, 0),
      Buffer.from('123456789012\0', 'ascii'),
      Buffer.from('mysql_native_password\0', 'ascii'),
    ]
    return makePacket(Buffer.concat(p), 0)
  }

  let serverReceivedTargetQuery = false
  let serverSocketDestroyed = false
  let serverSocketRef = null

  mockServer = net.createServer((socket) => {
    mockSockets.add(socket)
    serverSocketRef = socket
    socket.on('error', () => {})
    const onEnd = () => {
      serverSocketDestroyed = true
      mockSockets.delete(socket)
    }
    socket.once('close', onEnd)
    socket.once('error', onEnd)
    socket.once('end', onEnd)

    socket.write(makeHandshake())
    socket.on('data', (d) => {
      if (d[3] === 1) {
        // Auth response -> trả OK
        socket.write(makePacket(Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]), 2))
        return
      }
      if (d[4] === 0x03) {
        // COM_QUERY
        const queryText = d.subarray(5).toString('utf8')
        if (queryText.includes('SET time_zone')) {
          // Trả lời SET time_zone bình thường để connection khởi tạo thành công
          socket.write(makePacket(Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]), d[3] + 1))
          return
        }
        if (queryText.includes('SELECT VERSION()')) {
          serverReceivedTargetQuery = true
          // CHỈ CỐ TÌNH IM LẶNG: không trả lời byte nào cho đúng câu SELECT mục tiêu để kiểm tra deadline!
        }
      }
    })
  })

  await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve))
  const port = mockServer.address().port

  const mockClientSockets = new Set()
  const mockSequelize = new Sequelize('mock_db', 'mock_user', 'mock_pass_123', {
    host: '127.0.0.1',
    port,
    dialect: 'mysql',
    timezone: '+00:00',
    databaseVersion: '8.4.4',
    logging: false,
    pool: { max: 1, min: 0, acquire: 2000 },
    dialectOptions: {
      connectTimeout: 2000,
      stream: (opts) => {
        const sock = net.connect(opts.config.port, opts.config.host)
        mockClientSockets.add(sock)
        sock.once('close', () => mockClientSockets.delete(sock))
        sock.once('error', () => mockClientSockets.delete(sock))
        return sock
      },
    },
  })

  try {
    const t0 = Date.now()
    let errorCaught = null

    try {
      // Gọi queryWithDeadline với thời hạn 1200ms
      await queryWithDeadline('SELECT VERSION() AS version', 1200, mockSequelize, mockClientSockets)
    } catch (err) {
      errorCaught = err
    }

    const elapsed = Date.now() - t0

    assert(serverReceivedTargetQuery, 'Mock server đã nhận được đúng câu lệnh SELECT VERSION() mục tiêu từ client')
    assert(errorCaught !== null, 'Truy vấn treo bị từ chối với lỗi timeout')
    assert(
      errorCaught?.code === 'ETIMEDOUT' ||
        errorCaught?.code === 'PROTOCOL_SEQUENCE_TIMEOUT' ||
        errorCaught?.message?.includes('deadline exceeded'),
      'Lỗi nhận được là ETIMEDOUT / deadline exceeded',
    )
    assert(
      elapsed >= 1000 && elapsed <= 2200,
      `Deadline được thực thi chính xác trong thời gian hữu hạn (${elapsed}ms ~ 1200ms, KHÔNG bị treo qua 5000ms)`,
    )

    // Đợi một khoảng ngắn để socket đóng hoàn tất
    await new Promise((res) => setTimeout(res, 200))
    const isSocketTerminated = serverSocketDestroyed || (serverSocketRef && serverSocketRef.destroyed) || mockSockets.size === 0
    assert(Boolean(isSocketTerminated), 'Socket kết nối bị hủy hoàn toàn khi deadline quá hạn')
  } finally {
    for (const s of mockClientSockets) {
      try { s.destroy() } catch {}
    }
    for (const s of mockSockets) {
      try {
        s.destroy()
      } catch {}
    }
    mockSockets.clear()
    await mockSequelize.close().catch(() => {})
    await new Promise((resolve) => mockServer.close(resolve)).catch(() => {})
  }
}

async function runDatabaseChecks() {
  console.log('=== BẮT ĐẦU KIỂM TRA TOÀN DIỆN MYSQL VÀ SERVICE THẬT CHO DATA API ===\n')

  try {
    // -------------------------------------------------------------
    // PHẦN 0: Test giả lập truy vấn treo chứng minh deadline
    // -------------------------------------------------------------
    await testMockQueryHangDeadline()

    // -------------------------------------------------------------
    // PHẦN 1: Kiểm tra xác thực Sequelize và phiên bản MySQL 8.4 thật
    // -------------------------------------------------------------
    console.log('\n[1/4] Kiểm tra xác thực Sequelize và phiên bản CSDL MySQL 8.4...')

    await authenticateWithDeadline(5000)
    assert(true, 'sequelize.authenticate() kết nối thành công với MySQL trong deadline 5000ms')

    const versionResult = await queryWithDeadline('SELECT VERSION() AS version', 5000)
    const version = versionResult[0]?.version || ''
    assert(version.startsWith('8.4.'), `Phiên bản MySQL là 8.4.x (thực tế: ${version})`)

    const dbResult = await queryWithDeadline('SELECT DATABASE() AS db_name', 5000)
    const dbName = dbResult[0]?.db_name || ''
    assert(dbName === 'shopnova_dev', `Database đang kết nối đúng là "shopnova_dev" (thực tế: ${dbName})`)

    const userResult = await queryWithDeadline('SELECT CURRENT_USER() AS user_name', 5000)
    const userName = userResult[0]?.user_name || ''
    assert(userName.startsWith('shopnova_data_api@'), `Đang sử dụng tài khoản riêng biệt shopnova_data_api (thực tế: ${userName})`)

    // -------------------------------------------------------------
    // PHẦN 2: Kiểm tra dữ liệu seed của 3 bảng cốt lõi (categories, products, product_variants)
    // -------------------------------------------------------------
    console.log('\n[2/4] Kiểm tra đối chiếu chính xác dữ liệu seed của 3 bảng (categories, products, product_variants)...')

    // 2.1 Bảng categories
    const categories = await queryWithDeadline(
      'SELECT id, name, slug FROM categories ORDER BY id ASC',
      5000,
    )
    assert(categories.length >= 2, `Bảng categories có ít nhất 2 bản ghi (thực tế: ${categories.length})`)

    const catFashion = categories.find((c) => c.slug === 'thoi-trang-nam' || c.id === 1)
    assert(
      catFashion && catFashion.id === 1 && catFashion.slug === 'thoi-trang-nam',
      'Danh mục "Thời trang nam" tồn tại với id=1 và slug="thoi-trang-nam"',
      `thực tế: ${JSON.stringify(catFashion)}`,
    )

    const catElectronics = categories.find((c) => c.slug === 'dien-thoai' || c.id === 2)
    assert(
      catElectronics && catElectronics.id === 2 && catElectronics.slug === 'dien-thoai',
      'Danh mục "Điện thoại và phụ kiện" tồn tại với id=2 và slug="dien-thoai"',
      `thực tế: ${JSON.stringify(catElectronics)}`,
    )

    // 2.2 Bảng products
    const products = await queryWithDeadline(
      'SELECT id, category_id, shop_id, name, slug, free_shipping FROM products ORDER BY id ASC',
      5000,
    )
    assert(products.length >= 2, `Bảng products có ít nhất 2 bản ghi (thực tế: ${products.length})`)

    const prodShirt = products.find((p) => p.slug === 'ao-thun-mau' || p.id === 1)
    assert(
      prodShirt && prodShirt.id === 1 && prodShirt.shop_id === 1 && prodShirt.category_id === 1,
      'Sản phẩm "Áo thun mẫu" có id=1, shop_id=1, category_id=1',
      `thực tế: ${JSON.stringify(prodShirt)}`,
    )

    const prodCharger = products.find((p) => p.slug === 'cu-sac-mau' || p.id === 2)
    assert(
      prodCharger && prodCharger.id === 2 && prodCharger.shop_id === 2 && prodCharger.category_id === 2,
      'Sản phẩm "Củ sạc mẫu" có id=2, shop_id=2, category_id=2',
      `thực tế: ${JSON.stringify(prodCharger)}`,
    )

    // 2.3 Bảng product_variants (đối chiếu từng SKU chính xác)
    const variants = await queryWithDeadline(
      'SELECT id, product_id, sku, name, price, original_price, stock_qty FROM product_variants ORDER BY id ASC',
      5000,
    )
    assert(variants.length >= 3, `Bảng product_variants có ít nhất 3 biến thể SKU (thực tế: ${variants.length})`)

    // Đối chiếu SKU DEMO-AO-M
    const skuAoM = variants.find((v) => v.sku === 'DEMO-AO-M')
    const matchAoM =
      skuAoM &&
      skuAoM.product_id === 1 &&
      Number(skuAoM.price) === 180000 &&
      Number(skuAoM.original_price) === 220000 &&
      Number(skuAoM.stock_qty) === 10
    assert(
      Boolean(matchAoM),
      'SKU DEMO-AO-M khớp chính xác: product_id=1, price=180000, original_price=220000, stock_qty=10',
      `thực tế: ${JSON.stringify(skuAoM)}`,
    )

    // Đối chiếu SKU DEMO-AO-L
    const skuAoL = variants.find((v) => v.sku === 'DEMO-AO-L')
    const matchAoL =
      skuAoL &&
      skuAoL.product_id === 1 &&
      Number(skuAoL.price) === 180000 &&
      Number(skuAoL.original_price) === 220000 &&
      Number(skuAoL.stock_qty) === 8
    assert(
      Boolean(matchAoL),
      'SKU DEMO-AO-L khớp chính xác: product_id=1, price=180000, original_price=220000, stock_qty=8',
      `thực tế: ${JSON.stringify(skuAoL)}`,
    )

    // Đối chiếu SKU DEMO-SAC-DEFAULT
    const skuSac = variants.find((v) => v.sku === 'DEMO-SAC-DEFAULT')
    const matchSac =
      skuSac &&
      skuSac.product_id === 2 &&
      Number(skuSac.price) === 350000 &&
      skuSac.original_price === null &&
      Number(skuSac.stock_qty) === 5
    assert(
      Boolean(matchSac),
      'SKU DEMO-SAC-DEFAULT khớp chính xác: product_id=2, price=350000, original_price=null, stock_qty=5',
      `thực tế: ${JSON.stringify(skuSac)}`,
    )

    // Kiểm tra liên kết SKU -> product
    const productIds = new Set(products.map((p) => p.id))
    const allVariantsLinked = variants.every((v) => productIds.has(v.product_id))
    assert(allVariantsLinked, 'Mọi biến thể SKU đều có liên kết product_id hợp lệ tới bảng products')

    // -------------------------------------------------------------
    // PHẦN 3: Kiểm tra tiến trình test production thật khi MySQL sẵn sàng
    // -------------------------------------------------------------
    console.log('\n[3/4] Kiểm tra tiến trình test production thật với CSDL MySQL đang chạy...')
    let liveService = null
    try {
      liveService = await startProductionService({
        DB_HOST: env.dbHost,
        DB_PORT: String(env.dbPort),
      })

      // 3.1 Thiếu x-service-key -> HTTP 401
      {
        const res = await fetch(`${liveService.baseUrl}/internal/v1/ready`, {
          signal: AbortSignal.timeout(5000),
        })
        const data = await res.json()
        assert(res.status === 401, 'Live service: Thiếu x-service-key bị từ chối với HTTP 401')
        assert(data.error?.code === 'SERVICE_UNAUTHORIZED', 'Live service: Mã lỗi 401 là SERVICE_UNAUTHORIZED')
      }

      // 3.2 Sai x-service-key -> HTTP 401
      {
        const res = await fetch(`${liveService.baseUrl}/internal/v1/ready`, {
          headers: { 'x-service-key': 'incorrect-service-key' },
          signal: AbortSignal.timeout(5000),
        })
        const data = await res.json()
        assert(res.status === 401, 'Live service: Sai x-service-key bị từ chối với HTTP 401')
        assert(data.error?.code === 'SERVICE_UNAUTHORIZED', 'Live service: Mã lỗi khi sai key là SERVICE_UNAUTHORIZED')
      }

      // 3.3 Health check hợp lệ -> HTTP 200
      {
        const res = await fetch(`${liveService.baseUrl}/internal/v1/health`, {
          headers: { 'x-service-key': env.dataApiKey },
          signal: AbortSignal.timeout(5000),
        })
        const data = await res.json()
        assert(res.status === 200, 'Live service: GET /internal/v1/health trả HTTP 200')
        assert(data.success === true, 'Live service: Health success === true')
        assert(data.data?.status === 'ok', 'Live service: Health data.status === "ok"')
      }

      // 3.4 Readiness check hợp lệ -> HTTP 200, database connected
      {
        const res = await fetch(`${liveService.baseUrl}/internal/v1/ready`, {
          headers: { 'x-service-key': env.dataApiKey },
          signal: AbortSignal.timeout(5000),
        })
        const data = await res.json()
        assert(res.status === 200, 'Live service: GET /internal/v1/ready trả HTTP 200 khi MySQL sẵn sàng')
        assert(data.success === true, 'Live service: Ready success === true')
        assert(data.data?.service === 'shopnova-data-api', 'Live service: Ready data.service đúng')
        assert(data.data?.database === 'connected', 'Live service: Ready data.database === "connected"')
      }
    } finally {
      if (liveService?.child) {
        await stopProductionService(liveService.child)
        console.log('  -> Đã dừng tiến trình live production test an toàn.')
      }
    }

    // -------------------------------------------------------------
    // PHẦN 4: Kiểm tra tiến trình test production thật khi MySQL không truy cập được
    // -------------------------------------------------------------
    console.log('\n[4/4] Kiểm tra tiến trình test production thật khi MySQL không lắng nghe (cổng đóng)...')

    const deadDbPort = await getAvailablePort()
    let deadService = null

    try {
      deadService = await startProductionService({
        DB_HOST: '127.0.0.1',
        DB_PORT: String(deadDbPort),
        DB_READINESS_TIMEOUT_MS: '2000',
      })

      // 4.1 Thiếu x-service-key khi DB không hoạt động -> HTTP 401
      {
        const res = await fetch(`${deadService.baseUrl}/internal/v1/ready`, {
          signal: AbortSignal.timeout(5000),
        })
        const data = await res.json()
        assert(
          res.status === 401,
          'Dead DB service: Thiếu x-service-key bị từ chối 401 trước khi kiểm tra DB',
        )
        assert(data.error?.code === 'SERVICE_UNAUTHORIZED', 'Dead DB service: Mã lỗi là SERVICE_UNAUTHORIZED')
      }

      // 4.2 Sai x-service-key khi DB không hoạt động -> HTTP 401
      {
        const res = await fetch(`${deadService.baseUrl}/internal/v1/ready`, {
          headers: { 'x-service-key': 'invalid-key' },
          signal: AbortSignal.timeout(5000),
        })
        const data = await res.json()
        assert(
          res.status === 401,
          'Dead DB service: Sai x-service-key bị từ chối 401 trước khi kiểm tra DB',
        )
        assert(data.error?.code === 'SERVICE_UNAUTHORIZED', 'Dead DB service: Mã lỗi là SERVICE_UNAUTHORIZED khi sai key')
      }

      // 4.3 Health check vẫn trả HTTP 200 khi DB không hoạt động
      {
        const res = await fetch(`${deadService.baseUrl}/internal/v1/health`, {
          headers: { 'x-service-key': env.dataApiKey },
          signal: AbortSignal.timeout(5000),
        })
        const data = await res.json()
        assert(
          res.status === 200,
          'Dead DB service: GET /internal/v1/health vẫn trả HTTP 200 khi MySQL chết',
        )
        assert(data.data?.status === 'ok', 'Dead DB service: Health data.status vẫn là "ok"')
      }

      // 4.4 Readiness check trả HTTP 503 với mã DATABASE_UNAVAILABLE trong thời gian hữu hạn
      {
        const startTime = Date.now()
        const res = await fetch(`${deadService.baseUrl}/internal/v1/ready`, {
          headers: { 'x-service-key': env.dataApiKey },
          signal: AbortSignal.timeout(5000),
        })
        const duration = Date.now() - startTime
        const data = await res.json()

        assert(res.status === 503, 'Dead DB service: GET /internal/v1/ready trả HTTP 503 khi MySQL chết')
        assert(data.success === false, 'Dead DB service: Ready fail có success === false')
        assert(
          data.error?.code === 'DATABASE_UNAVAILABLE',
          'Dead DB service: Error code là DATABASE_UNAVAILABLE',
        )
        assert(
          duration < 3500,
          `Dead DB service: Phản hồi lỗi trong thời gian hữu hạn (${duration}ms < 3500ms)`,
        )
        assert(
          !JSON.stringify(data).includes('password') && !JSON.stringify(data).includes(env.dbPassword),
          'Dead DB service: Phản hồi 503 tuyệt đối không rò rỉ mật khẩu CSDL',
        )
      }
    } finally {
      if (deadService?.child) {
        await stopProductionService(deadService.child)
        console.log('  -> Đã dừng tiến trình dead DB production test an toàn.')
      }
    }
  } finally {
    // Đóng kết nối Sequelize chính an toàn
    await checkDbSequelize.close().catch(() => {})
    for (const sock of checkDbSockets) {
      try {
        sock.destroy()
      } catch {}
    }
    checkDbSockets.clear()
    console.log('\n[Check DB] Đã đóng kết nối Sequelize chính an toàn.')
  }

  console.log('\n=== TỔNG KẾT KẾT QUẢ KIỂM TRA DATABASE VÀ SERVICE THẬT ===')
  console.log(`Số test vượt qua (PASS): ${passed}`)
  console.log(`Số test thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ kiểm tra kết nối MySQL 8.4 và Service Production đều ĐẠT (PASS)!')
  }
}

runDatabaseChecks().catch((err) => {
  console.error('[Check DB Fatal Error]:', err.message || err)
  process.exit(1)
})
