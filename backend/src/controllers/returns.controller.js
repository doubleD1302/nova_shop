import { callDataApi } from '../clients/data.client.js'
import { notifyUser } from '../services/notification.service.js'

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
 * Buyer tra cứu danh sách yêu cầu trả hàng của một đơn hàng cụ thể
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
 * Buyer tra cứu toàn bộ danh sách yêu cầu trả hàng của cá nhân trên sàn
 * Endpoint: GET /api/v1/returns
 */
export async function listAllBuyerReturns(req, res, next) {
  try {
    const params = new URLSearchParams({ userId: String(req.user.id) })
    for (const key of ['status', 'limit', 'offset']) {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        params.set(key, String(req.query[key]))
      }
    }
    const result = await callDataApi(`/internal/v1/returns?${params}`)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

/**
 * Buyer hủy yêu cầu trả hàng khi còn chờ duyệt
 * Endpoint: PATCH /api/v1/returns/:returnId/cancel
 */
export async function cancelBuyerReturn(req, res, next) {
  try {
    const returnId = req.params.returnId
    if (!/^[1-9]\d{0,19}$/.test(returnId)) {
      return res.status(400).json({
        success: false,
        message: 'Mã yêu cầu trả hàng không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi(`/internal/v1/returns/${encodeURIComponent(returnId)}/cancel`, {
      method: 'PATCH',
      body: { userId: req.user.id },
    })

    return res.status(200).json({
      success: true,
      message: 'Đã hủy yêu cầu trả hàng thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Buyer gửi khiếu nại lên Admin sau khi Người bán từ chối
 * Endpoint: POST /api/v1/returns/:returnId/dispute
 */
export async function disputeBuyerReturn(req, res, next) {
  try {
    const returnId = req.params.returnId
    const { disputeReason } = req.body || {}
    if (
      !/^[1-9]\d{0,19}$/.test(returnId) ||
      typeof disputeReason !== 'string' ||
      !disputeReason.trim() ||
      disputeReason.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: 'Lý do khiếu nại lên sàn là bắt buộc (tối đa 1000 ký tự).',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi(`/internal/v1/returns/${encodeURIComponent(returnId)}/dispute`, {
      method: 'POST',
      body: {
        userId: req.user.id,
        disputeReason: disputeReason.trim(),
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Gửi khiếu nại tranh chấp lên Admin thành công.',
      data: result,
    })
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

/**
 * Admin xem danh sách toàn bộ khiếu nại trả hàng trên sàn
 * Endpoint: GET /api/v1/admin/returns
 */
export async function listAdminReturns(req, res, next) {
  try {
    const params = new URLSearchParams()
    for (const key of ['status', 'shopId', 'limit', 'offset']) {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        params.set(key, String(req.query[key]))
      }
    }
    const result = await callDataApi(`/internal/v1/admin/returns?${params}`)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

/**
 * Trọng tài Admin phân xử khiếu nại trả hàng
 * Endpoint: PATCH /api/v1/admin/returns/:returnId/resolve
 */
export async function resolveAdminReturnDispute(req, res, next) {
  try {
    const returnId = req.params.returnId
    const { resolution, adminNote } = req.body || {}

    if (
      !/^[1-9]\d{0,19}$/.test(returnId) ||
      !['approve', 'reject'].includes(resolution) ||
      typeof adminNote !== 'string' ||
      !adminNote.trim() ||
      adminNote.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message: 'Quyết định phân xử (approve/reject) và ghi chú lý do phân xử là bắt buộc (tối đa 500 ký tự).',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi(`/internal/v1/admin/returns/${encodeURIComponent(returnId)}/resolve`, {
      method: 'PATCH',
      body: {
        adminId: req.user.id,
        resolution,
        adminNote: adminNote.trim(),
      },
    })

    // Gửi thông báo cho người mua khi Admin hoàn tất phân xử
    if (result?.buyerId) {
      notifyUser({
        userId: result.buyerId,
        title: resolution === 'approve' ? 'Khiếu nại trả hàng được chấp thuận' : 'Khiếu nại trả hàng bị từ chối',
        content: `Ban quản trị đã ${resolution === 'approve' ? 'chấp thuận hoàn tiền' : 'bác bỏ yêu cầu'} cho khiếu nại #${returnId}: ${adminNote.trim()}`,
        type: 'order',
        link: '/tai-khoan/don-hang',
        metadata: { returnId, resolution },
      }).catch(() => {})
    }

    return res.status(200).json({
      success: true,
      message: result?.message || 'Phân xử khiếu nại thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}
