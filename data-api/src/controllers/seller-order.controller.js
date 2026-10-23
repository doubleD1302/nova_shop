import { executeQuery, executeTransaction } from '../config/database.js'

/**
 * Các trạng thái hợp lệ của shop_orders
 */
const VALID_STATUSES = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled']

/**
 * Quy tắc chuyển trạng thái hợp lệ cho seller:
 * - pending -> confirmed hoặc cancelled
 * - confirmed -> shipping hoặc cancelled
 * - shipping -> delivered hoặc cancelled
 * - delivered -> không thể đổi
 * - cancelled -> không thể đổi
 */
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}

/**
 * Định dạng đơn con trả về cho seller
 */
function formatSellerOrder(so, items = []) {
  return {
    id: String(so.id),
    orderId: String(so.order_id),
    orderCode: so.order_code,
    shopId: String(so.shop_id),
    shopName: so.shop_name,
    status: so.status,
    subtotal: Number(so.subtotal),
    shippingFee: Number(so.shipping_fee),
    discountAmount: Number(so.discount_amount),
    totalAmount: Number(so.total_amount),
    shippingMethod: so.shipping_method,
    shippingName: so.shipping_name,
    trackingCode: so.tracking_code || null,
    recipient: {
      name: so.recipient_name,
      phone: so.recipient_phone,
      province: so.province,
      district: so.district || null,
      ward: so.ward || null,
      addressDetail: so.address_detail,
      note: so.order_note || null,
    },
    cancelReason: so.cancel_reason || null,
    cancelledAt: so.cancelled_at ? new Date(so.cancelled_at).toISOString() : null,
    deliveredAt: so.delivered_at ? new Date(so.delivered_at).toISOString() : null,
    createdAt: so.created_at ? new Date(so.created_at).toISOString() : null,
    updatedAt: so.updated_at ? new Date(so.updated_at).toISOString() : null,
    items: items.map((it) => ({
      id: String(it.id),
      productId: String(it.product_id),
      variantId: String(it.variant_id),
      productName: it.product_name,
      productSlug: it.product_slug,
      variantName: it.variant_name,
      variantAttributes: it.variant_attributes,
      sku: it.sku,
      imageUrl: it.image_url,
      unitPrice: Number(it.unit_price),
      originalPrice: it.original_price ? Number(it.original_price) : null,
      qty: Number(it.qty),
      lineTotal: Number(it.line_total),
    })),
  }
}

/**
 * GET /internal/v1/seller/orders
 * Lấy danh sách đơn hàng con thuộc shop của người bán.
 */
export async function getSellerOrders(req, res, next) {
  try {
    const { shopId, status, page = '1', limit = '10' } = req.query

    if (!shopId || !/^\d+$/.test(String(shopId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã gian hàng shopId không hợp lệ.',
        error: { code: 'INVALID_SHOP_ID' },
      })
    }

    const numericShopId = BigInt(shopId)
    const parsedPage = Math.max(1, Number(page) || 1)
    const parsedLimit = Math.min(50, Math.max(1, Number(limit) || 10))
    const offset = (parsedPage - 1) * parsedLimit

    const whereClauses = ['so.shop_id = ?']
    const params = [numericShopId]

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Trạng thái đơn hàng không hợp lệ.',
          error: { code: 'INVALID_STATUS' },
        })
      }
      whereClauses.push('so.status = ?')
      params.push(status)
    }

    const whereSql = whereClauses.join(' AND ')

    // Đếm tổng số đơn con
    const countSql = `SELECT COUNT(*) AS total FROM shop_orders so WHERE ${whereSql}`
    const countRows = await executeQuery(countSql, params)
    const total = Number(countRows[0]?.total || 0)

    // Lấy danh sách shop_orders kèm thông tin đơn cha (người nhận, mã đơn)
    const sql = `
      SELECT so.id, so.order_id, so.shop_id, so.shop_name, so.status,
             so.subtotal, so.shipping_fee, so.discount_amount, so.total_amount,
             so.shipping_method, so.shipping_name, so.tracking_code,
             so.cancel_reason, so.cancelled_at, so.delivered_at, so.created_at, so.updated_at,
             o.code AS order_code, o.recipient_name, o.recipient_phone,
             o.province, o.district, o.ward, o.address_detail, o.note AS order_note
      FROM shop_orders so
      JOIN orders o ON o.id = so.order_id
      WHERE ${whereSql}
      ORDER BY so.created_at DESC, so.id DESC
      LIMIT ? OFFSET ?
    `
    const shopOrderRows = await executeQuery(sql, [...params, parsedLimit, offset])

    // Lấy items cho các đơn con
    let formattedOrders = []
    if (shopOrderRows && shopOrderRows.length > 0) {
      const shopOrderIds = shopOrderRows.map((so) => so.id)
      const placeholders = shopOrderIds.map(() => '?').join(',')
      const itemsSql = `
        SELECT id, shop_order_id, product_id, variant_id, product_name,
               product_slug, variant_name, variant_attributes, sku, image_url,
               unit_price, original_price, qty, line_total
        FROM order_items
        WHERE shop_order_id IN (${placeholders})
        ORDER BY id ASC
      `
      const itemRows = await executeQuery(itemsSql, shopOrderIds)

      const itemsByShopOrder = new Map()
      for (const it of itemRows) {
        const soId = String(it.shop_order_id)
        if (!itemsByShopOrder.has(soId)) itemsByShopOrder.set(soId, [])
        itemsByShopOrder.get(soId).push(it)
      }

      formattedOrders = shopOrderRows.map((so) =>
        formatSellerOrder(so, itemsByShopOrder.get(String(so.id)) || []),
      )
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đơn hàng cho người bán thành công.',
      data: formattedOrders,
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit) || 1,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /internal/v1/seller/orders/:shopOrderId/status
 * Người bán cập nhật trạng thái đơn con của shop mình.
 */
export async function updateSellerOrderStatus(req, res, next) {
  try {
    const { shopOrderId } = req.params
    const { shopId, toStatus, note, cancelReason, trackingCode, actorId } = req.body || {}

    if (!shopOrderId || !/^\d+$/.test(String(shopOrderId)) || !shopId || !/^\d+$/.test(String(shopId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã đơn hàng hoặc mã gian hàng không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    if (!toStatus || !VALID_STATUSES.includes(toStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái chuyển đổi không hợp lệ.',
        error: { code: 'INVALID_STATUS' },
      })
    }

    const numericShopOrderId = BigInt(shopOrderId)
    const numericShopId = BigInt(shopId)
    const numericActorId = actorId && /^\d+$/.test(String(actorId)) ? BigInt(actorId) : null

    const result = await executeTransaction(async (query) => {
      // 1. Khóa và lấy thông tin shop_order
      const checkSql = `
        SELECT id, order_id, shop_id, status
        FROM shop_orders
        WHERE id = ? AND shop_id = ?
        FOR UPDATE
      `
      const rows = await query(checkSql, [numericShopOrderId, numericShopId])
      if (!rows || rows.length === 0) {
        const err = new Error('Không tìm thấy đơn hàng của shop hoặc không có quyền thao tác.')
        err.status = 404
        err.code = 'ORDER_NOT_FOUND'
        throw err
      }

      const currentOrder = rows[0]
      const currentStatus = currentOrder.status

      if (currentStatus === toStatus) {
        return {
          id: String(numericShopOrderId),
          status: currentStatus,
          unchanged: true,
        }
      }

      const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || []
      if (!allowedNext.includes(toStatus)) {
        const err = new Error(
          `Không thể chuyển trạng thái từ '${currentStatus}' sang '${toStatus}'.`,
        )
        err.status = 400
        err.code = 'INVALID_STATUS_TRANSITION'
        throw err
      }

      // 2. Cập nhật trạng thái
      const updateFields = ['status = ?', 'updated_at = NOW(3)']
      const updateParams = [toStatus]

      if (toStatus === 'delivered') {
        updateFields.push('delivered_at = NOW(3)')
      }

      if (toStatus === 'cancelled') {
        updateFields.push('cancelled_at = NOW(3)')
        updateFields.push('cancel_reason = ?')
        updateParams.push(cancelReason ? String(cancelReason).trim() : 'Người bán hủy đơn')
      }

      if (trackingCode && typeof trackingCode === 'string' && trackingCode.trim().length > 0) {
        updateFields.push('tracking_code = ?')
        updateParams.push(trackingCode.trim())
      }

      updateParams.push(numericShopOrderId)
      await query(
        `UPDATE shop_orders SET ${updateFields.join(', ')} WHERE id = ?`,
        updateParams,
      )

      // 3. Nếu hủy đơn: HOÀN TỒN KHO cho các SKU thuộc đơn con này
      if (toStatus === 'cancelled') {
        const items = await query(
          'SELECT id, variant_id, qty FROM order_items WHERE shop_order_id = ?',
          [numericShopOrderId],
        )

        for (const item of items) {
          // Ghi nhận sổ biến động kho
          await query(
            `INSERT INTO stock_moves (variant_id, order_item_id, reason, delta_qty, actor_id, note)
             VALUES (?, ?, 'cancel', ?, ?, ?)`,
            [
              item.variant_id,
              item.id,
              item.qty,
              numericActorId,
              cancelReason || 'Người bán hủy đơn',
            ],
          )

          // Hoàn lại số lượng tồn kho
          await query(
            'UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?',
            [item.qty, item.variant_id],
          )
        }

        // Kiểm tra xem tất cả các shop_orders của đơn cha này đã bị hủy hết chưa
        const remainingActiveShops = await query(
          `SELECT COUNT(*) AS activeCount FROM shop_orders WHERE order_id = ? AND status != 'cancelled'`,
          [currentOrder.order_id],
        )
        const activeCount = Number(remainingActiveShops[0]?.activeCount || 0)
        if (activeCount === 0) {
          // Toàn bộ các shop_orders trong đơn cha đã bị hủy: tự động hoàn trả voucher cho người mua
          const appliedVoucherRows = await query(
            `SELECT id, voucher_id FROM voucher_uses WHERE order_id = ? AND state = 'applied' FOR UPDATE`,
            [currentOrder.order_id],
          )
          if (appliedVoucherRows && appliedVoucherRows.length > 0) {
            for (const vu of appliedVoucherRows) {
              await query(
                `UPDATE voucher_uses SET state = 'released', released_at = NOW(3) WHERE id = ?`,
                [vu.id],
              )
              await query(
                `UPDATE vouchers SET used_count = GREATEST(0, used_count - 1) WHERE id = ?`,
                [vu.voucher_id],
              )
            }
          }
        }
      }

      // 4. Ghi nhận sự kiện vào bảng order_events
      await query(
        `INSERT INTO order_events (shop_order_id, from_status, to_status, actor_id, note)
         VALUES (?, ?, ?, ?, ?)`,
        [
          numericShopOrderId,
          currentStatus,
          toStatus,
          numericActorId,
          note || cancelReason || `Chuyển trạng thái sang ${toStatus}`,
        ],
      )

      return {
        id: String(numericShopOrderId),
        fromStatus: currentStatus,
        toStatus,
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái đơn hàng thành công.',
      data: result,
    })
  } catch (err) {
    if (err.status && err.code) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        error: { code: err.code },
      })
    }
    next(err)
  }
}
