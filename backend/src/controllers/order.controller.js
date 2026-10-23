import crypto from 'node:crypto'
import {
  createOrder as dataCreateOrder,
  fetchOrders as dataFetchOrders,
  fetchOrderDetail as dataFetchOrderDetail,
  cancelOrder as dataCancelOrder,
  DataApiClientError,
} from '../clients/data.client.js'

/**
 * POST /api/v1/orders
 * Đặt hàng mới (từ giỏ hàng hoặc mua ngay), yêu cầu đăng nhập.
 */
export async function createOrder(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Bạn cần đăng nhập để thực hiện đặt hàng.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const {
      recipientName,
      recipientPhone,
      province,
      district,
      ward,
      addressDetail,
      note,
      paymentMethod = 'cod',
      voucherCode,
      idempotencyKey,
      items,
    } = req.body

    if (!recipientName || typeof recipientName !== 'string' || recipientName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tên người nhận hàng không được để trống.',
        error: { code: 'VALIDATION_ERROR', field: 'recipientName' },
      })
    }

    if (!recipientPhone || typeof recipientPhone !== 'string' || recipientPhone.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại người nhận không được để trống.',
        error: { code: 'VALIDATION_ERROR', field: 'recipientPhone' },
      })
    }

    if (!province || typeof province !== 'string' || province.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tỉnh/Thành phố nhận hàng không được để trống.',
        error: { code: 'VALIDATION_ERROR', field: 'province' },
      })
    }

    if (!addressDetail || typeof addressDetail !== 'string' || addressDetail.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Địa chỉ chi tiết nhận hàng không được để trống.',
        error: { code: 'VALIDATION_ERROR', field: 'addressDetail' },
      })
    }

    // Kiểm tra tính hợp lệ của voucherCode nếu được truyền lên
    if (voucherCode !== undefined && voucherCode !== null) {
      if (typeof voucherCode !== 'string' || voucherCode.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Mã giảm giá không hợp lệ.',
          error: { code: 'INVALID_VOUCHER_CODE', field: 'voucherCode' },
        })
      }
    }

    // Tự sinh idempotencyKey nếu client không truyền
    const cleanIdempotencyKey =
      idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0
        ? idempotencyKey.trim()
        : crypto.randomUUID()

    const orderData = {
      userId,
      idempotencyKey: cleanIdempotencyKey,
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      province: province.trim(),
      district: district ? String(district).trim() : null,
      ward: ward ? String(ward).trim() : null,
      addressDetail: addressDetail.trim(),
      note: note ? String(note).trim() : null,
      paymentMethod,
      voucherCode:
        typeof voucherCode === 'string' && voucherCode.trim().length > 0
          ? voucherCode.trim().toUpperCase()
          : undefined,
      items: Array.isArray(items) ? items : undefined,
    }

    const createdOrder = await dataCreateOrder(orderData)

    return res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công.',
      data: createdOrder,
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
 * GET /api/v1/orders
 * Lấy danh sách lịch sử đơn hàng của người dùng.
 */
export async function getOrders(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Bạn cần đăng nhập để xem danh sách đơn hàng.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { status, page = '1', limit = '10' } = req.query

    const result = await dataFetchOrders({
      userId,
      status,
      page,
      limit,
    })

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đơn hàng thành công.',
      data: result.data,
      meta: result.meta,
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
 * GET /api/v1/orders/:orderId
 * Xem chi tiết một đơn hàng của người dùng.
 */
export async function getOrderDetail(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Bạn cần đăng nhập để xem chi tiết đơn hàng.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { orderId } = req.params
    if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mã đơn hàng không hợp lệ.',
        error: { code: 'INVALID_ORDER_ID' },
      })
    }

    const order = await dataFetchOrderDetail(orderId.trim(), userId)

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết đơn hàng thành công.',
      data: order,
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
 * PATCH /api/v1/orders/:orderId/cancel
 * Hủy đơn hàng khi còn ở trạng thái pending.
 */
export async function cancelOrder(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Bạn cần đăng nhập để hủy đơn hàng.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { orderId } = req.params
    const { reason = 'Khách hàng yêu cầu hủy đơn' } = req.body

    if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mã đơn hàng không hợp lệ.',
        error: { code: 'INVALID_ORDER_ID' },
      })
    }

    const result = await dataCancelOrder(orderId.trim(), { userId, reason })

    return res.status(200).json({
      success: true,
      message: 'Hủy đơn hàng thành công.',
      data: result,
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
