import { env } from '../config/env.js'

/**
 * Ngân sách thời gian tối đa cho mỗi lần gọi sang Data API nội bộ (5000ms).
 * Deadline này bao trùm toàn bộ quá trình: mở kết nối TCP, nhận headers, đọc toàn bộ body và parse JSON.
 */
const DATA_API_TIMEOUT_MS = 5000

/**
 * Giới hạn kích thước phản hồi tối đa từ Data API (1MiB).
 */
const MAX_RESPONSE_BYTES = 1024 * 1024 // 1MiB

/**
 * Lớp lỗi chuẩn cho HTTP client gọi Data API.
 */
export class DataApiClientError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'DataApiClientError'
    this.status = status
    this.code = code
  }
}

/**
 * Hàm gọi HTTP nội bộ tới Data API với quản lý deadline bao trùm và giới hạn kích thước phản hồi.
 * - URL và path cố định trong mã nguồn máy chủ, không lấy từ request của người dùng.
 * - Header x-service-key lấy từ cấu hình máy chủ (env.dataApiKey).
 * - Không tự động retry; không tự động redirect (redirect: 'manual').
 * - Deadline 5000ms bao phủ toàn bộ: connect, headers, streaming body, parse JSON.
 */
async function requestDataApi(endpointPath, options = {}) {
  const { method = 'GET', body = null } = options
  const url = `${env.dataApiUrl}${endpointPath}`
  const controller = new AbortController()
  let isTimedOut = false

  const timer = setTimeout(() => {
    isTimedOut = true
    try {
      controller.abort()
    } catch {}
  }, DATA_API_TIMEOUT_MS)

  const headers = {
    'x-service-key': env.dataApiKey,
    'Accept': 'application/json',
  }
  let payloadBody = undefined
  if (body !== null && body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payloadBody = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: payloadBody,
      redirect: 'manual',
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (isTimedOut || err?.name === 'AbortError') {
      throw new DataApiClientError(
        504,
        'DATA_API_TIMEOUT',
        'Hết thời gian chờ phản hồi từ dịch vụ dữ liệu nội bộ.',
      )
    }
    // Lỗi không kết nối được (ECONNREFUSED, ENOTFOUND, v.v.)
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Không thể kết nối tới dịch vụ dữ liệu nội bộ.',
    )
  }

  // 1. Kiểm tra redirect (chặn theo dõi chuyển hướng sang địa chỉ khác)
  if ((res.status >= 300 && res.status < 400) || res.type === 'opaqueredirect') {
    clearTimeout(timer)
    try {
      if (res.body) await res.body.cancel()
    } catch {}
    controller.abort()
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn (chuyển hướng không được hỗ trợ).',
    )
  }

  // 2. Đọc toàn bộ body có kiểm soát dung lượng (tối đa 1MiB) dưới cùng một deadline timer
  let bodyBuffer
  try {
    if (!res.body) {
      bodyBuffer = Buffer.alloc(0)
    } else {
      const reader = res.body.getReader()
      const chunks = []
      let totalBytes = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.length
        if (totalBytes > MAX_RESPONSE_BYTES) {
          try {
            await reader.cancel()
          } catch {}
          controller.abort()
          throw new DataApiClientError(
            502,
            'DATA_API_BAD_RESPONSE',
            'Dung lượng phản hồi từ dịch vụ dữ liệu vượt quá giới hạn cho phép (1MB).',
          )
        }
        chunks.push(value)
      }
      bodyBuffer = Buffer.concat(chunks)
    }
  } catch (err) {
    clearTimeout(timer)
    if (isTimedOut || err?.name === 'AbortError') {
      throw new DataApiClientError(
        504,
        'DATA_API_TIMEOUT',
        'Hết thời gian chờ phản hồi từ dịch vụ dữ liệu nội bộ.',
      )
    }
    if (err instanceof DataApiClientError) {
      throw err
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Lỗi khi đọc dữ liệu từ dịch vụ dữ liệu nội bộ.',
    )
  }

  // 3. Phân tích cú pháp JSON trong khi timer vẫn đang bảo vệ
  let json
  try {
    const text = bodyBuffer.toString('utf8')
    json = JSON.parse(text)
  } catch {
    clearTimeout(timer)
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Dữ liệu phản hồi từ dịch vụ dữ liệu nội bộ không phải là JSON hợp lệ.',
    )
  } finally {
    // Chỉ hủy timer sau khi toàn bộ quá trình đọc và parse JSON đã kết thúc thành công
    clearTimeout(timer)
  }

  return {
    status: res.status,
    headers: res.headers,
    data: json,
  }
}

/**
 * Gọi endpoint kiểm tra liveness của Data API:
 * GET /internal/v1/health
 */
export async function fetchDataApiHealth() {
  const { status, data: json } = await requestDataApi('/internal/v1/health')

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status !== 200) {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
    )
  }

  // Thẩm định JSON envelope của health: success=true, service=shopnova-data-api, status=ok
  if (
    typeof json !== 'object' ||
    json === null ||
    json.success !== true ||
    typeof json.data !== 'object' ||
    json.data === null ||
    json.data.service !== 'shopnova-data-api' ||
    json.data.status !== 'ok'
  ) {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi liveness từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  return json.data
}

/**
 * Gọi endpoint kiểm tra readiness của Data API:
 * GET /internal/v1/ready
 */
export async function fetchDataApiReady() {
  const { status, data: json } = await requestDataApi('/internal/v1/ready')

  // Trường hợp 1: Data API trả 200 OK
  if (status === 200) {
    // Thẩm định JSON envelope của ready: success=true, service=shopnova-data-api, database=connected
    if (
      typeof json !== 'object' ||
      json === null ||
      json.success !== true ||
      typeof json.data !== 'object' ||
      json.data === null ||
      json.data.service !== 'shopnova-data-api' ||
      json.data.database !== 'connected'
    ) {
      throw new DataApiClientError(
        502,
        'DATA_API_BAD_RESPONSE',
        'Phản hồi readiness từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
      )
    }

    return json.data
  }

  // Trường hợp 2: Data API trả 503 DATABASE_UNAVAILABLE với envelope hợp lệ
  if (status === 503) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === false &&
      json.error?.code === 'DATABASE_UNAVAILABLE'
    ) {
      throw new DataApiClientError(
        503,
        'DATA_API_UNAVAILABLE',
        'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
      )
    }

    // 503 nhưng envelope hoặc error.code sai
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi lỗi 503 từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  // Trường hợp 3: Data API trả 401 do khóa dịch vụ sai
  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  // Trường hợp 4: Mã trạng thái khác ngoài contract (500, 404, 403, 201...)
  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

const MAX_BIGINT_UNSIGNED = 18446744073709551615n

/**
 * Kiểm tra chuỗi định dạng số nguyên dương chuẩn trong phạm vi BIGINT UNSIGNED (1 đến 2^64-1).
 * Không có khoảng trắng, không có số 0 ở đầu, không có dấu âm/dương.
 * @param {string} val
 */
export function isValidBigIntUnsignedString(val) {
  if (typeof val !== 'string') return false
  if (!/^[1-9]\d*$/.test(val)) return false
  try {
    const b = BigInt(val)
    return b >= 1n && b <= MAX_BIGINT_UNSIGNED
  } catch {
    return false
  }
}

/**
 * Thẩm định hồ sơ người dùng trả về từ Data API theo đúng hợp đồng (Contract Enforcement).
 * @param {object} user - Đối tượng user trả về
 * @param {string|null} expectedUserId - ID người dùng mong đợi (nếu có)
 */
export function validateAuthUserProfile(user, expectedUserId = null) {
  if (typeof user !== 'object' || user === null || Array.isArray(user)) {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Dữ liệu hồ sơ người dùng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  // 1. Validate id: chuỗi số nguyên dương chuẩn BIGINT UNSIGNED
  if (!isValidBigIntUnsignedString(user.id)) {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Mã định danh người dùng từ dịch vụ dữ liệu nội bộ không hợp lệ.',
    )
  }

  // Nếu có expectedUserId, bắt buộc phải khớp chính xác
  if (expectedUserId !== null && user.id !== String(expectedUserId)) {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Mã định danh người dùng không khớp với yêu cầu.',
    )
  }

  // 2. Validate username:
  // - Schema: VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL (chuẩn hóa chữ thường)
  // - Hợp đồng: Chuỗi không rỗng, tối đa 50 ký tự, thuần mã ASCII, đúng định dạng đã chuẩn hóa (trim và chữ thường)
  if (
    typeof user.username !== 'string' ||
    user.username.length === 0 ||
    user.username.length > 50 ||
    user.username.trim() !== user.username ||
    user.username.toLowerCase() !== user.username ||
    !/^[\x20-\x7E]+$/.test(user.username)
  ) {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Tên đăng nhập từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  // 3. Validate fullName (VARCHAR(120) theo schema MySQL: tối đa 120 ký tự Unicode code points)
  const fullNameCodePoints = Array.from(typeof user.fullName === 'string' ? user.fullName : []).length
  if (
    typeof user.fullName !== 'string' ||
    user.fullName.trim().length === 0 ||
    fullNameCodePoints > 120
  ) {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Họ và tên người dùng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  // 4. Validate các trường nullable: email, phone, avatarUrl
  if (user.email !== null && typeof user.email !== 'string') {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Email người dùng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (user.phone !== null && typeof user.phone !== 'string') {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Số điện thoại người dùng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (user.avatarUrl !== null && typeof user.avatarUrl !== 'string') {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Ảnh đại diện người dùng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  // 5. Validate role: chỉ chấp nhận 'buyer' hoặc 'seller'
  if (user.role !== 'buyer' && user.role !== 'seller') {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Vai trò người dùng từ dịch vụ dữ liệu nội bộ không hợp lệ.',
    )
  }

  // 6. Validate status: chỉ chấp nhận 'active' hoặc 'blocked'
  if (user.status !== 'active' && user.status !== 'blocked') {
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Trạng thái người dùng từ dịch vụ dữ liệu nội bộ không hợp lệ.',
    )
  }

  // 7. Validate shopId:
  // - Nếu role là 'seller': shopId bắt buộc phải là chuỗi BIGINT UNSIGNED hợp lệ
  // - Nếu role là 'buyer': shopId bắt buộc phải là null
  if (user.role === 'seller') {
    if (!isValidBigIntUnsignedString(user.shopId)) {
      throw new DataApiClientError(
        502,
        'DATA_API_BAD_RESPONSE',
        'Mã cửa hàng của người bán từ dịch vụ dữ liệu nội bộ không hợp lệ.',
      )
    }
  } else if (user.role === 'buyer') {
    if (user.shopId !== null) {
      throw new DataApiClientError(
        502,
        'DATA_API_BAD_RESPONSE',
        'Người mua không được phép có mã cửa hàng.',
      )
    }
  }

  // Trả về đối tượng user đã qua whitelist chuẩn
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email ?? null,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    status: user.status,
    shopId: user.shopId ?? null,
  }
}

/**
 * Xác thực thông tin đăng nhập với Data API:
 * POST /internal/v1/auth/verify-credentials
 */
export async function verifyCredentials(username, password) {
  const { status, data: json } = await requestDataApi('/internal/v1/auth/verify-credentials', {
    method: 'POST',
    body: { username, password },
  })

  // Trường hợp 1: Data API trả 200 OK
  if (status === 200) {
    if (
      typeof json !== 'object' ||
      json === null ||
      json.success !== true ||
      typeof json.data !== 'object' ||
      json.data === null
    ) {
      throw new DataApiClientError(
        502,
        'DATA_API_BAD_RESPONSE',
        'Phản hồi xác thực từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
      )
    }

    const validatedUser = validateAuthUserProfile(json.data.user)

    // Login chỉ cấp token khi hồ sơ hợp lệ và status === 'active'
    if (validatedUser.status !== 'active') {
      throw new DataApiClientError(
        401,
        'INVALID_CREDENTIALS',
        'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
      )
    }

    return validatedUser
  }

  // Trường hợp 2: Thông tin đăng nhập không hợp lệ (401 INVALID_CREDENTIALS)
  if (status === 401) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === false &&
      json.error?.code === 'INVALID_CREDENTIALS'
    ) {
      throw new DataApiClientError(
        401,
        'INVALID_CREDENTIALS',
        'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
      )
    }

    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === false &&
      json.error?.code === 'SERVICE_UNAUTHORIZED'
    ) {
      throw new DataApiClientError(
        502,
        'DATA_API_AUTH_FAILED',
        'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
      )
    }

    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi lỗi 401 từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  // Trường hợp 3: 400 Bad Request
  if (status === 400) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === false &&
      json.error?.code === 'VALIDATION_ERROR'
    ) {
      throw new DataApiClientError(
        400,
        'VALIDATION_ERROR',
        'Dữ liệu yêu cầu không hợp lệ.',
      )
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi lỗi 400 từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  // Trường hợp 4: 503 DATABASE_UNAVAILABLE
  if (status === 503) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === false &&
      json.error?.code === 'DATABASE_UNAVAILABLE'
    ) {
      throw new DataApiClientError(
        503,
        'DATA_API_UNAVAILABLE',
        'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
      )
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi lỗi 503 từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Đọc hồ sơ xác thực tài khoản từ Data API:
 * GET /internal/v1/users/:userId/auth-profile
 */
export async function getUserAuthProfile(userId) {
  const { status, data: json } = await requestDataApi(`/internal/v1/users/${encodeURIComponent(userId)}/auth-profile`)

  // Trường hợp 1: Data API trả 200 OK
  if (status === 200) {
    if (
      typeof json !== 'object' ||
      json === null ||
      json.success !== true ||
      typeof json.data !== 'object' ||
      json.data === null
    ) {
      throw new DataApiClientError(
        502,
        'DATA_API_BAD_RESPONSE',
        'Phản hồi hồ sơ người dùng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
      )
    }

    return validateAuthUserProfile(json.data.user, userId)
  }

  // Trường hợp 2: Không tìm thấy user (404 USER_NOT_FOUND)
  if (status === 404) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === false &&
      json.error?.code === 'USER_NOT_FOUND'
    ) {
      throw new DataApiClientError(
        404,
        'USER_NOT_FOUND',
        'Không tìm thấy người dùng.',
      )
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi lỗi 404 từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  // Trường hợp 3: Khóa dịch vụ sai (401)
  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  // Trường hợp 4: 400 Bad Request
  if (status === 400) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === false &&
      json.error?.code === 'INVALID_PARAMS'
    ) {
      throw new DataApiClientError(
        400,
        'INVALID_PARAMS',
        'Mã định danh người dùng không hợp lệ.',
      )
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi lỗi 400 từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  // Trường hợp 5: 503 DATABASE_UNAVAILABLE
  if (status === 503) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === false &&
      json.error?.code === 'DATABASE_UNAVAILABLE'
    ) {
      throw new DataApiClientError(
        503,
        'DATA_API_UNAVAILABLE',
        'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
      )
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi lỗi 503 từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}
