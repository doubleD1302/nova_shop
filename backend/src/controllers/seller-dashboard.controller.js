import { callDataApi } from '../clients/data.client.js'

function getShopId(req, res) {
  const shopId = req.user?.shopId
  if (!shopId) {
    res.status(403).json({
      success: false,
      message: 'Tài khoản của bạn chưa liên kết với gian hàng nào.',
      error: { code: 'SHOP_NOT_FOUND' },
    })
    return null
  }
  return String(shopId)
}

/**
 * Controller trả về dữ liệu thống kê tổng quan Kênh Người Bán
 * Endpoint: GET /api/v1/seller/dashboard?days=7|30
 */
export async function getSellerDashboard(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    // Data API kiểm tra days (7 hoặc 30)
    const params = new URLSearchParams({ shopId })
    if (req.query.days !== undefined && req.query.days !== '') params.set('days', String(req.query.days))

    const data = await callDataApi(`/internal/v1/seller/dashboard?${params}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}
