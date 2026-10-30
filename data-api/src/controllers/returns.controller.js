import { executeQuery, executeTransaction } from '../config/database.js'

// Bộ nhớ đệm dự phòng trong trường hợp DBA chưa chạy migration bảng order_returns
const memoryReturns = []
let memoryReturnIdCounter = 1

function isTableMissingError(err) {
  return err?.original?.code === 'ER_NO_SUCH_TABLE' ||
         err?.code === 'ER_NO_SUCH_TABLE' ||
         String(err?.message || '').includes("doesn't exist")
}

/**
 * Buyer tạo yêu cầu trả hàng / hoàn tiền cho một đơn hàng con (shop_order)
 * Điều kiện:
 * - Shop order phải thuộc về buyerId
 * - Shop order phải ở trạng thái 'delivered'
 * - Chưa có yêu cầu trả hàng nào đang ở trạng thái 'requested' hoặc 'approved'
 */
export async function createOrderReturn(req, res, next) {
  try {
    const orderId = req.params.orderId
    const { userId, shopOrderId, reason, detail, images, refundAmount } = req.body || {}

    if (
      !/^[1-9]\d{0,19}$/.test(orderId) ||
      !/^[1-9]\d{0,19}$/.test(String(userId || '')) ||
      !/^[1-9]\d{0,19}$/.test(String(shopOrderId || '')) ||
      typeof reason !== 'string' ||
      !reason.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin yêu cầu trả hàng không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const cleanReason = reason.trim().slice(0, 255)
    const cleanDetail = typeof detail === 'string' ? detail.trim().slice(0, 2000) : null
    const cleanImages = Array.isArray(images) ? JSON.stringify(images.slice(0, 5)) : null

    // 1. Kiểm tra quyền sở hữu đơn hàng và trạng thái đơn hàng trong DB
    const rows = await executeQuery(
      `SELECT so.id, so.order_id, so.shop_id, so.status, so.total_amount, o.buyer_id
       FROM shop_orders so
       JOIN orders o ON o.id = so.order_id
       WHERE so.id = ? AND o.id = ? LIMIT 1`,
      [shopOrderId, orderId],
    )

    if (!rows.length || String(rows[0].buyer_id) !== String(userId)) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng tương ứng của người mua.',
        error: { code: 'ORDER_NOT_FOUND' },
      })
    }

    const shopOrder = rows[0]
    if (shopOrder.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể yêu cầu trả hàng / hoàn tiền khi đơn hàng đã giao thành công.',
        error: { code: 'INVALID_ORDER_STATUS' },
      })
    }

    const finalRefundAmount = typeof refundAmount === 'number' && refundAmount > 0
      ? Math.min(refundAmount, Number(shopOrder.total_amount))
      : Number(shopOrder.total_amount)

    // 2. Thử lưu vào bảng order_returns
    try {
      const result = await executeTransaction(async (query) => {
        // Kiểm tra xem đã có yêu cầu trả hàng đang xử lý chưa
        const existing = await query(
          `SELECT id, status FROM order_returns WHERE shop_order_id = ? AND status IN ('requested', 'approved') LIMIT 1`,
          [shopOrderId],
        )
        if (existing.length) {
          return { error: 'RETURN_ALREADY_REQUESTED' }
        }

        const insertRes = await query(
          `INSERT INTO order_returns (order_id, shop_order_id, buyer_id, shop_id, reason, detail, images, refund_amount, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested')`,
          [orderId, shopOrderId, userId, shopOrder.shop_id, cleanReason, cleanDetail, cleanImages, finalRefundAmount],
        )

        // Ghi nhận mốc sự kiện vào order_events
        await query(
          `INSERT INTO order_events (shop_order_id, from_status, to_status, actor_id, note)
           VALUES (?, 'delivered', 'delivered', ?, ?)`,
          [shopOrderId, userId, `Yêu cầu trả hàng/hoàn tiền: ${cleanReason}`],
        )

        return { id: insertRes.insertId || insertRes }
      })

      if (result.error === 'RETURN_ALREADY_REQUESTED') {
        return res.status(409).json({
          success: false,
          message: 'Đơn hàng này đã có một yêu cầu trả hàng đang được xử lý.',
          error: { code: 'RETURN_ALREADY_REQUESTED' },
        })
      }

      return res.status(201).json({
        success: true,
        message: 'Gửi yêu cầu trả hàng / hoàn tiền thành công.',
        data: {
          id: String(result.id),
          orderId: String(orderId),
          shopOrderId: String(shopOrderId),
          refundAmount: finalRefundAmount,
          reason: cleanReason,
          status: 'requested',
        },
      })
    } catch (err) {
      if (!isTableMissingError(err)) throw err

      // Fallback lưu tạm bộ nhớ nếu bảng order_returns chưa chạy migration
      const existingMem = memoryReturns.find(
        (r) => String(r.shopOrderId) === String(shopOrderId) && ['requested', 'approved'].includes(r.status),
      )
      if (existingMem) {
        return res.status(409).json({
          success: false,
          message: 'Đơn hàng này đã có một yêu cầu trả hàng đang được xử lý.',
          error: { code: 'RETURN_ALREADY_REQUESTED' },
        })
      }

      const newReturn = {
        id: String(memoryReturnIdCounter++),
        orderId: String(orderId),
        shopOrderId: String(shopOrderId),
        buyerId: String(userId),
        shopId: String(shopOrder.shop_id),
        reason: cleanReason,
        detail: cleanDetail,
        images: cleanImages ? JSON.parse(cleanImages) : [],
        refundAmount: finalRefundAmount,
        status: 'requested',
        sellerNote: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      memoryReturns.push(newReturn)

      return res.status(201).json({
        success: true,
        message: 'Gửi yêu cầu trả hàng / hoàn tiền thành công.',
        data: newReturn,
      })
    }
  } catch (err) {
    return next(err)
  }
}

/**
 * Lấy danh sách yêu cầu trả hàng theo orderId (cho Buyer)
 */
export async function listOrderReturns(req, res, next) {
  try {
    const orderId = req.params.orderId
    const userId = req.query.userId

    try {
      const rows = await executeQuery(
        `SELECT ret.*, so.shop_name
         FROM order_returns ret
         JOIN shop_orders so ON so.id = ret.shop_order_id
         WHERE ret.order_id = ? AND ret.buyer_id = ?
         ORDER BY ret.id DESC`,
        [orderId, userId],
      )

      return res.status(200).json({
        success: true,
        data: rows.map((r) => ({
          id: String(r.id),
          orderId: String(r.order_id),
          shopOrderId: String(r.shop_order_id),
          shopName: r.shop_name,
          reason: r.reason,
          detail: r.detail,
          images: typeof r.images === 'string' ? JSON.parse(r.images || '[]') : (r.images || []),
          refundAmount: Number(r.refund_amount),
          status: r.status,
          sellerNote: r.seller_note,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      })
    } catch (err) {
      if (!isTableMissingError(err)) throw err

      const filtered = memoryReturns.filter(
        (r) => String(r.orderId) === String(orderId) && String(r.buyerId) === String(userId),
      )
      return res.status(200).json({ success: true, data: filtered })
    }
  } catch (err) {
    return next(err)
  }
}

/**
 * Lấy danh sách yêu cầu trả hàng thuộc shop của người bán (cho Seller)
 */
export async function listSellerReturns(req, res, next) {
  try {
    const userId = req.query.userId
    const { status, limit = 50, offset = 0 } = req.query

    // Lấy shopId của seller
    const ownedShops = await executeQuery(
      `SELECT id FROM shops WHERE owner_id = ? LIMIT 1`,
      [userId],
    )
    if (!ownedShops.length) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chưa có gian hàng người bán.',
        error: { code: 'SHOP_NOT_FOUND' },
      })
    }
    const shopId = ownedShops[0].id

    try {
      const params = [shopId]
      let whereSql = 'ret.shop_id = ?'
      if (status && ['requested', 'approved', 'rejected', 'completed', 'cancelled'].includes(status)) {
        whereSql += ' AND ret.status = ?'
        params.push(status)
      }
      params.push(Number(limit), Number(offset))

      const rows = await executeQuery(
        `SELECT ret.*, u.full_name AS buyer_name, u.phone AS buyer_phone, so.total_amount AS order_total
         FROM order_returns ret
         JOIN users u ON u.id = ret.buyer_id
         JOIN shop_orders so ON so.id = ret.shop_order_id
         WHERE ${whereSql}
         ORDER BY ret.id DESC
         LIMIT ? OFFSET ?`,
        params,
      )

      return res.status(200).json({
        success: true,
        data: rows.map((r) => ({
          id: String(r.id),
          orderId: String(r.order_id),
          shopOrderId: String(r.shop_order_id),
          buyerName: r.buyer_name,
          buyerPhone: r.buyer_phone,
          reason: r.reason,
          detail: r.detail,
          images: typeof r.images === 'string' ? JSON.parse(r.images || '[]') : (r.images || []),
          refundAmount: Number(r.refund_amount),
          status: r.status,
          sellerNote: r.seller_note,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      })
    } catch (err) {
      if (!isTableMissingError(err)) throw err

      let filtered = memoryReturns.filter((r) => String(r.shopId) === String(shopId))
      if (status) filtered = filtered.filter((r) => r.status === status)
      return res.status(200).json({ success: true, data: filtered })
    }
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller cập nhật trạng thái yêu cầu trả hàng (approved, rejected, completed)
 */
export async function updateSellerReturnStatus(req, res, next) {
  try {
    const returnId = req.params.returnId
    const { userId, status, sellerNote } = req.body || {}

    if (
      !/^[1-9]\d{0,19}$/.test(returnId) ||
      !/^[1-9]\d{0,19}$/.test(String(userId || '')) ||
      !['approved', 'rejected', 'completed'].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái xử lý yêu cầu trả hàng không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const cleanNote = typeof sellerNote === 'string' ? sellerNote.trim().slice(0, 500) : null

    // Kiểm tra quyền seller sở hữu shop
    const ownedShops = await executeQuery(
      `SELECT id FROM shops WHERE owner_id = ? LIMIT 1`,
      [userId],
    )
    if (!ownedShops.length) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền quản lý gian hàng này.',
        error: { code: 'FORBIDDEN' },
      })
    }
    const shopId = ownedShops[0].id

    try {
      const result = await executeTransaction(async (query) => {
        const rows = await query(
          `SELECT ret.*, so.id AS shop_order_id, so.order_id
           FROM order_returns ret
           JOIN shop_orders so ON so.id = ret.shop_order_id
           WHERE ret.id = ? AND ret.shop_id = ?
           FOR UPDATE`,
          [returnId, shopId],
        )

        if (!rows.length) return { error: 'RETURN_NOT_FOUND' }
        const currentReturn = rows[0]

        if (currentReturn.status !== 'requested' && status !== 'completed') {
          return { error: 'INVALID_TRANSITION' }
        }

        await query(
          `UPDATE order_returns
           SET status = ?, seller_note = ?, updated_at = UTC_TIMESTAMP(3)
           WHERE id = ?`,
          [status, cleanNote, returnId],
        )

        // Ghi lại order event
        await query(
          `INSERT INTO order_events (shop_order_id, from_status, to_status, actor_id, note)
           VALUES (?, 'delivered', 'delivered', ?, ?)`,
          [currentReturn.shop_order_id, userId, `Người bán ${status === 'approved' ? 'chấp nhận' : (status === 'rejected' ? 'từ chối' : 'hoàn tất')} trả hàng: ${cleanNote || ''}`],
        )

        return { success: true }
      })

      if (result.error === 'RETURN_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy yêu cầu trả hàng.',
          error: { code: 'RETURN_NOT_FOUND' },
        })
      }
      if (result.error === 'INVALID_TRANSITION') {
        return res.status(400).json({
          success: false,
          message: 'Yêu cầu trả hàng đã được xử lý từ trước.',
          error: { code: 'INVALID_TRANSITION' },
        })
      }

      return res.status(200).json({
        success: true,
        message: 'Cập nhật trạng thái trả hàng thành công.',
        data: { id: String(returnId), status, sellerNote: cleanNote },
      })
    } catch (err) {
      if (!isTableMissingError(err)) throw err

      const target = memoryReturns.find((r) => String(r.id) === String(returnId) && String(r.shopId) === String(shopId))
      if (!target) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy yêu cầu trả hàng.',
          error: { code: 'RETURN_NOT_FOUND' },
        })
      }

      target.status = status
      target.sellerNote = cleanNote
      target.updatedAt = new Date().toISOString()

      return res.status(200).json({
        success: true,
        message: 'Cập nhật trạng thái trả hàng thành công.',
        data: { id: String(returnId), status, sellerNote: cleanNote },
      })
    }
  } catch (err) {
    return next(err)
  }
}
