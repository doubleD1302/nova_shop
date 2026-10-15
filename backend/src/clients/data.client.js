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

/**
 * Lấy danh sách ngành hàng / danh mục từ Data API:
 * GET /internal/v1/categories
 */
export async function getCategories() {
  const { status, data: json } = await requestDataApi('/internal/v1/categories')

  if (status === 200) {
    if (
      typeof json !== 'object' ||
      json === null ||
      json.success !== true ||
      !Array.isArray(json.data)
    ) {
      throw new DataApiClientError(
        502,
        'DATA_API_BAD_RESPONSE',
        'Phản hồi danh mục từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
      )
    }

    return json.data
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

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
 * Lấy danh sách sản phẩm kèm lọc và phân trang từ Data API:
 * GET /internal/v1/products
 */
export async function getProducts(params = {}) {
  const searchParams = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.append(key, String(val))
    }
  }

  const queryString = searchParams.toString()
  const endpoint = queryString ? `/internal/v1/products?${queryString}` : '/internal/v1/products'

  const { status, data: json } = await requestDataApi(endpoint)

  if (status === 200) {
    if (
      typeof json !== 'object' ||
      json === null ||
      json.success !== true ||
      !Array.isArray(json.data) ||
      typeof json.meta !== 'object' ||
      json.meta === null
    ) {
      throw new DataApiClientError(
        502,
        'DATA_API_BAD_RESPONSE',
        'Phản hồi danh sách sản phẩm từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
      )
    }

    return {
      data: json.data,
      meta: json.meta,
    }
  }

  if (status === 400) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === false &&
      json.error?.code === 'INVALID_QUERY'
    ) {
      throw new DataApiClientError(
        400,
        'INVALID_QUERY',
        json.message || 'Tham số truy vấn không hợp lệ.',
      )
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi lỗi 400 từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

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
 * Lấy chi tiết sản phẩm theo ID hoặc Slug từ Data API:
 * GET /internal/v1/products/:idOrSlug
 */
export async function getProductByIdOrSlug(idOrSlug) {
  const endpoint = `/internal/v1/products/${encodeURIComponent(idOrSlug)}`
  const { status, data: json } = await requestDataApi(endpoint)

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
        'Phản hồi chi tiết sản phẩm từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
      )
    }

    return json.data
  }

  if (status === 404) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === false &&
      json.error?.code === 'PRODUCT_NOT_FOUND'
    ) {
      throw new DataApiClientError(
        404,
        'PRODUCT_NOT_FOUND',
        json.message || 'Không tìm thấy sản phẩm.',
      )
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi lỗi 404 từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

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
        json.message || 'Mã định danh sản phẩm không hợp lệ.',
      )
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi lỗi 400 từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

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
 * Gọi POST /internal/v1/auth/register sang Data API để tạo tài khoản mới.
 * @param {Object} userData Thông tin tài khoản người mua hoặc người bán
 * @returns {Promise<Object>} Thông tin người dùng đã tạo
 */
export async function registerUser(userData) {
  const { status, data: json } = await requestDataApi('/internal/v1/auth/register', {
    method: 'POST',
    body: userData,
  })

  if (status === 201) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      json.data?.user
    ) {
      return validateAuthUserProfile(json.data.user)
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 409) {
    throw new DataApiClientError(
      409,
      json.error?.code || 'CONFLICT',
      json.message || 'Tên đăng nhập hoặc email đã tồn tại.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json.error?.code || 'VALIDATION_ERROR',
      json.message || 'Dữ liệu đăng ký không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy giỏ hàng của người dùng từ Data API:
 * GET /internal/v1/cart?userId=:userId
 */
export async function fetchCart(userId) {
  const { status, data: json } = await requestDataApi(`/internal/v1/cart?userId=${encodeURIComponent(userId)}`)

  if (status === 200) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      typeof json.data === 'object' &&
      json.data !== null
    ) {
      return json.data
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi giỏ hàng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_USER_ID',
      json?.message || 'Mã người dùng không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Thêm sản phẩm vào giỏ hàng qua Data API:
 * POST /internal/v1/cart/items
 */
export async function addItemToCart(data) {
  const { status, data: json } = await requestDataApi('/internal/v1/cart/items', {
    method: 'POST',
    body: data,
  })

  if (status === 200 || status === 201) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      typeof json.data === 'object' &&
      json.data !== null
    ) {
      return json.data
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi thêm giỏ hàng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 404) {
    throw new DataApiClientError(
      404,
      json?.error?.code || 'VARIANT_NOT_FOUND',
      json?.message || 'Biến thể sản phẩm không tồn tại.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'VALIDATION_ERROR',
      json?.message || 'Dữ liệu thêm vào giỏ không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Cập nhật số lượng hoặc trạng thái chọn trong giỏ hàng:
 * PATCH /internal/v1/cart/items/:itemId
 */
export async function updateCartItem(itemId, data) {
  const { status, data: json } = await requestDataApi(`/internal/v1/cart/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: data,
  })

  if (status === 200) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      typeof json.data === 'object' &&
      json.data !== null
    ) {
      return json.data
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi cập nhật giỏ hàng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 404) {
    throw new DataApiClientError(
      404,
      json?.error?.code || 'CART_ITEM_NOT_FOUND',
      json?.message || 'Không tìm thấy sản phẩm trong giỏ hàng.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'VALIDATION_ERROR',
      json?.message || 'Dữ liệu cập nhật giỏ hàng không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Xóa một sản phẩm khỏi giỏ hàng:
 * DELETE /internal/v1/cart/items/:itemId
 */
export async function removeCartItem(itemId, userId) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/cart/items/${encodeURIComponent(itemId)}?userId=${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
    }
  )

  if (status === 200) {
    return json?.data || { itemId }
  }

  if (status === 404) {
    throw new DataApiClientError(
      404,
      json?.error?.code || 'CART_ITEM_NOT_FOUND',
      json?.message || 'Không tìm thấy dòng sản phẩm trong giỏ hàng.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_ITEM_ID',
      json?.message || 'Mã dòng giỏ hàng không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Xóa nhiều sản phẩm hoặc xóa sạch giỏ hàng:
 * DELETE /internal/v1/cart/items
 */
export async function clearOrRemoveCartItems(data) {
  const { status, data: json } = await requestDataApi('/internal/v1/cart/items', {
    method: 'DELETE',
    body: data,
  })

  if (status === 200) {
    return json?.data || {}
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_REQUEST',
      json?.message || 'Yêu cầu không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy danh sách gian hàng trên sàn:
 * GET /internal/v1/shops
 */
export async function fetchShops(query = {}) {
  const searchParams = new URLSearchParams()
  if (query.page) searchParams.set('page', String(query.page))
  if (query.limit) searchParams.set('limit', String(query.limit))
  if (query.mall !== undefined) searchParams.set('mall', String(query.mall))
  if (query.keyword) searchParams.set('keyword', String(query.keyword))
  if (query.province) searchParams.set('province', String(query.province))
  if (query.sort) searchParams.set('sort', String(query.sort))

  const queryString = searchParams.toString()
  const path = queryString ? `/internal/v1/shops?${queryString}` : '/internal/v1/shops'

  const { status, data: json } = await requestDataApi(path)

  if (status === 200) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      Array.isArray(json.data)
    ) {
      return { data: json.data, meta: json.meta }
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi danh sách gian hàng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_QUERY',
      json?.message || 'Tham số truy vấn gian hàng không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy chi tiết gian hàng theo ID hoặc Slug:
 * GET /internal/v1/shops/:idOrSlug
 */
export async function fetchShopDetail(idOrSlug) {
  const { status, data: json } = await requestDataApi(`/internal/v1/shops/${encodeURIComponent(idOrSlug)}`)

  if (status === 200) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      typeof json.data === 'object' &&
      json.data !== null
    ) {
      return json.data
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi chi tiết gian hàng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 404) {
    throw new DataApiClientError(
      404,
      json?.error?.code || 'SHOP_NOT_FOUND',
      json?.message || 'Không tìm thấy gian hàng yêu cầu.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_SHOP_ID',
      json?.message || 'Định danh gian hàng không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy danh sách sản phẩm của gian hàng:
 * GET /internal/v1/shops/:idOrSlug/products
 */
export async function fetchShopProducts(idOrSlug, query = {}) {
  const searchParams = new URLSearchParams()
  if (query.page) searchParams.set('page', String(query.page))
  if (query.limit) searchParams.set('limit', String(query.limit))
  if (query.categoryId) searchParams.set('categoryId', String(query.categoryId))
  if (query.sort) searchParams.set('sort', String(query.sort))

  const queryString = searchParams.toString()
  const path = queryString
    ? `/internal/v1/shops/${encodeURIComponent(idOrSlug)}/products?${queryString}`
    : `/internal/v1/shops/${encodeURIComponent(idOrSlug)}/products`

  const { status, data: json } = await requestDataApi(path)

  if (status === 200) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      Array.isArray(json.data)
    ) {
      return { data: json.data, meta: json.meta }
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi danh sách sản phẩm gian hàng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 404) {
    throw new DataApiClientError(
      404,
      json?.error?.code || 'SHOP_NOT_FOUND',
      json?.message || 'Không tìm thấy gian hàng yêu cầu.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_QUERY',
      json?.message || 'Tham số truy vấn sản phẩm của gian hàng không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Tạo đơn hàng mới qua Data API:
 * POST /internal/v1/orders
 */
export async function createOrder(orderData) {
  const { status, data: json } = await requestDataApi('/internal/v1/orders', {
    method: 'POST',
    body: orderData,
  })

  if (status === 200 || status === 201) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      typeof json.data === 'object' &&
      json.data !== null
    ) {
      return json.data
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi tạo đơn hàng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'VALIDATION_ERROR',
      json?.message || 'Thông tin tạo đơn hàng không hợp lệ.',
    )
  }

  if (status === 404) {
    throw new DataApiClientError(
      404,
      json?.error?.code || 'NOT_FOUND',
      json?.message || 'Không tìm thấy dữ liệu yêu cầu.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy danh sách đơn hàng của người mua:
 * GET /internal/v1/orders
 */
export async function fetchOrders(query = {}) {
  const searchParams = new URLSearchParams()
  if (query.userId) searchParams.set('userId', String(query.userId))
  if (query.status) searchParams.set('status', String(query.status))
  if (query.page) searchParams.set('page', String(query.page))
  if (query.limit) searchParams.set('limit', String(query.limit))

  const queryString = searchParams.toString()
  const path = queryString ? `/internal/v1/orders?${queryString}` : '/internal/v1/orders'

  const { status, data: json } = await requestDataApi(path)

  if (status === 200) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      Array.isArray(json.data)
    ) {
      return { data: json.data, meta: json.meta }
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi danh sách đơn hàng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_QUERY',
      json?.message || 'Tham số truy vấn đơn hàng không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy chi tiết đơn hàng:
 * GET /internal/v1/orders/:orderIdOrCode
 */
export async function fetchOrderDetail(orderIdOrCode, userId) {
  const searchParams = new URLSearchParams()
  if (userId) searchParams.set('userId', String(userId))

  const queryString = searchParams.toString()
  const path = queryString
    ? `/internal/v1/orders/${encodeURIComponent(orderIdOrCode)}?${queryString}`
    : `/internal/v1/orders/${encodeURIComponent(orderIdOrCode)}`

  const { status, data: json } = await requestDataApi(path)

  if (status === 200) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      typeof json.data === 'object' &&
      json.data !== null
    ) {
      return json.data
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi chi tiết đơn hàng từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 404) {
    throw new DataApiClientError(
      404,
      json?.error?.code || 'ORDER_NOT_FOUND',
      json?.message || 'Không tìm thấy đơn hàng yêu cầu.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_ORDER_ID',
      json?.message || 'Định danh đơn hàng không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Hủy đơn hàng:
 * PATCH /internal/v1/orders/:orderIdOrCode/cancel
 */
export async function cancelOrder(orderIdOrCode, { userId, reason }) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/orders/${encodeURIComponent(orderIdOrCode)}/cancel`,
    {
      method: 'PATCH',
      body: { userId, reason },
    },
  )

  if (status === 200) {
    return json?.data || { cancelled: true }
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'ORDER_CANNOT_BE_CANCELLED',
      json?.message || 'Không thể hủy đơn hàng ở trạng thái hiện tại.',
    )
  }

  if (status === 404) {
    throw new DataApiClientError(
      404,
      json?.error?.code || 'ORDER_NOT_FOUND',
      json?.message || 'Không tìm thấy đơn hàng cần hủy.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Cập nhật thông tin hồ sơ người dùng:
 * PUT /internal/v1/users/:userId/profile
 */
export async function updateUserProfile(userId, profileData) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/users/${encodeURIComponent(userId)}/profile`,
    {
      method: 'PUT',
      body: profileData,
    },
  )

  if (status === 200) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      typeof json.data?.user === 'object'
    ) {
      return json.data.user
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi cập nhật hồ sơ từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'VALIDATION_ERROR',
      json?.message || 'Thông tin hồ sơ không hợp lệ.',
    )
  }

  if (status === 409) {
    throw new DataApiClientError(
      409,
      json?.error?.code || 'EMAIL_EXISTS',
      json?.message || 'Email đã được sử dụng bởi tài khoản khác.',
    )
  }

  if (status === 404) {
    throw new DataApiClientError(
      404,
      json?.error?.code || 'USER_NOT_FOUND',
      json?.message || 'Không tìm thấy thông tin người dùng.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy danh sách địa chỉ nhận hàng của người dùng:
 * GET /internal/v1/users/:userId/addresses
 */
export async function fetchUserAddresses(userId) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/users/${encodeURIComponent(userId)}/addresses`,
  )

  if (status === 200) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      Array.isArray(json.data)
    ) {
      return json.data
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi danh sách địa chỉ từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_USER_ID',
      json?.message || 'Mã tài khoản không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Thêm địa chỉ nhận hàng mới:
 * POST /internal/v1/users/:userId/addresses
 */
export async function createUserAddress(userId, addressData) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/users/${encodeURIComponent(userId)}/addresses`,
    {
      method: 'POST',
      body: addressData,
    },
  )

  if (status === 200 || status === 201) {
    if (
      typeof json === 'object' &&
      json !== null &&
      json.success === true &&
      typeof json.data === 'object' &&
      json.data !== null
    ) {
      return json.data
    }
    throw new DataApiClientError(
      502,
      'DATA_API_BAD_RESPONSE',
      'Phản hồi tạo địa chỉ từ dịch vụ dữ liệu nội bộ không đúng quy chuẩn.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'VALIDATION_ERROR',
      json?.message || 'Thông tin địa chỉ không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Đặt địa chỉ làm mặc định:
 * PATCH /internal/v1/users/:userId/addresses/:addressId/default
 */
export async function setDefaultUserAddress(userId, addressId) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/users/${encodeURIComponent(userId)}/addresses/${encodeURIComponent(addressId)}/default`,
    {
      method: 'PATCH',
    },
  )

  if (status === 200) {
    return json?.data || {}
  }

  if (status === 404) {
    throw new DataApiClientError(
      404,
      json?.error?.code || 'ADDRESS_NOT_FOUND',
      json?.message || 'Không tìm thấy địa chỉ nhận hàng.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_PARAMS',
      json?.message || 'Tham số yêu cầu không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Xóa địa chỉ nhận hàng:
 * DELETE /internal/v1/users/:userId/addresses/:addressId
 */
export async function deleteUserAddress(userId, addressId) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/users/${encodeURIComponent(userId)}/addresses/${encodeURIComponent(addressId)}`,
    {
      method: 'DELETE',
    },
  )

  if (status === 200) {
    return json?.data || { deleted: true }
  }

  if (status === 404) {
    throw new DataApiClientError(
      404,
      json?.error?.code || 'ADDRESS_NOT_FOUND',
      json?.message || 'Không tìm thấy địa chỉ cần xóa.',
    )
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_PARAMS',
      json?.message || 'Tham số yêu cầu không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy dữ liệu sản phẩm nổi bật & Flash Sale cho trang chủ:
 * GET /internal/v1/products/featured
 */
export async function getFeaturedHomeData() {
  const { status, data: json } = await requestDataApi('/internal/v1/products/featured')

  if (status === 200) {
    return json?.data || { flashSale: [], featuredProducts: [] }
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy danh sách đánh giá của sản phẩm:
 * GET /internal/v1/products/:productId/reviews
 */
export async function getProductReviews(productId, query = {}) {
  const searchParams = new URLSearchParams()
  if (query.page) searchParams.set('page', String(query.page))
  if (query.limit) searchParams.set('limit', String(query.limit))
  const qs = searchParams.toString()
  const endpoint = qs
    ? `/internal/v1/products/${encodeURIComponent(productId)}/reviews?${qs}`
    : `/internal/v1/products/${encodeURIComponent(productId)}/reviews`

  const { status, data: json } = await requestDataApi(endpoint)

  if (status === 200) {
    return json || { success: true, data: { reviews: [], averageRating: 5.0, totalReviews: 0 } }
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_PRODUCT_ID',
      json?.message || 'Mã sản phẩm không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Tạo đánh giá sản phẩm mới:
 * POST /internal/v1/reviews
 */
export async function createProductReview(reviewData) {
  const { status, data: json } = await requestDataApi('/internal/v1/reviews', {
    method: 'POST',
    body: reviewData,
  })

  if (status === 201) {
    return json?.data
  }

  if (status === 400 || status === 403 || status === 404 || status === 409) {
    throw new DataApiClientError(
      status,
      json?.error?.code || 'REVIEW_ERROR',
      json?.message || 'Không thể tạo đánh giá sản phẩm.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy danh sách sản phẩm yêu thích của người dùng:
 * GET /internal/v1/users/:userId/favorites
 */
export async function getUserFavorites(userId) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/users/${encodeURIComponent(userId)}/favorites`,
  )

  if (status === 200) {
    return json?.data || []
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_USER_ID',
      json?.message || 'Mã người dùng không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Thêm sản phẩm vào danh sách yêu thích:
 * POST /internal/v1/users/:userId/favorites/:productId
 */
export async function addUserFavorite(userId, productId) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/users/${encodeURIComponent(userId)}/favorites/${encodeURIComponent(productId)}`,
    {
      method: 'POST',
    },
  )

  if (status === 200) {
    return json?.data || { favorited: true, productId }
  }

  if (status === 400 || status === 404) {
    throw new DataApiClientError(
      status,
      json?.error?.code || 'FAVORITE_ERROR',
      json?.message || 'Không thể thêm vào danh sách yêu thích.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Xóa sản phẩm khỏi danh sách yêu thích:
 * DELETE /internal/v1/users/:userId/favorites/:productId
 */
export async function removeUserFavorite(userId, productId) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/users/${encodeURIComponent(userId)}/favorites/${encodeURIComponent(productId)}`,
    {
      method: 'DELETE',
    },
  )

  if (status === 200) {
    return json?.data || { favorited: false, productId }
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'FAVORITE_ERROR',
      json?.message || 'Không thể xóa khỏi danh sách yêu thích.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy danh sách đơn hàng con thuộc shop của seller:
 * GET /internal/v1/seller/orders?shopId=...
 */
export async function fetchSellerOrders(shopId, query = {}) {
  const searchParams = new URLSearchParams()
  searchParams.set('shopId', String(shopId))
  if (query.status) searchParams.set('status', String(query.status))
  if (query.page) searchParams.set('page', String(query.page))
  if (query.limit) searchParams.set('limit', String(query.limit))

  const endpoint = `/internal/v1/seller/orders?${searchParams.toString()}`
  const { status, data: json } = await requestDataApi(endpoint)

  if (status === 200) {
    return json || { success: true, data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } }
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_QUERY',
      json?.message || 'Tham số truy vấn đơn hàng không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Cập nhật trạng thái đơn hàng con của người bán:
 * PATCH /internal/v1/seller/orders/:shopOrderId/status
 */
export async function updateSellerOrderStatus(shopOrderId, updateData) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/seller/orders/${encodeURIComponent(shopOrderId)}/status`,
    {
      method: 'PATCH',
      body: updateData,
    },
  )

  if (status === 200) {
    return json?.data
  }

  if (status === 400 || status === 404) {
    throw new DataApiClientError(
      status,
      json?.error?.code || 'ORDER_UPDATE_ERROR',
      json?.message || 'Không thể cập nhật trạng thái đơn hàng.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Lấy danh sách sản phẩm của shop:
 * GET /internal/v1/seller/products?shopId=...
 */
export async function fetchSellerProducts(shopId, query = {}) {
  const searchParams = new URLSearchParams()
  searchParams.set('shopId', String(shopId))
  if (query.status) searchParams.set('status', String(query.status))
  if (query.page) searchParams.set('page', String(query.page))
  if (query.limit) searchParams.set('limit', String(query.limit))

  const endpoint = `/internal/v1/seller/products?${searchParams.toString()}`
  const { status, data: json } = await requestDataApi(endpoint)

  if (status === 200) {
    return json || { success: true, data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } }
  }

  if (status === 400) {
    throw new DataApiClientError(
      400,
      json?.error?.code || 'INVALID_QUERY',
      json?.message || 'Tham số truy vấn không hợp lệ.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Tạo mới sản phẩm cho shop:
 * POST /internal/v1/seller/products
 */
export async function createSellerProduct(productData) {
  const { status, data: json } = await requestDataApi('/internal/v1/seller/products', {
    method: 'POST',
    body: productData,
  })

  if (status === 201) {
    return json?.data
  }

  if (status === 400 || status === 409) {
    throw new DataApiClientError(
      status,
      json?.error?.code || 'VALIDATION_ERROR',
      json?.message || 'Không thể tạo sản phẩm.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Cập nhật thông tin sản phẩm:
 * PUT /internal/v1/seller/products/:productId
 */
export async function updateSellerProduct(productId, updateData) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/seller/products/${encodeURIComponent(productId)}`,
    {
      method: 'PUT',
      body: updateData,
    },
  )

  if (status === 200) {
    return json?.data
  }

  if (status === 400 || status === 404) {
    throw new DataApiClientError(
      status,
      json?.error?.code || 'UPDATE_ERROR',
      json?.message || 'Không thể cập nhật sản phẩm.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}

/**
 * Xóa/lưu trữ sản phẩm:
 * DELETE /internal/v1/seller/products/:productId?shopId=...
 */
export async function deleteSellerProduct(productId, shopId) {
  const { status, data: json } = await requestDataApi(
    `/internal/v1/seller/products/${encodeURIComponent(productId)}?shopId=${encodeURIComponent(shopId)}`,
    {
      method: 'DELETE',
    },
  )

  if (status === 200) {
    return json?.data || { archived: true }
  }

  if (status === 400 || status === 404) {
    throw new DataApiClientError(
      status,
      json?.error?.code || 'DELETE_ERROR',
      json?.message || 'Không thể xóa sản phẩm.',
    )
  }

  if (status === 401) {
    throw new DataApiClientError(
      502,
      'DATA_API_AUTH_FAILED',
      'Lỗi xác thực khóa dịch vụ với dịch vụ dữ liệu nội bộ.',
    )
  }

  if (status === 503) {
    throw new DataApiClientError(
      503,
      'DATA_API_UNAVAILABLE',
      'Dịch vụ dữ liệu nội bộ hoặc cơ sở dữ liệu hiện không sẵn sàng.',
    )
  }

  throw new DataApiClientError(
    502,
    'DATA_API_BAD_RESPONSE',
    'Dịch vụ dữ liệu nội bộ trả về mã trạng thái không hợp lệ.',
  )
}
