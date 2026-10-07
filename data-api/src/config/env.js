import fs from 'node:fs'
import path from 'node:path'
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
export function parseAndValidateEnv(sourceEnv = process.env, shouldExitOnError = true) {
  const fail = (message) => {
    if (shouldExitOnError) {
      console.error(message)
      process.exit(1)
    }
    throw new Error(message)
  }

  // 1. Kiểm tra HOST (Mặc định: '127.0.0.1')
  const host = (sourceEnv.HOST || '127.0.0.1').trim()
  if (!host) {
    fail('[Lỗi cấu hình] HOST không được để trống.')
  }

  // 2. Kiểm tra PORT (Mặc định: 3001)
  const rawPort = sourceEnv.PORT || '3001'
  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`[Lỗi cấu hình] PORT không hợp lệ: "${rawPort}". PORT phải là số nguyên từ 1 đến 65535.`)
  }

  // 3. Kiểm tra NODE_ENV (Mặc định: 'development')
  const rawNodeEnv = (sourceEnv.NODE_ENV || 'development').trim()
  const allowedNodeEnvs = ['development', 'test', 'production']
  if (!allowedNodeEnvs.includes(rawNodeEnv)) {
    fail(
      `[Lỗi cấu hình] NODE_ENV không hợp lệ: "${rawNodeEnv}". Chỉ chấp nhận: ${allowedNodeEnvs.join(', ')}.`,
    )
  }

  // 4. Kiểm tra cấu hình CSDL MySQL (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
  const dbHost = (sourceEnv.DB_HOST || '127.0.0.1').trim()
  if (!dbHost) {
    fail('[Lỗi cấu hình] DB_HOST không được để trống.')
  }

  const rawDbPort = sourceEnv.DB_PORT || '3306'
  const dbPort = Number(rawDbPort)
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    fail(`[Lỗi cấu hình] DB_PORT không hợp lệ: "${rawDbPort}". DB_PORT phải là số nguyên từ 1 đến 65535.`)
  }

  const dbName = (sourceEnv.DB_NAME || 'shopnova_dev').trim()
  if (!dbName) {
    fail('[Lỗi cấu hình] DB_NAME không được để trống.')
  }

  const dbUser = (sourceEnv.DB_USER || '').trim()
  if (!dbUser) {
    fail('[Lỗi cấu hình] Thiếu biến môi trường bắt buộc: DB_USER.')
  }

  // Secret bắt buộc: DB_PASSWORD (không rỗng, không placeholder)
  const dbPassword = sourceEnv.DB_PASSWORD
  if (!isValidSecret(dbPassword)) {
    fail(
      '[Lỗi cấu hình] Biến môi trường DB_PASSWORD không hợp lệ (không được để trống, chỉ chứa khoảng trắng hoặc dùng giá trị mẫu placeholder).',
    )
  }

  // Secret bắt buộc: DATA_API_KEY (không rỗng, không placeholder)
  const dataApiKey = sourceEnv.DATA_API_KEY
  if (!isValidSecret(dataApiKey)) {
    fail(
      '[Lỗi cấu hình] Biến môi trường DATA_API_KEY không hợp lệ (không được để trống, chỉ chứa khoảng trắng hoặc dùng giá trị mẫu placeholder).',
    )
  }

  // 5. Ngân sách thời gian kiểm tra readiness CSDL (Mặc định: 3000 ms, bắt buộc < 5000 ms của Backend)
  const rawReadinessTimeout = sourceEnv.DB_READINESS_TIMEOUT_MS || '3000'
  const dbReadinessTimeoutMs = Number(rawReadinessTimeout)
  if (!Number.isInteger(dbReadinessTimeoutMs) || dbReadinessTimeoutMs < 200 || dbReadinessTimeoutMs >= 5000) {
    fail(
      `[Lỗi cấu hình] DB_READINESS_TIMEOUT_MS không hợp lệ: "${rawReadinessTimeout}". Phải là số nguyên từ 200 đến 4999 (ms) để đảm bảo nhỏ hơn timeout Backend 5000ms.`,
    )
  }

  // 6. Kiểm tra cấu hình kết nối TLS / SSL cho CSDL (DB_SSL_ENABLED, DB_SSL_CA)
  const rawSslEnabled = (sourceEnv.DB_SSL_ENABLED !== undefined && sourceEnv.DB_SSL_ENABLED !== '')
    ? String(sourceEnv.DB_SSL_ENABLED).trim().toLowerCase()
    : 'false'

  if (rawSslEnabled !== 'true' && rawSslEnabled !== 'false') {
    fail(
      '[Lỗi cấu hình] Biến môi trường DB_SSL_ENABLED không hợp lệ. Chỉ chấp nhận giá trị: "true" hoặc "false".',
    )
  }
  const dbSslEnabled = rawSslEnabled === 'true'

  let dbSslCa = null
  let dbSslCaContent = null

  if (dbSslEnabled) {
    const rawCa = sourceEnv.DB_SSL_CA
    if (!rawCa || typeof rawCa !== 'string' || rawCa.trim().length === 0) {
      fail('[Lỗi cấu hình] Thiếu biến môi trường bắt buộc: DB_SSL_CA khi DB_SSL_ENABLED là true.')
    }

    const trimmedCa = rawCa.trim()
    const resolvedCaPath = path.isAbsolute(trimmedCa)
      ? trimmedCa
      : path.resolve(process.cwd(), trimmedCa)

    if (!fs.existsSync(resolvedCaPath)) {
      fail('[Lỗi cấu hình] File chứng chỉ DB_SSL_CA không tồn tại hoặc không đọc được.')
    }

    let fileContent = ''
    try {
      fileContent = fs.readFileSync(resolvedCaPath, 'utf8')
    } catch {
      fail('[Lỗi cấu hình] File chứng chỉ DB_SSL_CA không tồn tại hoặc không đọc được.')
    }

    if (
      !fileContent ||
      fileContent.trim().length === 0 ||
      !fileContent.includes('-----BEGIN CERTIFICATE-----')
    ) {
      fail('[Lỗi cấu hình] File chứng chỉ DB_SSL_CA không hợp lệ (yêu cầu định dạng chứng chỉ PEM).')
    }

    dbSslCa = trimmedCa
    dbSslCaContent = fileContent
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
    dbSslEnabled,
    dbSslCa,
    dbSslCaContent,
  })
}

export const env = parseAndValidateEnv()
