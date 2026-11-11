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
 * Endpoint: GET /api/v1/seller/dashboard
 */
export async function getSellerDashboard(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const data = await callDataApi(`/internal/v1/seller/dashboard?shopId=${encodeURIComponent(shopId)}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}
