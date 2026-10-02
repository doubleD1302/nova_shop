import dotenv from 'dotenv'

// Nạp các biến môi trường từ file .env nếu có (cho phép override đường dẫn khi chạy test cô lập)
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || undefined })

// Danh sách các giá trị placeholder mẫu không được phép dùng trong cấu hình thực tế
const FORBIDDEN_PLACEHOLDERS = Object.freeze([
  'your_service_key_here',
  'your_api_key_here',
  'your_secret_key_here',
  'your_data_api_key_here',
  'your_db_password_here',
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
 * Đọc và kiểm tra tính hợp lệ của cấu hình môi trường cho Backend.
 * Nếu cấu hình không hợp lệ, hệ thống sẽ in thông báo lỗi rõ ràng và dừng tiến trình.
 * Thông báo lỗi chỉ nêu tên biến môi trường, tuyệt đối không in giá trị secret ra console/log.
 */
function parseAndValidateEnv() {
  // 1. Kiểm tra PORT (Mặc định: 3000)
  const rawPort = process.env.PORT || '3000'
  const port = Number(rawPort)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`[Lỗi cấu hình] PORT không hợp lệ: "${rawPort}". PORT phải là số nguyên từ 1 đến 65535.`)
    process.exit(1)
  }

  // 2. Kiểm tra NODE_ENV (Mặc định: 'development')
  const rawNodeEnv = (process.env.NODE_ENV || 'development').trim()
  const allowedNodeEnvs = ['development', 'test', 'production']

  if (!allowedNodeEnvs.includes(rawNodeEnv)) {
    console.error(
      `[Lỗi cấu hình] NODE_ENV không hợp lệ: "${rawNodeEnv}". Chỉ chấp nhận: ${allowedNodeEnvs.join(', ')}.`,
    )
    process.exit(1)
  }

  // 3. Kiểm tra CORS_ORIGINS (Mặc định cho phép Vite dev server tại cổng 5173)
  const rawCors = process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
  const corsOrigins = rawCors
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

  if (corsOrigins.length === 0) {
    console.error('[Lỗi cấu hình] CORS_ORIGINS không được để trống. Cần ít nhất 1 origin hợp lệ.')
    process.exit(1)
  }

  // 4. Kiểm tra DATA_API_URL (Mặc định: 'http://127.0.0.1:3001')
  // DATA_API_URL là base URL của dịch vụ, không chứa /internal/v1. Chỉ chấp nhận http/https, không chứa user/pass, query, fragment.
  const rawDataApiUrl = process.env.DATA_API_URL !== undefined
    ? process.env.DATA_API_URL.trim()
    : 'http://127.0.0.1:3001'

  if (!rawDataApiUrl) {
    console.error('[Lỗi cấu hình] DATA_API_URL không được để trống.')
    process.exit(1)
  }

  let parsedUrl
  try {
    parsedUrl = new URL(rawDataApiUrl)
  } catch {
    console.error('[Lỗi cấu hình] DATA_API_URL không phải là một URL hợp lệ.')
    process.exit(1)
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    console.error('[Lỗi cấu hình] DATA_API_URL phải có giao thức http hoặc https.')
    process.exit(1)
  }

  if (parsedUrl.username || parsedUrl.password) {
    console.error('[Lỗi cấu hình] DATA_API_URL không được chứa username hoặc password.')
    process.exit(1)
  }

  if (parsedUrl.search || parsedUrl.hash) {
    console.error('[Lỗi cấu hình] DATA_API_URL không được chứa query string hoặc fragment (#).')
    process.exit(1)
  }

  if (parsedUrl.pathname.includes('/internal/v1')) {
    console.error('[Lỗi cấu hình] DATA_API_URL là base URL của dịch vụ, không được chứa /internal/v1.')
    process.exit(1)
  }

  // Chuẩn hóa base URL: loại bỏ dấu gạch chéo cuối nếu có
  const dataApiUrl = parsedUrl.origin + (parsedUrl.pathname === '/' ? '' : parsedUrl.pathname.replace(/\/+$/, ''))

  // 5. Kiểm tra DATA_API_KEY (Bắt buộc, không được để trống, chỉ chứa khoảng trắng hoặc placeholder)
  const dataApiKey = process.env.DATA_API_KEY
  if (!isValidSecret(dataApiKey)) {
    console.error(
      '[Lỗi cấu hình] Biến môi trường DATA_API_KEY không hợp lệ (không được để trống, chỉ chứa khoảng trắng hoặc dùng giá trị mẫu placeholder).',
    )
    process.exit(1)
  }

  return Object.freeze({
    port,
    nodeEnv: rawNodeEnv,
    corsOrigins,
    dataApiUrl,
    dataApiKey: dataApiKey.trim(),
  })
}

export const env = parseAndValidateEnv()
