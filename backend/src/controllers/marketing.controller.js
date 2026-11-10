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
 * Lấy danh sách các chiến dịch marketing đang mở
 */
export async function listSellerCampaigns(req, res, next) {
  try {
    const data = await callDataApi('/internal/v1/marketing/campaigns')
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller đăng ký sản phẩm tham gia chiến dịch
 */
export async function registerSellerCampaign(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const { campaignId, productId, discountPrice, note } = req.body || {}

    if (!campaignId || !productId || typeof discountPrice !== 'number' || discountPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin đăng ký chiến dịch không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const data = await callDataApi('/internal/v1/seller/marketing/campaigns/register', {
      method: 'POST',
      body: {
        campaignId: String(campaignId),
        shopId,
        productId: String(productId),
        discountPrice: Math.round(discountPrice),
        note: note ? String(note).slice(0, 255) : '',
      },
    })

    return res.status(201).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Lấy danh sách đăng ký chiến dịch của shop
 */
export async function listSellerCampaignRegistrations(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const data = await callDataApi(`/internal/v1/seller/marketing/registrations?shopId=${encodeURIComponent(shopId)}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Mua gói đẩy sản phẩm (Quảng cáo / Boost)
 */
export async function buySellerProductBoost(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const { productId, packageType } = req.body || {}

    if (!productId || !packageType || typeof packageType !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Mã sản phẩm và gói đẩy không được để trống.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const data = await callDataApi('/internal/v1/seller/marketing/boost', {
      method: 'POST',
      body: {
        shopId,
        productId: String(productId),
        packageType: packageType.trim(),
      },
    })

    return res.status(201).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Lấy danh sách các gói đẩy sản phẩm của shop
 */
export async function listSellerProductBoosts(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const data = await callDataApi(`/internal/v1/seller/marketing/boosts?shopId=${encodeURIComponent(shopId)}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}
