import { fetchDataApiReady, DataApiClientError } from '../clients/data.client.js'

/**
 * Controller kiểm tra tính sẵn sàng của Backend và các phụ thuộc (Readiness check).
 * GET /api/v1/ready
 *
 * Thực hiện gọi sang Data API nội bộ qua HTTP client:
 * - Khi Data API và MySQL sẵn sàng: HTTP 200 { dataApi: "connected", database: "connected" }
 * - Khi CSDL MySQL chết hoặc không kết nối được Data API: HTTP 503 DATA_API_UNAVAILABLE
 * - Khi Data API timeout quá 5000ms: HTTP 504 DATA_API_TIMEOUT
 * - Khi sai khóa dịch vụ nội bộ: HTTP 502 DATA_API_AUTH_FAILED
 * - Khi response Data API sai contract/envelope/quá lớn: HTTP 502 DATA_API_BAD_RESPONSE
 */
export async function getReady(req, res, next) {
  try {
    await fetchDataApiReady()

    return res.status(200).json({
      success: true,
      message: 'Backend sẵn sàng.',
      data: {
        service: 'shopnova-backend',
        status: 'ready',
        dataApi: 'connected',
        database: 'connected',
      },
    })
  } catch (err) {
    if (err instanceof DataApiClientError) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        error: {
          code: err.code,
        },
      })
    }

    // Lỗi không mong đợi -> chuyển tiếp cho global errorHandler xử lý
    next(err)
  }
}
