import { callDataApi } from '../clients/data.client.js'

/**
 * Tính toán phí vận chuyển động theo địa chỉ người gửi, người nhận, cân nặng và giá trị đơn hàng
 */
export async function calculateShippingFee(req, res, next) {
  try {
    const { fromProvince, toProvince, weightGrams, subtotal, isMall } = req.body || {}

    const result = await callDataApi('/internal/v1/shipping/calculate', {
      method: 'POST',
      body: {
        fromProvince,
        toProvince,
        weightGrams: typeof weightGrams === 'number' ? weightGrams : undefined,
        subtotal: typeof subtotal === 'number' ? subtotal : undefined,
        isMall: Boolean(isMall),
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Tính toán phí vận chuyển thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller cập nhật mã vận đơn và đơn vị vận chuyển cho đơn hàng của shop
 */
export async function updateOrderTracking(req, res, next) {
  try {
    const shopOrderId = req.params.shopOrderId
    const { trackingCode, carrier, autoAdvanceStatus } = req.body || {}

    if (typeof trackingCode !== 'string' || !trackingCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Mã vận đơn là bắt buộc.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi(`/internal/v1/seller/orders/${encodeURIComponent(shopOrderId)}/tracking`, {
      method: 'PATCH',
      body: {
        userId: req.user.id,
        trackingCode: trackingCode.trim(),
        carrier: typeof carrier === 'string' ? carrier.trim() : undefined,
        autoAdvanceStatus: autoAdvanceStatus !== false,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Cập nhật mã vận đơn thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Buyer hoặc Seller tra cứu hành trình chi tiết của các bưu kiện trong đơn hàng
 */
export async function getOrderTracking(req, res, next) {
  try {
    const orderId = req.params.orderId
    const result = await callDataApi(
      `/internal/v1/orders/${encodeURIComponent(orderId)}/tracking?userId=${encodeURIComponent(req.user.id)}`,
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}
