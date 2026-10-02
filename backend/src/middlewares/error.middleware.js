import { DataApiClientError } from '../clients/data.client.js'

/**
 * Middleware xử lý lỗi tập trung cho toàn bộ ứng dụng (Global Error Handler).
 * Express nhận diện middleware xử lý lỗi khi hàm có đúng 4 tham số: (err, req, res, next).
 */
export function errorHandler(err, req, res, next) {
  // 1. Lỗi cú pháp JSON khi client gửi request body sai định dạng
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400) && 'body' in err) {
    console.error('[Backend Error] Event: BAD_JSON')
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu JSON không hợp lệ.',
      error: {
        code: 'BAD_JSON',
      },
    })
  }

  // 2. Lỗi dữ liệu gửi lên vượt quá giới hạn kích thước (Payload Too Large)
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    console.error('[Backend Error] Event: BODY_TOO_LARGE')
    return res.status(413).json({
      success: false,
      message: 'Dung lượng dữ liệu vượt quá giới hạn cho phép (1MB).',
      error: {
        code: 'BODY_TOO_LARGE',
      },
    })
  }

  // 3. Lỗi từ HTTP client gọi dịch vụ Data API nội bộ (502, 503, 504)
  if (err instanceof DataApiClientError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      error: {
        code: err.code,
      },
    })
  }

  // 4. Ghi log mã sự kiện an toàn cho lỗi máy chủ không xác định (tuyệt đối không in err.message hay secret)
  console.error('[Backend Error] Event: INTERNAL_SERVER_ERROR')

  // 5. Lỗi máy chủ không xác định (Internal Server Error)
  return res.status(500).json({
    success: false,
    message: 'Đã xảy ra lỗi máy chủ nội bộ.',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
    },
  })
}
