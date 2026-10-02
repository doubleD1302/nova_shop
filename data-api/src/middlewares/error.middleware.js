import { isDatabaseUnavailableError } from '../config/database.js'

/**
 * Middleware xử lý lỗi tập trung cho Data API.
 * - Xử lý payload vượt quá giới hạn dung lượng (BODY_TOO_LARGE -> HTTP 413).
 * - Xử lý lỗi phân tích cú pháp JSON body (BAD_JSON -> HTTP 400).
 * - Xử lý lỗi CSDL không sẵn sàng / timeout (DATABASE_UNAVAILABLE -> HTTP 503).
 * - Xử lý các lỗi ngoại lệ chưa bắt (INTERNAL_SERVER_ERROR -> HTTP 500).
 *
 * Nguyên tắc bảo mật nhật ký (Log Security):
 * - Tuyệt đối không log nguyên err.message, err.sql, parameters, stack, cause hoặc connection config.
 * - Chỉ ghi thông tin chẩn đoán cố định đã được xác định an toàn (Diagnostic Event Code).
 * - Đảm bảo response và console log không bao giờ để lộ SQL, secret hoặc thông tin nội bộ.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // 1. Lỗi dữ liệu body vượt quá giới hạn dung lượng (413 Payload Too Large)
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    console.error('[Data API Error] Event: BODY_TOO_LARGE')
    return res.status(413).json({
      success: false,
      message: 'Dung lượng dữ liệu gửi lên vượt quá giới hạn cho phép.',
      error: {
        code: 'BODY_TOO_LARGE',
      },
    })
  }

  // 2. Lỗi cú pháp JSON từ express.json() (400 Bad Request)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('[Data API Error] Event: BAD_JSON')
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu JSON trong body request không hợp lệ.',
      error: {
        code: 'BAD_JSON',
      },
    })
  }

  // 3. Lỗi kết nối CSDL hoặc timeout thao tác (503 Service Unavailable)
  if (isDatabaseUnavailableError(err)) {
    console.error('[Data API Error] Event: DATABASE_UNAVAILABLE')
    return res.status(503).json({
      success: false,
      message: 'Không thể kết nối đến cơ sở dữ liệu MySQL hoặc thao tác đã quá thời gian xử lý.',
      error: {
        code: 'DATABASE_UNAVAILABLE',
      },
    })
  }

  // 4. Các lỗi hệ thống khác (500 Internal Server Error)
  // Chỉ ghi nhận mã sự kiện cố định, tuyệt đối không in err.message/err.sql/parameters/stack
  console.error('[Data API Error] Event: INTERNAL_SERVER_ERROR')

  return res.status(500).json({
    success: false,
    message: 'Đã xảy ra lỗi nội bộ tại Data API.',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
    },
  })
}
