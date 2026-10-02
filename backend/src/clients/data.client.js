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
async function requestDataApi(endpointPath) {
  const url = `${env.dataApiUrl}${endpointPath}`
  const controller = new AbortController()
  let isTimedOut = false

  const timer = setTimeout(() => {
    isTimedOut = true
    try {
      controller.abort()
    } catch {}
  }, DATA_API_TIMEOUT_MS)

  let res
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-service-key': env.dataApiKey,
        'Accept': 'application/json',
      },
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
