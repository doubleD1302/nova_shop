import http from 'node:http'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import bcrypt from '../../data-api/node_modules/bcryptjs/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.NODE_ENV = 'test'
process.env.PORT = '3000'
process.env.DOTENV_CONFIG_PATH = path.resolve(__dirname, '../../data-api/.env')

// 1. Nạp cấu hình Data API và kết nối CSDL MySQL thật
const { env: dataEnv } = await import('../../data-api/src/config/env.js')
const { default: dataApiApp } = await import('../../data-api/src/app.js')
const { executeQuery, sequelize } = await import('../../data-api/src/config/database.js')

// 2. Khởi động Data API test server trên cổng ngẫu nhiên
const dataApiServer = http.createServer(dataApiApp)
await new Promise((resolve, reject) => {
  dataApiServer.listen(0, '127.0.0.1', () => resolve())
  dataApiServer.on('error', reject)
})
const dataApiPort = dataApiServer.address().port
const dataApiUrl = `http://127.0.0.1:${dataApiPort}`

// 3. Thiết lập biến môi trường cho Backend kết nối Data API
process.env.DATA_API_URL = dataApiUrl
process.env.DATA_API_KEY = dataEnv.dataApiKey
process.env.JWT_SECRET = 'be003b_refresh_password_test_jwt_secret_min_32_chars_123'

// 4. Nạp Backend App và Auth helper
const { default: backendApp } = await import('../src/app.js')
const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')

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
  console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP BE-003B: REFRESH TOKEN & ĐỔI MẬT KHẨU ===\n')
  console.log(`[Test] Data API test server: ${dataApiUrl}`)

  // Khởi động Backend test server trên cổng ngẫu nhiên
  const backendServer = http.createServer(backendApp)
  await new Promise((resolve, reject) => {
    backendServer.listen(0, '127.0.0.1', () => resolve())
    backendServer.on('error', reject)
  })
  const backendPort = backendServer.address().port
  const backendUrl = `http://127.0.0.1:${backendPort}`
  console.log(`[Test] Backend test server: ${backendUrl}\n`)

  const testUsername = `user_be003b_${Date.now()}`
  const initialPassword = 'InitialPassword123!'
  const changedPassword = 'NewSecretPassword456!'
  let testUserId = null

  try {
    // -------------------------------------------------------------
    // Bước 0: Tạo tài khoản test trực tiếp trong MySQL
    // -------------------------------------------------------------
    console.log('--- 0. Chuẩn bị tài khoản test trong MySQL ---')
    const hash = await bcrypt.hash(initialPassword, 12)
    const insertRes = await executeQuery(
      `INSERT INTO users (username, password_hash, full_name, email, role, status)
       VALUES (?, ?, ?, ?, 'buyer', 'active')`,
      [testUsername, hash, 'Test BE-003B User', `${testUsername}@example.com`],
    )
    testUserId = String(insertRes.insertId)
    console.log(`  -> Đã tạo user ID: ${testUserId}, username: ${testUsername}\n`)

    // -------------------------------------------------------------
    // Nhóm 1: Đăng nhập cấp phát Access Token (15p) & Refresh Token (7 ngày)
    // -------------------------------------------------------------
    console.log('--- 1. Kiểm tra đăng nhập và lưu phiên đăng nhập (Sessions) ---')
    let firstAccessToken = null
    let firstRefreshToken = null

    {
      const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: testUsername, password: initialPassword }),
      })
      const body = await res.json()

      assert(res.status === 200, 'Đăng nhập thành công trả về HTTP 200')
      assert(body.success === true, 'Phản hồi có success === true')
      assert(typeof body.data?.token === 'string' && body.data.token.length > 20, 'Nhận được access token JWT')
      assert(body.data?.expiresIn === 900, 'Access token có thời hạn 900 giây (15 phút)')
      assert(typeof body.data?.refreshToken === 'string' && body.data.refreshToken.length === 64, 'Nhận được refreshToken ngẫu nhiên 64 ký tự hex')

      firstAccessToken = body.data.token
      firstRefreshToken = body.data.refreshToken

      // Kiểm tra trong database sessions
      const tokenHash = crypto.createHash('sha256').update(firstRefreshToken).digest('hex')
      const sessions = await executeQuery(
        `SELECT id, user_id, token_hash, expires_at, revoked_at FROM sessions WHERE token_hash = ?`,
        [tokenHash],
      )
      assert(sessions.length === 1, 'Bảng sessions có chính xác 1 bản ghi khớp với SHA-256 token_hash')
      assert(String(sessions[0].user_id) === testUserId, 'Session thuộc đúng user_id')
      assert(sessions[0].revoked_at === null, 'Session mới khởi tạo có revoked_at === null (chưa bị thu hồi)')
      assert(new Date(sessions[0].expires_at).getTime() > Date.now(), 'Session có hạn expires_at ở tương lai (7 ngày)')
    }

    // -------------------------------------------------------------
    // Nhóm 2: Làm mới phiên đăng nhập (POST /api/v1/auth/refresh)
    // -------------------------------------------------------------
    console.log('\n--- 2. Kiểm tra làm mới phiên đăng nhập (Refresh Token Rotation) ---')
    let secondAccessToken = null
    let secondRefreshToken = null

    {
      const res = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: firstRefreshToken }),
      })
      const body = await res.json()

      assert(res.status === 200, 'POST /api/v1/auth/refresh trả về HTTP 200')
      assert(body.success === true, 'Làm mới phiên có success === true')
      assert(typeof body.data?.token === 'string' && body.data.token.length > 20, 'Cấp access token mới')
      assert(typeof body.data?.refreshToken === 'string' && body.data.refreshToken.length === 64, 'Cấp refreshToken mới (Rotation)')
      assert(body.data.refreshToken !== firstRefreshToken, 'Refresh token mới khác refresh token cũ')

      secondAccessToken = body.data.token
      secondRefreshToken = body.data.refreshToken

      // Kiểm tra rotation trong CSDL: phiên cũ bị thu hồi, phiên mới đang hoạt động
      const oldHash = crypto.createHash('sha256').update(firstRefreshToken).digest('hex')
      const newHash = crypto.createHash('sha256').update(secondRefreshToken).digest('hex')

      const oldSessions = await executeQuery('SELECT revoked_at FROM sessions WHERE token_hash = ?', [oldHash])
      assert(oldSessions[0].revoked_at !== null, 'Phiên cũ đã được thu hồi (revoked_at IS NOT NULL)')

      const newSessions = await executeQuery('SELECT revoked_at FROM sessions WHERE token_hash = ?', [newHash])
      assert(newSessions[0].revoked_at === null, 'Phiên mới đang hoạt động (revoked_at IS NULL)')

      // Sử dụng access token mới gọi GET /api/v1/auth/me thành công
      const meRes = await fetch(`${backendUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${secondAccessToken}` },
      })
      const meBody = await meRes.json()
      assert(meRes.status === 200, 'Dùng access token mới gọi GET /api/v1/auth/me thành công (HTTP 200)')
      assert(meBody.data?.user?.id === testUserId, 'Lấy đúng hồ sơ tài khoản từ token mới')
    }

    // -------------------------------------------------------------
    // Nhóm 3: Bảo mật chống dùng lại Refresh Token cũ (Token Reuse Detection)
    // -------------------------------------------------------------
    console.log('\n--- 3. Kiểm tra an toàn bảo mật token (Ngăn chặn dùng lại token đã thu hồi) ---')
    {
      // Dùng lại firstRefreshToken (đã bị rotate)
      const res = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: firstRefreshToken }),
      })
      const body = await res.json()
      assert(res.status === 401, 'Dùng lại refresh token cũ đã thu hồi bị từ chối với HTTP 401')
      assert(body.error?.code === 'AUTH_EXPIRED', 'Mã lỗi là AUTH_EXPIRED')
    }

    {
      // Dùng refresh token rác / không tồn tại
      const fakeToken = crypto.randomBytes(32).toString('hex')
      const res = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: fakeToken }),
      })
      const body = await res.json()
      assert(res.status === 401, 'Dùng refresh token không tồn tại bị từ chối với HTTP 401')
      assert(body.error?.code === 'AUTH_EXPIRED', 'Mã lỗi là AUTH_EXPIRED')
    }

    // -------------------------------------------------------------
    // Nhóm 4: Đổi mật khẩu tài khoản (POST /api/v1/auth/change-password)
    // -------------------------------------------------------------
    console.log('\n--- 4. Kiểm tra đổi mật khẩu và thu hồi phiên toàn bộ thiết bị ---')

    {
      // 4.1 Sai mật khẩu hiện tại
      const res = await fetch(`${backendUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secondAccessToken}`,
        },
        body: JSON.stringify({
          currentPassword: 'WrongPassword123!',
          newPassword: changedPassword,
        }),
      })
      const body = await res.json()
      assert(res.status === 401, 'Sai mật khẩu hiện tại trả HTTP 401')
      assert(body.error?.code === 'INVALID_CREDENTIALS', 'Mã lỗi là INVALID_CREDENTIALS')
    }

    {
      // 4.2 Mật khẩu mới quá ngắn (< 8 ký tự)
      const res = await fetch(`${backendUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secondAccessToken}`,
        },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword: 'short',
        }),
      })
      const body = await res.json()
      assert(res.status === 400, 'Mật khẩu mới ngắn hơn 8 ký tự trả HTTP 400')
      assert(body.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR')
    }

    {
      // 4.3 Mật khẩu mới trùng mật khẩu hiện tại
      const res = await fetch(`${backendUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secondAccessToken}`,
        },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword: initialPassword,
        }),
      })
      const body = await res.json()
      assert(res.status === 400, 'Mật khẩu mới trùng mật khẩu cũ trả HTTP 400')
      assert(body.error?.code === 'VALIDATION_ERROR', 'Mã lỗi là VALIDATION_ERROR')
    }

    let thirdAccessToken = null
    let thirdRefreshToken = null

    {
      // 4.4 Đổi mật khẩu hợp lệ thành công
      const res = await fetch(`${backendUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secondAccessToken}`,
        },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword: changedPassword,
        }),
      })
      const body = await res.json()
      assert(res.status === 200, 'Đổi mật khẩu thành công trả HTTP 200')
      assert(body.success === true, 'Phản hồi đổi mật khẩu có success === true')
      assert(typeof body.data?.token === 'string', 'Nhận được access token phiên mới')
      assert(typeof body.data?.refreshToken === 'string', 'Nhận được refresh token phiên mới')

      thirdAccessToken = body.data.token
      thirdRefreshToken = body.data.refreshToken

      // Kiểm tra CSDL: mật khẩu mới đã được cập nhật
      const users = await executeQuery('SELECT password_hash FROM users WHERE id = ?', [testUserId])
      const isNewMatch = await bcrypt.compare(changedPassword, users[0].password_hash)
      assert(isNewMatch === true, 'Mật khẩu trong CSDL đã được cập nhật khớp với mật khẩu mới')

      // Kiểm tra CSDL: toàn bộ phiên cũ (kể cả secondRefreshToken) đã bị thu hồi
      const prevHash = crypto.createHash('sha256').update(secondRefreshToken).digest('hex')
      const prevSession = await executeQuery('SELECT revoked_at FROM sessions WHERE token_hash = ?', [prevHash])
      assert(prevSession[0].revoked_at !== null, 'Phiên đăng nhập cũ trước đó đã bị thu hồi sau khi đổi mật khẩu')

      // Thử dùng secondRefreshToken để refresh -> phải bị từ chối
      const refreshOld = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: secondRefreshToken }),
      })
      assert(refreshOld.status === 401, 'Refresh token trước khi đổi mật khẩu bị vô hiệu hóa hoàn toàn')

      // Đăng nhập bằng mật khẩu cũ -> thất bại
      const loginOld = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: testUsername, password: initialPassword }),
      })
      assert(loginOld.status === 401, 'Đăng nhập bằng mật khẩu cũ bị từ chối 401')

      // Đăng nhập bằng mật khẩu mới -> thành công
      const loginNew = await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: testUsername, password: changedPassword }),
      })
      assert(loginNew.status === 200, 'Đăng nhập bằng mật khẩu mới thành công (HTTP 200)')
    }

    // -------------------------------------------------------------
    // Nhóm 5: Đăng xuất và thu hồi phiên (POST /api/v1/auth/logout)
    // -------------------------------------------------------------
    console.log('\n--- 5. Kiểm tra đăng xuất và thu hồi phiên ---')
    {
      const res = await fetch(`${backendUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${thirdAccessToken}`,
        },
        body: JSON.stringify({ refreshToken: thirdRefreshToken }),
      })
      const body = await res.json()
      assert(res.status === 200, 'POST /api/v1/auth/logout trả về HTTP 200')
      assert(body.success === true, 'Đăng xuất có success === true')

      // Kiểm tra CSDL: session đã bị thu hồi
      const activeHash = crypto.createHash('sha256').update(thirdRefreshToken).digest('hex')
      const sess = await executeQuery('SELECT revoked_at FROM sessions WHERE token_hash = ?', [activeHash])
      assert(sess[0].revoked_at !== null, 'Phiên đăng xuất đã được đánh dấu revoked_at trong CSDL')

      // Thử refresh bằng token vừa đăng xuất -> thất bại 401
      const refreshLoggedOut = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: thirdRefreshToken }),
      })
      assert(refreshLoggedOut.status === 401, 'Không thể làm mới phiên sau khi đã đăng xuất')
    }

  } finally {
    // Dọn dẹp tài khoản test và các phiên liên quan
    if (testUserId) {
      try {
        await executeQuery('DELETE FROM sessions WHERE user_id = ?', [testUserId])
        await executeQuery('DELETE FROM users WHERE id = ?', [testUserId])
        console.log(`\n[Cleanup] Đã dọn dẹp tài khoản test ID: ${testUserId} và các phiên an toàn.`)
      } catch (cleanupErr) {
        console.warn('[Cleanup Warning] Không thể dọn dẹp:', cleanupErr.message)
      }
    }

    // Đóng servers
    backendServer.close()
    dataApiServer.close()
    await sequelize.close()
    console.log('[Cleanup] Đã đóng test servers và kết nối MySQL an toàn.')
  }

  console.log('\n=== TỔNG KẾT KẾT QUẢ KIỂM THỬ BE-003B ===')
  console.log(`Số bài kiểm tra vượt qua (PASS): ${passed}`)
  console.log(`Số bài kiểm tra thất bại  (FAIL): ${failed}`)

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('\n[Lỗi nghiêm trọng trong kiểm thử]:', err)
  process.exit(1)
})
