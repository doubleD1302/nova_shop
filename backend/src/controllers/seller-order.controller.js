import {
  fetchSellerOrders,
  updateSellerOrderStatus as changeSellerOrderStatus,
} from '../clients/data.client.js'

/**
 * GET /api/v1/seller/orders
 * Danh sách đơn hàng con (`shop_orders`) chứa sản phẩm thuộc shop của seller đang đăng nhập.
 */
export async function getOrders(req, res, next) {
  try {
    const shopId = req.user.shopId

    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa được liên kết với bất kỳ gian hàng nào.',
        error: { code: 'SHOP_REQUIRED' },
      })
    }

    const { status, page, limit } = req.query
    const result = await fetchSellerOrders(shopId, { status, page, limit })

    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/seller/orders/:shopOrderId/status
 * Đổi trạng thái xử lý đơn (pending -> confirmed -> shipping -> delivered, hoặc hủy)
 */
export async function updateOrderStatus(req, res, next) {
  try {
    const shopId = req.user.shopId
    const { shopOrderId } = req.params
    const { toStatus, note, cancelReason, trackingCode } = req.body || {}

    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa được liên kết với bất kỳ gian hàng nào.',
        error: { code: 'SHOP_REQUIRED' },
      })
    }

    if (!shopOrderId || !/^\d+$/.test(String(shopOrderId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã đơn hàng không hợp lệ.',
        error: { code: 'INVALID_ORDER_ID' },
      })
    }

    if (!toStatus) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái chuyển đổi không được để trống.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await changeSellerOrderStatus(shopOrderId, {
      shopId,
      toStatus,
      note,
      cancelReason,
      trackingCode,
      actorId: req.user.id,
    })

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái đơn hàng thành công.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}
