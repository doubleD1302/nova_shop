import { checkDatabaseReadiness } from '../config/database.js'

/**
 * Controller xử lý các endpoint kiểm tra trạng thái hệ thống Data API
 */

/**
 * GET /internal/v1/health
 * Kiểm tra liveness của tiến trình Data API.
 * Luôn trả HTTP 200 khi tiến trình Node.js đang chạy bình thường; tuyệt đối không truy vấn CSDL MySQL.
 */
export function getHealth(req, res) {
  res.status(200).json({
    success: true,
    message: 'Dịch vụ Data API đang hoạt động bình thường.',
    data: {
      service: 'shopnova-data-api',
      status: 'ok',
    },
  })
}

/**
 * GET /internal/v1/ready
 * Kiểm tra readiness của Data API đối với cơ sở dữ liệu MySQL với ngân sách thời gian hữu hạn.
 * Thực hiện gọi checkDatabaseReadiness() để kiểm tra kết nối CSDL thực tế.
 * - Thành công: trả HTTP 200, data: { service: 'shopnova-data-api', database: 'connected' }.
 * - Thất bại/Timeout: trả HTTP 503, error.code: 'DATABASE_UNAVAILABLE'.
 * - Tuyệt đối không trả về chi tiết mật khẩu, host, user, câu lệnh SQL hay stack trace.
 */
export async function getReady(req, res) {
  try {
    await checkDatabaseReadiness()

    return res.status(200).json({
      success: true,
      message: 'Kết nối cơ sở dữ liệu MySQL sẵn sàng.',
      data: {
        service: 'shopnova-data-api',
        database: 'connected',
      },
    })
  } catch {
    return res.status(503).json({
      success: false,
      message: 'Không thể kết nối đến cơ sở dữ liệu MySQL.',
      error: {
        code: 'DATABASE_UNAVAILABLE',
      },
    })
  }
}
