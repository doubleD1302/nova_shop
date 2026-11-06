import { executeQuery, executeTransaction } from '../config/database.js'
import { calculateShippingOptions } from '../utils/shipping.js'
import { isValidAmount } from '../utils/money.js'
import { getWeatherRisk } from '../services/weather.js'

function isTableMissingError(err) {
  return err?.original?.code === 'ER_NO_SUCH_TABLE' ||
         err?.code === 'ER_NO_SUCH_TABLE' ||
         String(err?.message || '').includes("doesn't exist")
}

/**
 * Ước tính phí cho một shop. Checkout tính lại bằng dữ liệu sản phẩm trên server.
 */
export async function calculateShippingFee(req, res, next) {
  try {
    const { fromProvince, toProvince, weightGrams, subtotal = 0, isMall } = req.body || {}
    if (!isValidAmount(subtotal) ||
        (fromProvince !== undefined && (typeof fromProvince !== 'string' || !fromProvince.trim() || fromProvince.length > 120)) ||
        (toProvince !== undefined && (typeof toProvince !== 'string' || !toProvince.trim() || toProvince.length > 120)) ||
        (weightGrams !== undefined && (!Number.isSafeInteger(weightGrams) || weightGrams < 1 || weightGrams > 30000)) ||
        (isMall !== undefined && typeof isMall !== 'boolean')) {
      return res.status(400).json({ success: false, message: 'Thông tin tính phí vận chuyển không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const weatherRisk = await getWeatherRisk(toProvince)
    const options = calculateShippingOptions({ subtotal, fromProvince, toProvince, weightGrams, weatherRisk })

    return res.status(200).json({
      success: true,
      message: 'Tính phí vận chuyển thành công.',
      data: {
        estimated: true,
        note: 'Cước ShopNova ước tính theo vùng, khối lượng và thời điểm; thời tiết được xét khi dịch vụ dự báo đã cấu hình. Checkout tính lại từ sản phẩm và địa chỉ trên server.',
        options,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller cập nhật mã vận đơn (tracking_code) và đơn vị vận chuyển cho shop_order
 */
export async function updateOrderTracking(req, res, next) {
  try {
    const shopOrderId = req.params.shopOrderId
    const { userId, trackingCode, carrier = 'ShopNova', autoAdvanceStatus = true } = req.body || {}

    if (
      !/^[1-9]\d{0,19}$/.test(shopOrderId) ||
      !/^[1-9]\d{0,19}$/.test(String(userId || '')) ||
      typeof trackingCode !== 'string' || !trackingCode.trim() || trackingCode.trim().toUpperCase().length > 100 ||
      typeof carrier !== 'string' || !carrier.trim() || carrier.trim().length > 60 ||
      typeof autoAdvanceStatus !== 'boolean'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin mã vận đơn không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const cleanCode = trackingCode.trim().toUpperCase()
    const cleanCarrier = carrier.trim()

    const result = await executeTransaction(async (query) => {
      const rows = await query(
        `SELECT so.id, so.order_id, so.status, so.shop_id, s.owner_id, o.payment_method
         FROM shop_orders so
         JOIN shops s ON s.id = so.shop_id
         JOIN orders o ON o.id = so.order_id
         WHERE so.id = ? FOR UPDATE`,
        [shopOrderId],
      )

      if (!rows.length || String(rows[0].owner_id) !== String(userId)) {
        return { error: 'ORDER_NOT_FOUND' }
      }

      const shopOrder = rows[0]
      if (['delivered', 'cancelled'].includes(shopOrder.status)) {
        return { error: 'INVALID_STATUS_FOR_TRACKING' }
      }
      if (shopOrder.payment_method !== 'cod') {
        const payments = await query('SELECT status FROM payments WHERE shop_order_id = ? FOR UPDATE', [shopOrderId])
        if (payments[0]?.status !== 'paid') return { error: 'PAYMENT_REQUIRED' }
      }

      // Tự động chuyển từ 'confirmed' hoặc 'pending' sang 'shipping' khi gán mã vận đơn
      const nextStatus = (autoAdvanceStatus && shopOrder.status === 'confirmed') ? 'shipping' : shopOrder.status

      await query(
        `UPDATE shop_orders
         SET tracking_code = ?, shipping_name = ?, status = ?, updated_at = UTC_TIMESTAMP(3)
         WHERE id = ?`,
        [cleanCode, cleanCarrier, nextStatus, shopOrderId],
      )

      // Ghi nhận sự kiện nếu có đổi trạng thái
      if (nextStatus !== shopOrder.status) {
        await query(
          `INSERT INTO order_events (shop_order_id, from_status, to_status, actor_id, note)
           VALUES (?, ?, ?, ?, ?)`,
          [shopOrderId, shopOrder.status, nextStatus, userId, `Gán mã vận đơn ${cleanCode} (${cleanCarrier})`],
        )
      }

      await query(
        `INSERT INTO shipment_trackings (shop_order_id, tracking_code, carrier, status, location, description)
         VALUES (?, ?, ?, 'manifest_created', 'Kho người bán', 'Đã tạo mã vận đơn và sẵn sàng bàn giao cho bưu tá')`,
        [shopOrderId, cleanCode, cleanCarrier],
      )
      return {
        id: String(shopOrderId),
        trackingCode: cleanCode,
        carrier: cleanCarrier,
        status: nextStatus,
      }
    })

    if (result.error === 'ORDER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng của người bán.',
        error: { code: 'ORDER_NOT_FOUND' },
      })
    }
    if (result.error === 'INVALID_STATUS_FOR_TRACKING') {
      return res.status(400).json({
        success: false,
        message: 'Không thể cập nhật mã vận đơn cho đơn hàng đã hoàn tất hoặc đã hủy.',
        error: { code: 'INVALID_STATUS_FOR_TRACKING' },
      })
    }
    if (result.error === 'PAYMENT_REQUIRED') {
      return res.status(409).json({ success: false, message: 'Cần xác nhận thanh toán trước khi giao hàng.', error: { code: 'PAYMENT_REQUIRED' } })
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật mã vận đơn thành công.',
      data: result,
    })
  } catch (err) {
    if (isTableMissingError(err)) return res.status(503).json({ success: false, message: 'Dữ liệu chưa sẵn sàng.', error: { code: 'DATA_STORAGE_UNAVAILABLE' } })
    return next(err)
  }
}

/**
 * Tra cứu tiến trình và hành trình bưu kiện của đơn hàng
 */
export async function getOrderTracking(req, res, next) {
  try {
    const orderId = req.params.orderId
    const userId = req.query.userId
    if (!/^[1-9]\d{0,19}$/.test(orderId) || typeof userId !== 'string' || !/^[1-9]\d{0,19}$/.test(userId)) {
      return res.status(400).json({ success: false, message: 'Mã đơn hoặc tài khoản không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    // 1. Kiểm tra đơn hàng thuộc về user (hoặc user là seller của một shop order)
    const rows = await executeQuery(
      `SELECT so.id AS shop_order_id, so.order_id, so.shop_name, so.status,
              so.shipping_method, so.shipping_name, so.tracking_code, so.delivered_at, so.created_at,
              o.recipient_name, o.recipient_phone, o.province, o.district, o.address_detail
       FROM shop_orders so
       JOIN orders o ON o.id = so.order_id
       LEFT JOIN shops s ON s.id = so.shop_id
       WHERE o.id = ? AND (o.buyer_id = ? OR s.owner_id = ?)`,
      [orderId, userId, userId],
    )

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin đơn hàng.',
        error: { code: 'ORDER_NOT_FOUND' },
      })
    }

    const trackingsResult = []

    for (const item of rows) {
      let timeline = []
      const code = item.tracking_code || `NOVA-${item.shop_order_id}`

      try {
        const trackRows = await executeQuery(
          `SELECT * FROM shipment_trackings WHERE shop_order_id = ? ORDER BY event_time ASC`,
          [item.shop_order_id],
        )
        timeline = trackRows.map((t) => ({
          status: t.status,
          location: t.location,
          description: t.description,
          time: t.event_time,
        }))
      } catch (err) {
        if (isTableMissingError(err)) return res.status(503).json({ success: false, message: 'Dữ liệu chưa sẵn sàng.', error: { code: 'DATA_STORAGE_UNAVAILABLE' } })
        throw err
      }

      // Nếu chưa có mốc chi tiết trong bảng tracking, tạo timeline tự động dựa trên trạng thái đơn hàng
      if (!timeline.length) {
        timeline.push({
          status: 'manifest_created',
          location: 'Kho gian hàng',
          description: 'Người bán đang chuẩn bị hàng',
          time: item.created_at,
        })
        if (['shipping', 'delivered'].includes(item.status)) {
          timeline.push({
            status: 'in_transit',
            location: 'Trung tâm khai thác trung chuyển',
            description: 'Kiện hàng đang được luân chuyển qua các bưu cục',
            time: item.created_at,
          })
        }
        if (item.status === 'delivered') {
          timeline.push({
            status: 'delivered',
            location: `${item.district || ''}, ${item.province}`,
            description: 'Giao hàng thành công cho người nhận',
            time: item.delivered_at || new Date().toISOString(),
          })
        }
      }

      trackingsResult.push({
        shopOrderId: String(item.shop_order_id),
        shopName: item.shop_name,
        carrier: item.shipping_name || 'Đơn vị vận chuyển tiêu chuẩn',
        shippingMethod: item.shipping_method,
        trackingCode: item.tracking_code || null,
        currentStatus: item.status,
        recipient: {
          name: item.recipient_name,
          phone: item.recipient_phone,
          address: `${item.address_detail}, ${item.district || ''}, ${item.province}`,
        },
        timeline,
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: String(orderId),
        packages: trackingsResult,
      },
    })
  } catch (err) {
    return next(err)
  }
}
