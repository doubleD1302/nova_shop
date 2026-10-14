/**
 * Middleware bắt các request gọi đến đường dẫn (route) không tồn tại.
 * Luôn trả về định dạng JSON thống nhất với mã lỗi HTTP 404.
 */
export function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: 'Không tìm thấy API.',
    error: {
      code: 'NOT_FOUND',
    },
  })
}
