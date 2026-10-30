import { callDataApi } from '../clients/data.client.js'

/**
 * GET /api/v1/cart
 * Lấy danh sách sản phẩm và thông tin giỏ hàng của người dùng đang đăng nhập.
 */
export async function getCart(req, res, next) {
  try {
    const result = await callDataApi(`/internal/v1/cart?userId=${encodeURIComponent(req.user.id)}`)
    return res.status(200).json({
      success: true,
      message: 'Lấy giỏ hàng thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /api/v1/cart/items
 * Thêm sản phẩm (hoặc tăng số lượng SKU) vào giỏ hàng của người dùng.
 */
export async function addItemToCart(req, res, next) {
  try {
    const { variantId, productId, qty = 1, selected = true, replaceQty } = req.body || {}
    const parsedQty = Number(qty)
    if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 99) {
      return res.status(400).json({
        success: false,
        message: 'Số lượng phải là số nguyên từ 1 đến 99.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi('/internal/v1/cart/items', {
      method: 'POST',
      body: {
        userId: req.user.id,
        variantId,
        productId,
        qty: parsedQty,
        selected: Boolean(selected),
        replaceQty: Boolean(replaceQty),
      },
    })

    return res.status(201).json({
      success: true,
      message: 'Đã thêm sản phẩm vào giỏ hàng.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * PATCH /api/v1/cart/items/:itemId
 * Cập nhật số lượng hoặc trạng thái chọn của sản phẩm trong giỏ hàng.
 */
export async function updateCartItem(req, res, next) {
  try {
    const itemId = String(req.params.itemId || '').trim()
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'Mã dòng sản phẩm không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const { qty, selected } = req.body || {}
    if (qty !== undefined) {
      const parsedQty = Number(qty)
      if (!Number.isInteger(parsedQty) || parsedQty < 0 || parsedQty > 99) {
        return res.status(400).json({
          success: false,
          message: 'Số lượng phải là số nguyên từ 0 đến 99 (0 là xóa khỏi giỏ).',
          error: { code: 'VALIDATION_ERROR' },
        })
      }
    }

    const result = await callDataApi(`/internal/v1/cart/items/${encodeURIComponent(itemId)}`, {
      method: 'PATCH',
      body: {
        userId: req.user.id,
        qty,
        selected,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật giỏ hàng.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * DELETE /api/v1/cart/items/:itemId
 * Xóa một sản phẩm cụ thể khỏi giỏ hàng.
 */
export async function removeCartItem(req, res, next) {
  try {
    const itemId = String(req.params.itemId || '').trim()
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'Mã dòng sản phẩm không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi(`/internal/v1/cart/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      body: { userId: req.user.id },
    })

    return res.status(200).json({
      success: true,
      message: 'Đã xóa sản phẩm khỏi giỏ hàng.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * DELETE /api/v1/cart/items (hoặc DELETE /api/v1/cart)
 * Xóa toàn bộ giỏ hàng hoặc chỉ xóa các sản phẩm đang được chọn.
 */
export async function clearCart(req, res, next) {
  try {
    const selectedOnly = req.query.selected === 'true' || req.body?.selectedOnly === true
    const result = await callDataApi('/internal/v1/cart/items', {
      method: 'DELETE',
      body: {
        userId: req.user.id,
        selectedOnly,
      },
    })

    return res.status(200).json({
      success: true,
      message: selectedOnly ? 'Đã xóa các sản phẩm được chọn khỏi giỏ hàng.' : 'Đã làm sạch giỏ hàng.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * POST /api/v1/cart/sync
 * Hợp nhất danh sách sản phẩm từ local storage (trước khi đăng nhập) vào giỏ hàng máy chủ.
 */
export async function syncCart(req, res, next) {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    const result = await callDataApi('/internal/v1/cart/sync', {
      method: 'POST',
      body: {
        userId: req.user.id,
        items,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Đồng bộ giỏ hàng thành công.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * PATCH /api/v1/cart/selection
 * Chọn hoặc bỏ chọn hàng loạt (toàn bộ giỏ hàng hoặc theo từng shop).
 */
export async function updateCartSelection(req, res, next) {
  try {
    const { selected, shopId } = req.body || {}
    if (selected === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Trường selected là bắt buộc.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await callDataApi('/internal/v1/cart/selection', {
      method: 'PATCH',
      body: {
        userId: req.user.id,
        selected: Boolean(selected),
        shopId: shopId ? String(shopId) : undefined,
      },
    })

    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật trạng thái chọn sản phẩm.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}
