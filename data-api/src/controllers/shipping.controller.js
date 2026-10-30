import { executeQuery, executeTransaction } from '../config/database.js'

// Bộ nhớ đệm dự phòng mốc tracking nếu bảng shipment_trackings chưa chạy migration
const memoryShipmentTrackings = []
let memoryTrackingIdCounter = 1

function isTableMissingError(err) {
  return err?.original?.code === 'ER_NO_SUCH_TABLE' ||
         err?.code === 'ER_NO_SUCH_TABLE' ||
         String(err?.message || '').includes("doesn't exist")
}

/**
 * Tính phí vận chuyển động dựa trên tỉnh gửi, tỉnh nhận, khối lượng và giá trị đơn hàng
 */
export async function calculateShippingFee(req, res, next) {
  try {
    const { fromProvince, toProvince, weightGrams = 500, subtotal = 0, isMall = false } = req.body || {}

    const origin = String(fromProvince || 'TP. Hồ Chí Minh').trim()
    const destination = String(toProvince || 'TP. Hồ Chí Minh').trim()
    const weight = Math.max(100, Math.min(Number(weightGrams) || 500, 100000))
    const cartSubtotal = Math.max(0, Number(subtotal) || 0)

    // Kiểm tra nội thành / cùng tỉnh
    const isSameProvince = origin.toLowerCase() === destination.toLowerCase() ||
      (origin.toLowerCase().includes('hồ chí minh') && destination.toLowerCase().includes('hồ chí minh')) ||
      (origin.toLowerCase().includes('hà nội') && destination.toLowerCase().includes('hà nội'))

    // Phụ phí theo cân nặng (vượt 2kg thì mỗi 1000g thêm 5.000đ)
    const extraWeightKg = Math.max(0, Math.ceil((weight - 2000) / 1000))
    const weightSurcharge = extraWeightKg * 5000

    let standardFee = isSameProvince ? 16500 : 32000
    let expressFee = isSameProvince ? 30000 : 48000
    let savingsFee = isSameProvince ? 14000 : 24000

    standardFee += weightSurcharge
    expressFee += weightSurcharge * 1.5
    savingsFee += weightSurcharge

    // Giảm phí nếu đạt mốc miễn phí vận chuyển (>= 1.000.000đ hoặc shop Mall)
    let discount = 0
    if (cartSubtotal >= 1000000 || isMall) {
      discount = Math.min(30000, standardFee)
    }

    const options = [
      {
        id: 'standard',
        name: 'Giao hàng Tiêu chuẩn',
        carrier: isSameProvince ? 'Giao Hàng Nhanh (GHN)' : 'Viettel Post',
        originalFee: Math.round(standardFee),
        discount: Math.round(discount),
        fee: Math.max(0, Math.round(standardFee - discount)),
        estimatedDays: isSameProvince ? '1 - 2 ngày' : '2 - 4 ngày',
        isDefault: true,
      },
      {
        id: 'express',
        name: 'Giao hàng Hỏa tốc',
        carrier: 'AhaMove / GrabExpress',
        originalFee: Math.round(expressFee),
        discount: Math.round(Math.min(discount, 15000)),
        fee: Math.max(0, Math.round(expressFee - Math.min(discount, 15000))),
        estimatedDays: isSameProvince ? 'Trong ngày (2 - 4 giờ)' : '1 - 2 ngày',
        isDefault: false,
      },
      {
        id: 'savings',
        name: 'Giao hàng Tiết kiệm',
        carrier: 'Giao Hàng Tiết Kiệm (GHTK)',
        originalFee: Math.round(savingsFee),
        discount: Math.round(discount),
        fee: Math.max(0, Math.round(savingsFee - discount)),
        estimatedDays: isSameProvince ? '2 - 3 ngày' : '3 - 5 ngày',
        isDefault: false,
      },
    ]

    return res.status(200).json({
      success: true,
      message: 'Tính phí vận chuyển thành công.',
      data: {
        fromProvince: origin,
        toProvince: destination,
        weightGrams: weight,
        isSameProvince,
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
    const { userId, trackingCode, carrier = 'Giao Hàng Nhanh (GHN)', autoAdvanceStatus = true } = req.body || {}

    if (
      !/^[1-9]\d{0,19}$/.test(shopOrderId) ||
      !/^[1-9]\d{0,19}$/.test(String(userId || '')) ||
      typeof trackingCode !== 'string' ||
      !trackingCode.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin mã vận đơn không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const cleanCode = trackingCode.trim().toUpperCase().slice(0, 100)
    const cleanCarrier = String(carrier || 'Giao Hàng Nhanh (GHN)').trim().slice(0, 60)

    const result = await executeTransaction(async (query) => {
      const rows = await query(
        `SELECT so.id, so.order_id, so.status, so.shop_id, s.owner_id
         FROM shop_orders so
         JOIN shops s ON s.id = so.shop_id
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

    // Thử thêm mốc vận chuyển khởi đầu vào shipment_trackings
    try {
      await executeQuery(
        `INSERT INTO shipment_trackings (shop_order_id, tracking_code, carrier, status, location, description)
         VALUES (?, ?, ?, 'manifest_created', 'Kho người bán', 'Đã tạo mã vận đơn và sẵn sàng bàn giao cho bưu tá')`,
        [shopOrderId, cleanCode, cleanCarrier],
      )
    } catch (err) {
      if (!isTableMissingError(err)) throw err
      memoryShipmentTrackings.push({
        id: String(memoryTrackingIdCounter++),
        shopOrderId: String(shopOrderId),
        trackingCode: cleanCode,
        carrier: cleanCarrier,
        status: 'manifest_created',
        location: 'Kho người bán',
        description: 'Đã tạo mã vận đơn và sẵn sàng bàn giao cho bưu tá',
        eventTime: new Date().toISOString(),
      })
    }

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
 * Tra cứu tiến trình và hành trình bưu kiện của đơn hàng
 */
export async function getOrderTracking(req, res, next) {
  try {
    const orderId = req.params.orderId
    const userId = req.query.userId

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
        if (!isTableMissingError(err)) throw err
        timeline = memoryShipmentTrackings
          .filter((t) => String(t.shopOrderId) === String(item.shop_order_id))
          .map((t) => ({
            status: t.status,
            location: t.location,
            description: t.description,
            time: t.eventTime,
          }))
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
