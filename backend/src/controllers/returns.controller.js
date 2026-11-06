import { callDataApi } from '../clients/data.client.js'

const validBodyId = (value) => (typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))) && /^[1-9]\d{0,19}$/.test(String(value))

/**
 * Buyer gửi yêu cầu trả hàng / hoàn tiền cho một đơn hàng con
 */
export async function createOrderReturn(req, res, next) {
  try {
    const orderId = req.params.orderId
    const { shopOrderId, reason, detail, images, refundAmount } = req.body || {}

    if (
      !/^[1-9]\d{0,19}$/.test(orderId) ||
      !validBodyId(shopOrderId) ||
      (refundAmount !== undefined && (!Number.isSafeInteger(refundAmount) || refundAmount <= 0)) ||
      typeof reason !== 'string' || !reason.trim() || reason.trim().length > 255 ||
      (detail != null && (typeof detail !== 'string' || detail.trim().length > 2000)) ||
      (images != null && (!Array.isArray(images) || images.length > 5 || images.some((image) => typeof image !== 'string' || !image.trim() || image.length > 1024)))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin yêu cầu trả hàng không hợp lệ (mã đơn, lý do là bắt buộc).',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi(`/internal/v1/orders/${encodeURIComponent(orderId)}/returns`, {
      method: 'POST',
      body: {
        userId: req.user.id,
        shopOrderId,
        reason: reason.trim(),
        detail: typeof detail === 'string' ? detail.trim() : null,
        images: Array.isArray(images) ? images : [],
        refundAmount: typeof refundAmount === 'number' ? refundAmount : undefined,
      },
    })

    return res.status(201).json({
      success: true,
      message: 'Gửi yêu cầu trả hàng / hoàn tiền thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Buyer tra cứu danh sách yêu cầu trả hàng của đơn hàng
 */
export async function listOrderReturns(req, res, next) {
  try {
    const orderId = req.params.orderId
    const result = await callDataApi(
      `/internal/v1/orders/${encodeURIComponent(orderId)}/returns?userId=${encodeURIComponent(req.user.id)}`,
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller tra cứu danh sách yêu cầu hoàn hàng của các đơn thuộc shop
 */
export async function listSellerReturns(req, res, next) {
  try {
    const params = new URLSearchParams({ userId: String(req.user.id) })
    for (const key of ['status', 'limit', 'offset']) {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        params.set(key, String(req.query[key]))
      }
    }
    const result = await callDataApi(`/internal/v1/seller/returns?${params}`)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller xử lý duyệt hoặc từ chối yêu cầu trả hàng
 */
export async function updateSellerReturnStatus(req, res, next) {
  try {
    const returnId = req.params.returnId
    const { status, sellerNote } = req.body || {}

    if (!['approved', 'rejected', 'completed'].includes(status) ||
        (sellerNote != null && (typeof sellerNote !== 'string' || sellerNote.trim().length > 500))) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái xử lý không hợp lệ. Chỉ chấp nhận approved, rejected hoặc completed.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi(`/internal/v1/seller/returns/${encodeURIComponent(returnId)}/status`, {
      method: 'PATCH',
      body: {
        userId: req.user.id,
        status,
        sellerNote: typeof sellerNote === 'string' ? sellerNote.trim() : null,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái yêu cầu trả hàng thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}
