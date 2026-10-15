import {
  getUserFavorites as fetchUserFavorites,
  addUserFavorite as insertUserFavorite,
  removeUserFavorite as deleteUserFavorite,
} from '../clients/data.client.js'

/**
 * GET /api/v1/favorites
 * Lấy danh sách sản phẩm yêu thích của người dùng đang đăng nhập.
 */
export async function getFavorites(req, res, next) {
  try {
    const userId = req.user.id
    const favorites = await fetchUserFavorites(userId)

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách sản phẩm yêu thích thành công.',
      data: favorites,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/favorites/:productId
 * Thêm sản phẩm vào danh sách yêu thích.
 */
export async function addFavorite(req, res, next) {
  try {
    const userId = req.user.id
    const { productId } = req.params

    if (!productId || !/^\d+$/.test(String(productId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã sản phẩm không hợp lệ.',
        error: { code: 'INVALID_PRODUCT_ID' },
      })
    }

    const result = await insertUserFavorite(userId, productId)

    return res.status(200).json({
      success: true,
      message: 'Đã thêm sản phẩm vào danh sách yêu thích.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/favorites/:productId
 * Xóa sản phẩm khỏi danh sách yêu thích.
 */
export async function removeFavorite(req, res, next) {
  try {
    const userId = req.user.id
    const { productId } = req.params

    if (!productId || !/^\d+$/.test(String(productId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã sản phẩm không hợp lệ.',
        error: { code: 'INVALID_PRODUCT_ID' },
      })
    }

    const result = await deleteUserFavorite(userId, productId)

    return res.status(200).json({
      success: true,
      message: 'Đã bỏ sản phẩm khỏi danh sách yêu thích.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}
