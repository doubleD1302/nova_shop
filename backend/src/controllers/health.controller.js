/**
 * Controller kiểm tra trạng thái hoạt động của máy chủ backend (Health check).
 * Lưu ý: Trong BE-001, API này chỉ xác nhận tiến trình Express đang chạy bình thường,
 * chưa kết nối database hay dịch vụ bên ngoài.
 */
export function getHealth(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Backend đang hoạt động.',
    data: {
      service: 'shopnova-backend',
      status: 'ok',
    },
  })
}
