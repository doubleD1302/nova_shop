import dotenv from 'dotenv'

// Nạp các biến môi trường từ file .env nếu có (cho phép override đường dẫn khi chạy test cô lập)
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || undefined })

// Danh sách các giá trị placeholder mẫu không được phép dùng trong cấu hình thực tế
const FORBIDDEN_PLACEHOLDERS = Object.freeze([
  'your_service_key_here',
  'your_db_password_here',
  'your_password_here',
  'your_api_key_here',
  'change_me',
  'secret',
  'password',
])

/**
 * Kiểm tra xem một giá trị secret có hợp lệ hay không:
 * - Phải là chuỗi string
 * - Không được rỗng hoặc chỉ toàn khoảng trắng
 * - Không được trùng với các placeholder mẫu bị cấm
 */
function isValidSecret(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  if (FORBIDDEN_PLACEHOLDERS.includes(trimmed.toLowerCase())) return false
  return true
}

/**
 * Đọc và kiểm tra tính hợp lệ của cấu hình môi trường cho Data API.
 * Các biến secret bắt buộc phải có giá trị thực, không chấp nhận placeholder hoặc chuỗi rỗng.
 * Thông báo lỗi chỉ nêu tên biến môi trường, tuyệt đối không in giá trị secret ra console/log.
 */
function parseAndValidateEnv() {
  // 1. Kiểm tra HOST (Mặc định: '127.0.0.1')
  const host = (process.env.HOST || '127.0.0.1').trim()
  if (!host) {
    console.error('[Lỗi cấu hình] HOST không được để trống.')
    process.exit(1)
  }

  // 2. Kiểm tra PORT (Mặc định: 3001)
  const rawPort = process.env.PORT || '3001'
  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`[Lỗi cấu hình] PORT không hợp lệ: "${rawPort}". PORT phải là số nguyên từ 1 đến 65535.`)
    process.exit(1)
  }

  // 3. Kiểm tra NODE_ENV (Mặc định: 'development')
  const rawNodeEnv = (process.env.NODE_ENV || 'development').trim()
  const allowedNodeEnvs = ['development', 'test', 'production']
  if (!allowedNodeEnvs.includes(rawNodeEnv)) {
    console.error(
      `[Lỗi cấu hình] NODE_ENV không hợp lệ: "${rawNodeEnv}". Chỉ chấp nhận: ${allowedNodeEnvs.join(', ')}.`,
    )
    process.exit(1)
  }

  // 4. Kiểm tra cấu hình CSDL MySQL (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
  const dbHost = (process.env.DB_HOST || '127.0.0.1').trim()
  if (!dbHost) {
    console.error('[Lỗi cấu hình] DB_HOST không được để trống.')
    process.exit(1)
  }

  const rawDbPort = process.env.DB_PORT || '3306'
  const dbPort = Number(rawDbPort)
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    console.error(`[Lỗi cấu hình] DB_PORT không hợp lệ: "${rawDbPort}". DB_PORT phải là số nguyên từ 1 đến 65535.`)
    process.exit(1)
  }

  const dbName = (process.env.DB_NAME || 'shopnova_dev').trim()
  if (!dbName) {
    console.error('[Lỗi cấu hình] DB_NAME không được để trống.')
    process.exit(1)
  }

  const dbUser = (process.env.DB_USER || '').trim()
  if (!dbUser) {
    console.error('[Lỗi cấu hình] Thiếu biến môi trường bắt buộc: DB_USER.')
    process.exit(1)
  }

  // Secret bắt buộc: DB_PASSWORD (không rỗng, không placeholder)
  const dbPassword = process.env.DB_PASSWORD
  if (!isValidSecret(dbPassword)) {
    console.error(
      '[Lỗi cấu hình] Biến môi trường DB_PASSWORD không hợp lệ (không được để trống, chỉ chứa khoảng trắng hoặc dùng giá trị mẫu placeholder).',
    )
    process.exit(1)
  }

  // Secret bắt buộc: DATA_API_KEY (không rỗng, không placeholder)
  const dataApiKey = process.env.DATA_API_KEY
  if (!isValidSecret(dataApiKey)) {
    console.error(
      '[Lỗi cấu hình] Biến môi trường DATA_API_KEY không hợp lệ (không được để trống, chỉ chứa khoảng trắng hoặc dùng giá trị mẫu placeholder).',
    )
    process.exit(1)
  }

  // 5. Ngân sách thời gian kiểm tra readiness CSDL (Mặc định: 3000 ms, bắt buộc < 5000 ms của Backend)
  const rawReadinessTimeout = process.env.DB_READINESS_TIMEOUT_MS || '3000'
  const dbReadinessTimeoutMs = Number(rawReadinessTimeout)
  if (!Number.isInteger(dbReadinessTimeoutMs) || dbReadinessTimeoutMs < 200 || dbReadinessTimeoutMs >= 5000) {
    console.error(
      `[Lỗi cấu hình] DB_READINESS_TIMEOUT_MS không hợp lệ: "${rawReadinessTimeout}". Phải là số nguyên từ 200 đến 4999 (ms) để đảm bảo nhỏ hơn timeout Backend 5000ms.`,
    )
    process.exit(1)
  }

  return Object.freeze({
    host,
    port,
    nodeEnv: rawNodeEnv,
    dbHost,
    dbPort,
    dbName,
    dbUser,
    dbPassword,
    dataApiKey: dataApiKey.trim(),
    dbReadinessTimeoutMs,
  })
}

export const env = parseAndValidateEnv()
