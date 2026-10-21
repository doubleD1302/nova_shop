import {
  fetchSellerShop,
  updateSellerShop as modifySellerShop,
  fetchSellerDashboard,
  registerSellerShop,
} from '../clients/data.client.js'
import { signAccessToken } from '../middlewares/auth.middleware.js'

/**
 * POST /api/v1/seller/register-shop
 * Cho phép tài khoản (buyer hoặc mới) đăng ký mở gian hàng và nhận quyền seller.
 */
export async function registerShop(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập để mở gian hàng.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { shopName, province, tagline } = req.body || {}
    if (!shopName || typeof shopName !== 'string' || shopName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tên gian hàng không được để trống.',
        error: { code: 'VALIDATION_ERROR', field: 'shopName' },
      })
    }

    const result = await registerSellerShop(userId, { shopName, province, tagline })

    // Cấp mới token mang quyền seller cho người dùng
    const updatedUser = {
      ...req.user,
      role: 'seller',
      shopId: result.shopId,
    }
    const token = signAccessToken(updatedUser)

    return res.status(201).json({
      success: true,
      message: 'Đăng ký gian hàng thành công.',
      data: {
        token,
        shop: result,
        user: updatedUser,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/seller/shop
 * Lấy thông tin gian hàng của seller đang đăng nhập.
 */
export async function getShop(req, res, next) {
  try {
    const shopId = req.user.shopId || req.user.id
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
    const shopId = req.user.shopId || req.user.id
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
    const shopId = req.user.shopId || req.user.id
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

