import {
  fetchCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearOrRemoveCartItems,
  DataApiClientError,
} from '../clients/data.client.js'

function isValidBigIntString(val) {
  if (typeof val !== 'string') return false
  return /^[1-9]\d*$/.test(val.trim())
}

/**
 * GET /api/v1/cart
 * Lấy toàn bộ thông tin giỏ hàng của người dùng đang đăng nhập (gồm danh sách items và nhóm theo shop).
 */
export async function getCart(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập để xem giỏ hàng.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const cartData = await fetchCart(userId)

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin giỏ hàng thành công.',
      data: cartData,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/cart/items
 * Thêm một sản phẩm (theo biến thể SKU) vào giỏ hàng.
 */
export async function addItem(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập để thêm vào giỏ hàng.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { variantId, qty = 1, selected = true } = req.body || {}

    if (!variantId || !isValidBigIntString(String(variantId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã biến thể sản phẩm (variantId) không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const parsedQty = Number(qty)
    if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 99) {
      return res.status(400).json({
        success: false,
        message: 'Số lượng mua phải là số nguyên từ 1 đến 99.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await addItemToCart({
      userId,
      variantId: String(variantId),
      qty: parsedQty,
      selected: Boolean(selected),
    })

    return res.status(201).json({
      success: true,
      message: 'Đã thêm sản phẩm vào giỏ hàng thành công.',
      data: result,
    })
  } catch (err) {
    if (err instanceof DataApiClientError && (err.status === 400 || err.status === 404)) {
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
 * PATCH /api/v1/cart/items/:itemId
 * Cập nhật số lượng hoặc trạng thái chọn của một sản phẩm trong giỏ.
 */
export async function updateItem(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập để thao tác giỏ hàng.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { itemId } = req.params
    const { qty, selected } = req.body || {}

    if (!itemId || !isValidBigIntString(String(itemId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã dòng giỏ hàng không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    if (qty === undefined && selected === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Cần cung cấp ít nhất số lượng (qty) hoặc trạng thái chọn (selected) để cập nhật.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const updatePayload = { userId }

    if (qty !== undefined) {
      const parsedQty = Number(qty)
      if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 99) {
        return res.status(400).json({
          success: false,
          message: 'Số lượng phải là số nguyên từ 1 đến 99.',
          error: { code: 'VALIDATION_ERROR' },
        })
      }
      updatePayload.qty = parsedQty
    }

    if (selected !== undefined) {
      updatePayload.selected = Boolean(selected)
    }

    const result = await updateCartItem(itemId, updatePayload)

    return res.status(200).json({
      success: true,
      message: 'Cập nhật sản phẩm trong giỏ hàng thành công.',
      data: result,
    })
  } catch (err) {
    if (err instanceof DataApiClientError && (err.status === 400 || err.status === 404)) {
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
 * DELETE /api/v1/cart/items/:itemId
 * Xóa một sản phẩm khỏi giỏ hàng.
 */
export async function deleteItem(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập để thao tác giỏ hàng.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { itemId } = req.params

    if (!itemId || !isValidBigIntString(String(itemId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã dòng giỏ hàng không hợp lệ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const result = await removeCartItem(itemId, userId)

    return res.status(200).json({
      success: true,
      message: 'Đã xóa sản phẩm khỏi giỏ hàng thành công.',
      data: result,
    })
  } catch (err) {
    if (err instanceof DataApiClientError && (err.status === 400 || err.status === 404)) {
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
 * DELETE /api/v1/cart/items
 * Xóa nhiều sản phẩm hoặc xóa sạch toàn bộ giỏ hàng.
 */
export async function clearOrRemoveItems(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập để thao tác giỏ hàng.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { itemIds, clearAll } = req.body || {}

    const result = await clearOrRemoveCartItems({
      userId,
      itemIds,
      clearAll,
    })

    return res.status(200).json({
      success: true,
      message: clearAll ? 'Đã làm trống giỏ hàng.' : 'Đã xóa các sản phẩm được chọn khỏi giỏ.',
      data: result,
    })
  } catch (err) {
    if (err instanceof DataApiClientError && err.status === 400) {
      return res.status(400).json({
        success: false,
        message: err.message,
        error: { code: err.code },
      })
    }
    next(err)
  }
}
