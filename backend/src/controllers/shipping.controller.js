import { callDataApi } from '../clients/data.client.js'
import { env } from '../config/env.js'
import {
  calculateCarriersShippingRates,
  dispatchOrderToCarrier,
  normalizeCarrierWebhookEvent,
  verifyCarrierWebhook,
} from '../services/third-party-logistics.js'

/**
 * Ước tính phí vận chuyển cho một shop theo bảng phí nội bộ ShopNova
 */
export async function calculateShippingFee(req, res, next) {
  try {
    const { fromProvince, toProvince, weightGrams, subtotal, isMall } = req.body || {}
    if (
      (fromProvince !== undefined && (typeof fromProvince !== 'string' || !fromProvince.trim() || fromProvince.length > 120)) ||
      (toProvince !== undefined && (typeof toProvince !== 'string' || !toProvince.trim() || toProvince.length > 120)) ||
      (weightGrams !== undefined && (!Number.isSafeInteger(weightGrams) || weightGrams < 1 || weightGrams > 30000)) ||
      (subtotal !== undefined && (!Number.isSafeInteger(subtotal) || subtotal < 0 || subtotal > 999999999999999)) ||
      (isMall !== undefined && typeof isMall !== 'boolean')
    ) {
      return res.status(400).json({ success: false, message: 'Thông tin tính phí vận chuyển không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    const result = await callDataApi('/internal/v1/shipping/calculate', {
      method: 'POST',
      body: {
        fromProvince,
        toProvince,
        weightGrams: typeof weightGrams === 'number' ? weightGrams : undefined,
        subtotal,
        isMall,
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
 * Báo giá và thời gian giao hàng thực tế từ các hãng vận chuyển 3PL (GHN, GHTK, Viettel Post)
 */
export async function calculate3PlRates(req, res, next) {
  try {
    const { fromProvince, toProvince, weightGrams, subtotal, isMall } = req.body || {}
    if (
      (fromProvince !== undefined && (typeof fromProvince !== 'string' || fromProvince.length > 120)) ||
      (toProvince !== undefined && (typeof toProvince !== 'string' || toProvince.length > 120)) ||
      (weightGrams !== undefined && (!Number.isSafeInteger(weightGrams) || weightGrams < 1 || weightGrams > 50000)) ||
      (subtotal !== undefined && (!Number.isSafeInteger(subtotal) || subtotal < 0)) ||
      (isMall !== undefined && typeof isMall !== 'boolean')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin tra cứu cước hãng vận chuyển không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const rates = await calculateCarriersShippingRates({
      fromProvince: fromProvince || 'Hồ Chí Minh',
      toProvince: toProvince || 'Hà Nội',
      weightGrams: weightGrams || 1000,
      subtotal: subtotal || 0,
      isMall: Boolean(isMall),
      config: env.logistics || {},
    })

    return res.status(200).json({
      success: true,
      message: 'Tra cứu bảng cước và thời gian giao hàng thực tế từ đối tác 3PL thành công.',
      data: {
        fromProvince: fromProvince || 'Hồ Chí Minh',
        toProvince: toProvince || 'Hà Nội',
        carriers: rates,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller cập nhật mã vận đơn thủ công cho shop order
 */
export async function updateOrderTracking(req, res, next) {
  try {
    const shopOrderId = req.params.shopOrderId
    const { trackingCode, carrier, autoAdvanceStatus } = req.body || {}

    if (typeof trackingCode !== 'string' || !trackingCode.trim() || trackingCode.trim().toUpperCase().length > 100 ||
        (carrier !== undefined && (typeof carrier !== 'string' || !carrier.trim() || carrier.trim().length > 60)) ||
        (autoAdvanceStatus !== undefined && typeof autoAdvanceStatus !== 'boolean')) {
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
 * Tự động đẩy đơn sang 3PL ngay khi Seller bấm "Xác nhận gửi hàng"
 * Tạo mã vận đơn thực tế và lịch hẹn bưu tá lấy hàng
 */
export async function dispatchOrder(req, res, next) {
  try {
    const shopOrderId = req.params.shopOrderId
    const { carrier = 'GHN' } = req.body || {}

    if (!/^[1-9]\d{0,19}$/.test(String(shopOrderId || '')) || typeof carrier !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Mã đơn hoặc đơn vị vận chuyển không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    // 1. Gọi API 3PL để sinh mã vận đơn và lịch hẹn bưu tá
    const carrierDispatch = await dispatchOrderToCarrier({
      carrier,
      shopOrderId,
      orderData: {
        shopPhone: req.user.phone || '0901234567',
        shopAddress: 'Kho hàng người bán',
      },
      config: env.logistics || {},
    })

    // 2. Gửi thông tin sang Data API để cập nhật vào database và lịch sử bưu kiện
    const result = await callDataApi(`/internal/v1/seller/orders/${encodeURIComponent(shopOrderId)}/dispatch`, {
      method: 'POST',
      body: {
        userId: req.user.id,
        trackingCode: carrierDispatch.trackingCode,
        carrier: carrierDispatch.carrier,
        pickupAppointment: carrierDispatch.pickupAppointment,
      },
    })

    return res.status(200).json({
      success: true,
      message: `Đã xác nhận gửi hàng và đẩy đơn sang ${carrierDispatch.carrierName} thành công.`,
      data: {
        ...result,
        carrierName: carrierDispatch.carrierName,
        pickupAppointment: carrierDispatch.pickupAppointment,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Webhook cập nhật hành trình tự động từ bưu tá (GHN, GHTK, Viettel Post)
 */
export async function carrierWebhook(req, res, next) {
  try {
    const carrier = req.params.carrier || 'GHN'

    // 1. Xác thực webhook
    const isValid = verifyCarrierWebhook({
      carrier,
      headers: req.headers,
      body: req.body,
      config: env.logistics || {},
    })

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Chữ ký hoặc mã xác thực Webhook không hợp lệ.',
        error: { code: 'UNAUTHORIZED_WEBHOOK' },
      })
    }

    // 2. Chuẩn hóa dữ liệu sự kiện hành trình từ bưu tá
    const event = normalizeCarrierWebhookEvent({
      carrier,
      body: req.body,
    })

    if (!event.trackingCode) {
      return res.status(400).json({
        success: false,
        message: 'Webhook thiếu mã vận đơn (tracking_code).',
        error: { code: 'MISSING_TRACKING_CODE' },
      })
    }

    // 3. Chuyển tiếp tới Data API cập nhật database và chuyển trạng thái
    const dataResult = await callDataApi('/internal/v1/shipping/webhook-event', {
      method: 'POST',
      body: event,
    })

    return res.status(200).json({
      success: true,
      message: 'Cập nhật hành trình tự động thành công.',
      data: dataResult,
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
