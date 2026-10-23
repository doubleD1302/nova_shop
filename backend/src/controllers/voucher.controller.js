import { fetchVouchers, fetchVoucherByCode, DataApiClientError } from '../clients/data.client.js'

/**
 * GET /api/v1/vouchers
 * Lấy danh sách mã giảm giá công khai trên sàn (có thể lọc theo ?code=...).
 */
export async function getVouchers(req, res, next) {
  try {
    const { code } = req.query || {}
    const vouchers = await fetchVouchers({ code })

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách mã giảm giá thành công.',
      data: vouchers,
    })
  } catch (err) {
    if (err instanceof DataApiClientError) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        error: { code: err.code },
      })
    }
    next(err)
  }
}

/**
 * GET /api/v1/vouchers/:code
 * Tra cứu chi tiết một mã giảm giá cụ thể theo mã code.
 */
export async function getVoucherDetail(req, res, next) {
  try {
    const { code } = req.params || {}

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mã giảm giá không hợp lệ.',
        error: { code: 'INVALID_CODE' },
      })
    }

    const voucher = await fetchVoucherByCode(code.trim().toUpperCase())

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin mã giảm giá thành công.',
      data: voucher,
    })
  } catch (err) {
    if (err instanceof DataApiClientError) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        error: { code: err.code },
      })
    }
    next(err)
  }
}
