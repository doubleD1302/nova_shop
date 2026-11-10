import { callDataApi } from '../clients/data.client.js'

/**
 * Lấy danh sách sản phẩm yêu thích của người dùng đang đăng nhập
 * GET /api/v1/favorites
 */
export async function listFavorites(req, res, next) {
  try {
    const data = await callDataApi(`/internal/v1/users/${encodeURIComponent(req.user.id)}/favorites`)
    return res.status(200).json({ success: true, data: data || [] })
  } catch (err) {
    return next(err)
  }
}

/**
 * Thêm sản phẩm vào danh sách yêu thích
 * POST /api/v1/favorites/:productId
 */
export async function addFavorite(req, res, next) {
  try {
    const productId = req.params.productId
    if (!/^[1-9]\d{0,19}$/.test(productId)) {
      return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const data = await callDataApi(`/internal/v1/users/${encodeURIComponent(req.user.id)}/favorites/${encodeURIComponent(productId)}`, {
      method: 'POST',
      body: { userId: req.user.id },
    })
    return res.status(200).json({ success: true, message: 'Đã thêm vào danh sách yêu thích.', data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Xóa sản phẩm khỏi danh sách yêu thích
 * DELETE /api/v1/favorites/:productId
 */
export async function removeFavorite(req, res, next) {
  try {
    const productId = req.params.productId
    if (!/^[1-9]\d{0,19}$/.test(productId)) {
      return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const data = await callDataApi(`/internal/v1/users/${encodeURIComponent(req.user.id)}/favorites/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      body: { userId: req.user.id },
    })
    return res.status(200).json({ success: true, message: 'Đã xóa khỏi danh sách yêu thích.', data })
  } catch (err) {
    return next(err)
  }
}
