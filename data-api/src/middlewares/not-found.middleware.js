/**
 * Middleware xử lý khi client gọi route không tồn tại (404 Not Found)
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Đường dẫn "${req.originalUrl}" không tồn tại trên Data API.`,
    error: {
      code: 'NOT_FOUND',
    },
  })
}
