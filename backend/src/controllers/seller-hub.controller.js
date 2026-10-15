import {
  fetchSellerShop,
  updateSellerShop as modifySellerShop,
  fetchSellerDashboard,
} from '../clients/data.client.js'

/**
 * GET /api/v1/seller/shop
 * Lấy thông tin gian hàng của seller đang đăng nhập.
 */
export async function getShop(req, res, next) {
  try {
    const shopId = req.user.shopId
    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa được liên kết với bất kỳ gian hàng nào.',
        error: { code: 'SHOP_REQUIRED' },
      })
    }

    const shop = await fetchSellerShop(shopId)

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin gian hàng thành công.',
      data: shop,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/v1/seller/shop
 * Cập nhật cấu hình gian hàng (logo, banner, tagline, mô tả, địa chỉ).
 */
export async function updateShop(req, res, next) {
  try {
    const shopId = req.user.shopId
    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa được liên kết với bất kỳ gian hàng nào.',
        error: { code: 'SHOP_REQUIRED' },
      })
    }

    const result = await modifySellerShop(shopId, req.body || {})

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin gian hàng thành công.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/seller/dashboard
 * Thống kê doanh thu, đơn hàng và cảnh báo tồn kho cho seller.
 */
export async function getDashboard(req, res, next) {
  try {
    const shopId = req.user.shopId
    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa được liên kết với bất kỳ gian hàng nào.',
        error: { code: 'SHOP_REQUIRED' },
      })
    }

    const dashboard = await fetchSellerDashboard(shopId)

    return res.status(200).json({
      success: true,
      message: 'Lấy dữ liệu thống kê dashboard thành công.',
      data: dashboard,
    })
  } catch (err) {
    next(err)
  }
}
