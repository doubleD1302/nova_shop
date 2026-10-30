import crypto from 'node:crypto'
import { executeQuery, executeTransaction } from '../config/database.js'

const SHIPPING = Object.freeze({
  tietkiem: { name: 'Tiết Kiệm', fee: 16500 },
  nhanh: { name: 'Hoả Tốc ShopNova', fee: 32000 },
  hoatoc: { name: 'Nhanh', fee: 22000 },
})

const responseError = (res, status, code, message) => res.status(status).json({
  success: false,
  message,
  error: { code },
})

function normalizeOrderRequest(body) {
  const items = Array.isArray(body.items)
    ? body.items.map((item) => ({
        variantId: String(item?.variantId || ''),
        qty: Number(item?.qty),
      })).sort((a, b) => a.variantId.localeCompare(b.variantId))
    : []
  const address = body.address || {}
  return {
    items,
    address: {
      recipientName: String(address.fullName || '').trim(),
      phone: String(address.phone || '').trim(),
      province: String(address.province || '').trim(),
      district: String(address.district || '').trim(),
      ward: String(address.ward || '').trim(),
      detail: String(address.detail || '').trim(),
    },
    paymentMethod: body.paymentMethod,
    shippingMethod: body.shippingMethod,
    voucherCode: String(body.voucherCode || '').trim().toUpperCase(),
    note: String(body.note || '').trim(),
  }
}

function makeOrderCode() {
  return `NOVA${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

function serializeDate(value) {
  return value instanceof Date ? value.toISOString() : String(value || '')
}

function serializeOrderItem(row, shopId, shopName) {
  return {
    productId: String(row.product_id),
    variantId: String(row.variant_id),
    slug: row.product_slug,
    name: row.product_name,
    image: row.image_url || '',
    price: Number(row.unit_price),
    originalPrice: row.original_price === null ? null : Number(row.original_price),
    qty: Number(row.qty),
    variant: row.variant_name,
    shopId: String(shopId),
    shopName,
  }
}

export async function createOrder(req, res, next) {
  const { userId } = req.body || {}
  const idempotencyKey = req.headers['idempotency-key']
  const order = normalizeOrderRequest(req.body || {})
  if (
    !/^[1-9]\d{0,19}$/.test(String(userId || '')) ||
    typeof idempotencyKey !== 'string' ||
    !/^[A-Za-z0-9_-]{16,64}$/.test(idempotencyKey) ||
    !order.items.length ||
    order.items.length > 50 ||
    order.items.some((item) => !/^[1-9]\d{0,19}$/.test(item.variantId) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) ||
    new Set(order.items.map((item) => item.variantId)).size !== order.items.length ||
    !order.address.recipientName ||
    !order.address.phone ||
    !order.address.province ||
    !order.address.detail ||
    order.address.recipientName.length > 120 ||
    order.address.phone.length > 20 ||
    order.address.province.length > 120 ||
    order.address.district.length > 120 ||
    order.address.ward.length > 120 ||
    order.address.detail.length > 255 ||
    order.note.length > 500 ||
    order.paymentMethod !== 'cod' ||
    !SHIPPING[order.shippingMethod] ||
    order.voucherCode.length > 32
  ) {
    return responseError(res, 400, 'VALIDATION_ERROR', 'Thông tin đặt hàng không hợp lệ.')
  }

  const requestHash = crypto.createHash('sha256').update(JSON.stringify(order)).digest('hex')
  try {
    const result = await executeTransaction(async (query) => {
      const priorOrders = await query(
        `SELECT id, code, request_hash, subtotal, shipping_fee, discount_amount, total_amount, created_at
         FROM orders WHERE buyer_id = ? AND idempotency_key = ? FOR UPDATE`,
        [userId, idempotencyKey],
      )
      if (priorOrders.length) {
        if (priorOrders[0].request_hash !== requestHash) return { error: 'IDEMPOTENCY_CONFLICT' }
        const replayItems = await query(
          `SELECT oi.product_id, oi.variant_id, oi.product_slug, oi.product_name, oi.image_url,
                  oi.unit_price, oi.original_price, oi.qty, oi.variant_name, oi.shop_id AS item_shop_id,
                  so.shop_name
           FROM order_items oi
           JOIN shop_orders so ON so.id = oi.shop_order_id
           WHERE so.order_id = ? ORDER BY oi.id`,
          [priorOrders[0].id],
        )
        return {
          order: {
            ...priorOrders[0],
            items: replayItems.map((item) => serializeOrderItem(item, item.item_shop_id, item.shop_name)),
          },
          replayed: true,
        }
      }

      const variants = []
      for (const item of order.items) {
        const rows = await query(
          `SELECT v.id AS variant_id, v.product_id, v.name AS variant_name, v.attributes, v.sku,
                  v.price, v.original_price, v.stock_qty, p.shop_id, p.name AS product_name,
                  p.slug AS product_slug, p.free_shipping, s.name AS shop_name,
                  (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS image_url
           FROM product_variants v
           JOIN products p ON p.id = v.product_id
           JOIN shops s ON s.id = p.shop_id
           JOIN users shop_owner ON shop_owner.id = s.owner_id AND shop_owner.status = 'active'
           WHERE v.id = ? AND v.is_active = 1 AND p.status = 'active' AND s.status = 'active'
           FOR UPDATE`,
          [item.variantId],
        )
        if (!rows.length) return { error: 'PRODUCT_UNAVAILABLE' }
        if (Number(rows[0].stock_qty) < item.qty) return { error: 'INSUFFICIENT_STOCK' }
        variants.push({ ...rows[0], qty: item.qty })
      }

      const groups = new Map()
      let subtotal = 0
      for (const variant of variants) {
        const lineTotal = Number(variant.price) * variant.qty
        subtotal += lineTotal
        const shopId = String(variant.shop_id)
        const group = groups.get(shopId) || {
          shopId,
          shopName: variant.shop_name,
          lines: [],
          subtotal: 0,
          hasFreeShipping: false,
        }
        group.lines.push({ ...variant, lineTotal })
        group.subtotal += lineTotal
        group.hasFreeShipping ||= Boolean(variant.free_shipping)
        groups.set(shopId, group)
      }

      const shipping = SHIPPING[order.shippingMethod]
      let shippingFee = 0
      for (const group of groups.values()) {
        group.shippingFee = group.hasFreeShipping || group.subtotal >= 1000000 ? 0 : shipping.fee
        shippingFee += group.shippingFee
      }

      let voucher = null
      let discountAmount = 0
      if (order.voucherCode) {
        const vouchers = await query(
          `SELECT id, discount_amount, min_subtotal, usage_limit, per_user_limit, used_count
           FROM vouchers
           WHERE code = ? AND is_active = 1 AND starts_at <= UTC_TIMESTAMP(3) AND ends_at > UTC_TIMESTAMP(3)
           FOR UPDATE`,
          [order.voucherCode],
        )
        if (!vouchers.length) return { error: 'VOUCHER_INVALID' }
        voucher = vouchers[0]
        const usage = await query(
          `SELECT COUNT(*) AS used FROM voucher_uses WHERE voucher_id = ? AND buyer_id = ? AND state = 'applied'`,
          [voucher.id, userId],
        )
        if (
          subtotal < Number(voucher.min_subtotal) ||
          (voucher.usage_limit !== null && Number(voucher.used_count) >= Number(voucher.usage_limit)) ||
          Number(usage[0].used) >= Number(voucher.per_user_limit)
        ) {
          return { error: 'VOUCHER_UNAVAILABLE' }
        }
        discountAmount = Math.min(Number(voucher.discount_amount), subtotal)
        if (discountAmount === 0) voucher = null
      }

      const orderCode = makeOrderCode()
      const orderIdResult = await query(
        `INSERT INTO orders
          (buyer_id, code, idempotency_key, request_hash, recipient_name, recipient_phone, province,
           district, ward, address_detail, note, voucher_code, payment_method, subtotal,
           shipping_fee, discount_amount, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', ?, ?, ?, ?)`,
        [
          userId,
          orderCode,
          idempotencyKey,
          requestHash,
          order.address.recipientName,
          order.address.phone,
          order.address.province,
          order.address.district || null,
          order.address.ward || null,
          order.address.detail,
          order.note || null,
          voucher && discountAmount ? order.voucherCode : null,
          subtotal,
          shippingFee,
          discountAmount,
          subtotal + shippingFee - discountAmount,
        ],
      )
      const orderId = String(orderIdResult.insertId)
      let allocatedDiscount = 0
      const groupList = [...groups.values()]
      for (let index = 0; index < groupList.length; index += 1) {
        const group = groupList[index]
        const groupDiscount = index === groupList.length - 1
          ? discountAmount - allocatedDiscount
          : subtotal ? Math.floor(discountAmount * group.subtotal / subtotal) : 0
        allocatedDiscount += groupDiscount
        const shopOrderResult = await query(
          `INSERT INTO shop_orders
            (order_id, shop_id, shop_name, status, subtotal, shipping_fee, discount_amount,
             total_amount, shipping_method, shipping_name)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            group.shopId,
            group.shopName,
            group.subtotal,
            group.shippingFee,
            groupDiscount,
            group.subtotal + group.shippingFee - groupDiscount,
            order.shippingMethod,
            shipping.name,
          ],
        )
        const shopOrderId = String(shopOrderResult.insertId)
        await query(
          `INSERT INTO order_events (shop_order_id, from_status, to_status, actor_id, note)
           VALUES (?, NULL, 'pending', ?, 'Đơn hàng được tạo')`,
          [shopOrderId, userId],
        )
        await query(
          `INSERT INTO payments (shop_order_id, method, status, amount)
           VALUES (?, 'cod', 'unpaid', ?)`,
          [shopOrderId, group.subtotal + group.shippingFee - groupDiscount],
        )

        for (const line of group.lines) {
          const attributes = typeof line.attributes === 'string' ? JSON.parse(line.attributes) : line.attributes
          const itemResult = await query(
            `INSERT INTO order_items
              (shop_order_id, shop_id, product_id, variant_id, product_name, product_slug,
               variant_name, variant_attributes, sku, image_url, unit_price, original_price, qty, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              shopOrderId,
              group.shopId,
              line.product_id,
              line.variant_id,
              line.product_name,
              line.product_slug,
              line.variant_name,
              JSON.stringify(attributes || {}),
              line.sku,
              line.image_url,
              line.price,
              line.original_price,
              line.qty,
              line.lineTotal,
            ],
          )
          const stockUpdate = await query(
            'UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?',
            [line.qty, line.variant_id, line.qty],
          )
          if (stockUpdate.affectedRows !== 1) {
            throw Object.assign(new Error('Stock changed during checkout'), { domainCode: 'INSUFFICIENT_STOCK' })
          }
          await query(
            `INSERT INTO stock_moves (variant_id, order_item_id, reason, delta_qty, actor_id, note)
             VALUES (?, ?, 'sale', ?, ?, 'Đặt hàng')`,
            [line.variant_id, itemResult.insertId, -line.qty, userId],
          )
        }
      }

      if (voucher && discountAmount) {
        await query('UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?', [voucher.id])
        await query(
          `INSERT INTO voucher_uses (voucher_id, order_id, buyer_id, discount_amount, state)
           VALUES (?, ?, ?, ?, 'applied')`,
          [voucher.id, orderId, userId, discountAmount],
        )
      }
      // Tự động xóa các mặt hàng đã mua khỏi giỏ hàng của người dùng
      const purchasedVariantIds = variants.map((v) => v.variant_id)
      if (purchasedVariantIds.length > 0) {
        const placeholders = purchasedVariantIds.map(() => "?").join(", ")
        await query(
          "DELETE FROM cart_items WHERE user_id = ? AND variant_id IN (" + placeholders + ")",
          [userId, ...purchasedVariantIds],
        )
      }

      return {
        order: {
          id: orderId,
          code: orderCode,
          subtotal,
          shipping_fee: shippingFee,
          discount_amount: discountAmount,
          total_amount: subtotal + shippingFee - discountAmount,
          created_at: new Date(),
          items: variants.map((line) => serializeOrderItem({
            product_id: line.product_id,
            variant_id: line.variant_id,
            product_slug: line.product_slug,
            product_name: line.product_name,
            image_url: line.image_url,
            unit_price: line.price,
            original_price: line.original_price,
            qty: line.qty,
            variant_name: line.variant_name,
          }, line.shop_id, line.shop_name)),
        },
        replayed: false,
      }
    })

    if (result.error) {
      const errors = {
        IDEMPOTENCY_CONFLICT: [409, 'IDEMPOTENCY_CONFLICT', 'Yêu cầu đặt hàng đã được sử dụng với thông tin khác.'],
        PRODUCT_UNAVAILABLE: [409, 'PRODUCT_UNAVAILABLE', 'Một sản phẩm trong giỏ không còn được bán.'],
        INSUFFICIENT_STOCK: [409, 'INSUFFICIENT_STOCK', 'Số lượng đặt vượt quá tồn kho hiện tại.'],
        VOUCHER_INVALID: [400, 'VOUCHER_INVALID', 'Mã giảm giá không hợp lệ hoặc đã hết hạn.'],
        VOUCHER_UNAVAILABLE: [409, 'VOUCHER_UNAVAILABLE', 'Mã giảm giá không đủ điều kiện hoặc đã hết lượt sử dụng.'],
      }
      const [status, code, message] = errors[result.error]
      return responseError(res, status, code, message)
    }
    return res.status(result.replayed ? 200 : 201).json({
      success: true,
      data: {
        order: {
          id: String(result.order.id),
          code: result.order.code,
          subtotal: Number(result.order.subtotal),
          shippingFee: Number(result.order.shipping_fee),
          discount: Number(result.order.discount_amount),
          total: Number(result.order.total_amount),
          createdAt: serializeDate(result.order.created_at),
          status: 'pending',
          payment: order.paymentMethod,
          shippingUnit: SHIPPING[order.shippingMethod].name,
          address: {
            fullName: order.address.recipientName,
            phone: order.address.phone,
            province: order.address.province,
            district: order.address.district,
            ward: order.address.ward,
            detail: order.address.detail,
          },
          note: order.note,
          items: result.order.items,
        },
      },
    })
  } catch (err) {
    if (err.domainCode === 'INSUFFICIENT_STOCK') {
      return responseError(res, 409, err.domainCode, 'Số lượng đặt vượt quá tồn kho hiện tại.')
    }
    return next(err)
  }
}

async function releaseOrderVoucher(query, orderId) {
  const voucherUses = await query(
    `SELECT voucher_id FROM voucher_uses WHERE order_id = ? AND state = 'applied' FOR UPDATE`,
    [orderId],
  )
  if (!voucherUses.length) return
  await query(
    `UPDATE voucher_uses SET state = 'released', released_at = UTC_TIMESTAMP(3)
     WHERE order_id = ? AND state = 'applied'`,
    [orderId],
  )
  await query(
    'UPDATE vouchers SET used_count = used_count - 1 WHERE id = ? AND used_count > 0',
    [voucherUses[0].voucher_id],
  )
}

async function restockShopOrder(query, shopOrderId, userId, note) {
  const items = await query(
    'SELECT id, variant_id, qty FROM order_items WHERE shop_order_id = ? ORDER BY variant_id FOR UPDATE',
    [shopOrderId],
  )
  for (const item of items) {
    await query('UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?', [item.qty, item.variant_id])
    await query(
      `INSERT INTO stock_moves (variant_id, order_item_id, reason, delta_qty, actor_id, note)
       VALUES (?, ?, 'cancel', ?, ?, ?)`,
      [item.variant_id, item.id, item.qty, userId, note],
    )
  }
}

export async function cancelOrder(req, res, next) {
  try {
    const orderId = req.params.orderId
    const { userId } = req.body || {}
    if (!/^[1-9]\d{0,19}$/.test(orderId)) {
      return responseError(res, 400, 'INVALID_ORDER_ID', 'Mã đơn hàng không hợp lệ.')
    }
    const result = await executeTransaction(async (query) => {
      const orders = await query(
        'SELECT id FROM orders WHERE id = ? AND buyer_id = ? FOR UPDATE',
        [orderId, userId],
      )
      if (!orders.length) return { error: 'ORDER_NOT_FOUND' }
      const shopOrders = await query(
        'SELECT id, status FROM shop_orders WHERE order_id = ? FOR UPDATE',
        [orderId],
      )
      if (!shopOrders.length || shopOrders.some((shopOrder) => shopOrder.status !== 'pending')) {
        return { error: 'ORDER_NOT_CANCELLABLE' }
      }

      for (const shopOrder of shopOrders) {
        await query(
          `UPDATE shop_orders SET status = 'cancelled', cancel_reason = 'Người mua hủy đơn',
           cancelled_at = UTC_TIMESTAMP(3) WHERE id = ? AND status = 'pending'`,
          [shopOrder.id],
        )
        await query(
          `INSERT INTO order_events (shop_order_id, from_status, to_status, actor_id, note)
           VALUES (?, 'pending', 'cancelled', ?, 'Người mua hủy đơn')`,
          [shopOrder.id, userId],
        )
        await query(`UPDATE payments SET status = 'void' WHERE shop_order_id = ? AND status = 'unpaid'`, [shopOrder.id])
        await restockShopOrder(query, shopOrder.id, userId, 'Hoàn kho do hủy đơn')
      }
      await releaseOrderVoucher(query, orderId)
      return { cancelled: true }
    })
    if (result.error === 'ORDER_NOT_FOUND') return responseError(res, 404, result.error, 'Không tìm thấy đơn hàng.')
    if (result.error) return responseError(res, 409, result.error, 'Đơn hàng không còn ở trạng thái chờ xác nhận nên không thể hủy.')
    return res.status(200).json({ success: true, data: { orderId: String(orderId), status: 'cancelled' } })
  } catch (err) {
    return next(err)
  }
}

export async function listOrders(req, res, next) {
  try {
    const userId = req.query.userId
    if (!/^[1-9]\d{0,19}$/.test(String(userId || ''))) {
      return responseError(res, 400, 'INVALID_USER_ID', 'Mã tài khoản không hợp lệ.')
    }
    const requestedLimit = Number(req.query.limit)
    const requestedOffset = Number(req.query.offset)
    const limit = Number.isInteger(requestedLimit) && requestedLimit >= 0 && requestedLimit <= 100 ? requestedLimit : 50
    const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0
    const orderId = req.query.orderId ? String(req.query.orderId) : ''
    if (orderId && !/^[1-9]\d{0,19}$/.test(orderId)) return responseError(res, 400, 'INVALID_ORDER_ID', 'Mã đơn hàng không hợp lệ.')
    const summaryRows = await executeQuery(
      `SELECT COUNT(*) AS order_count,
              COALESCE(SUM(CASE WHEN EXISTS (
                SELECT 1 FROM shop_orders so_live WHERE so_live.order_id = o.id AND so_live.status <> 'cancelled'
              ) THEN o.total_amount ELSE 0 END), 0) AS spent
       FROM orders o WHERE o.buyer_id = ?`,
      [userId],
    )
    if (limit === 0 && !req.query.orderId) {
      const summary = { orderCount: Number(summaryRows[0]?.order_count || 0), spent: Number(summaryRows[0]?.spent || 0) }
      return res.status(200).json({ success: true, data: { orders: [], total: summary.orderCount, summary, limit, offset } })
    }
    const pageFilter = orderId
      ? 'AND o.id = ?'
      : 'AND o.id IN (SELECT page_order.id FROM (SELECT id FROM orders WHERE buyer_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?) page_order)'
    const pageParams = orderId ? [userId, orderId] : [userId, userId, limit, offset]
    const rows = await executeQuery(
      `SELECT o.id AS order_id, o.buyer_id, o.code, o.recipient_name, o.recipient_phone,
              o.province, o.district, o.ward, o.address_detail, o.note, o.payment_method,
              o.subtotal, o.shipping_fee, o.discount_amount, o.total_amount, o.created_at, o.updated_at,
              so.id AS shop_order_id, so.shop_id, so.shop_name, so.status AS shop_status,
              so.shipping_name, oi.product_id, oi.variant_id, oi.product_name, oi.product_slug,
              oi.variant_name, oi.image_url, oi.unit_price, oi.original_price, oi.qty
       FROM orders o
       JOIN shop_orders so ON so.order_id = o.id
       JOIN order_items oi ON oi.shop_order_id = so.id
       WHERE o.buyer_id = ? ${pageFilter}
       ORDER BY o.created_at DESC, o.id DESC, so.id, oi.id`,
      pageParams,
    )
    const ordersById = new Map()
    const orderIdByShopOrder = new Map()
    for (const row of rows) {
      const orderId = String(row.order_id)
      let order = ordersById.get(orderId)
      if (!order) {
        order = {
          id: orderId,
          buyerId: String(row.buyer_id),
          buyerName: row.recipient_name,
          code: row.code,
          createdAt: serializeDate(row.created_at),
          updatedAt: serializeDate(row.updated_at),
          status: 'pending',
          statusHistory: [],
          items: [],
          payment: row.payment_method,
          shippingUnit: row.shipping_name,
          shippingFee: Number(row.shipping_fee),
          discount: Number(row.discount_amount),
          subtotal: Number(row.subtotal),
          total: Number(row.total_amount),
          note: row.note || '',
          address: {
            fullName: row.recipient_name,
            phone: row.recipient_phone,
            province: row.province,
            district: row.district || '',
            ward: row.ward || '',
            detail: row.address_detail,
          },
          shopStatuses: new Map(),
        }
        ordersById.set(orderId, order)
      }
      const shopOrderId = String(row.shop_order_id)
      order.shopStatuses.set(shopOrderId, row.shop_status)
      orderIdByShopOrder.set(shopOrderId, orderId)
      order.items.push(serializeOrderItem(row, row.shop_id, row.shop_name))
    }

    const orders = [...ordersById.values()]
    for (const order of orders) {
      const statuses = [...order.shopStatuses.values()]
      order.status = statuses.every((status) => status === 'cancelled')
        ? 'cancelled'
        : statuses.every((status) => status === 'delivered')
          ? 'delivered'
          : statuses.includes('shipping')
            ? 'shipping'
            : statuses.includes('confirmed')
              ? 'confirmed'
              : 'pending'
      delete order.shopStatuses
    }

    const shopOrderIds = [...orderIdByShopOrder.keys()]
    if (shopOrderIds.length) {
      const events = await executeQuery(
        `SELECT shop_order_id, to_status, created_at FROM order_events
         WHERE shop_order_id IN (${shopOrderIds.map(() => '?').join(',')})
         ORDER BY created_at, id`,
        shopOrderIds,
      )
      for (const event of events) {
        const orderId = orderIdByShopOrder.get(String(event.shop_order_id))
        ordersById.get(orderId).statusHistory.push({
          status: event.to_status,
          at: serializeDate(event.created_at),
        })
      }
    }
    return res.status(200).json({ success: true, data: {
      orders,
      total: Number(summaryRows[0]?.order_count || 0),
      summary: { orderCount: Number(summaryRows[0]?.order_count || 0), spent: Number(summaryRows[0]?.spent || 0) },
      limit,
      offset,
    } })
  } catch (err) {
    return next(err)
  }
}

export async function confirmOrderReceived(req, res, next) {
  try {
    const orderId = req.params.orderId
    const { userId } = req.body || {}
    if (!/^[1-9]\d{0,19}$/.test(orderId)) {
      return responseError(res, 400, 'INVALID_ORDER_ID', 'Mã đơn hàng không hợp lệ.')
    }
    const result = await executeTransaction(async (query) => {
      const orders = await query(
        'SELECT id FROM orders WHERE id = ? AND buyer_id = ? FOR UPDATE',
        [orderId, userId],
      )
      if (!orders.length) return { error: 'ORDER_NOT_FOUND' }
      const shopOrders = await query('SELECT id, status FROM shop_orders WHERE order_id = ? FOR UPDATE', [orderId])
      const shippingOrders = shopOrders.filter((shopOrder) => shopOrder.status === 'shipping')
      if (!shippingOrders.length) return { error: 'ORDER_NOT_CONFIRMABLE' }
      for (const shopOrder of shippingOrders) {
        await query(
          `UPDATE shop_orders SET status = 'delivered', delivered_at = UTC_TIMESTAMP(3)
           WHERE id = ? AND status = 'shipping'`,
          [shopOrder.id],
        )
        await query(
          `INSERT INTO order_events (shop_order_id, from_status, to_status, actor_id, note)
           VALUES (?, 'shipping', 'delivered', ?, 'Người mua xác nhận đã nhận hàng')`,
          [shopOrder.id, userId],
        )
      }
      return { status: 'delivered' }
    })
    if (result.error === 'ORDER_NOT_FOUND') return responseError(res, 404, result.error, 'Không tìm thấy đơn hàng.')
    if (result.error) return responseError(res, 409, result.error, 'Đơn hàng chưa ở trạng thái đang giao.')
    return res.status(200).json({ success: true, data: { orderId: String(orderId), status: result.status } })
  } catch (err) {
    return next(err)
  }
}

export async function listSellerOrders(req, res, next) {
  try {
    const userId = req.query.userId
    if (!/^[1-9]\d{0,19}$/.test(String(userId || ''))) {
      return responseError(res, 400, 'INVALID_USER_ID', 'Mã tài khoản không hợp lệ.')
    }
    const requestedLimit = Number(req.query.limit)
    const requestedOffset = Number(req.query.offset)
    const limit = Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 50
    const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0
    const summaryRows = await executeQuery(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(so.status = 'pending'), 0) AS pending,
              COALESCE(SUM(so.status = 'confirmed'), 0) AS confirmed,
              COALESCE(SUM(so.status = 'shipping'), 0) AS shipping,
              COALESCE(SUM(so.status = 'delivered'), 0) AS delivered,
              COALESCE(SUM(so.status = 'cancelled'), 0) AS cancelled,
              COALESCE(SUM(CASE WHEN so.status = 'delivered' THEN so.total_amount ELSE 0 END), 0) AS revenue
       FROM shop_orders so JOIN shops s ON s.id = so.shop_id WHERE s.owner_id = ?`,
      [userId],
    )
    const rows = await executeQuery(
      `SELECT o.id AS order_id, o.code, o.created_at, o.payment_method, o.buyer_id,
              buyer.full_name AS buyer_name, so.id AS shop_order_id, so.shop_id, so.shop_name,
              so.status, so.subtotal, so.shipping_fee, so.discount_amount, so.total_amount,
              so.shipping_name, so.cancel_reason, so.delivered_at, oi.product_id, oi.variant_id,
              oi.product_name, oi.product_slug, oi.variant_name, oi.image_url, oi.unit_price,
              oi.original_price, oi.qty
       FROM shop_orders so
       JOIN orders o ON o.id = so.order_id
       JOIN users buyer ON buyer.id = o.buyer_id
       JOIN shops s ON s.id = so.shop_id
       JOIN order_items oi ON oi.shop_order_id = so.id
       WHERE s.owner_id = ?
         AND so.id IN (
           SELECT page_shop_order.id FROM (
             SELECT so_page.id FROM shop_orders so_page
             JOIN shops s_page ON s_page.id = so_page.shop_id
             WHERE s_page.owner_id = ?
             ORDER BY so_page.created_at DESC, so_page.id DESC
             LIMIT ? OFFSET ?
           ) page_shop_order
         )
       ORDER BY o.created_at DESC, o.id DESC, so.id, oi.id`,
      [userId, userId, limit, offset],
    )
    const ordersByShopOrder = new Map()
    for (const row of rows) {
      const shopOrderId = String(row.shop_order_id)
      let order = ordersByShopOrder.get(shopOrderId)
      if (!order) {
        order = {
          id: String(row.order_id),
          shopOrderId,
          buyerId: String(row.buyer_id),
          buyerName: row.buyer_name,
          code: row.code,
          createdAt: serializeDate(row.created_at),
          status: row.status,
          payment: row.payment_method,
          shippingUnit: row.shipping_name,
          shippingFee: Number(row.shipping_fee),
          subtotal: Number(row.subtotal),
          discount: Number(row.discount_amount),
          total: Number(row.total_amount),
          totalForShop: Number(row.total_amount),
          cancelReason: row.cancel_reason || '',
          deliveredAt: row.delivered_at ? serializeDate(row.delivered_at) : null,
          items: [],
        }
        ordersByShopOrder.set(shopOrderId, order)
      }
      order.items.push(serializeOrderItem(row, row.shop_id, row.shop_name))
    }
    return res.status(200).json({ success: true, data: {
      orders: [...ordersByShopOrder.values()],
      total: Number(summaryRows[0]?.total || 0),
      summary: {
        total: Number(summaryRows[0]?.total || 0),
        pending: Number(summaryRows[0]?.pending || 0),
        confirmed: Number(summaryRows[0]?.confirmed || 0),
        shipping: Number(summaryRows[0]?.shipping || 0),
        delivered: Number(summaryRows[0]?.delivered || 0),
        cancelled: Number(summaryRows[0]?.cancelled || 0),
        revenue: Number(summaryRows[0]?.revenue || 0),
      },
      limit,
      offset,
    } })
  } catch (err) {
    return next(err)
  }
}

export async function updateSellerOrderStatus(req, res, next) {
  try {
    const shopOrderId = req.params.shopOrderId
    const { userId, status } = req.body || {}
    if (
      !/^[1-9]\d{0,19}$/.test(shopOrderId) ||
      !/^[1-9]\d{0,19}$/.test(String(userId || '')) ||
      !['confirmed', 'shipping', 'delivered', 'cancelled'].includes(status)
    ) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Trạng thái đơn hàng không hợp lệ.')
    }
    const result = await executeTransaction(async (query) => {
      const rows = await query(
        `SELECT so.id, so.order_id, so.status, so.shop_id, s.owner_id
         FROM shop_orders so JOIN shops s ON s.id = so.shop_id
         WHERE so.id = ? FOR UPDATE`,
        [shopOrderId],
      )
      if (!rows.length || String(rows[0].owner_id) !== String(userId)) return { error: 'ORDER_NOT_FOUND' }
      const order = rows[0]
      const allowed = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['shipping', 'cancelled'],
        shipping: ['delivered'],
      }
      if (!allowed[order.status]?.includes(status)) return { error: 'INVALID_STATUS_TRANSITION' }

      if (status === 'cancelled') {
        await query(
          `UPDATE shop_orders
           SET status = 'cancelled', cancel_reason = 'Người bán hủy đơn', cancelled_at = UTC_TIMESTAMP(3)
           WHERE id = ? AND status = ?`,
          [shopOrderId, order.status],
        )
      } else if (status === 'delivered') {
        await query(
          `UPDATE shop_orders SET status = 'delivered', delivered_at = UTC_TIMESTAMP(3)
           WHERE id = ? AND status = ?`,
          [shopOrderId, order.status],
        )
      } else {
        await query('UPDATE shop_orders SET status = ? WHERE id = ? AND status = ?', [status, shopOrderId, order.status])
      }

      await query(
        `INSERT INTO order_events (shop_order_id, from_status, to_status, actor_id, note)
         VALUES (?, ?, ?, ?, ?)`,
        [shopOrderId, order.status, status, userId, status === 'cancelled' ? 'Người bán hủy đơn' : null],
      )
      if (status === 'cancelled') {
        await query(`UPDATE payments SET status = 'void' WHERE shop_order_id = ? AND status = 'unpaid'`, [shopOrderId])
        await restockShopOrder(query, shopOrderId, userId, 'Hoàn kho do người bán hủy đơn')
        const remainingOrders = await query(
          `SELECT COUNT(*) AS count FROM shop_orders WHERE order_id = ? AND status <> 'cancelled'`,
          [order.order_id],
        )
        if (Number(remainingOrders[0].count) === 0) {
          await releaseOrderVoucher(query, order.order_id)
        }
      }
      return { status }
    })
    if (result.error === 'ORDER_NOT_FOUND') return responseError(res, 404, result.error, 'Không tìm thấy đơn hàng.')
    if (result.error) return responseError(res, 409, result.error, 'Không thể chuyển đơn hàng sang trạng thái này.')
    return res.status(200).json({ success: true, data: { shopOrderId: String(shopOrderId), status: result.status } })
  } catch (err) {
    return next(err)
  }
}
