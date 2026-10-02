import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { EventEmitter } from 'node:events'
import jwt from 'jsonwebtoken'
import mysql from '../../data-api/node_modules/mysql2/promise.js'
import bcrypt from '../../data-api/node_modules/bcryptjs/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataApiRootDir = path.resolve(rootDir, '../data-api')

// Thiết lập môi trường test cô lập cho tiến trình runner
process.env.NODE_ENV = 'test'
process.env.PORT = '3000'
process.env.DATA_API_URL = 'http://127.0.0.1:3001'
process.env.DATA_API_KEY = 'test_integration_auth_main_service_key_for_setup_64_entropy'
process.env.JWT_SECRET = 'test_integration_auth_main_jwt_secret_min_32_characters_random_key_123'
process.env.DOTENV_CONFIG_PATH = path.join(__dirname, 'non-existent-auth-test.env')

// Nạp dynamic import sau khi thiết lập env
const { requireRole, CLOCK_SKEW_TOLERANCE_SECONDS } = await import('../src/middlewares/auth.middleware.js')
const { isValidBigIntUnsignedString } = await import('../src/clients/data.client.js')

let passedRealDb = 0
let failedRealDb = 0
let passedMock = 0
let failedMock = 0

function assertReal(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS [MySQL Thật]: ${testName}`)
    passedRealDb++
  } else {
    console.error(`  ✗ FAIL [MySQL Thật]: ${testName} ${detail ? `(${detail})` : ''}`)
    failedRealDb++
  }
}

function assertMock(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS [Mock / Contract]: ${testName}`)
    passedMock++
  } else {
    console.error(`  ✗ FAIL [Mock / Contract]: ${testName} ${detail ? `(${detail})` : ''}`)
    failedMock++
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
 * Danh sách theo dõi mọi child process và timer để đảm bảo dọn dẹp sạch sẽ trong finally
 */
const trackedProcesses = new Set()
const trackedTimers = new Set()

function registerTimer(timer) {
  trackedTimers.add(timer)
  return timer
}

function clearTrackedTimer(timer) {
  clearTimeout(timer)
  trackedTimers.delete(timer)
}

/**
 * Dừng tiến trình con an toàn và xác nhận tiến trình đã thoát thực sự.
 * - Chỉ xác nhận hoàn tất khi nhận được sự kiện exit/close hoặc đã có exitCode/signalCode.
 * - Tuyệt đối không dùng setTimeout để resolve giả lập khi chưa nhận được tín hiệu thoát.
 * - Nếu hết hạn ngân sách mà tiến trình vẫn chưa thoát, báo lỗi kiểm thử (reject).
 * - Dọn dẹp toàn bộ timer và listener đầy đủ để tránh rò rỉ tài nguyên.
 */
function stopProcess(child, timeoutMs = 6000) {
  if (!child) return Promise.resolve({ exitCode: null, signalCode: null })
  if (child.exitCode !== null || child.signalCode !== null) {
    trackedProcesses.delete(child)
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
      if (sigkillTimer) {
        clearTrackedTimer(sigkillTimer)
        sigkillTimer = null
      }
      if (failTimer) {
        clearTrackedTimer(failTimer)
        failTimer = null
      }
    }

    const onDone = () => {
      if (!resolved) {
        resolved = true
        cleanupListeners()
        trackedProcesses.delete(child)
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

    // Gửi SIGKILL sau một khoảng thời gian nếu tiến trình chưa thoát
    const killGraceMs = Math.min(2000, Math.floor(timeoutMs / 2))
    sigkillTimer = registerTimer(setTimeout(() => {
      sigkillTimer = null
      if (!resolved && child.exitCode === null && child.signalCode === null) {
        try {
          child.kill('SIGKILL')
        } catch {}
      }
    }, killGraceMs))

    // Hạn chót tối đa: nếu hết hạn mà vẫn chưa có exit/close, reject báo lỗi kiểm thử
    failTimer = registerTimer(setTimeout(() => {
      failTimer = null
      if (!resolved) {
        if (child.exitCode !== null || child.signalCode !== null) {
          onDone()
        } else {
          resolved = true
          cleanupListeners()
          trackedProcesses.delete(child)
          reject(new Error(`Process cleanup failed: Child process (pid: ${child.pid}) did not exit within ${timeoutMs}ms.`))
        }
      }
    }, timeoutMs))
  })
}

/**
 * Đọc cấu hình database từ biến môi trường và file .env của Data API.
 * - Mặc định database test là 'shopnova_auth_test'.
 * - TUYỆT ĐỐI TỪ CHỐI CHẠY nếu cấu hình trỏ vào 'shopnova_dev'.
 * - Bỏ mật khẩu hardcode: bắt buộc nhận qua biến môi trường.
 */
function loadDatabaseTestConfig() {
  const dataApiEnvPath = path.resolve(dataApiRootDir, '.env')
  let dataApiEnvContent = ''
  if (fs.existsSync(dataApiEnvPath)) {
    dataApiEnvContent = fs.readFileSync(dataApiEnvPath, 'utf8')
  }

  let dbHost = '127.0.0.1'
  let dbPort = 3306
  let dataApiUser = 'shopnova_data_api'
  let dataApiPassword = ''

  for (const line of dataApiEnvContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key === 'DB_HOST') dbHost = val
    if (key === 'DB_PORT') dbPort = Number(val)
    if (key === 'DB_USER') dataApiUser = val
    if (key === 'DB_PASSWORD') dataApiPassword = val
  }

  const testDbName = process.env.TEST_DB_NAME || 'shopnova_auth_test'
  const fixtureUser = process.env.TEST_FIXTURE_USER || process.env.FIXTURE_DB_USER || 'shopnova_fixture'
  const fixturePassword = process.env.TEST_FIXTURE_PASSWORD || process.env.FIXTURE_DB_PASSWORD || process.env.TEST_DB_PASSWORD

  const resolvedDataApiPassword = process.env.DATA_API_DB_PASSWORD || process.env.DB_PASSWORD || dataApiPassword

  return {
    host: process.env.DB_HOST || dbHost,
    port: Number(process.env.DB_PORT) || dbPort,
    database: testDbName,
    fixtureUser,
    fixturePassword,
    dataApiUser: process.env.DATA_API_DB_USER || dataApiUser,
    dataApiPassword: resolvedDataApiPassword,
  }
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
      const childEnv = {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'test',
        JWT_SECRET: 'test_integration_auth_jwt_secret_min_32_characters_random_key_123',
        ...customEnv,
      }
      delete childEnv.DOTENV_CONFIG_PATH

      const child = spawn(process.execPath, [serverPath], {
        cwd: rootDir,
        env: childEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      trackedProcesses.add(child)

      child.stdout.on('data', (c) => { stdout += c.toString() })
      child.stderr.on('data', (c) => { stderr += c.toString() })

      let isStarted = false
      const timer = registerTimer(setTimeout(() => {
        clearTrackedTimer(timer)
        if (!isStarted) {
          try { child.kill('SIGKILL') } catch {}
          reject(new Error(`Timeout quá 6000ms chờ Backend khởi động trên cổng ${port}`))
        }
      }, 6000))

      child.stdout.on('data', (chunk) => {
        const msg = chunk.toString()
        if (msg.includes('Server đang chạy tại') && !isStarted) {
          isStarted = true
          clearTrackedTimer(timer)
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
        clearTrackedTimer(timer)
        if (!isStarted) reject(err)
      })

      child.on('exit', (code, sig) => {
        clearTrackedTimer(timer)
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
  const port = customEnv.PORT ? Number(customEnv.PORT) : await getAvailablePort()
  const serverPath = path.resolve(dataApiRootDir, 'src/server.js')
  let stdout = ''
  let stderr = ''

  return new Promise((resolve, reject) => {
    try {
      const childEnv = {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'test',
        ...customEnv,
      }
      delete childEnv.DOTENV_CONFIG_PATH

      const child = spawn(process.execPath, [serverPath], {
        cwd: dataApiRootDir,
        env: childEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      trackedProcesses.add(child)

      child.stdout.on('data', (c) => { stdout += c.toString() })
      child.stderr.on('data', (c) => { stderr += c.toString() })

      let isStarted = false
      const timer = registerTimer(setTimeout(() => {
        clearTrackedTimer(timer)
        if (!isStarted) {
          try { child.kill('SIGKILL') } catch {}
          reject(new Error(`Timeout quá 6000ms chờ Data API khởi động trên cổng ${port}`))
        }
      }, 6000))

      child.stdout.on('data', (chunk) => {
        const msg = chunk.toString()
        if (msg.includes('Server đang chạy tại') && !isStarted) {
          isStarted = true
          clearTrackedTimer(timer)
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
        clearTrackedTimer(timer)
        if (!isStarted) reject(err)
      })

      child.on('exit', (code, sig) => {
        clearTrackedTimer(timer)
        if (!isStarted) {
          reject(new Error(`Tiến trình Data API dừng trước khi sẵn sàng (code: ${code}, sig: ${sig}, stderr: ${stderr})`))
        }
      })
    } catch (err) {
      reject(err)
    }
  })
}

async function runAllAuthTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP TOÀN DIỆN CHO BE-003A-R1 ===\n')

  const dbConfig = loadDatabaseTestConfig()

  // 1. Kiểm tra cấu hình và từ chối chạy trên shopnova_dev
  console.log('[Kiểm tra Cấu hình Môi trường]')
  console.log(`  - Target Test Database: ${dbConfig.database}`)
  console.log(`  - Writer (Fixture): ${dbConfig.fixtureUser}`)
  console.log(`  - Reader (Data API): ${dbConfig.dataApiUser}`)

  if (typeof dbConfig.database === 'string' && dbConfig.database.trim().toLowerCase() === 'shopnova_dev') {
    throw new Error(
      'TỪ CHỐI CHẠY FIXTURE: Cấu hình database test đang trỏ vào shopnova_dev!\n' +
      'Theo quy tắc BE-003A-R1, fixture chỉ được phép ghi vào database test riêng (ví dụ: shopnova_auth_test).'
    )
  }

  if (!dbConfig.fixturePassword) {
    throw new Error(
      'THIẾU CẤU HÌNH BẮT BUỘC: Chưa cung cấp mật khẩu tài khoản writer test qua biến môi trường.\n' +
      'Vui lòng thiết lập biến môi trường TEST_FIXTURE_PASSWORD (hoặc TEST_DB_PASSWORD) trước khi chạy.\n' +
      'Ví dụ (PowerShell): $env:TEST_FIXTURE_PASSWORD="..."; npm run check:auth'
    )
  }

  let devStatusBefore = null
  let devStatusAfter = null
  let fixtureConn = null
  let dataApiProc = null
  let backendProc = null
  let backendRateLimitProc = null
  let backendMockProc = null
  let mockServer = null

  const TEST_SERVICE_KEY = 'test_integration_auth_service_key_valid_64_characters_entropy_long'
  const TEST_JWT_SECRET = 'test_integration_auth_jwt_secret_min_32_characters_random_key_123'

  const FIXTURES = {
    buyer: {
      username: 'test_buyer_be003a',
      password: 'BuyerPass123!@#',
      fullName: 'Buyer Test Nguyen',
      email: 'buyer.test.be003a@shopnova.vn',
      phone: '0901234567',
      role: 'buyer',
      status: 'active',
      id: null,
    },
    seller: {
      username: 'test_seller_be003a',
      password: 'SellerPass123!@#',
      fullName: 'Seller Test Tran',
      email: 'seller.test.be003a@shopnova.vn',
      phone: '0912345678',
      role: 'seller',
      status: 'active',
      id: null,
      shopId: null,
      shopSlug: 'test-seller-shop-slug-be003a',
    },
    blocked: {
      username: 'test_blocked_be003a',
      password: 'BlockedPass123!@#',
      fullName: 'Blocked Test Le',
      email: 'blocked.test.be003a@shopnova.vn',
      phone: '0923456789',
      role: 'buyer',
      status: 'blocked',
      id: null,
    },
    bigint: {
      username: 'test_bigint_be003a',
      password: 'BigIntPass123!@#',
      fullName: 'BigInt Test Pham',
      email: 'bigint.test.be003a@shopnova.vn',
      phone: '0934567890',
      role: 'buyer',
      status: 'active',
      id: '9007199254740993', // Vượt Number.MAX_SAFE_INTEGER (9007199254740991)
    },
    buyerPlus: {
      username: 'buyer+demo',
      password: 'BuyerPlusPass123!@#',
      fullName: 'Buyer Plus Demo',
      email: 'buyer.plus.demo@shopnova.vn',
      phone: '0945678901',
      role: 'buyer',
      status: 'active',
      id: null,
    },
    buyerEmail: {
      username: 'buyer@example.com',
      password: 'BuyerEmailPass123!@#',
      fullName: 'Buyer Email Demo',
      email: 'buyer.email@shopnova.vn',
      phone: '0956789012',
      role: 'buyer',
      status: 'active',
      id: null,
    },
    buyer50Char: {
      username: 'a'.repeat(50),
      password: 'Buyer50CharPass123!@#',
      fullName: 'Buyer 50 Chars Demo',
      email: 'buyer50@shopnova.vn',
      phone: '0967890123',
      role: 'buyer',
      status: 'active',
      id: null,
    },
  }

  try {
    // -----------------------------------------------------------------------------------
    // BƯỚC 1: Kiểm tra chỉ đọc shopnova_dev trước khi chạy test
    // -----------------------------------------------------------------------------------
    console.log('\n[1. Kiểm tra chỉ đọc shopnova_dev trước test]')
    try {
      const devConn = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.dataApiUser,
        password: dbConfig.dataApiPassword,
        database: 'shopnova_dev',
      })
      const [rows] = await devConn.query('SELECT COUNT(*) AS userCount FROM users')
      const [tableStatus] = await devConn.query(
        "SELECT AUTO_INCREMENT FROM information_schema.tables WHERE table_schema = 'shopnova_dev' AND table_name = 'users'"
      )
      devStatusBefore = {
        userCount: Number(rows[0].userCount),
        autoIncrement: tableStatus[0]?.AUTO_INCREMENT ? String(tableStatus[0].AUTO_INCREMENT) : 'unknown',
      }
      await devConn.end()
      console.log(`  -> shopnova_dev hiện trạng: ${devStatusBefore.userCount} users, AUTO_INCREMENT = ${devStatusBefore.autoIncrement}`)
      console.log('  -> Khẳng định: Toàn bộ thao tác test sẽ chạy trên database riêng "shopnova_auth_test".')
    } catch (e) {
      console.log(`  -> (Lưu ý: Không thể đọc shopnova_dev: ${e.message})`)
    }

    // -----------------------------------------------------------------------------------
    // BƯỚC 2: Khởi tạo fixtures trên database test riêng (shopnova_auth_test) bằng tài khoản writer
    // -----------------------------------------------------------------------------------
    console.log('\n[2. Setup Fixtures trên database test riêng bằng tài khoản writer]')
    fixtureConn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.fixtureUser,
      password: dbConfig.fixturePassword,
      database: dbConfig.database,
      supportBigNumbers: true,
      bigNumberStrings: true,
    })

    // Dọn dẹp trước nếu còn dữ liệu sót từ lần chạy trước
    await fixtureConn.execute(`DELETE FROM shops WHERE slug = ?`, [FIXTURES.seller.shopSlug])
    await fixtureConn.execute(
      `DELETE FROM users WHERE username IN (?, ?, ?, ?, ?, ?, ?)`,
      [
        FIXTURES.buyer.username,
        FIXTURES.seller.username,
        FIXTURES.blocked.username,
        FIXTURES.bigint.username,
        FIXTURES.buyerPlus.username,
        FIXTURES.buyerEmail.username,
        FIXTURES.buyer50Char.username,
      ],
    )

    // Tạo hash bcrypt thật cost 12
    const buyerHash = await bcrypt.hash(FIXTURES.buyer.password, 12)
    const sellerHash = await bcrypt.hash(FIXTURES.seller.password, 12)
    const blockedHash = await bcrypt.hash(FIXTURES.blocked.password, 12)
    const bigintHash = await bcrypt.hash(FIXTURES.bigint.password, 12)
    const buyerPlusHash = await bcrypt.hash(FIXTURES.buyerPlus.password, 12)
    const buyerEmailHash = await bcrypt.hash(FIXTURES.buyerEmail.password, 12)
    const buyer50CharHash = await bcrypt.hash(FIXTURES.buyer50Char.password, 12)

    // 1. Tạo buyer
    const [buyerRes] = await fixtureConn.execute(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [FIXTURES.buyer.username, buyerHash, FIXTURES.buyer.fullName, FIXTURES.buyer.email, FIXTURES.buyer.phone, FIXTURES.buyer.role, FIXTURES.buyer.status],
    )
    FIXTURES.buyer.id = String(buyerRes.insertId)

    // 2. Tạo seller và shop
    const [sellerRes] = await fixtureConn.execute(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [FIXTURES.seller.username, sellerHash, FIXTURES.seller.fullName, FIXTURES.seller.email, FIXTURES.seller.phone, FIXTURES.seller.role, FIXTURES.seller.status],
    )
    FIXTURES.seller.id = String(sellerRes.insertId)

    const [shopRes] = await fixtureConn.execute(
      `INSERT INTO shops (owner_id, slug, name, province, status) VALUES (?, ?, ?, ?, ?)`,
      [FIXTURES.seller.id, FIXTURES.seller.shopSlug, 'Shop Seller BE003A-R1', 'Hà Nội', 'active'],
    )
    FIXTURES.seller.shopId = String(shopRes.insertId)

    // 3. Tạo user blocked
    const [blockedRes] = await fixtureConn.execute(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [FIXTURES.blocked.username, blockedHash, FIXTURES.blocked.fullName, FIXTURES.blocked.email, FIXTURES.blocked.phone, FIXTURES.blocked.role, FIXTURES.blocked.status],
    )
    FIXTURES.blocked.id = String(blockedRes.insertId)

    // 4. Tạo user có ID BIGINT lớn vượt Number.MAX_SAFE_INTEGER
    await fixtureConn.execute(
      `INSERT INTO users (id, username, password_hash, full_name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [FIXTURES.bigint.id, FIXTURES.bigint.username, bigintHash, FIXTURES.bigint.fullName, FIXTURES.bigint.email, FIXTURES.bigint.phone, FIXTURES.bigint.role, FIXTURES.bigint.status],
    )

    // 5. Tạo user buyer+demo
    const [buyerPlusRes] = await fixtureConn.execute(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [FIXTURES.buyerPlus.username, buyerPlusHash, FIXTURES.buyerPlus.fullName, FIXTURES.buyerPlus.email, FIXTURES.buyerPlus.phone, FIXTURES.buyerPlus.role, FIXTURES.buyerPlus.status],
    )
    FIXTURES.buyerPlus.id = String(buyerPlusRes.insertId)

    // 6. Tạo user buyer@example.com
    const [buyerEmailRes] = await fixtureConn.execute(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [FIXTURES.buyerEmail.username, buyerEmailHash, FIXTURES.buyerEmail.fullName, FIXTURES.buyerEmail.email, FIXTURES.buyerEmail.phone, FIXTURES.buyerEmail.role, FIXTURES.buyerEmail.status],
    )
    FIXTURES.buyerEmail.id = String(buyerEmailRes.insertId)

    // 7. Tạo user với username đúng 50 ký tự ASCII
    const [buyer50CharRes] = await fixtureConn.execute(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [FIXTURES.buyer50Char.username, buyer50CharHash, FIXTURES.buyer50Char.fullName, FIXTURES.buyer50Char.email, FIXTURES.buyer50Char.phone, FIXTURES.buyer50Char.role, FIXTURES.buyer50Char.status],
    )
    FIXTURES.buyer50Char.id = String(buyer50CharRes.insertId)

    console.log(`  -> Đã khởi tạo fixtures thành công trong ${dbConfig.database}:`)
    console.log(`     Buyer ID: ${FIXTURES.buyer.id}`)
    console.log(`     Seller ID: ${FIXTURES.seller.id} (Shop ID: ${FIXTURES.seller.shopId})`)
    console.log(`     Blocked ID: ${FIXTURES.blocked.id}`)
    console.log(`     BigInt ID: ${FIXTURES.bigint.id}`)
    console.log(`     BuyerPlus ID: ${FIXTURES.buyerPlus.id}`)
    console.log(`     BuyerEmail ID: ${FIXTURES.buyerEmail.id}`)
    console.log(`     Buyer50Char ID: ${FIXTURES.buyer50Char.id}`)

    // -----------------------------------------------------------------------------------
    // BƯỚC 3: Khởi chạy Data API production thật (kết nối database test riêng với SELECT-only)
    // -----------------------------------------------------------------------------------
    console.log('\n[3. Khởi chạy Data API production thật]')
    dataApiProc = await startDataApiProduction({
      DB_NAME: dbConfig.database,
      DB_USER: dbConfig.dataApiUser,
      DB_PASSWORD: dbConfig.dataApiPassword,
      DATA_API_KEY: TEST_SERVICE_KEY,
    })
    const dataApiPort = dataApiProc.port
    console.log(`  -> Data API đang chạy tại: ${dataApiProc.baseUrl} (PID: ${dataApiProc.child.pid})`)

    console.log('[4. Khởi chạy Backend production thật]')
    backendProc = await startBackendProduction({
      DATA_API_URL: dataApiProc.baseUrl,
      DATA_API_KEY: TEST_SERVICE_KEY,
      JWT_SECRET: TEST_JWT_SECRET,
    })
    console.log(`  -> Backend đang chạy tại: ${backendProc.baseUrl} (PID: ${backendProc.child.pid})\n`)

    const backendUrl = backendProc.baseUrl
    let buyerToken = ''
    let sellerToken = ''

    // -----------------------------------------------------------------------------------
    // NHÓM 1: KIỂM THỬ TRÊN MYSQL THẬT (POST /login, GET /me, Phân quyền)
    // -----------------------------------------------------------------------------------
    console.log('=== NHÓM 1: KIỂM THỬ TRÊN MYSQL THẬT (shopnova_auth_test) ===\n')

    // 1.1 Buyer đăng nhập thành công
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: FIXTURES.buyer.username,
          password: FIXTURES.buyer.password,
        }),
      })
      const body = await res.json()
      assertReal(res.status === 200, 'Buyer đăng nhập thành công trả HTTP 200')
      assertReal(body.success === true, 'Phản hồi đăng nhập có success === true')
      assertReal(typeof body.data?.token === 'string' && body.data.token.length > 20, 'Nhận được access token JWT')
      assertReal(body.data?.tokenType === 'Bearer', 'tokenType là "Bearer"')
      assertReal(body.data?.expiresIn === 900, 'expiresIn là 900 giây (15 phút)')
      assertReal(body.data?.user?.id === FIXTURES.buyer.id, 'User ID đúng khớp với MySQL')
      assertReal(body.data?.user?.role === 'buyer', 'User role là "buyer"')
      assertReal(body.data?.user?.shopId === null, 'Buyer shopId là null')
      assertReal(body.data?.user?.password_hash === undefined, 'Tuyệt đối không để lộ password_hash')
      buyerToken = body.data.token
    }

    // 1.2 Seller đăng nhập thành công có shopId
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: FIXTURES.seller.username,
          password: FIXTURES.seller.password,
        }),
      })
      const body = await res.json()
      assertReal(res.status === 200, 'Seller đăng nhập thành công trả HTTP 200')
      assertReal(body.data?.user?.id === FIXTURES.seller.id, 'Seller User ID đúng khớp')
      assertReal(body.data?.user?.role === 'seller', 'Seller role là "seller"')
      assertReal(body.data?.user?.shopId === FIXTURES.seller.shopId, 'Seller nhận đúng shopId dạng chuỗi')
      sellerToken = body.data.token
    }

    // 1.3 BigInt ID user (> Number.MAX_SAFE_INTEGER) đăng nhập thành công, giữ nguyên dạng chuỗi
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: FIXTURES.bigint.username,
          password: FIXTURES.bigint.password,
        }),
      })
      const body = await res.json()
      assertReal(res.status === 200, 'BigInt ID user (> MAX_SAFE_INTEGER) đăng nhập thành công trả HTTP 200')
      assertReal(body.data?.user?.id === '9007199254740993', 'ID BIGINT lớn được giữ nguyên vẹn dạng chuỗi, không bị làm tròn')
    }

    // 1.3b Buyer với username buyer+demo đăng nhập thành công và lấy thông tin tài khoản
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: FIXTURES.buyerPlus.username,
          password: FIXTURES.buyerPlus.password,
        }),
      })
      const body = await res.json()
      assertReal(res.status === 200, 'Buyer với username "buyer+demo" đăng nhập thành công trả HTTP 200')
      assertReal(body.data?.user?.username === 'buyer+demo', 'Username "buyer+demo" được trả về nguyên vẹn khi login')
      const plusToken = body.data?.token
      assertReal(typeof plusToken === 'string' && plusToken.length > 20, 'Nhận được access token JWT cho buyer+demo')

      // Dùng token để gọi GET /api/v1/auth/me
      const meRes = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${plusToken}` },
      })
      const meBody = await meRes.json()
      assertReal(meRes.status === 200, 'GET /api/v1/auth/me với token buyer+demo trả HTTP 200')
      assertReal(meBody.data?.user?.username === 'buyer+demo', 'Username "buyer+demo" được giữ nguyên vẹn tại /auth/me')
    }

    // 1.3c Buyer với username buyer@example.com đăng nhập thành công và lấy thông tin tài khoản
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: FIXTURES.buyerEmail.username,
          password: FIXTURES.buyerEmail.password,
        }),
      })
      const body = await res.json()
      assertReal(res.status === 200, 'Buyer với username "buyer@example.com" đăng nhập thành công trả HTTP 200')
      assertReal(body.data?.user?.username === 'buyer@example.com', 'Username "buyer@example.com" được trả về nguyên vẹn khi login')
      const emailToken = body.data?.token
      assertReal(typeof emailToken === 'string' && emailToken.length > 20, 'Nhận được access token JWT cho buyer@example.com')

      // Dùng token để gọi GET /api/v1/auth/me
      const meRes = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${emailToken}` },
      })
      const meBody = await meRes.json()
      assertReal(meRes.status === 200, 'GET /api/v1/auth/me với token buyer@example.com trả HTTP 200')
      assertReal(meBody.data?.user?.username === 'buyer@example.com', 'Username "buyer@example.com" được giữ nguyên vẹn tại /auth/me')
    }

    // 1.3d Buyer với username đúng 50 ký tự ASCII đăng nhập thành công và lấy thông tin tài khoản
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: FIXTURES.buyer50Char.username,
          password: FIXTURES.buyer50Char.password,
        }),
      })
      const body = await res.json()
      assertReal(res.status === 200, 'Buyer với username đúng 50 ký tự ASCII đăng nhập thành công trả HTTP 200')
      assertReal(body.data?.user?.username === FIXTURES.buyer50Char.username, 'Username 50 ký tự ASCII được trả về nguyên vẹn khi login')
      const token50 = body.data?.token
      assertReal(typeof token50 === 'string' && token50.length > 20, 'Nhận được access token JWT cho username 50 ký tự')

      // Dùng token để gọi GET /api/v1/auth/me
      const meRes = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token50}` },
      })
      const meBody = await meRes.json()
      assertReal(meRes.status === 200, 'GET /api/v1/auth/me với token username 50 ký tự trả HTTP 200')
      assertReal(meBody.data?.user?.username === FIXTURES.buyer50Char.username, 'Username 50 ký tự ASCII được giữ nguyên vẹn tại /auth/me')
    }

    // 1.4 Chuẩn hóa username thành chữ thường và trim
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '   TEST_BUYER_BE003A   ',
          password: FIXTURES.buyer.password,
        }),
      })
      const body = await res.json()
      assertReal(res.status === 200, 'Username viết hoa và chứa khoảng trắng được chuẩn hóa thành công')
      assertReal(body.data?.user?.username === FIXTURES.buyer.username, 'Username trả về ở dạng chuẩn hóa')
    }

    // Helper reset bộ đếm rate limiter bằng một lần đăng nhập thành công (HTTP 200)
    async function clearRateLimitWithSuccessLogin() {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
      })
      return res.status === 200
    }

    // 1.5 Mật khẩu không bị trim hay cắt gọt
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: FIXTURES.buyer.username,
          password: `  ${FIXTURES.buyer.password}  `,
        }),
      })
      const body = await res.json()
      assertReal(res.status === 401, 'Mật khẩu có thêm khoảng trắng không bị tự ý trim, trả 401')
      assertReal(body.error?.code === 'INVALID_CREDENTIALS', 'Mã lỗi là INVALID_CREDENTIALS')
      await clearRateLimitWithSuccessLogin()
    }

    // 1.6 Bỏ qua các field quyền tự khai do client gửi
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: FIXTURES.buyer.username,
          password: FIXTURES.buyer.password,
          role: 'seller',
          shopId: '99999',
          userId: '1',
        }),
      })
      const body = await res.json()
      assertReal(res.status === 200, 'Đăng nhập thành công')
      assertReal(body.data?.user?.role === 'buyer', 'Role vẫn là "buyer" lấy từ database, bỏ qua role tự khai')
      assertReal(body.data?.user?.shopId === null, 'shopId vẫn là null, bỏ qua shopId tự khai')
    }

    // 1.7 Mật khẩu vượt giới hạn 72 byte UTF-8 bị từ chối với 401
    {
      const longPassword = 'a'.repeat(73)
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: FIXTURES.buyer.username,
          password: longPassword,
        }),
      })
      const body = await res.json()
      assertReal(res.status === 401, 'Mật khẩu > 72 byte UTF-8 bị từ chối với HTTP 401')
      assertReal(body.error?.code === 'INVALID_CREDENTIALS', 'Mã lỗi là INVALID_CREDENTIALS')
      await clearRateLimitWithSuccessLogin()
    }

    // 1.8 Sai tài khoản, sai mật khẩu, tài khoản blocked trả CÙNG mã lỗi và CÙNG thông báo
    {
      const resNonExistent = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'non_existent_user_9999', password: 'SomePassword123!' }),
      })
      const bodyNonExistent = await resNonExistent.json()

      const resWrongPw = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: 'WrongPassword999!' }),
      })
      const bodyWrongPw = await resWrongPw.json()

      const resBlocked = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.blocked.username, password: FIXTURES.blocked.password }),
      })
      const bodyBlocked = await resBlocked.json()

      assertReal(resNonExistent.status === 401, 'Username không tồn tại trả HTTP 401')
      assertReal(resWrongPw.status === 401, 'Sai mật khẩu trả HTTP 401')
      assertReal(resBlocked.status === 401, 'Tài khoản blocked trả HTTP 401')

      assertReal(bodyNonExistent.error?.code === 'INVALID_CREDENTIALS', 'User không tồn tại có mã INVALID_CREDENTIALS')
      assertReal(bodyWrongPw.error?.code === 'INVALID_CREDENTIALS', 'Sai pass có mã INVALID_CREDENTIALS')
      assertReal(bodyBlocked.error?.code === 'INVALID_CREDENTIALS', 'Blocked có mã INVALID_CREDENTIALS')

      const expectedMsg = 'Tên đăng nhập hoặc mật khẩu không hợp lệ.'
      assertReal(bodyNonExistent.message === expectedMsg, 'Message user không tồn tại cố định chuẩn mực')
      assertReal(bodyWrongPw.message === expectedMsg, 'Message sai mật khẩu đồng nhất 100%')
      assertReal(bodyBlocked.message === expectedMsg, 'Message tài khoản blocked đồng nhất 100%')
      await clearRateLimitWithSuccessLogin()
    }

    // 1.9 Body thiếu field hoặc sai kiểu trả 400 VALIDATION_ERROR
    {
      const resMissingPw = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username }),
      })
      const bodyMissingPw = await resMissingPw.json()
      assertReal(resMissingPw.status === 400, 'Thiếu password trả HTTP 400')
      assertReal(bodyMissingPw.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR khi thiếu password')

      const resEmptyUser = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: '   ', password: '123' }),
      })
      assertReal(resEmptyUser.status === 400, 'Username rỗng trả HTTP 400')
      await clearRateLimitWithSuccessLogin()
    }

    // 1.10 GET /auth/me thành công với token hợp lệ của buyer
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      })
      const body = await res.json()
      assertReal(res.status === 200, 'GET /api/v1/auth/me trả HTTP 200')
      assertReal(body.success === true, 'Success === true')
      assertReal(body.data?.user?.id === FIXTURES.buyer.id, 'User ID khớp')
      assertReal(body.data?.user?.username === FIXTURES.buyer.username, 'Username khớp')
      assertReal(body.data?.user?.email === FIXTURES.buyer.email, 'Email khớp')
      assertReal(body.data?.user?.role === 'buyer', 'Role khớp "buyer"')
      assertReal(body.data?.user?.shopId === null, 'shopId là null')
      assertReal(body.data?.user?.password_hash === undefined, 'Không có password_hash')
    }

    // 1.11 GET /auth/me với token của seller
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      })
      const body = await res.json()
      assertReal(res.status === 200, 'GET /auth/me seller trả HTTP 200')
      assertReal(body.data?.user?.role === 'seller', 'Role khớp "seller"')
      assertReal(body.data?.user?.shopId === FIXTURES.seller.shopId, 'Seller có shopId')
    }

    // 1.12 Thiếu Authorization header hoặc sai Bearer
    {
      const resNoHeader = await fetch(`${backendUrl}/api/v1/auth/me`)
      const bodyNoHeader = await resNoHeader.json()
      assertReal(resNoHeader.status === 401, 'Thiếu header Authorization trả HTTP 401')
      assertReal(bodyNoHeader.error?.code === 'AUTH_REQUIRED', 'Mã lỗi là AUTH_REQUIRED')

      const resBasic = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Basic ${buyerToken}` },
      })
      const bodyBasic = await resBasic.json()
      assertReal(resBasic.status === 401, 'Header Authorization không phải Bearer trả HTTP 401')
      assertReal(bodyBasic.error?.code === 'AUTH_REQUIRED', 'Mã lỗi là AUTH_REQUIRED khi thiếu tiền tố Bearer')
    }

    // 1.13 Token bị sửa chữ ký (tampered token) trả 401 AUTH_INVALID
    {
      const tamperedToken = buyerToken.slice(0, -5) + 'xxxxx'
      const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${tamperedToken}` },
      })
      const body = await res.json()
      assertReal(res.status === 401, 'Token sửa chữ ký trả HTTP 401')
      assertReal(body.error?.code === 'AUTH_INVALID', 'Mã lỗi là AUTH_INVALID')
    }

    // 1.14 Token hết hạn trả 401 AUTH_EXPIRED
    {
      const expiredToken = jwt.sign(
        { sub: FIXTURES.buyer.id, role: 'buyer' },
        TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: -120, // Hết hạn 120s trước (vượt quá dung sai clock skew 60s)
          issuer: 'shopnova-backend',
          audience: 'shopnova-clients',
        },
      )
      const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      })
      const body = await res.json()
      assertReal(res.status === 401, 'Token hết hạn trả HTTP 401')
      assertReal(body.error?.code === 'AUTH_EXPIRED', 'Mã lỗi là AUTH_EXPIRED khi token hết hạn')
    }

    // 1.15 Token thuật toán none và sai issuer/aud
    {
      const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
      const nonePayload = Buffer.from(JSON.stringify({
        sub: FIXTURES.buyer.id,
        role: 'buyer',
        iss: 'shopnova-backend',
        aud: 'shopnova-clients',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      })).toString('base64url')
      const noneToken = `${noneHeader}.${nonePayload}.`

      const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${noneToken}` },
      })
      const body = await res.json()
      assertReal(res.status === 401, 'Token thuật toán "none" bị từ chối trả HTTP 401')
      assertReal(body.error?.code === 'AUTH_INVALID', 'Mã lỗi là AUTH_INVALID')

      const wrongIssuerToken = jwt.sign(
        { sub: FIXTURES.buyer.id, role: 'buyer' },
        TEST_JWT_SECRET,
        { algorithm: 'HS256', expiresIn: 900, issuer: 'wrong-issuer-evil', audience: 'shopnova-clients' },
      )
      const resIssuer = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${wrongIssuerToken}` },
      })
      const bodyIssuer = await resIssuer.json()
      assertReal(resIssuer.status === 401, 'Token sai issuer bị từ chối với HTTP 401')
      assertReal(bodyIssuer.error?.code === 'AUTH_INVALID', 'Mã lỗi là AUTH_INVALID khi sai issuer')
    }

    // 1.16 REGRESSION JWT CLAIMS & SUB VALIDATION (Mục 5)
    {
      console.log('\n[Kiểm thử Regression JWT Sub Validation & Claims]')
      const invalidSubs = [
        '123abc',              // Chứa chữ
        ' 12345 ',             // Chứa khoảng trắng
        '012345',              // Chứa số 0 ở đầu
        '-12345',              // Số âm
        '18446744073709551616',// Vượt BIGINT UNSIGNED (2^64)
      ]

      for (const badSub of invalidSubs) {
        const badSubToken = jwt.sign(
          { sub: badSub, role: 'buyer' },
          TEST_JWT_SECRET,
          { algorithm: 'HS256', expiresIn: 900, issuer: 'shopnova-backend', audience: 'shopnova-clients' },
        )
        const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${badSubToken}` },
        })
        const body = await res.json()
        assertReal(res.status === 401, `Token có sub không hợp lệ ("${badSub}") bị từ chối HTTP 401`)
        assertReal(body.error?.code === 'AUTH_INVALID', `Mã lỗi là AUTH_INVALID khi sub sai quy chuẩn`)
      }

      // Token có thời hạn không đúng chuẩn 900 giây (ví dụ 850s, 950s, 3600s)
      for (const badDuration of [850, 950, 3600]) {
        const nowSec = Math.floor(Date.now() / 1000)
        const invalidDurationToken = jwt.sign(
          { sub: FIXTURES.buyer.id, role: 'buyer', iat: nowSec, exp: nowSec + badDuration },
          TEST_JWT_SECRET,
          { algorithm: 'HS256', issuer: 'shopnova-backend', audience: 'shopnova-clients' },
        )
        const resBadDuration = await fetch(`${backendUrl}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${invalidDurationToken}` },
        })
        const bodyBadDuration = await resBadDuration.json()
        assertReal(resBadDuration.status === 401, `Token có thời hạn exp - iat = ${badDuration}s (khác 900s) bị từ chối HTTP 401`)
        assertReal(bodyBadDuration.error?.code === 'AUTH_INVALID', 'Mã lỗi là AUTH_INVALID khi thời hạn token khác 900s')
      }

      // Token có iat ở tương lai vượt dung sai lệch đồng hồ 60s (ví dụ iat = now + 120s)
      {
        const nowSec = Math.floor(Date.now() / 1000)
        const futureIatToken = jwt.sign(
          { sub: FIXTURES.buyer.id, role: 'buyer', iat: nowSec + 120, exp: nowSec + 120 + 900 },
          TEST_JWT_SECRET,
          { algorithm: 'HS256', issuer: 'shopnova-backend', audience: 'shopnova-clients' },
        )
        const resFutureIat = await fetch(`${backendUrl}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${futureIatToken}` },
        })
        const bodyFutureIat = await resFutureIat.json()
        assertReal(resFutureIat.status === 401, 'Token có iat ở tương lai vượt dung sai bị từ chối HTTP 401 ngay lập tức')
        assertReal(bodyFutureIat.error?.code === 'AUTH_INVALID', 'Mã lỗi là AUTH_INVALID khi iat ở tương lai')
      }
    }

    // 1.17 Khóa tài khoản sau khi cấp token: request tiếp theo bị từ chối 401 AUTH_INVALID
    {
      await fixtureConn.execute(`UPDATE users SET status = 'blocked' WHERE id = ?`, [FIXTURES.buyer.id])

      const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      })
      const body = await res.json()
      assertReal(res.status === 401, 'Tài khoản bị khóa sau khi cấp token: request tiếp theo trả HTTP 401')
      assertReal(body.error?.code === 'AUTH_INVALID', 'Mã lỗi là AUTH_INVALID khi tài khoản bị khóa')

      await fixtureConn.execute(`UPDATE users SET status = 'active' WHERE id = ?`, [FIXTURES.buyer.id])
    }

    // 1.18 Đổi role trong MySQL: request tiếp theo phản ánh role mới
    {
      // Tạo shop hợp lệ cho buyer trước khi nâng cấp role thành seller
      const [promotedShopRes] = await fixtureConn.execute(
        `INSERT INTO shops (owner_id, slug, name, province, status) VALUES (?, ?, ?, ?, ?)`,
        [FIXTURES.buyer.id, 'buyer-promoted-shop', 'Shop Của Buyer Lên Seller', 'Hà Nội', 'active'],
      )
      await fixtureConn.execute(`UPDATE users SET role = 'seller' WHERE id = ?`, [FIXTURES.buyer.id])

      const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      })
      const body = await res.json()
      assertReal(res.status === 200, 'GET /me sau khi đổi role trả HTTP 200')
      assertReal(body.data?.user?.role === 'seller', 'Role mới được cập nhật tức thì thành "seller"')

      // Khôi phục lại role buyer và xóa shop tạm
      await fixtureConn.execute(`UPDATE users SET role = 'buyer' WHERE id = ?`, [FIXTURES.buyer.id])
      await fixtureConn.execute(`DELETE FROM shops WHERE id = ?`, [promotedShopRes.insertId])
    }

    // 1.19 Middleware requireRole
    {
      const mockRes = () => {
        const res = {}
        res.statusCode = 200
        res.status = function (code) { this.statusCode = code; return this }
        res.json = function (obj) { this.body = obj; return this }
        return res
      }

      // Buyer vào seller
      const reqBuyer = { user: { role: 'buyer' } }
      const resBuyer = mockRes()
      let nextCalledBuyer = false
      requireRole('seller')(reqBuyer, resBuyer, () => { nextCalledBuyer = true })
      assertReal(resBuyer.statusCode === 403, 'Buyer vào tài nguyên seller bị từ chối HTTP 403')
      assertReal(resBuyer.body?.error?.code === 'FORBIDDEN', 'Mã lỗi là FORBIDDEN')
      assertReal(nextCalledBuyer === false, 'next() không được gọi cho buyer khi thiếu quyền seller')

      // Seller vào seller
      const reqSeller = { user: { role: 'seller' } }
      const resSeller = mockRes()
      let nextCalledSeller = false
      requireRole('seller')(reqSeller, resSeller, () => { nextCalledSeller = true })
      assertReal(nextCalledSeller === true, 'Seller vào tài nguyên seller được chấp nhận')

      // Seller vào buyer (kế thừa quyền mua)
      const reqSellerForBuyer = { user: { role: 'seller' } }
      const resSellerForBuyer = mockRes()
      let nextCalledSellerForBuyer = false
      requireRole('buyer')(reqSellerForBuyer, resSellerForBuyer, () => { nextCalledSellerForBuyer = true })
      assertReal(nextCalledSellerForBuyer === true, 'Seller truy cập tài nguyên buyer được chấp nhận (kế thừa quyền mua)')

      // Buyer vào buyer
      const reqBuyerForBuyer = { user: { role: 'buyer' } }
      const resBuyerForBuyer = mockRes()
      let nextCalledBuyerForBuyer = false
      requireRole('buyer')(reqBuyerForBuyer, resBuyerForBuyer, () => { nextCalledBuyerForBuyer = true })
      assertReal(nextCalledBuyerForBuyer === true, 'Buyer truy cập tài nguyên buyer được chấp nhận')

      // Chưa xác thực
      const reqNoUser = {}
      const resNoUser = mockRes()
      let nextCalledNoUser = false
      requireRole('buyer')(reqNoUser, resNoUser, () => { nextCalledNoUser = true })
      assertReal(resNoUser.statusCode === 401, 'Chưa xác thực vào middleware role bị từ chối HTTP 401')
      assertReal(resNoUser.body?.error?.code === 'AUTH_REQUIRED', 'Mã lỗi là AUTH_REQUIRED')
      assertReal(nextCalledNoUser === false, 'next() không được gọi khi chưa authenticate')
    }

    // 1.20 REGRESSION RATE LIMIT TRÊN INSTANCE CÔ LẬP (Mục 1)
    {
      console.log('\n[Kiểm thử Regression Rate Limit trên Backend Instance Cô lập]')
      backendRateLimitProc = await startBackendProduction({
        DATA_API_URL: dataApiProc.baseUrl,
        DATA_API_KEY: TEST_SERVICE_KEY,
        JWT_SECRET: TEST_JWT_SECRET,
      })

      let rateLimited = false
      let retryAfterHeader = null

      // Gửi 6 lần đăng nhập sai từ cùng client nhưng mỗi lần đổi một header X-Forwarded-For khác nhau
      for (let i = 1; i <= 6; i++) {
        const fakeForwardedIp = `203.0.113.${10 + i}`
        const res = await fetch(`${backendRateLimitProc.baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': fakeForwardedIp, // Cố tình đổi header
          },
          body: JSON.stringify({
            username: FIXTURES.buyer.username,
            password: 'WrongPasswordForRateLimitRegression!',
          }),
        })

        if (res.status === 429) {
          rateLimited = true
          retryAfterHeader = res.headers.get('retry-after')
          const body = await res.json()
          assertReal(body.error?.code === 'RATE_LIMITED', 'Mã lỗi là RATE_LIMITED khi bị chặn')
          break
        }
      }

      assertReal(rateLimited === true, 'Đổi X-Forwarded-For liên tục vẫn bị chặn 429 vì Backend dùng IP socket kết nối thực tế')
      assertReal(retryAfterHeader !== null && Number(retryAfterHeader) > 0, `Có header Retry-After hợp lệ (${retryAfterHeader}s)`)

      await stopProcess(backendRateLimitProc.child)
      backendRateLimitProc = null
    }

    // 1.21 REGRESSION CONCURRENCY & CLIENT ABORT RATE LIMIT (Upstream Spy - Mock/Contract)
    {
      console.log('\n[Kiểm thử Regression Concurrency Rate Limit & Client Abort trên Backend Thật (Upstream Spy)]')

      // Dựng Upstream Spy Server để đếm chính xác số lời gọi upstream thực tế và chủ động giữ phản hồi
      const spyPort = await getAvailablePort()
      let totalUpstreamCalls = 0
      let activeUpstreamCalls = 0
      let maxActiveUpstream = 0
      let upstreamMode = 'hold'
      const heldRequests = []

      function releaseHeld(statusCode = 401, body = { success: false, error: { code: 'INVALID_CREDENTIALS' } }) {
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

      const spyServer = http.createServer((req, res) => {
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

          // Chế độ delay ngắn cho kịch bản đồng thời
          if (upstreamMode === 'delayed_401') {
            const timer = registerTimer(setTimeout(() => {
              clearTrackedTimer(timer)
              activeUpstreamCalls = Math.max(0, activeUpstreamCalls - 1)
              if (!res.writableEnded) {
                res.writeHead(401, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({
                  success: false,
                  message: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
                  error: { code: 'INVALID_CREDENTIALS' },
                }))
              }
            }, 120))
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

      try {
        backendRateLimitProc = await startBackendProduction({
          DATA_API_URL: `http://127.0.0.1:${spyPort}`,
          DATA_API_KEY: TEST_SERVICE_KEY,
          JWT_SECRET: TEST_JWT_SECRET,
        })

        // Kịch bản A: 20 lần đăng nhập sai đồng thời
        console.log('  -> Kịch bản A: 20 lần đăng nhập sai đồng thời...')
        upstreamMode = 'delayed_401'
        totalUpstreamCalls = 0
        activeUpstreamCalls = 0
        maxActiveUpstream = 0

        const concurrentRequests = Array.from({ length: 20 }, (_, idx) =>
          fetch(`${backendRateLimitProc.baseUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: FIXTURES.buyer.username,
              password: `WrongPasswordConcurrent_${idx}`,
            }),
          }).then(async (res) => ({
            status: res.status,
            retryAfter: res.headers.get('retry-after'),
            body: await res.json(),
          }))
        )

        const results = await Promise.all(concurrentRequests)
        const count429 = results.filter((r) => r.status === 429).length
        const count401 = results.filter((r) => r.status === 401).length

        assertMock(count401 === 5, `20 request đồng thời: chính xác 5 phản hồi 401 (thực tế: ${count401})`)
        assertMock(count429 === 15, `20 request đồng thời: chính xác 15 phản hồi 429 (thực tế: ${count429})`)
        assertMock(totalUpstreamCalls === 5, `Đếm upstream thực tế: chỉ đúng 5 lời gọi upstream (thực tế: ${totalUpstreamCalls})`)
        assertMock(maxActiveUpstream <= 5, `Số công việc upstream chạy đồng thời không vượt 5 (thực tế max: ${maxActiveUpstream})`)

        // Kịch bản B: Gửi 5 yêu cầu, chờ upstream nhận đủ 5, hủy client trong lúc upstream đang giữ, gửi tiếp yêu cầu thứ 6
        console.log('  -> Kịch bản B: Gửi 5 yêu cầu, chờ upstream spy nhận đủ 5, hủy client và kiểm tra chặn 429...')
        await stopProcess(backendRateLimitProc.child)
        backendRateLimitProc = await startBackendProduction({
          DATA_API_URL: `http://127.0.0.1:${spyPort}`,
          DATA_API_KEY: TEST_SERVICE_KEY,
          JWT_SECRET: TEST_JWT_SECRET,
        })

        upstreamMode = 'hold'
        heldRequests.length = 0
        totalUpstreamCalls = 0
        activeUpstreamCalls = 0
        maxActiveUpstream = 0

        const backendHttpPort = new URL(backendRateLimitProc.baseUrl).port
        const clientRequests = []

        for (let i = 0; i < 5; i++) {
          const clientReq = http.request({
            hostname: '127.0.0.1',
            port: backendHttpPort,
            path: '/api/v1/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
          clientReq.on('error', () => {})
          clientReq.write(JSON.stringify({
            username: FIXTURES.buyer.username,
            password: `WrongPasswordAbort_${i}`,
          }))
          clientReq.end()
          clientRequests.push(clientReq)
        }

        // Chờ upstream xác nhận đã nhận đủ 5 yêu cầu (không dùng thời gian chờ cố định)
        await waitForUpstreamHeld(5, 4000)
        assertMock(heldRequests.length === 5, 'Upstream spy đã nhận và đang giữ chính xác 5 yêu cầu')
        assertMock(activeUpstreamCalls === 5, 'Số yêu cầu đang xử lý tại upstream là 5')

        // Hủy kết nối của cả 5 client trong lúc upstream vẫn đang giữ các yêu cầu
        for (const req of clientRequests) {
          try { req.destroy() } catch {}
        }
        await new Promise((r) => setTimeout(r, 50))

        // Gửi thêm một đợt đăng nhập thứ 6 từ cùng IP: phải nhận 429 và không phát sinh lời gọi upstream mới
        const res6 = await fetch(`${backendRateLimitProc.baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: FIXTURES.buyer.username, password: 'Attempt6_FromSameIP' }),
        })
        const data6 = await res6.json()

        assertMock(res6.status === 429, 'Đợt đăng nhập thứ 6 từ cùng IP bị chặn với HTTP 429 RATE_LIMITED')
        assertMock(data6.error?.code === 'RATE_LIMITED', 'Mã lỗi trả về là RATE_LIMITED')
        assertMock(heldRequests.length === 5, 'Không phát sinh lời gọi upstream mới (upstream vẫn chỉ giữ 5 yêu cầu cũ)')
        assertMock(totalUpstreamCalls === 5, 'Tổng số lời gọi upstream thực tế không vượt quá 5')
        assertMock(maxActiveUpstream <= 5, 'Số công việc upstream đang chạy đồng thời tại mọi thời điểm không vượt quá 5')

        // Cho upstream hoàn tất các yêu cầu cũ với 401
        releaseHeld(401, { success: false, error: { code: 'INVALID_CREDENTIALS' } })
        await new Promise((r) => setTimeout(r, 100))
        assertMock(activeUpstreamCalls === 0, 'Tất cả 5 yêu cầu cũ đã hoàn tất tại upstream')

        // Gửi request thứ 7: xác nhận kết quả thất bại vẫn được ghi nhận dù client đã ngắt kết nối
        const res7 = await fetch(`${backendRateLimitProc.baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: FIXTURES.buyer.username, password: 'Attempt7_CheckFailedRecorded' }),
        })
        const data7 = await res7.json()
        assertMock(res7.status === 429, 'Request thứ 7 vẫn nhận 429 vì 5 lần thử sai đã được ghi nhận kể cả khi client hủy')
        assertMock(data7.error?.code === 'RATE_LIMITED', 'Mã lỗi vẫn là RATE_LIMITED')

        // Kịch bản C: Kiểm tra nhánh lỗi hệ thống (500) và phục hồi phần giữ chỗ
        console.log('  -> Kịch bản C: Kiểm tra nhánh lỗi hệ thống (500) thu hồi phần giữ chỗ và phục hồi...')
        await stopProcess(backendRateLimitProc.child)
        backendRateLimitProc = await startBackendProduction({
          DATA_API_URL: `http://127.0.0.1:${spyPort}`,
          DATA_API_KEY: TEST_SERVICE_KEY,
          JWT_SECRET: TEST_JWT_SECRET,
        })

        upstreamMode = 'hold'
        heldRequests.length = 0
        totalUpstreamCalls = 0
        activeUpstreamCalls = 0
        maxActiveUpstream = 0

        const singleReq = http.request({
          hostname: '127.0.0.1',
          port: new URL(backendRateLimitProc.baseUrl).port,
          path: '/api/v1/auth/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        singleReq.on('error', () => {})
        singleReq.write(JSON.stringify({ username: FIXTURES.buyer.username, password: 'SingleReqPassword' }))
        singleReq.end()

        await waitForUpstreamHeld(1, 4000)
        assertMock(heldRequests.length === 1, 'Upstream spy đã nhận request kiểm tra lỗi hệ thống')

        try { singleReq.destroy() } catch {}
        await new Promise((r) => setTimeout(r, 50))

        releaseHeld(500, { success: false, error: { code: 'INTERNAL_SERVER_ERROR' } })
        await new Promise((r) => setTimeout(r, 100))
        assertMock(activeUpstreamCalls === 0, 'Yêu cầu lỗi 500 đã kết thúc tại upstream')

        upstreamMode = 'immediate_401'
        const recoveryRes = await fetch(`${backendRateLimitProc.baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: FIXTURES.buyer.username,
            password: 'PasswordAfterSystemError',
          }),
        })
        const recoveryData = await recoveryRes.json()

        assertMock(recoveryRes.status === 401, 'Request sau lỗi hệ thống nhận HTTP 401 (không bị kẹt 429 hay rò rỉ chỗ giữ)')
        assertMock(recoveryData.error?.code === 'INVALID_CREDENTIALS', 'Mã lỗi là INVALID_CREDENTIALS do upstream trả về')
      } finally {
        releaseHeld(500, { success: false })
        if (backendRateLimitProc?.child) {
          await stopProcess(backendRateLimitProc.child)
          backendRateLimitProc = null
        }
        if (spyServer) {
          await new Promise((resolve) => spyServer.close(resolve)).catch(() => {})
        }
      }
    }

    // -----------------------------------------------------------------------------------
    // NHÓM 2: KIỂM THỬ MOCK & CONTRACT REGRESSION (Mục 2, 3, 4)
    // -----------------------------------------------------------------------------------
    console.log('\n=== NHÓM 2: KIỂM THỬ MOCK & CONTRACT REGRESSION (Upstream, Timeout, Markers) ===\n')

    // 2.0 Kiểm tra stopProcess(): nhánh không phát sinh exit/close phải báo lỗi, không báo cleanup thành công
    {
      console.log('\n[Kiểm thử Harness: stopProcess ném lỗi khi tiến trình không phát sinh exit/close]')
      const fakeChild = new EventEmitter()
      fakeChild.pid = 88888
      fakeChild.exitCode = null
      fakeChild.signalCode = null
      fakeChild.kill = () => {} // Cố tình không thoát, không emit exit hay close

      let stoppedSuccess = false
      let caughtError = null
      try {
        await stopProcess(fakeChild, 300)
        stoppedSuccess = true
      } catch (err) {
        caughtError = err
      }

      assertMock(stoppedSuccess === false, 'stopProcess không báo cleanup thành công khi tiến trình không phát sinh exit/close')
      assertMock(caughtError !== null, 'stopProcess ném lỗi kiểm thử khi tiến trình không chịu thoát')
      assertMock(
        caughtError?.message?.includes('Process cleanup failed'),
        'Thông báo lỗi chỉ rõ tiến trình không thoát trong thời hạn ngân sách',
      )
    }

    // Tạm dừng Data API thật để test cổng đóng
    await stopProcess(dataApiProc.child)
    dataApiProc = null

    // 2.1 Cổng Data API đóng: Backend trả 503 DATA_API_UNAVAILABLE
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
      })
      const body = await res.json()
      assertMock(res.status === 503, 'Data API đóng cổng: Backend trả HTTP 503')
      assertMock(body.error?.code === 'DATA_API_UNAVAILABLE', 'Mã lỗi là DATA_API_UNAVAILABLE (không phải INVALID_CREDENTIALS)')
    }

    // Khởi tạo Mock Server linh hoạt để mô phỏng tất cả các trường hợp upstream
    const mockPort = await getAvailablePort()
    let mockScenario = 'auth-failed'
    const SENSITIVE_MARKER = 'SENSITIVE_UPSTREAM_MARKER_TEST_12345'

    mockServer = http.createServer((req, res) => {
      // 1. Kịch bản khóa dịch vụ sai: 401 SERVICE_UNAUTHORIZED
      if (mockScenario === 'auth-failed') {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          message: 'Khóa dịch vụ không hợp lệ.',
          error: { code: 'SERVICE_UNAUTHORIZED' },
        }))
        return
      }

      // 2. Kịch bản rò rỉ marker nhạy cảm trong response Data API
      if (mockScenario === 'sensitive-marker-in-error') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          message: `Lỗi nội bộ chứa marker: ${SENSITIVE_MARKER}`,
          error: {
            code: 'VALIDATION_ERROR',
            details: `Chi tiết nhạy cảm: ${SENSITIVE_MARKER}`,
            sql: `SELECT * FROM secret_table WHERE id = '${SENSITIVE_MARKER}'`,
            stack: `Error at database.js:10:15 (${SENSITIVE_MARKER})`,
          },
        }))
        return
      }

      // 3. Kịch bản Data API trả lỗi 503 DATABASE_UNAVAILABLE (SELECT treo hoặc connection timeout)
      if (mockScenario === 'db-unavailable-503') {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          message: 'Cơ sở dữ liệu tạm thời không sẵn sàng.',
          error: { code: 'DATABASE_UNAVAILABLE' },
        }))
        return
      }

      // 4. Kịch bản Data API trả 500 lỗi lập trình / syntax SQL (không phải database unavailable)
      if (mockScenario === 'syntax-error-500') {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          message: 'Lỗi máy chủ nội bộ.',
          error: { code: 'INTERNAL_SERVER_ERROR' },
        }))
        return
      }

      // Kịch bản Data API trả lỗi 500 có chữ timeout (TypeError hoặc SQL error)
      if (mockScenario === 'type-error-with-timeout') {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          message: "Lỗi máy chủ nội bộ: TypeError: Cannot read properties of undefined (reading 'timeout')",
          error: { code: 'INTERNAL_SERVER_ERROR' },
        }))
        return
      }

      if (mockScenario === 'sql-error-with-timeout-col') {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          message: "Lỗi máy chủ nội bộ: ER_BAD_FIELD_ERROR: Unknown column 'timeout' in 'field list'",
          error: { code: 'INTERNAL_SERVER_ERROR' },
        }))
        return
      }

      // Kịch bản kiểm tra độ dài fullName Unicode code points
      if (mockScenario.startsWith('fullname:')) {
        const count = Number(mockScenario.split(':')[1])
        const unicodeSample = 'Nguyễn Văn Đạt Hoàng ' // 21 ký tự Unicode code points
        let fullStr = unicodeSample.repeat(Math.ceil(count / 21))
        fullStr = Array.from(fullStr).slice(0, count).join('')

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          data: {
            user: {
              id: '1',
              username: 'valid_user',
              fullName: fullStr,
              email: null,
              phone: null,
              avatarUrl: null,
              role: 'buyer',
              status: 'active',
              shopId: null,
            },
          },
        }))
        return
      }

      // 5. Kịch bản hồ sơ Data API sai contract (Mục 2)
      if (mockScenario.startsWith('bad-profile:')) {
        const badType = mockScenario.split(':')[1]
        let badUser = {
          id: '1',
          username: 'valid_user',
          fullName: 'Valid Name',
          email: null,
          phone: null,
          avatarUrl: null,
          role: 'buyer',
          status: 'active',
          shopId: null,
        }

        if (badType === 'missing-role') delete badUser.role
        else if (badType === 'invalid-id-type') badUser.id = 12345 // Number thay vì string
        else if (badType === 'invalid-id-alpha') badUser.id = '123a'
        else if (badType === 'invalid-role') badUser.role = 'superadmin'
        else if (badType === 'invalid-status') badUser.status = 'pending'
        else if (badType === 'buyer-has-shop') badUser.shopId = '5' // Buyer không được có shopId
        else if (badType === 'seller-no-shop') { badUser.role = 'seller'; badUser.shopId = null } // Seller bắt buộc có shopId
        else if (badType === 'mismatched-id') badUser.id = '9999' // ID không khớp với ID yêu cầu
        else if (badType === 'username-number') badUser.username = 12345 // Number thay vì string
        else if (badType === 'username-null') badUser.username = null
        else if (badType === 'username-empty') badUser.username = ''
        else if (badType === 'username-whitespace-only') badUser.username = '   '
        else if (badType === 'username-too-long') badUser.username = 'a'.repeat(51) // 51 ký tự
        else if (badType === 'username-non-ascii-viet') badUser.username = 'buyer_việt'
        else if (badType === 'username-non-ascii-emoji') badUser.username = 'buyer⚡'
        else if (badType === 'username-non-ascii-latin') badUser.username = 'buyerñ'
        else if (badType === 'username-uppercase') badUser.username = 'BUYER' // Chưa lowercase
        else if (badType === 'username-not-trimmed') badUser.username = ' buyer ' // Chưa trim

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          data: { user: badUser },
        }))
        return
      }

      // Kịch bản mock upstream trả hồ sơ username hợp lệ (50 ký tự, +, @)
      if (mockScenario.startsWith('valid-username:')) {
        const validUname = mockScenario.slice('valid-username:'.length)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          data: {
            user: {
              id: '1',
              username: validUname,
              fullName: 'Valid User',
              email: null,
              phone: null,
              avatarUrl: null,
              role: 'buyer',
              status: 'active',
              shopId: null,
            },
          },
        }))
        return
      }

      // 6. Kịch bản login trả user bị blocked (Mục 2: Login chỉ cấp token khi status active)
      if (mockScenario === 'login-user-blocked') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: true,
          data: {
            user: {
              id: '1',
              username: 'blocked_user',
              fullName: 'Blocked User',
              email: null,
              phone: null,
              avatarUrl: null,
              role: 'buyer',
              status: 'blocked',
              shopId: null,
            },
          },
        }))
        return
      }

      // 7. Kịch bản Data API treo không phản hồi (5000ms timeout)
      if (mockScenario === 'hang') {
        return
      }
    })

    await new Promise((resolve) => mockServer.listen(mockPort, '127.0.0.1', resolve))

    // Khởi động Backend thứ 2 trỏ vào Mock Server
    backendMockProc = await startBackendProduction({
      DATA_API_URL: `http://127.0.0.1:${mockPort}`,
      DATA_API_KEY: 'test_key_valid_64_characters_entropy_long_mock_service',
      JWT_SECRET: TEST_JWT_SECRET,
    })

    // 2.2 Service Key sai từ Data API: Backend trả 502 DATA_API_AUTH_FAILED
    {
      mockScenario = 'auth-failed'
      const res = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
      })
      const body = await res.json()
      assertMock(res.status === 502, 'Service key sai: Backend trả HTTP 502 Bad Gateway')
      assertMock(body.error?.code === 'DATA_API_AUTH_FAILED', 'Mã lỗi là DATA_API_AUTH_FAILED (không phải 401)')
    }

    // 2.3 Upstream trả lỗi có chứa Marker nhạy cảm: Backend tuyệt đối không để lộ (Mục 3)
    {
      mockScenario = 'sensitive-marker-in-error'
      const res = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
      })
      const rawText = await res.text()
      const body = JSON.parse(rawText)

      assertMock(res.status === 400, 'Data API trả 400 VALIDATION_ERROR: Backend trả HTTP 400')
      assertMock(body.error?.code === 'VALIDATION_ERROR', 'Mã lỗi Backend là VALIDATION_ERROR')
      assertMock(body.message === 'Dữ liệu yêu cầu không hợp lệ.', 'Backend dùng thông báo cố định tiếng Việt, không chuyển tiếp json.message Data API')

      // Kiểm tra marker nhạy cảm không xuất hiện trong response và không xuất hiện trong log
      assertMock(!rawText.includes(SENSITIVE_MARKER), 'Response của Backend KHÔNG chứa marker nhạy cảm của upstream')
      const mockBackendStdout = backendMockProc.getStdout()
      const mockBackendStderr = backendMockProc.getStderr()
      assertMock(!mockBackendStdout.includes(SENSITIVE_MARKER) && !mockBackendStderr.includes(SENSITIVE_MARKER), 'Log Backend KHÔNG để rò rỉ marker nhạy cảm của upstream')
    }

    // 2.4 Data API SELECT treo / Database Unavailable trả 503: Backend map thành 503 DATA_API_UNAVAILABLE (Mục 4)
    {
      mockScenario = 'db-unavailable-503'
      const res = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
      })
      const body = await res.json()
      assertMock(res.status === 503, 'Data API trả 503 DATABASE_UNAVAILABLE: Backend map thành HTTP 503')
      assertMock(body.error?.code === 'DATA_API_UNAVAILABLE', 'Mã lỗi Backend là DATA_API_UNAVAILABLE')
    }

    // 2.5 Data API lỗi cú pháp SQL hoặc lập trình (500): Backend trả 502 DATA_API_BAD_RESPONSE (KHÔNG biến thành 503) (Mục 4)
    {
      mockScenario = 'syntax-error-500'
      const res = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
      })
      const body = await res.json()
      assertMock(res.status === 502, 'Data API trả 500 lỗi lập trình/SQL: Backend trả 502 DATA_API_BAD_RESPONSE')
      assertMock(body.error?.code === 'DATA_API_BAD_RESPONSE', 'Mã lỗi Backend là DATA_API_BAD_RESPONSE (không biến thành 503)')

      // Kiểm tra Data API trả 500 kèm thông báo có chữ timeout (TypeError hoặc SQL error)
      // Backend phải trả 502 DATA_API_BAD_RESPONSE, tuyệt đối không được xem là 503 DATABASE_UNAVAILABLE
      mockScenario = 'type-error-with-timeout'
      const resTypeError = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
      })
      const bodyTypeError = await resTypeError.json()
      assertMock(resTypeError.status === 502, 'Data API trả 500 do TypeError (có chữ timeout): Backend trả 502 (không biến thành 503)')
      assertMock(bodyTypeError.error?.code === 'DATA_API_BAD_RESPONSE', 'Mã lỗi là DATA_API_BAD_RESPONSE')

      mockScenario = 'sql-error-with-timeout-col'
      const resSqlError = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
      })
      const bodySqlError = await resSqlError.json()
      assertMock(resSqlError.status === 502, 'Data API trả 500 do lỗi SQL có cột timeout: Backend trả 502 (không biến thành 503)')
      assertMock(bodySqlError.error?.code === 'DATA_API_BAD_RESPONSE', 'Mã lỗi là DATA_API_BAD_RESPONSE')
    }

    // 2.6 Kiểm tra chặt hồ sơ Data API (Mục 2 Contract Enforcement)
    {
      console.log('\n[Kiểm thử Contract Enforcement Hồ sơ Người dùng]')
      const badContractScenarios = [
        { type: 'missing-role', desc: 'Hồ sơ thiếu role' },
        { type: 'invalid-id-type', desc: 'Hồ sơ có ID kiểu Number thay vì chuỗi' },
        { type: 'invalid-id-alpha', desc: 'Hồ sơ có ID chứa ký tự chữ cái' },
        { type: 'invalid-role', desc: 'Hồ sơ có role không thuộc whitelist (superadmin)' },
        { type: 'invalid-status', desc: 'Hồ sơ có status không thuộc whitelist (pending)' },
        { type: 'buyer-has-shop', desc: 'Buyer nhưng shopId khác null' },
        { type: 'seller-no-shop', desc: 'Seller nhưng shopId là null' },
        // Kiểm thử vi phạm hợp đồng username:
        { type: 'username-number', desc: 'Hồ sơ có username kiểu Number thay vì chuỗi' },
        { type: 'username-null', desc: 'Hồ sơ có username là null' },
        { type: 'username-empty', desc: 'Hồ sơ có username là chuỗi rỗng' },
        { type: 'username-whitespace-only', desc: 'Hồ sơ có username chỉ chứa khoảng trắng' },
        { type: 'username-too-long', desc: 'Hồ sơ có username vượt quá 50 ký tự (51 ký tự)' },
        { type: 'username-non-ascii-viet', desc: 'Hồ sơ có username chứa tiếng Việt ngoài ASCII' },
        { type: 'username-non-ascii-emoji', desc: 'Hồ sơ có username chứa emoji ngoài ASCII' },
        { type: 'username-non-ascii-latin', desc: 'Hồ sơ có username chứa ký tự Latin mở rộng ngoài ASCII' },
        { type: 'username-uppercase', desc: 'Hồ sơ có username chứa chữ in hoa chưa chuẩn hóa' },
        { type: 'username-not-trimmed', desc: 'Hồ sơ có username chứa khoảng trắng chưa trim' },
      ]

      for (const item of badContractScenarios) {
        mockScenario = `bad-profile:${item.type}`
        const res = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
        })
        const body = await res.json()
        assertMock(res.status === 502, `${item.desc}: Backend từ chối với HTTP 502`)
        assertMock(body.error?.code === 'DATA_API_BAD_RESPONSE', `Mã lỗi là DATA_API_BAD_RESPONSE khi contract bị vi phạm`)
      }

      // Kiểm thử hồ sơ upstream có username hợp lệ (50 ký tự ASCII, dấu +, ký tự @) qua Mock
      console.log('\n[Kiểm thử Contract Enforcement Username Hợp Lệ Qua Mock Upstream]')
      const validUsernameCases = [
        { username: 'a'.repeat(50), desc: 'Username đúng 50 ký tự ASCII' },
        { username: 'buyer+demo', desc: 'Username chứa dấu + (buyer+demo)' },
        { username: 'buyer@example.com', desc: 'Username chứa ký tự @ (buyer@example.com)' },
      ]

      for (const validItem of validUsernameCases) {
        mockScenario = `valid-username:${validItem.username}`
        const res = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: validItem.username, password: FIXTURES.buyer.password }),
        })
        const body = await res.json()
        assertMock(res.status === 200, `${validItem.desc}: Backend chấp nhận trả HTTP 200`)
        assertMock(body.data?.user?.username === validItem.username, `${validItem.desc}: Username trả về nguyên vẹn`)
      }

      // Kịch bản login nhưng user trả về có status !== 'active' (ví dụ blocked) -> từ chối cấp token
      mockScenario = 'login-user-blocked'
      const resBlockedLogin = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
      })
      const bodyBlockedLogin = await resBlockedLogin.json()
      assertMock(resBlockedLogin.status === 401, 'Login với tài khoản không active bị từ chối cấp token (HTTP 401)')
      assertMock(bodyBlockedLogin.error?.code === 'INVALID_CREDENTIALS', 'Mã lỗi trả về là INVALID_CREDENTIALS')

      // Kịch bản auth-profile nhưng ID trả về không khớp với ID yêu cầu
      mockScenario = 'bad-profile:mismatched-id'
      const validTokenForMock = jwt.sign(
        { sub: '1', role: 'buyer' },
        TEST_JWT_SECRET,
        { algorithm: 'HS256', expiresIn: 900, issuer: 'shopnova-backend', audience: 'shopnova-clients' },
      )
      const resMismatchedId = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${validTokenForMock}` },
      })
      const bodyMismatchedId = await resMismatchedId.json()
      assertMock(resMismatchedId.status === 502, 'Auth-profile nhận ID không khớp với sub: Backend trả HTTP 502')
      assertMock(bodyMismatchedId.error?.code === 'DATA_API_BAD_RESPONSE', 'Mã lỗi là DATA_API_BAD_RESPONSE')

      // Kiểm tra validation fullName theo Unicode code points (Mục 2)
      console.log('\n[Kiểm thử Validation fullName theo Unicode code points: 100, 101, 120, 121]')
      for (const count of [100, 101, 120]) {
        mockScenario = `fullname:${count}`
        const res = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
        })
        const body = await res.json()
        assertMock(res.status === 200, `Hồ sơ có fullName ${count} ký tự Unicode code points được chấp nhận (HTTP 200)`)
        assertMock(
          Array.from(body.data?.user?.fullName || '').length === count,
          `fullName ${count} ký tự Unicode được giữ nguyên vẹn, không bị cắt ngắn`,
        )
      }

      // fullName 121 ký tự Unicode code points -> vượt trần VARCHAR(120), bị từ chối với HTTP 502
      mockScenario = 'fullname:121'
      const resOver120 = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
      })
      const bodyOver120 = await resOver120.json()
      assertMock(resOver120.status === 502, 'Hồ sơ có fullName 121 ký tự Unicode code points bị từ chối với HTTP 502')
      assertMock(bodyOver120.error?.code === 'DATA_API_BAD_RESPONSE', 'Mã lỗi là DATA_API_BAD_RESPONSE khi fullName vượt quá 120 code points')
    }

    // 2.7 Upstream treo (5000ms deadline bao trùm) (Mục 3)
    {
      console.log('\n[Kiểm thử Timeout Deadline 5000ms Upstream]')
      mockScenario = 'hang'
      const t0 = Date.now()
      const res = await fetch(`${backendMockProc.baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: FIXTURES.buyer.username, password: FIXTURES.buyer.password }),
      })
      const duration = Date.now() - t0
      const body = await res.json()
      assertMock(res.status === 504, 'Data API treo: Backend trả HTTP 504 Gateway Timeout')
      assertMock(body.error?.code === 'DATA_API_TIMEOUT', 'Mã lỗi là DATA_API_TIMEOUT')
      assertMock(duration >= 4900 && duration <= 6000, `Hết hạn đúng hạn ngân sách 5000ms (${duration}ms)`)
    }

    // Dọn dẹp backend thứ 2 và mock server
    await stopProcess(backendMockProc.child)
    backendMockProc = null
    await new Promise((resolve) => mockServer.close(resolve))
    mockServer = null

    // -----------------------------------------------------------------------------------
    // NHÓM 3: PHỤC HỒI TIẾN TRÌNH VÀ BẢO MẬT LOG
    // -----------------------------------------------------------------------------------
    console.log('\n=== NHÓM 3: PHỤC HỒI TIẾN TRÌNH VÀ BẢO MẬT LOG ===\n')

    // Khởi động lại Data API thật để kiểm tra Backend gốc phục hồi kết nối thành công
    dataApiProc = await startDataApiProduction({
      PORT: String(dataApiPort),
      DB_NAME: dbConfig.database,
      DB_USER: dbConfig.dataApiUser,
      DB_PASSWORD: dbConfig.dataApiPassword,
      DATA_API_KEY: TEST_SERVICE_KEY,
    })

    const resRecover = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: FIXTURES.seller.username,
        password: FIXTURES.seller.password,
      }),
    })
    const bodyRecover = await resRecover.json()
    assertReal(resRecover.status === 200, 'Backend trên CÙNG TIẾN TRÌNH phục hồi kết nối Data API thành công')
    assertReal(bodyRecover.data?.user?.username === FIXTURES.seller.username, 'Đăng nhập thành công trở lại')

    // Kiểm tra bảo mật log Backend
    const backendStdout = backendProc.getStdout()
    const backendStderr = backendProc.getStderr()
    assertReal(!backendStdout.includes(TEST_JWT_SECRET) && !backendStderr.includes(TEST_JWT_SECRET), 'Backend log tuyệt đối không để lộ JWT_SECRET')
    assertReal(!backendStdout.includes(TEST_SERVICE_KEY) && !backendStderr.includes(TEST_SERVICE_KEY), 'Backend log tuyệt đối không để lộ DATA_API_KEY')
    assertReal(!backendStdout.includes(FIXTURES.buyer.password) && !backendStderr.includes(FIXTURES.buyer.password), 'Backend log tuyệt đối không để lộ mật khẩu người dùng')

    // Kiểm tra bảo mật log Data API
    const dataApiStdout = dataApiProc.getStdout()
    const dataApiStderr = dataApiProc.getStderr()
    assertReal(!dataApiStdout.includes(TEST_SERVICE_KEY) && !dataApiStderr.includes(TEST_SERVICE_KEY), 'Data API log tuyệt đối không để lộ DATA_API_KEY')
    assertReal(!dataApiStdout.includes(FIXTURES.buyer.password) && !dataApiStderr.includes(FIXTURES.buyer.password), 'Data API log tuyệt đối không để lộ mật khẩu người dùng')

  } catch (err) {
    console.error('\n[Fatal Test Error]:', err)
    failedRealDb++
  } finally {
    console.log('\n[Dọn dẹp tài nguyên & Quản lý tiến trình trong finally]')

    // 1. Dọn dẹp fixtures trong MySQL test database bằng tài khoản writer
    if (fixtureConn) {
      try {
        await fixtureConn.execute(`DELETE FROM shops WHERE slug = ?`, [FIXTURES.seller.shopSlug])
        await fixtureConn.execute(
          `DELETE FROM users WHERE username IN (?, ?, ?, ?, ?, ?, ?)`,
          [
            FIXTURES.buyer.username,
            FIXTURES.seller.username,
            FIXTURES.blocked.username,
            FIXTURES.bigint.username,
            FIXTURES.buyerPlus.username,
            FIXTURES.buyerEmail.username,
            FIXTURES.buyer50Char.username,
          ],
        )
        console.log(`  -> Đã dọn sạch 7 tài khoản fixture và shop khỏi ${dbConfig.database}.`)
      } catch (e) {
        console.error('  [Lỗi dọn DB fixture]:', e.message)
      }
      try {
        await fixtureConn.end()
      } catch {}
    }

    // 2. Kiểm tra lại shopnova_dev để xác nhận không bị ảnh hưởng
    if (devStatusBefore) {
      try {
        const devConn = await mysql.createConnection({
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.dataApiUser,
          password: dbConfig.dataApiPassword,
          database: 'shopnova_dev',
        })
        const [rows] = await devConn.query('SELECT COUNT(*) AS userCount FROM users')
        const [tableStatus] = await devConn.query(
          "SELECT AUTO_INCREMENT FROM information_schema.tables WHERE table_schema = 'shopnova_dev' AND table_name = 'users'"
        )
        devStatusAfter = {
          userCount: Number(rows[0].userCount),
          autoIncrement: tableStatus[0]?.AUTO_INCREMENT ? String(tableStatus[0].AUTO_INCREMENT) : 'unknown',
        }
        await devConn.end()
        console.log(`  -> Đối chiếu shopnova_dev sau test: ${devStatusAfter.userCount} users (ban đầu: ${devStatusBefore.userCount}), AUTO_INCREMENT = ${devStatusAfter.autoIncrement} (ban đầu: ${devStatusBefore.autoIncrement})`)
        if (devStatusBefore.userCount === devStatusAfter.userCount && devStatusBefore.autoIncrement === devStatusAfter.autoIncrement) {
          console.log('  -> XÁC NHẬN: shopnova_dev hoàn toàn không bị ảnh hưởng bởi toàn bộ quá trình kiểm thử!')
        } else {
          console.warn('  -> CẢNH BÁO: shopnova_dev có sự thay đổi chỉ số!')
        }
      } catch (e) {
        console.log(`  -> (Không thể đối chiếu lại shopnova_dev: ${e.message})`)
      }
    }

    // 3. Dừng tất cả tiến trình con an toàn
    for (const child of Array.from(trackedProcesses)) {
      try {
        await stopProcess(child)
      } catch {}
    }
    console.log('  -> Toàn bộ child processes đã được dừng và thu hồi socket an toàn.')

    // 4. Xóa toàn bộ timers đang chạy
    for (const timer of Array.from(trackedTimers)) {
      clearTimeout(timer)
      trackedTimers.delete(timer)
    }

    // 5. Đóng mock server nếu còn mở
    if (mockServer) {
      try {
        await new Promise((resolve) => mockServer.close(resolve))
      } catch {}
    }
  }

  console.log('\n=== TỔNG KẾT KẾT QUẢ KIỂM THỬ AUTH & PHÂN QUYỀN (BE-003A-R1) ===')
  console.log(`[MySQL Thật (${dbConfig.database})] PASS: ${passedRealDb} | FAIL: ${failedRealDb}`)
  console.log(`[Mock Upstream / Contracts] PASS: ${passedMock} | FAIL: ${failedMock}`)
  const totalPassed = passedRealDb + passedMock
  const totalFailed = failedRealDb + failedMock
  console.log(`[Tổng cộng] PASS: ${totalPassed} | FAIL: ${totalFailed}`)

  if (totalFailed > 0) {
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ bài kiểm thử tích hợp Auth và Phân quyền BE-003A-R1 đều ĐẠT (PASS)!')
    process.exit(0)
  }
}

runAllAuthTests().catch((err) => {
  console.error('[Top-level Error]:', err)
  process.exit(1)
})
