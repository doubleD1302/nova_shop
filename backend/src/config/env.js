import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendEnvPath = path.resolve(__dirname, '../../.env')

// Nạp các biến môi trường từ đúng file backend/.env (cho phép override đường dẫn khi chạy test cô lập)
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || backendEnvPath })

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

  // 3. Kiểm tra CORS_ORIGINS (Cho phép Vite dev server dùng cổng 5173 hoặc 5174)
  const rawCors = process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174'
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

  // 6. Kiểm tra JWT_SECRET (Bắt buộc, độ dài tối thiểu 32 ký tự, không được để trống hoặc dùng placeholder)
  const jwtSecret = process.env.JWT_SECRET
  if (!isValidSecret(jwtSecret) || jwtSecret.trim().length < 32) {
    console.error(
      '[Lỗi cấu hình] Biến môi trường JWT_SECRET không hợp lệ (phải có độ dài tối thiểu 32 ký tự và không dùng giá trị mẫu placeholder).',
    )
    process.exit(1)
  }

  const uploadStorage = (process.env.UPLOAD_STORAGE || 'local').trim().toLowerCase()
  if (!['local', 's3'].includes(uploadStorage)) {
    console.error('[Lỗi cấu hình] UPLOAD_STORAGE chỉ chấp nhận local hoặc s3.')
    process.exit(1)
  }

  const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  const uploadDir = path.resolve(process.env.UPLOAD_DIR?.trim() || path.join(backendDir, 'uploads'))
  const rawFirebaseServiceAccount = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim()
  let firebaseServiceAccount = null

  if (rawFirebaseServiceAccount) {
    try {
      const parsed = JSON.parse(rawFirebaseServiceAccount)
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.project_id !== 'string' ||
        typeof parsed.client_email !== 'string' ||
        typeof parsed.private_key !== 'string'
      ) {
        throw new Error('invalid service account shape')
      }
      firebaseServiceAccount = {
        projectId: parsed.project_id.trim(),
        clientEmail: parsed.client_email.trim(),
        privateKey: parsed.private_key.replace(/\\n/g, '\n'),
      }
      if (!firebaseServiceAccount.projectId || !firebaseServiceAccount.clientEmail || !firebaseServiceAccount.privateKey) {
        throw new Error('empty service account field')
      }
    } catch {
      console.error('[Lỗi cấu hình] FIREBASE_SERVICE_ACCOUNT_JSON phải là JSON Service Account hợp lệ của Firebase.')
      process.exit(1)
    }
  }

  const firebaseProjectId = (
    process.env.FIREBASE_PROJECT_ID ||
    firebaseServiceAccount?.projectId ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    ''
  ).trim()
  const s3Bucket = (process.env.S3_BUCKET || '').trim()
  const s3Region = (process.env.S3_REGION || 'us-east-1').trim()
  const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID
  const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const rawS3Endpoint = (process.env.S3_ENDPOINT || '').trim()
  const rawForcePathStyle = (process.env.S3_FORCE_PATH_STYLE || 'false').trim().toLowerCase()

  if (rawForcePathStyle !== 'true' && rawForcePathStyle !== 'false') {
    console.error('[Lỗi cấu hình] S3_FORCE_PATH_STYLE chỉ chấp nhận true hoặc false.')
    process.exit(1)
  }

  let s3Endpoint = ''
  if (rawS3Endpoint) {
    let parsedEndpoint
    try {
      parsedEndpoint = new URL(rawS3Endpoint)
    } catch {
      console.error('[Lỗi cấu hình] S3_ENDPOINT không phải là một URL hợp lệ.')
      process.exit(1)
    }
    if (
      !['http:', 'https:'].includes(parsedEndpoint.protocol) ||
      parsedEndpoint.username || parsedEndpoint.password ||
      parsedEndpoint.search || parsedEndpoint.hash ||
      (parsedEndpoint.pathname !== '/' && parsedEndpoint.pathname !== '') ||
      (rawNodeEnv === 'production' && parsedEndpoint.protocol !== 'https:')
    ) {
      console.error('[Lỗi cấu hình] S3_ENDPOINT phải là origin HTTP(S) hợp lệ; production bắt buộc dùng HTTPS.')
      process.exit(1)
    }
    s3Endpoint = parsedEndpoint.origin
  }

  if (uploadStorage === 's3' && (
    !s3Bucket || !s3Region || !isValidSecret(s3AccessKeyId) || !isValidSecret(s3SecretAccessKey)
  )) {
    console.error('[Lỗi cấu hình] UPLOAD_STORAGE=s3 yêu cầu S3_BUCKET, S3_ACCESS_KEY_ID và S3_SECRET_ACCESS_KEY hợp lệ.')
    process.exit(1)
  }

  // 10. Cấu hình dịch vụ gửi email cảnh cáo vi phạm (SMTP)
  const smtpHost = (process.env.SMTP_HOST || '').trim()
  const rawSmtpPort = (process.env.SMTP_PORT || '587').trim()
  const smtpPort = Number(rawSmtpPort) || 587
  const smtpSecure = (process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true'
  const smtpUser = (process.env.SMTP_USER || '').trim()
  const rawSmtpPass = (process.env.SMTP_PASS || '').trim()
  const smtpPass = rawSmtpPass.replace(/^["']|["']$/g, '').replace(/\s+/g, '')
  const smtpFrom = (process.env.SMTP_FROM || 'Nova Shop <no-reply@novashop.vn>').trim()

  return Object.freeze({
    port,
    nodeEnv: rawNodeEnv,
    corsOrigins,
    dataApiUrl,
    dataApiKey: dataApiKey.trim(),
    jwtSecret: jwtSecret.trim(),
    uploadStorage,
    uploadDir,
    s3Bucket,
    s3Region,
    s3AccessKeyId: s3AccessKeyId?.trim() || '',
    s3SecretAccessKey: s3SecretAccessKey?.trim() || '',
    s3Endpoint,
    s3ForcePathStyle: rawForcePathStyle === 'true',
    firebaseServiceAccount,
    firebaseProjectId,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom,
    isSmtpConfigured: Boolean(smtpHost && smtpUser && smtpPass),
    geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  })
}

export const env = parseAndValidateEnv()
