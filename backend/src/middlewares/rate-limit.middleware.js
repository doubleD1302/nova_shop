/**
 * Middleware giới hạn tần suất thử đăng nhập (Login Rate Limiter).
 *
 * Phạm vi và Giới hạn:
 * - Cơ chế in-memory đơn tiến trình (phù hợp với kiến trúc hiện tại của Backend).
 * - Lưu ý: Khi mở rộng ứng dụng chạy đa tiến trình (Cluster) hoặc nhiều instance phía sau Load Balancer,
 *   cần chuyển sang sử dụng bộ nhớ phân tán tập trung (như Redis) để chia sẻ trạng thái rate limit giữa các worker.
 * - Cơ chế dọn dẹp: Tự động xóa các bản ghi đã hết hạn mỗi chu kỳ (sử dụng unref() để không chặn tiến trình thoát),
 *   đồng thời kiểm tra và dọn dẹp ngay tại thời điểm request đến, đảm bảo Map không bao giờ tăng vô hạn.
 */

const attemptsMap = new Map()

// Giới hạn số lượng bản ghi tối đa trong bộ nhớ để chống tấn công cạn kiệt RAM (DoS)
export const MAX_RATE_LIMIT_ENTRIES = 10000

// Chu kỳ dọn dẹp tự động các bản ghi hết hạn (mỗi 60 giây)
const CLEANUP_INTERVAL_MS = 60 * 1000
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, record] of attemptsMap.entries()) {
    if (now >= record.resetTime && record.inFlight === 0) {
      attemptsMap.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS)

// Không ngăn cản Node.js runtime thoát khi không còn tác vụ nào khác
if (cleanupTimer.unref) {
  cleanupTimer.unref()
}

/**
 * Thu hồi bớt bản ghi khi bộ nhớ đạt ngưỡng giới hạn MAX_RATE_LIMIT_ENTRIES.
 * @param {number} now
 */
function pruneExpiredOrOldestEntries(now) {
  // 1. Quét và xóa toàn bộ các bản ghi đã quá hạn và không còn request đang xử lý (inFlight === 0)
  for (const [key, record] of attemptsMap.entries()) {
    if (now >= record.resetTime && record.inFlight === 0) {
      attemptsMap.delete(key)
    }
  }

  // 2. Nếu vẫn vượt quá ngưỡng tối đa, loại bỏ bản ghi cũ nhất mà không có inFlight
  if (attemptsMap.size >= MAX_RATE_LIMIT_ENTRIES) {
    for (const [key, record] of attemptsMap.entries()) {
      if (record.inFlight === 0) {
        attemptsMap.delete(key)
        break
      }
    }
    // Nếu tất cả đều đang inFlight nhưng map vẫn đầy, loại bỏ bản ghi đầu tiên
    if (attemptsMap.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = attemptsMap.keys().next().value
      if (oldestKey !== undefined) {
        attemptsMap.delete(oldestKey)
      }
    }
  }
}

/**
 * Tạo middleware giới hạn số lần thử đăng nhập với kiểm soát concurrency an toàn.
 *
 * Lưu ý bảo mật về Concurrency & Client IP:
 * - Quản lý đồng thời cả số request đang xử lý (`inFlight`) và số lần thất bại (`failedAttempts`).
 * - Tổng `failedAttempts + inFlight` không được vượt quá `maxAttempts`.
 * - Giữ chỗ ngay khi request vào middleware trước khi gọi upstream.
 * - Giải phóng chỗ giữ đúng một lần duy nhất kể cả khi client ngắt kết nối (res close/abort).
 * - Sử dụng `req.ip` do Express xác định (hoặc `req.socket.remoteAddress` từ tầng TCP socket).
 *
 * @param {object} options
 * @param {number} options.windowMs - Cửa sổ thời gian (mặc định 60.000ms = 1 phút)
 * @param {number} options.maxAttempts - Số lần thử tối đa trong cửa sổ (mặc định 5 lần)
 */
export function createLoginRateLimiter({
  windowMs = 60 * 1000,
  maxAttempts = 5,
} = {}) {
  return (req, res, next) => {
    // Chỉ sử dụng IP do Express xác định từ kết nối (hoặc socket remoteAddress)
    // Tuyệt đối không đọc trực tiếp req.headers['x-forwarded-for']
    const clientIp = req.ip ||
      req.socket?.remoteAddress ||
      'unknown-client'

    const key = `login:${clientIp}`
    const now = Date.now()

    let record = attemptsMap.get(key)

    // Nếu bản ghi đã tồn tại nhưng đã hết thời hạn của cửa sổ
    if (record && now >= record.resetTime) {
      if (record.inFlight === 0) {
        attemptsMap.delete(key)
        record = undefined
      } else {
        // Cửa sổ đã trôi qua nhưng còn request cũ đang in-flight: reset số lần thất bại, gia hạn cửa sổ
        record.failedAttempts = 0
        record.resetTime = now + windowMs
      }
    }

    if (!record) {
      // Trước khi tạo bản ghi mới, kiểm tra và dọn dẹp nếu bộ nhớ đạt ngưỡng tối đa
      if (attemptsMap.size >= MAX_RATE_LIMIT_ENTRIES) {
        pruneExpiredOrOldestEntries(now)
      }

      record = {
        failedAttempts: 0,
        inFlight: 0,
        resetTime: now + windowMs,
      }
      attemptsMap.set(key, record)
    }

    // Kiểm tra nếu tổng số lần thất bại và các lần đang xử lý vượt quá giới hạn cho phép
    const currentLoad = record.failedAttempts + record.inFlight
    if (currentLoad >= maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000))
      res.setHeader('Retry-After', String(retryAfterSeconds))

      return res.status(429).json({
        success: false,
        message: 'Quá nhiều lần thử đăng nhập thất bại. Vui lòng thử lại sau.',
        error: {
          code: 'RATE_LIMITED',
        },
      })
    }

    // Giữ chỗ cho request đang xử lý (In-flight concurrency reservation)
    record.inFlight++

    // Đảm bảo cleanup giải phóng chỗ giữ chỉ chạy đúng 1 lần duy nhất
    let isCleanedUp = false

    // Safety timer phòng trường hợp tác vụ bị treo vô hạn
    const safetyTimer = setTimeout(() => {
      cleanup(res.statusCode || null)
    }, 30000)
    if (safetyTimer.unref) {
      safetyTimer.unref()
    }

    const cleanup = (statusCode) => {
      if (isCleanedUp) return
      isCleanedUp = true
      clearTimeout(safetyTimer)

      // Giảm số lượng request đang xử lý an toàn
      record.inFlight = Math.max(0, record.inFlight - 1)

      if (statusCode === 200) {
        // Đăng nhập thành công: reset số lần thất bại về 0
        record.failedAttempts = 0
        // Không xóa bản ghi nếu còn request khác đang in-flight để bảo toàn phần giữ chỗ của chúng
        if (record.inFlight === 0) {
          attemptsMap.delete(key)
        }
      } else if (statusCode === 400 || statusCode === 401) {
        // Đăng nhập thất bại do thông tin sai: tăng failedAttempts (kể cả khi client đã ngắt kết nối)
        record.failedAttempts++
      } else {
        // Lỗi hệ thống 5xx hoặc timeout bất thường:
        // Không tính vào số lần thử sai của người dùng
        if (record.inFlight === 0 && record.failedAttempts === 0) {
          attemptsMap.delete(key)
        }
      }
    }

    // Intercept res.end để thực hiện cleanup khi công việc đăng nhập thực sự hoàn tất.
    // Ngay cả khi client ngắt kết nối (socket closed), controller Express vẫn chạy tiếp và gọi res.end().
    // Không giải phóng ở sự kiện 'close' sớm để ngăn client abort bypass giới hạn in-flight.
    const originalEnd = res.end
    res.end = function (...args) {
      cleanup(res.statusCode)
      return originalEnd.apply(this, args)
    }

    res.once('finish', () => cleanup(res.statusCode))

    next()
  }
}

/**
 * Middleware rate limiter mặc định cho đăng nhập
 */
export const loginRateLimiter = createLoginRateLimiter()

/**
 * Hàm hỗ trợ reset bộ đếm phục vụ kiểm thử
 */
export function resetLoginRateLimiter() {
  attemptsMap.clear()
}
