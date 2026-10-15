import crypto from 'node:crypto'
import { executeQuery, executeTransaction } from '../config/database.js'

/**
 * Tạo mã hash SHA-256 cho nội dung request để kiểm tra tính toàn vẹn idempotency.
 */
function hashRequest(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
}

/**
 * Định dạng đối tượng đơn hàng an toàn cho API response.
 */
function formatOrderSummary(row, shopOrders = []) {
  return {
    id: String(row.id),
    code: row.code,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    province: row.province,
    district: row.district || null,
    ward: row.ward || null,
    addressDetail: row.address_detail,
    note: row.note || null,
    paymentMethod: row.payment_method,
    subtotal: Number(row.subtotal),
    shippingFee: Number(row.shipping_fee),
    discountAmount: Number(row.discount_amount),
    totalAmount: Number(row.total_amount),
    shopOrders: shopOrders.map((so) => ({
      id: String(so.id),
      shopId: String(so.shop_id),
      shopName: so.shop_name,
      status: so.status,
      subtotal: Number(so.subtotal),
      shippingFee: Number(so.shipping_fee),
      discountAmount: Number(so.discount_amount),
      totalAmount: Number(so.total_amount),
      shippingMethod: so.shipping_method,
      shippingName: so.shipping_name,
      items: (so.items || []).map((it) => ({
        id: String(it.id),
        productId: String(it.product_id),
        variantId: String(it.variant_id),
        productName: it.product_name,
        productSlug: it.product_slug,
        variantName: it.variant_name,
        sku: it.sku,
        imageUrl: it.image_url || null,
        unitPrice: Number(it.unit_price),
        qty: Number(it.qty),
        lineTotal: Number(it.line_total),
      })),
    })),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  }
}

/**
 * POST /internal/v1/orders
 * Tạo đơn hàng mới trong transaction an toàn, trừ tồn kho và xóa sản phẩm đã mua khỏi giỏ.
 */
export async function createOrder(req, res, next) {
  try {
    const {
      userId,
      idempotencyKey,
      recipientName,
      recipientPhone,
      province,
      district,
      ward,
      addressDetail,
      note,
      paymentMethod = 'cod',
      items: customItems,
    } = req.body

    // 1. Kiểm tra tham số cơ bản
    if (!userId || !/^\d+$/.test(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã tài khoản người mua không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Khóa idempotencyKey là bắt buộc để chống tạo đơn trùng lặp.',
        error: { code: 'IDEMPOTENCY_KEY_REQUIRED' },
      })
    }

    if (!recipientName || !recipientPhone || !province || !addressDetail) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin nhận hàng (họ tên, điện thoại, tỉnh thành, địa chỉ) không được để trống.',
        error: { code: 'SHIPPING_INFO_REQUIRED' },
      })
    }

    const numericUserId = BigInt(userId)
    const cleanIdempotencyKey = idempotencyKey.trim().substring(0, 64)
    const requestHash = hashRequest({
      userId,
      recipientName,
      recipientPhone,
      province,
      addressDetail,
      customItems,
    })

    // 2. Kiểm tra đơn trùng idempotency key (Idempotent response)
    const existingOrderRows = await executeQuery(
      `SELECT id, code, recipient_name, recipient_phone, province, district, ward, address_detail,
              note, payment_method, subtotal, shipping_fee, discount_amount, total_amount, created_at
       FROM orders
       WHERE buyer_id = ? AND idempotency_key = ?
       LIMIT 1`,
      [numericUserId, cleanIdempotencyKey],
    )

    if (existingOrderRows && existingOrderRows.length > 0) {
      const order = existingOrderRows[0]
      // Lấy danh sách shop_orders
      const shopRows = await executeQuery(
        `SELECT id, shop_id, shop_name, status, subtotal, shipping_fee, discount_amount, total_amount, shipping_method, shipping_name
         FROM shop_orders WHERE order_id = ?`,
        [order.id],
      )
      return res.status(200).json({
        success: true,
        message: 'Đơn hàng đã được tạo trước đó.',
        data: formatOrderSummary(order, shopRows),
      })
    }

    // 3. Thực hiện tạo đơn trong transaction
    const resultOrder = await executeTransaction(async (query) => {
      let checkoutItems = []

      if (Array.isArray(customItems) && customItems.length > 0) {
        // Mua trực tiếp các SKU được truyền lên
        for (const it of customItems) {
          const vId = BigInt(it.variantId)
          const q = Number(it.qty) || 1
          const vRows = await query(
            `SELECT v.id AS variant_id, v.sku, v.name AS variant_name, v.attributes AS variant_attributes,
                    v.price, v.original_price, v.stock_qty, v.is_active,
                    p.id AS product_id, p.name AS product_name, p.slug AS product_slug, p.shop_id,
                    s.name AS shop_name, s.is_mall, p.free_shipping,
                    (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1) AS image_url
             FROM product_variants v
             JOIN products p ON p.id = v.product_id
             JOIN shops s ON s.id = p.shop_id
             WHERE v.id = ? FOR UPDATE`,
            [vId],
          )
          if (!vRows || vRows.length === 0) {
            const err = new Error(`Biến thể SKU #${it.variantId} không tồn tại.`)
            err.code = 'VARIANT_NOT_FOUND'
            err.status = 404
            throw err
          }
          const item = vRows[0]
          if (!item.is_active) {
            const err = new Error(`Sản phẩm "${item.product_name}" hiện không còn mở bán.`)
            err.code = 'PRODUCT_INACTIVE'
            err.status = 400
            throw err
          }
          if (Number(item.stock_qty) < q) {
            const err = new Error(`Sản phẩm "${item.product_name}" không đủ số lượng tồn kho (còn ${item.stock_qty}).`)
            err.code = 'INSUFFICIENT_STOCK'
            err.status = 400
            throw err
          }
          checkoutItems.push({ ...item, buyQty: q })
        }
      } else {
        // Lấy từ giỏ hàng (các dòng được selected = 1)
        const cartRows = await query(
          `SELECT ci.id AS cart_item_id, ci.qty AS buyQty,
                  v.id AS variant_id, v.sku, v.name AS variant_name, v.attributes AS variant_attributes,
                  v.price, v.original_price, v.stock_qty, v.is_active,
                  p.id AS product_id, p.name AS product_name, p.slug AS product_slug, p.shop_id,
                  s.name AS shop_name, s.is_mall, p.free_shipping,
                  (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1) AS image_url
           FROM cart_items ci
           JOIN product_variants v ON v.id = ci.variant_id
           JOIN products p ON p.id = v.product_id
           JOIN shops s ON s.id = p.shop_id
           WHERE ci.user_id = ? AND ci.selected = 1
           FOR UPDATE`,
          [numericUserId],
        )

        if (!cartRows || cartRows.length === 0) {
          const err = new Error('Không có sản phẩm nào được chọn trong giỏ hàng để đặt hàng.')
          err.code = 'CART_EMPTY'
          err.status = 400
          throw err
        }

        for (const item of cartRows) {
          const q = Number(item.buyQty)
          if (!item.is_active) {
            const err = new Error(`Sản phẩm "${item.product_name}" hiện đã ngừng kinh doanh.`)
            err.code = 'PRODUCT_INACTIVE'
            err.status = 400
            throw err
          }
          if (Number(item.stock_qty) < q) {
            const err = new Error(`Sản phẩm "${item.product_name}" không đủ tồn kho (còn ${item.stock_qty}).`)
            err.code = 'INSUFFICIENT_STOCK'
            err.status = 400
            throw err
          }
          checkoutItems.push(item)
        }
      }

      // Gom nhóm theo Shop
      const shopGroups = new Map()
      for (const it of checkoutItems) {
        const sId = String(it.shop_id)
        if (!shopGroups.has(sId)) {
          shopGroups.set(sId, {
            shopId: it.shop_id,
            shopName: it.shop_name,
            freeShipping: Boolean(it.free_shipping),
            items: [],
          })
        }
        shopGroups.get(sId).items.push(it)
      }

      // Tính tổng tiền các shop
      let grandSubtotal = 0
      let grandShippingFee = 0

      for (const group of shopGroups.values()) {
        let shopSubtotal = 0
        for (const it of group.items) {
          const lineTotal = Number(it.price) * Number(it.buyQty)
          shopSubtotal += lineTotal
        }
        const shopShipFee = group.freeShipping ? 0 : 20000
        group.subtotal = shopSubtotal
        group.shippingFee = shopShipFee
        group.discountAmount = 0
        group.totalAmount = shopSubtotal + shopShipFee

        grandSubtotal += shopSubtotal
        grandShippingFee += shopShipFee
      }

      const grandDiscount = 0
      const grandTotal = grandSubtotal + grandShippingFee - grandDiscount

      // Sinh mã đơn tổng
      const orderCode = 'ORD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()

      // Insert bảng orders
      const insertOrderSql = `
        INSERT INTO orders (
          buyer_id, code, idempotency_key, request_hash,
          recipient_name, recipient_phone, province, district, ward, address_detail,
          note, payment_method, subtotal, shipping_fee, discount_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const orderInsertResult = await query(insertOrderSql, [
        numericUserId,
        orderCode,
        cleanIdempotencyKey,
        requestHash,
        recipientName.trim(),
        recipientPhone.trim(),
        province.trim(),
        district ? district.trim() : null,
        ward ? ward.trim() : null,
        addressDetail.trim(),
        note ? note.trim() : null,
        paymentMethod,
        grandSubtotal,
        grandShippingFee,
        grandDiscount,
        grandTotal,
      ])

      const newOrderId = orderInsertResult.insertId
      const createdShopOrders = []

      // Xử lý từng đơn con shop_orders
      for (const group of shopGroups.values()) {
        const insertShopOrderSql = `
          INSERT INTO shop_orders (
            order_id, shop_id, shop_name, status,
            subtotal, shipping_fee, discount_amount, total_amount,
            shipping_method, shipping_name
          ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, 'standard', 'Giao hàng tiêu chuẩn')
        `
        const shopOrderResult = await query(insertShopOrderSql, [
          newOrderId,
          group.shopId,
          group.shopName,
          group.subtotal,
          group.shippingFee,
          group.discountAmount,
          group.totalAmount,
        ])
        const shopOrderId = shopOrderResult.insertId

        // Insert payments (COD - status: unpaid)
        await query(
          `INSERT INTO payments (shop_order_id, method, status, amount) VALUES (?, ?, 'unpaid', ?)`,
          [shopOrderId, paymentMethod, group.totalAmount],
        )

        const createdItems = []
        // Insert order_items & cập nhật kho
        for (const it of group.items) {
          const lineTotal = Number(it.price) * Number(it.buyQty)
          const insertItemSql = `
            INSERT INTO order_items (
              shop_order_id, shop_id, product_id, variant_id,
              product_name, product_slug, variant_name, variant_attributes,
              sku, image_url, unit_price, original_price, qty, line_total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          const itemInsertResult = await query(insertItemSql, [
            shopOrderId,
            group.shopId,
            it.product_id,
            it.variant_id,
            it.product_name,
            it.product_slug,
            it.variant_name,
            typeof it.variant_attributes === 'string' ? it.variant_attributes : JSON.stringify(it.variant_attributes || {}),
            it.sku,
            it.image_url,
            it.price,
            it.original_price,
            it.buyQty,
            lineTotal,
          ])
          const orderItemId = itemInsertResult.insertId

          // Trừ tồn kho và ghi nhận stock_moves
          await query(
            `UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ?`,
            [it.buyQty, it.variant_id],
          )
          await query(
            `INSERT INTO stock_moves (variant_id, order_item_id, reason, delta_qty, actor_id, note)
             VALUES (?, ?, 'sale', ?, ?, 'Đơn hàng mới')`,
            [it.variant_id, orderItemId, -Number(it.buyQty), numericUserId],
          )

          createdItems.push({
            id: String(orderItemId),
            productId: String(it.product_id),
            variantId: String(it.variant_id),
            productName: it.product_name,
            productSlug: it.product_slug,
            variantName: it.variant_name,
            sku: it.sku,
            imageUrl: it.image_url,
            unitPrice: Number(it.price),
            qty: Number(it.buyQty),
            lineTotal,
          })
        }

        createdShopOrders.push({
          id: String(shopOrderId),
          shopId: String(group.shopId),
          shopName: group.shopName,
          status: 'pending',
          subtotal: group.subtotal,
          shippingFee: group.shippingFee,
          discountAmount: group.discountAmount,
          totalAmount: group.totalAmount,
          shippingMethod: 'standard',
          shippingName: 'Giao hàng tiêu chuẩn',
          items: createdItems,
        })
      }

      // Xóa các sản phẩm đã mua khỏi giỏ hàng
      const boughtVariantIds = checkoutItems.map((it) => it.variant_id)
      if (boughtVariantIds.length > 0) {
        const placeholders = boughtVariantIds.map(() => '?').join(',')
        await query(
          `DELETE FROM cart_items WHERE user_id = ? AND variant_id IN (${placeholders})`,
          [numericUserId, ...boughtVariantIds],
        )
      }

      return {
        id: String(newOrderId),
        code: orderCode,
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        province: province.trim(),
        district: district ? district.trim() : null,
        ward: ward ? ward.trim() : null,
        addressDetail: addressDetail.trim(),
        note: note ? note.trim() : null,
        paymentMethod,
        subtotal: grandSubtotal,
        shippingFee: grandShippingFee,
        discountAmount: grandDiscount,
        totalAmount: grandTotal,
        shopOrders: createdShopOrders,
        createdAt: new Date().toISOString(),
      }
    })

    return res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công.',
      data: resultOrder,
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

/**
 * GET /internal/v1/orders
 * Lấy danh sách đơn hàng của người mua.
 */
export async function getOrders(req, res, next) {
  try {
    const { userId, status, page = '1', limit = '10' } = req.query

    if (!userId || !/^\d+$/.test(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã tài khoản người mua không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    const numericUserId = BigInt(userId)
    const parsedPage = Math.max(1, Number(page) || 1)
    const parsedLimit = Math.min(50, Math.max(1, Number(limit) || 10))
    const offset = (parsedPage - 1) * parsedLimit

    const conditions = ['o.buyer_id = ?']
    const params = [numericUserId]

    if (status && ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'].includes(status)) {
      conditions.push('EXISTS (SELECT 1 FROM shop_orders so WHERE so.order_id = o.id AND so.status = ?)')
      params.push(status)
    }

    const whereClause = conditions.join(' AND ')

    // Đếm tổng số đơn
    const countRows = await executeQuery(`SELECT COUNT(*) AS total FROM orders o WHERE ${whereClause}`, params)
    const total = Number(countRows[0]?.total || 0)

    // Lấy danh sách orders
    const orderRows = await executeQuery(
      `SELECT o.id, o.code, o.recipient_name, o.recipient_phone, o.province, o.district, o.ward,
              o.address_detail, o.note, o.payment_method, o.subtotal, o.shipping_fee, o.discount_amount,
              o.total_amount, o.created_at
       FROM orders o
       WHERE ${whereClause}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parsedLimit, offset],
    )

    if (!orderRows || orderRows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách đơn hàng thành công.',
        data: [],
        meta: { page: parsedPage, limit: parsedLimit, total: 0, totalPages: 1 },
      })
    }

    const orderIds = orderRows.map((o) => o.id)
    const orderPlaceholders = orderIds.map(() => '?').join(',')

    // Lấy shop_orders và order_items
    const shopOrderRows = await executeQuery(
      `SELECT so.id, so.order_id, so.shop_id, so.shop_name, so.status,
              so.subtotal, so.shipping_fee, so.discount_amount, so.total_amount,
              so.shipping_method, so.shipping_name
       FROM shop_orders so
       WHERE so.order_id IN (${orderPlaceholders})`,
      orderIds,
    )

    const shopOrderIds = shopOrderRows.map((s) => s.id)
    let itemRows = []
    if (shopOrderIds.length > 0) {
      const shopPlaceholders = shopOrderIds.map(() => '?').join(',')
      itemRows = await executeQuery(
        `SELECT id, shop_order_id, product_id, variant_id, product_name, product_slug,
                variant_name, sku, image_url, unit_price, qty, line_total
         FROM order_items
         WHERE shop_order_id IN (${shopPlaceholders})`,
        shopOrderIds,
      )
    }

    // Map dữ liệu
    const itemsByShopOrder = new Map()
    for (const it of itemRows) {
      const sId = String(it.shop_order_id)
      if (!itemsByShopOrder.has(sId)) itemsByShopOrder.set(sId, [])
      itemsByShopOrder.get(sId).push(it)
    }

    const shopOrdersByOrder = new Map()
    for (const so of shopOrderRows) {
      const oId = String(so.order_id)
      if (!shopOrdersByOrder.has(oId)) shopOrdersByOrder.set(oId, [])
      const soItems = itemsByShopOrder.get(String(so.id)) || []
      shopOrdersByOrder.get(oId).push({ ...so, items: soItems })
    }

    const orders = orderRows.map((o) => {
      const relatedShopOrders = shopOrdersByOrder.get(String(o.id)) || []
      return formatOrderSummary(o, relatedShopOrders)
    })

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đơn hàng thành công.',
      data: orders,
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
 * GET /internal/v1/orders/:orderIdOrCode
 * Lấy chi tiết đơn hàng theo ID hoặc Code.
 */
export async function getOrderDetail(req, res, next) {
  try {
    const { orderIdOrCode } = req.params
    const { userId } = req.query

    if (!orderIdOrCode || typeof orderIdOrCode !== 'string' || orderIdOrCode.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Định danh đơn hàng không hợp lệ.',
        error: { code: 'INVALID_ORDER_ID' },
      })
    }

    const trimmed = orderIdOrCode.trim()
    const isNumericId = /^\d+$/.test(trimmed)

    let whereClause = 'o.code = ?'
    let param = trimmed
    if (isNumericId) {
      whereClause = 'o.id = ?'
      param = BigInt(trimmed)
    }

    const params = [param]
    if (userId && /^\d+$/.test(String(userId))) {
      whereClause += ' AND o.buyer_id = ?'
      params.push(BigInt(userId))
    }

    const orderRows = await executeQuery(
      `SELECT o.id, o.code, o.buyer_id, o.recipient_name, o.recipient_phone, o.province, o.district, o.ward,
              o.address_detail, o.note, o.payment_method, o.subtotal, o.shipping_fee, o.discount_amount,
              o.total_amount, o.created_at
       FROM orders o
       WHERE ${whereClause}
       LIMIT 1`,
      params,
    )

    if (!orderRows || orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin đơn hàng.',
        error: { code: 'ORDER_NOT_FOUND' },
      })
    }

    const order = orderRows[0]

    // Lấy shop_orders
    const shopOrderRows = await executeQuery(
      `SELECT id, shop_id, shop_name, status, subtotal, shipping_fee, discount_amount, total_amount, shipping_method, shipping_name
       FROM shop_orders WHERE order_id = ?`,
      [order.id],
    )

    const shopOrderIds = shopOrderRows.map((s) => s.id)
    let itemRows = []
    if (shopOrderIds.length > 0) {
      const placeholders = shopOrderIds.map(() => '?').join(',')
      itemRows = await executeQuery(
        `SELECT id, shop_order_id, product_id, variant_id, product_name, product_slug,
                variant_name, sku, image_url, unit_price, qty, line_total
         FROM order_items
         WHERE shop_order_id IN (${placeholders})`,
        shopOrderIds,
      )
    }

    const itemsByShopOrder = new Map()
    for (const it of itemRows) {
      const sId = String(it.shop_order_id)
      if (!itemsByShopOrder.has(sId)) itemsByShopOrder.set(sId, [])
      itemsByShopOrder.get(sId).push(it)
    }

    const shopOrdersWithItems = shopOrderRows.map((so) => ({
      ...so,
      items: itemsByShopOrder.get(String(so.id)) || [],
    }))

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết đơn hàng thành công.',
      data: formatOrderSummary(order, shopOrdersWithItems),
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /internal/v1/orders/:orderIdOrCode/cancel
 * Hủy đơn hàng khi còn ở trạng thái pending, hoàn tồn kho cho SKU.
 */
export async function cancelOrder(req, res, next) {
  try {
    const { orderIdOrCode } = req.params
    const { userId, reason = 'Khách hàng yêu cầu hủy đơn' } = req.body

    if (!userId || !/^\d+$/.test(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã tài khoản người mua không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    const numericUserId = BigInt(userId)
    const trimmed = String(orderIdOrCode).trim()
    const isNumericId = /^\d+$/.test(trimmed)

    let whereClause = 'o.code = ?'
    let param = trimmed
    if (isNumericId) {
      whereClause = 'o.id = ?'
      param = BigInt(trimmed)
    }

    await executeTransaction(async (query) => {
      // 1. Kiểm tra đơn hàng tồn tại và thuộc quyền sở hữu
      const orderRows = await query(
        `SELECT id FROM orders o WHERE ${whereClause} AND o.buyer_id = ? FOR UPDATE`,
        [param, numericUserId],
      )

      if (!orderRows || orderRows.length === 0) {
        const err = new Error('Không tìm thấy đơn hàng cần hủy.')
        err.code = 'ORDER_NOT_FOUND'
        err.status = 404
        throw err
      }

      const orderId = orderRows[0].id

      // 2. Kiểm tra trạng thái các shop_orders
      const shopRows = await query(
        `SELECT id, status FROM shop_orders WHERE order_id = ? FOR UPDATE`,
        [orderId],
      )

      const nonPendingShops = shopRows.filter((s) => s.status !== 'pending')
      if (nonPendingShops.length > 0) {
        const err = new Error('Đơn hàng đã được xác nhận hoặc đang vận chuyển, không thể hủy.')
        err.code = 'ORDER_CANNOT_BE_CANCELLED'
        err.status = 400
        throw err
      }

      // 3. Lấy toàn bộ items để hoàn trả tồn kho
      const shopOrderIds = shopRows.map((s) => s.id)
      const placeholders = shopOrderIds.map(() => '?').join(',')
      const itemsToRefund = await query(
        `SELECT id, variant_id, qty FROM order_items WHERE shop_order_id IN (${placeholders})`,
        shopOrderIds,
      )

      // Cập nhật trạng thái shop_orders thành cancelled
      await query(
        `UPDATE shop_orders
         SET status = 'cancelled', cancelled_at = NOW(3), cancel_reason = ?
         WHERE order_id = ?`,
        [reason.substring(0, 500), orderId],
      )

      // Cập nhật payments thành void
      await query(
        `UPDATE payments SET status = 'void' WHERE shop_order_id IN (${placeholders})`,
        shopOrderIds,
      )

      // Hoàn tồn kho và ghi nhận stock_moves
      for (const it of itemsToRefund) {
        await query(
          `UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?`,
          [it.qty, it.variant_id],
        )
        await query(
          `INSERT INTO stock_moves (variant_id, order_item_id, reason, delta_qty, actor_id, note)
           VALUES (?, ?, 'cancel', ?, ?, ?)`,
          [it.variant_id, it.id, Number(it.qty), numericUserId, reason.substring(0, 255)],
        )
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Hủy đơn hàng thành công và đã hoàn lại số lượng tồn kho.',
      data: { cancelled: true },
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
