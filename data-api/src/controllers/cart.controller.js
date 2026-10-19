import { executeQuery, executeWithConnection } from '../config/database.js'

function isValidBigIntString(val) {
  if (typeof val !== 'string') return false
  return /^[1-9]\d*$/.test(val.trim())
}

/**
 * GET /internal/v1/cart?userId=...
 * Đọc toàn bộ giỏ hàng của người dùng, nhóm theo gian hàng (shop).
 */
export async function getCart(req, res, next) {
  try {
    const { userId } = req.query || {}

    if (!userId || !isValidBigIntString(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã người dùng (userId) không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    const querySql = `
      SELECT
        ci.id AS itemId,
        ci.qty,
        ci.selected,
        ci.created_at AS createdAt,
        ci.updated_at AS updatedAt,
        v.id AS variantId,
        v.sku,
        v.name AS variantName,
        v.price,
        v.original_price AS originalPrice,
        v.stock_qty AS stockQty,
        v.is_active AS isActive,
        v.attributes,
        p.id AS productId,
        p.name AS productName,
        p.slug AS productSlug,
        p.free_shipping AS freeShipping,
        p.status AS productStatus,
        COALESCE(pi.url, '') AS imageUrl,
        s.id AS shopId,
        s.name AS shopName,
        s.slug AS shopSlug,
        s.is_mall AS isMall,
        s.province
      FROM cart_items ci
      JOIN product_variants v ON ci.variant_id = v.id
      JOIN products p ON v.product_id = p.id
      JOIN shops s ON p.shop_id = s.id
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.sort_order = 0
      WHERE ci.user_id = ?
      ORDER BY s.id ASC, ci.created_at DESC
    `

    const rows = await executeQuery(querySql, [userId])

    const items = (rows || []).map((r) => {
      let attrs = {}
      if (r.attributes) {
        try {
          attrs = typeof r.attributes === 'string' ? JSON.parse(r.attributes) : r.attributes
        } catch {}
      }

      const price = Number(r.price)
      const origPrice = r.originalPrice !== null && r.originalPrice !== undefined ? Number(r.originalPrice) : price
      const discount = origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0

      return {
        id: String(r.itemId),
        variantId: String(r.variantId),
        productId: String(r.productId),
        name: r.productName,
        slug: r.productSlug,
        variantName: r.variantName,
        sku: r.sku,
        attributes: attrs,
        price,
        originalPrice: origPrice,
        discount,
        qty: Number(r.qty),
        selected: Boolean(r.selected),
        stock: Number(r.stockQty),
        isActive: Boolean(r.isActive) && r.productStatus === 'active',
        imageUrl: r.imageUrl || '',
        shopId: String(r.shopId),
        shopName: r.shopName,
        shopSlug: r.shopSlug,
        isMall: Boolean(r.isMall),
        freeShipping: Boolean(r.freeShipping),
        province: r.province || '',
      }
    })

    // Nhóm theo từng Shop
    const groupMap = new Map()
    for (const item of items) {
      if (!groupMap.has(item.shopId)) {
        groupMap.set(item.shopId, {
          shopId: item.shopId,
          shopName: item.shopName,
          shopSlug: item.shopSlug,
          isMall: item.isMall,
          province: item.province,
          items: [],
        })
      }
      groupMap.get(item.shopId).items.push(item)
    }

    const groups = Array.from(groupMap.values()).map((g) => {
      const selectedInShop = g.items.filter((i) => i.selected && i.isActive)
      const subtotal = selectedInShop.reduce((sum, i) => sum + i.price * i.qty, 0)
      const hasFreeShip = selectedInShop.some((i) => i.freeShipping) || subtotal >= 1000000

      return {
        ...g,
        subtotal,
        shippingFee: selectedInShop.length === 0 ? 0 : hasFreeShip ? 0 : 16500,
        selectedCount: selectedInShop.reduce((sum, i) => sum + i.qty, 0),
        allSelected: g.items.length > 0 && selectedInShop.length === g.items.length,
      }
    })

    const selectedItems = items.filter((i) => i.selected && i.isActive)
    const subtotal = selectedItems.reduce((sum, i) => sum + i.price * i.qty, 0)
    const originalSubtotal = selectedItems.reduce((sum, i) => sum + i.originalPrice * i.qty, 0)
    const shippingTotal = groups.reduce((sum, g) => sum + g.shippingFee, 0)
    const voucher = subtotal >= 500000 ? 20000 : 0

    return res.status(200).json({
      success: true,
      message: 'Lấy giỏ hàng thành công.',
      data: {
        items,
        groups,
        summary: {
          totalItems: items.reduce((sum, i) => sum + i.qty, 0),
          distinctCount: items.length,
          selectedCount: selectedItems.reduce((sum, i) => sum + i.qty, 0),
          subtotal,
          originalSubtotal,
          productDiscount: originalSubtotal - subtotal,
          shippingTotal,
          voucher,
          total: Math.max(0, subtotal + shippingTotal - voucher),
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /internal/v1/cart/items
 * Thêm một SKU vào giỏ hàng của người dùng.
 */
export async function addItem(req, res, next) {
  try {
    const { userId, variantId, qty = 1, selected = true } = req.body || {}

    if (!userId || !isValidBigIntString(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã người dùng (userId) không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    if (!variantId || !isValidBigIntString(String(variantId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã biến thể SKU (variantId) không hợp lệ.',
        error: { code: 'INVALID_VARIANT_ID' },
      })
    }

    const parsedQty = Number(qty)
    if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 99) {
      return res.status(400).json({
        success: false,
        message: 'Số lượng mua phải là số nguyên từ 1 đến 99.',
        error: { code: 'INVALID_QTY' },
      })
    }

    // 1. Kiểm tra tồn tại và tính hợp lệ của SKU trong CSDL
    const variantRows = await executeQuery(
      `SELECT v.id, v.stock_qty, v.is_active, p.status AS product_status
       FROM product_variants v
       JOIN products p ON v.product_id = p.id
       WHERE v.id = ? LIMIT 1`,
      [variantId]
    )

    if (!variantRows || variantRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Biến thể sản phẩm không tồn tại.',
        error: { code: 'VARIANT_NOT_FOUND' },
      })
    }

    const variant = variantRows[0]
    if (!variant.is_active || variant.product_status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Sản phẩm hoặc biến thể này hiện đã ngừng kinh doanh.',
        error: { code: 'VARIANT_INACTIVE' },
      })
    }

    if (variant.stock_qty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Sản phẩm đã hết hàng trong kho.',
        error: { code: 'OUT_OF_STOCK' },
      })
    }

    // 2. Thêm hoặc cập nhật số lượng trong giỏ hàng
    const existingRows = await executeQuery(
      'SELECT id, qty FROM cart_items WHERE user_id = ? AND variant_id = ? LIMIT 1',
      [userId, variantId]
    )

    let itemId
    let finalQty

    if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0]
      finalQty = Math.min(existing.qty + parsedQty, 99)

      if (finalQty > variant.stock_qty) {
        return res.status(400).json({
          success: false,
          message: `Số lượng vượt quá tồn kho khả dụng (còn ${variant.stock_qty} sản phẩm).`,
          error: { code: 'STOCK_INSUFFICIENT' },
        })
      }

      await executeQuery(
        'UPDATE cart_items SET qty = ?, selected = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
        [finalQty, selected ? 1 : 0, existing.id]
      )
      itemId = existing.id
    } else {
      finalQty = parsedQty

      if (finalQty > variant.stock_qty) {
        return res.status(400).json({
          success: false,
          message: `Số lượng vượt quá tồn kho khả dụng (còn ${variant.stock_qty} sản phẩm).`,
          error: { code: 'STOCK_INSUFFICIENT' },
        })
      }

      const insertResult = await executeQuery(
        'INSERT INTO cart_items (user_id, variant_id, qty, selected) VALUES (?, ?, ?, ?)',
        [userId, variantId, finalQty, selected ? 1 : 0]
      )
      itemId = insertResult.insertId
    }

    return res.status(201).json({
      success: true,
      message: 'Đã thêm sản phẩm vào giỏ hàng thành công.',
      data: {
        itemId: String(itemId),
        variantId: String(variantId),
        qty: finalQty,
        selected: Boolean(selected),
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /internal/v1/cart/items/:itemId
 * Cập nhật số lượng hoặc trạng thái chọn của một dòng trong giỏ hàng.
 */
export async function updateItem(req, res, next) {
  try {
    const { itemId } = req.params
    const { userId, qty, selected } = req.body || {}

    if (!itemId || !isValidBigIntString(String(itemId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã dòng giỏ hàng không hợp lệ.',
        error: { code: 'INVALID_ITEM_ID' },
      })
    }

    if (!userId || !isValidBigIntString(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã người dùng không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    // Kiểm tra dòng giỏ hàng thuộc về user
    const rows = await executeQuery(
      `SELECT ci.id, ci.qty, ci.selected, v.stock_qty, v.is_active
       FROM cart_items ci
       JOIN product_variants v ON ci.variant_id = v.id
       WHERE ci.id = ? AND ci.user_id = ? LIMIT 1`,
      [itemId, userId]
    )

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm trong giỏ hàng.',
        error: { code: 'CART_ITEM_NOT_FOUND' },
      })
    }

    const currentItem = rows[0]
    let newQty = currentItem.qty
    let newSelected = currentItem.selected

    if (qty !== undefined) {
      const parsedQty = Number(qty)
      if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 99) {
        return res.status(400).json({
          success: false,
          message: 'Số lượng phải là số nguyên từ 1 đến 99.',
          error: { code: 'INVALID_QTY' },
        })
      }

      if (parsedQty > currentItem.stock_qty) {
        return res.status(400).json({
          success: false,
          message: `Số lượng vượt quá tồn kho khả dụng (còn ${currentItem.stock_qty} sản phẩm).`,
          error: { code: 'STOCK_INSUFFICIENT' },
        })
      }

      newQty = parsedQty
    }

    if (selected !== undefined) {
      newSelected = selected ? 1 : 0
    }

    await executeQuery(
      'UPDATE cart_items SET qty = ?, selected = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
      [newQty, newSelected, itemId]
    )

    return res.status(200).json({
      success: true,
      message: 'Cập nhật giỏ hàng thành công.',
      data: {
        itemId: String(itemId),
        qty: newQty,
        selected: Boolean(newSelected),
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /internal/v1/cart/items/:itemId
 * Xóa một dòng sản phẩm khỏi giỏ hàng.
 */
export async function deleteItem(req, res, next) {
  try {
    const { itemId } = req.params
    const { userId } = req.query || req.body || {}

    if (!itemId || !isValidBigIntString(String(itemId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã dòng giỏ hàng không hợp lệ.',
        error: { code: 'INVALID_ITEM_ID' },
      })
    }

    if (!userId || !isValidBigIntString(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã người dùng không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    const result = await executeQuery(
      'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    )

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dòng sản phẩm trong giỏ hàng.',
        error: { code: 'CART_ITEM_NOT_FOUND' },
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xóa sản phẩm khỏi giỏ hàng thành công.',
      data: { itemId: String(itemId) },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /internal/v1/cart/items (Xóa nhiều hoặc xóa sạch giỏ)
 */
export async function clearOrRemoveItems(req, res, next) {
  try {
    const { userId, itemIds, clearAll } = req.body || {}

    if (!userId || !isValidBigIntString(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã người dùng không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    if (clearAll === true) {
      await executeQuery('DELETE FROM cart_items WHERE user_id = ?', [userId])
      return res.status(200).json({
        success: true,
        message: 'Đã xóa sạch giỏ hàng.',
        data: { cleared: true },
      })
    }

    if (Array.isArray(itemIds) && itemIds.length > 0) {
      const validIds = itemIds.map(String).filter(isValidBigIntString)
      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách mã sản phẩm cần xóa không hợp lệ.',
          error: { code: 'INVALID_ITEM_IDS' },
        })
      }

      const placeholders = validIds.map(() => '?').join(',')
      await executeQuery(
        `DELETE FROM cart_items WHERE user_id = ? AND id IN (${placeholders})`,
        [userId, ...validIds]
      )

      return res.status(200).json({
        success: true,
        message: 'Đã xóa các sản phẩm được chọn khỏi giỏ hàng.',
        data: { deletedItemIds: validIds },
      })
    }

    return res.status(400).json({
      success: false,
      message: 'Yêu cầu không hợp lệ. Vui lòng cung cấp itemIds hoặc clearAll: true.',
      error: { code: 'INVALID_REQUEST' },
    })
  } catch (err) {
    next(err)
  }
}
