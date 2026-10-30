import { executeQuery, executeTransaction } from '../config/database.js'

const FREE_SHIP_THRESHOLD = 1000000
const SHIP_FEE_PER_SHOP = 16500
const VOUCHER_MIN = 500000
const VOUCHER_VALUE = 20000

const responseError = (res, status, code, message) => res.status(status).json({
  success: false,
  message,
  error: { code },
})

function isValidId(val) {
  return typeof val === 'string' && /^[1-9]\d{0,19}$/.test(val.trim())
}

function serializeCartItem(row) {
  const isAvailable = Boolean(
    row.variant_id &&
    row.product_id &&
    row.variant_active === 1 &&
    row.product_status === 'active' &&
    row.shop_status === 'active' &&
    Number(row.stock_qty || 0) > 0
  )
  const price = Number(row.price || 0)
  const originalPrice = row.original_price === null || row.original_price === undefined
    ? price
    : Number(row.original_price)
  const stock = Number(row.stock_qty || 0)
  const qty = Number(row.qty || 1)
  const selected = Boolean(row.selected)

  return {
    id: String(row.cart_item_id),
    cartItemId: String(row.cart_item_id),
    key: String(row.variant_id),
    variantId: String(row.variant_id),
    productId: String(row.product_id || ''),
    name: row.product_name || 'Sản phẩm',
    productName: row.product_name || 'Sản phẩm',
    slug: row.product_slug || '',
    productSlug: row.product_slug || '',
    variant: row.variant_name || 'Mặc định',
    variantName: row.variant_name || 'Mặc định',
    sku: row.sku || '',
    price,
    originalPrice,
    stock,
    qty,
    selected,
    image: row.image_url || '',
    imageUrl: row.image_url || '',
    imageFallback: row.image_url || '',
    shopId: String(row.shop_id || '1'),
    shopName: row.shop_name || 'ShopNova',
    shopMall: Boolean(row.is_mall),
    freeship: Boolean(row.free_shipping),
    freeShipping: Boolean(row.free_shipping),
    available: isAvailable,
    unavailable: !isAvailable,
    createdAt: row.item_created_at instanceof Date ? row.item_created_at.toISOString() : String(row.item_created_at || ''),
    updatedAt: row.item_updated_at instanceof Date ? row.item_updated_at.toISOString() : String(row.item_updated_at || ''),
  }
}

export async function fetchUserCartData(userId) {
  const sql = `
    SELECT
      ci.id AS cart_item_id,
      ci.user_id,
      ci.variant_id,
      ci.qty,
      ci.selected,
      ci.created_at AS item_created_at,
      ci.updated_at AS item_updated_at,
      pv.id AS variant_id,
      pv.sku,
      pv.name AS variant_name,
      pv.price,
      pv.original_price,
      pv.stock_qty,
      pv.is_active AS variant_active,
      p.id AS product_id,
      p.name AS product_name,
      p.slug AS product_slug,
      p.status AS product_status,
      p.free_shipping,
      s.id AS shop_id,
      s.name AS shop_name,
      s.slug AS shop_slug,
      s.is_mall,
      s.status AS shop_status,
      (
        SELECT url FROM product_images
        WHERE product_id = p.id
        ORDER BY sort_order ASC
        LIMIT 1
      ) AS image_url
    FROM cart_items ci
    LEFT JOIN product_variants pv ON pv.id = ci.variant_id
    LEFT JOIN products p ON p.id = pv.product_id
    LEFT JOIN shops s ON s.id = p.shop_id
    WHERE ci.user_id = ?
    ORDER BY ci.updated_at DESC, ci.id DESC
  `
  const rows = await executeQuery(sql, [userId])
  const items = rows.map(serializeCartItem)

  // Nhóm theo từng Shop
  const shopMap = new Map()
  for (const item of items) {
    if (!shopMap.has(item.shopId)) {
      shopMap.set(item.shopId, {
        shopId: item.shopId,
        shopName: item.shopName,
        shopMall: item.shopMall,
        items: [],
      })
    }
    shopMap.get(item.shopId).items.push(item)
  }

  const groups = [...shopMap.values()].map((g) => {
    const selectedInShop = g.items.filter((i) => i.selected && i.available)
    const subtotal = selectedInShop.reduce((sum, i) => sum + i.price * i.qty, 0)
    const hasFreeship = selectedInShop.some((i) => i.freeship)
    const shippingFee = selectedInShop.length === 0 ? 0 : hasFreeship || subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIP_FEE_PER_SHOP
    return {
      ...g,
      subtotal,
      shippingFee,
      hasFreeship,
      selectedCount: selectedInShop.reduce((sum, i) => sum + i.qty, 0),
      allSelected: g.items.length > 0 && g.items.every((i) => i.selected),
    }
  })

  // Thống kê tổng hợp giỏ hàng
  const selectedItems = items.filter((i) => i.selected && i.available)
  const subtotal = selectedItems.reduce((sum, i) => sum + i.price * i.qty, 0)
  const originalSubtotal = selectedItems.reduce((sum, i) => sum + (i.originalPrice || i.price) * i.qty, 0)
  const shippingTotal = groups.reduce((sum, g) => sum + g.shippingFee, 0)
  const voucher = subtotal >= VOUCHER_MIN ? VOUCHER_VALUE : 0
  const total = Math.max(0, subtotal + shippingTotal - voucher)

  const summary = {
    subtotal,
    originalSubtotal,
    productDiscount: originalSubtotal - subtotal,
    shippingTotal,
    voucher,
    total,
    selectedCount: selectedItems.reduce((sum, i) => sum + i.qty, 0),
    distinctCount: items.length,
    itemCount: items.reduce((sum, i) => sum + i.qty, 0),
    shopCount: groups.filter((g) => g.selectedCount > 0).length,
  }

  return { items, groups, summary }
}

/**
 * GET /internal/v1/cart?userId=:userId
 * Lấy toàn bộ dữ liệu giỏ hàng của người dùng.
 */
export async function getCart(req, res, next) {
  try {
    const userId = String(req.query.userId || '').trim()
    if (!isValidId(userId)) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'userId không hợp lệ.')
    }

    const cartData = await fetchUserCartData(userId)
    return res.status(200).json({
      success: true,
      message: 'Lấy giỏ hàng thành công.',
      data: cartData,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Tìm kiếm và xác thực biến thể sản phẩm (SKU) khả dụng.
 */
async function resolveVariant(variantId, productId) {
  const cleanVariantId = String(variantId || '').trim()
  const cleanProductId = String(productId || '').trim()

  if (isValidId(cleanVariantId)) {
    const rows = await executeQuery(
      `SELECT pv.id, pv.product_id, pv.price, pv.stock_qty, pv.is_active,
              p.status AS product_status, s.status AS shop_status
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       JOIN shops s ON s.id = p.shop_id
       WHERE pv.id = ?`,
      [cleanVariantId],
    )
    if (rows.length > 0) return rows[0]
  }

  if (cleanProductId) {
    const isId = isValidId(cleanProductId)
    const rows = await executeQuery(
      `SELECT pv.id, pv.product_id, pv.price, pv.stock_qty, pv.is_active,
              p.status AS product_status, s.status AS shop_status
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       JOIN shops s ON s.id = p.shop_id
       WHERE ${isId ? 'p.id = ?' : 'p.slug = ?'} AND pv.is_active = 1
       ORDER BY pv.id ASC
       LIMIT 1`,
      [cleanProductId],
    )
    if (rows.length > 0) return rows[0]
  }

  return null
}

/**
 * POST /internal/v1/cart/items
 * Thêm hoặc gộp sản phẩm vào giỏ hàng.
 */
export async function addItemToCart(req, res, next) {
  try {
    const { userId, variantId, productId, replaceQty } = req.body || {}
    const cleanUserId = String(userId || '').trim()
    if (!isValidId(cleanUserId)) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'userId không hợp lệ.')
    }

    const qty = Number(req.body?.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Số lượng phải là số nguyên từ 1 đến 99.')
    }

    const selected = req.body?.selected !== undefined ? (Boolean(req.body.selected) ? 1 : 0) : 1

    const variant = await resolveVariant(variantId, productId)
    if (!variant) {
      return responseError(res, 404, 'SKU_NOT_FOUND', 'Không tìm thấy biến thể sản phẩm.')
    }

    if (variant.is_active !== 1 || variant.product_status !== 'active' || variant.shop_status !== 'active') {
      return responseError(res, 400, 'PRODUCT_UNAVAILABLE', 'Sản phẩm hiện không khả dụng.')
    }

    if (Number(variant.stock_qty) < 1) {
      return responseError(res, 400, 'OUT_OF_STOCK', 'Sản phẩm hiện đã hết hàng.')
    }

    const targetVariantId = String(variant.id)
    const maxStock = Number(variant.stock_qty)

    // Thêm hoặc cập nhật trong cơ sở dữ liệu
    await executeTransaction(async (query) => {
      const existing = await query(
        'SELECT id, qty FROM cart_items WHERE user_id = ? AND variant_id = ? FOR UPDATE',
        [cleanUserId, targetVariantId],
      )

      if (existing.length > 0) {
        const nextQty = replaceQty
          ? Math.max(1, Math.min(qty, maxStock, 99))
          : Math.max(1, Math.min(Number(existing[0].qty) + qty, maxStock, 99))
        await query(
          'UPDATE cart_items SET qty = ?, selected = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
          [nextQty, selected, existing[0].id],
        )
      } else {
        const initialQty = Math.max(1, Math.min(qty, maxStock, 99))
        await query(
          'INSERT INTO cart_items (user_id, variant_id, qty, selected) VALUES (?, ?, ?, ?)',
          [cleanUserId, targetVariantId, initialQty, selected],
        )
      }
    })

    const cartData = await fetchUserCartData(cleanUserId)
    return res.status(201).json({
      success: true,
      message: 'Đã thêm sản phẩm vào giỏ hàng.',
      data: cartData,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * PATCH /internal/v1/cart/items/:itemId
 * Cập nhật số lượng hoặc trạng thái chọn của một sản phẩm trong giỏ hàng.
 * :itemId có thể là ID của cart_items hoặc ID biến thể variant_id.
 */
export async function updateCartItem(req, res, next) {
  try {
    const { userId, qty, selected } = req.body || {}
    const cleanUserId = String(userId || '').trim()
    const itemId = String(req.params.itemId || '').trim()

    if (!isValidId(cleanUserId) || !itemId) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Dữ liệu yêu cầu không hợp lệ.')
    }

    const existing = await executeQuery(
      `SELECT ci.id, ci.variant_id, ci.qty, ci.selected, pv.stock_qty
       FROM cart_items ci
       LEFT JOIN product_variants pv ON pv.id = ci.variant_id
       WHERE ci.user_id = ? AND (ci.id = ? OR ci.variant_id = ?)
       LIMIT 1`,
      [cleanUserId, itemId, itemId],
    )

    if (!existing.length) {
      return responseError(res, 404, 'ITEM_NOT_FOUND', 'Không tìm thấy sản phẩm trong giỏ hàng.')
    }

    const row = existing[0]

    // Nếu qty <= 0 -> Xóa khỏi giỏ
    if (qty !== undefined && Number(qty) <= 0) {
      await executeQuery('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [row.id, cleanUserId])
    } else {
      let nextQty = row.qty
      if (qty !== undefined) {
        const parsedQty = Number(qty)
        if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 99) {
          return responseError(res, 400, 'VALIDATION_ERROR', 'Số lượng phải là số nguyên từ 1 đến 99.')
        }
        const maxStock = row.stock_qty ? Number(row.stock_qty) : 99
        nextQty = Math.max(1, Math.min(parsedQty, maxStock, 99))
      }

      const nextSelected = selected !== undefined ? (Boolean(selected) ? 1 : 0) : row.selected

      await executeQuery(
        'UPDATE cart_items SET qty = ?, selected = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND user_id = ?',
        [nextQty, nextSelected, row.id, cleanUserId],
      )
    }

    const cartData = await fetchUserCartData(cleanUserId)
    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật giỏ hàng.',
      data: cartData,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * DELETE /internal/v1/cart/items/:itemId
 * Xóa một sản phẩm khỏi giỏ hàng.
 */
export async function removeCartItem(req, res, next) {
  try {
    const userId = String(req.body?.userId || req.query.userId || '').trim()
    const itemId = String(req.params.itemId || '').trim()

    if (!isValidId(userId) || !itemId) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'userId hoặc itemId không hợp lệ.')
    }

    await executeQuery(
      'DELETE FROM cart_items WHERE user_id = ? AND (id = ? OR variant_id = ?)',
      [userId, itemId, itemId],
    )

    const cartData = await fetchUserCartData(userId)
    return res.status(200).json({
      success: true,
      message: 'Đã xóa sản phẩm khỏi giỏ hàng.',
      data: cartData,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * DELETE /internal/v1/cart/items (hoặc DELETE /internal/v1/cart)
 * Xóa tất cả hoặc chỉ các sản phẩm đã được chọn khỏi giỏ hàng.
 */
export async function clearCart(req, res, next) {
  try {
    const userId = String(req.body?.userId || req.query.userId || '').trim()
    const selectedOnly = req.body?.selectedOnly === true || req.query.selected === 'true'

    if (!isValidId(userId)) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'userId không hợp lệ.')
    }

    if (selectedOnly) {
      await executeQuery('DELETE FROM cart_items WHERE user_id = ? AND selected = 1', [userId])
    } else {
      await executeQuery('DELETE FROM cart_items WHERE user_id = ?', [userId])
    }

    const cartData = await fetchUserCartData(userId)
    return res.status(200).json({
      success: true,
      message: selectedOnly ? 'Đã xóa các sản phẩm được chọn khỏi giỏ hàng.' : 'Đã làm sạch giỏ hàng.',
      data: cartData,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /internal/v1/cart/sync
 * Đồng bộ danh sách sản phẩm từ local storage của khách (khi đăng nhập) vào máy chủ.
 */
export async function syncCart(req, res, next) {
  try {
    const { userId, items } = req.body || {}
    const cleanUserId = String(userId || '').trim()

    if (!isValidId(cleanUserId)) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'userId không hợp lệ.')
    }

    if (!Array.isArray(items) || items.length === 0) {
      const cartData = await fetchUserCartData(cleanUserId)
      return res.status(200).json({
        success: true,
        message: 'Không có sản phẩm nào cần đồng bộ.',
        data: cartData,
      })
    }

    // Duyệt qua từng sản phẩm để hợp nhất
    for (const item of items) {
      try {
        const variant = await resolveVariant(item.variantId, item.productId)
        if (!variant || variant.is_active !== 1 || Number(variant.stock_qty) < 1) {
          continue
        }

        const targetVariantId = String(variant.id)
        const qty = Number(item.qty)
        const validQty = Number.isInteger(qty) && qty >= 1 ? Math.min(qty, Number(variant.stock_qty), 99) : 1
        const selected = item.selected !== undefined ? (Boolean(item.selected) ? 1 : 0) : 1

        const existing = await executeQuery(
          'SELECT id, qty FROM cart_items WHERE user_id = ? AND variant_id = ? LIMIT 1',
          [cleanUserId, targetVariantId],
        )

        if (existing.length > 0) {
          const mergedQty = Math.min(Number(existing[0].qty) + validQty, Number(variant.stock_qty), 99)
          await executeQuery(
            'UPDATE cart_items SET qty = ?, selected = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
            [mergedQty, selected, existing[0].id],
          )
        } else {
          await executeQuery(
            'INSERT INTO cart_items (user_id, variant_id, qty, selected) VALUES (?, ?, ?, ?)',
            [cleanUserId, targetVariantId, validQty, selected],
          )
        }
      } catch (err) {
        console.error('[CartSync] Bỏ qua item lỗi khi đồng bộ:', item, err?.message)
      }
    }

    const cartData = await fetchUserCartData(cleanUserId)
    return res.status(200).json({
      success: true,
      message: 'Đồng bộ giỏ hàng thành công.',
      data: cartData,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * PATCH /internal/v1/cart/selection
 * Cập nhật chọn / bỏ chọn hàng loạt (toàn bộ giỏ hoặc theo từng shop).
 */
export async function updateCartSelection(req, res, next) {
  try {
    const { userId, selected, shopId } = req.body || {}
    const cleanUserId = String(userId || '').trim()

    if (!isValidId(cleanUserId) || selected === undefined) {
      return responseError(res, 400, 'VALIDATION_ERROR', 'Dữ liệu yêu cầu không hợp lệ.')
    }

    const targetSelected = Boolean(selected) ? 1 : 0

    if (shopId) {
      await executeQuery(
        `UPDATE cart_items ci
         JOIN product_variants pv ON pv.id = ci.variant_id
         JOIN products p ON p.id = pv.product_id
         SET ci.selected = ?, ci.updated_at = CURRENT_TIMESTAMP(3)
         WHERE ci.user_id = ? AND p.shop_id = ?`,
        [targetSelected, cleanUserId, shopId],
      )
    } else {
      await executeQuery(
        'UPDATE cart_items SET selected = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE user_id = ?',
        [targetSelected, cleanUserId],
      )
    }

    const cartData = await fetchUserCartData(cleanUserId)
    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật trạng thái chọn sản phẩm.',
      data: cartData,
    })
  } catch (err) {
    return next(err)
  }
}
