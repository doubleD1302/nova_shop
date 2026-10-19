import {
  fetchShops,
  fetchShopDetail,
  fetchShopProducts,
  checkShopFollow,
  followShop as submitFollowShop,
  unfollowShop as submitUnfollowShop,
  DataApiClientError,
} from '../clients/data.client.js'

/**
 * GET /api/v1/shops
 * Lấy danh sách gian hàng trên sàn kèm bộ lọc, sắp xếp và phân trang.
 */
export async function getShops(req, res, next) {
  try {
    const { page, limit, mall, keyword, province, sort } = req.query

    // Validate page
    if (page !== undefined && page !== null && page !== '') {
      const p = Number(page)
      if (!Number.isInteger(p) || p < 1) {
        return res.status(400).json({
          success: false,
          message: 'Tham số page không hợp lệ, phải là số nguyên dương.',
          error: { code: 'INVALID_QUERY' },
        })
      }
    }

    // Validate limit
    if (limit !== undefined && limit !== null && limit !== '') {
      const l = Number(limit)
      if (!Number.isInteger(l) || l < 1 || l > 50) {
        return res.status(400).json({
          success: false,
          message: 'Tham số limit không hợp lệ, phải là số nguyên từ 1 đến 50.',
          error: { code: 'INVALID_QUERY' },
        })
      }
    }

    const result = await fetchShops({ page, limit, mall, keyword, province, sort })

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách gian hàng thành công.',
      data: result.data,
      meta: result.meta,
    })
  } catch (err) {
    if (err instanceof DataApiClientError) {
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
 * GET /api/v1/shops/:shopId
 * Lấy thông tin chi tiết một gian hàng theo ID hoặc Slug.
 */
export async function getShopDetail(req, res, next) {
  try {
    const { shopId } = req.params

    if (!shopId || typeof shopId !== 'string' || shopId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Định danh gian hàng không hợp lệ.',
        error: { code: 'INVALID_SHOP_ID' },
      })
    }

    const shop = await fetchShopDetail(shopId.trim())

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin gian hàng thành công.',
      data: shop,
    })
  } catch (err) {
    if (err instanceof DataApiClientError) {
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
 * GET /api/v1/shops/:shopId/products
 * Lấy danh sách sản phẩm của một gian hàng.
 */
export async function getShopProducts(req, res, next) {
  try {
    const { shopId } = req.params
    const { page, limit, categoryId, sort } = req.query

    if (!shopId || typeof shopId !== 'string' || shopId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Định danh gian hàng không hợp lệ.',
        error: { code: 'INVALID_SHOP_ID' },
      })
    }

    // Validate page
    if (page !== undefined && page !== null && page !== '') {
      const p = Number(page)
      if (!Number.isInteger(p) || p < 1) {
        return res.status(400).json({
          success: false,
          message: 'Tham số page không hợp lệ, phải là số nguyên dương.',
          error: { code: 'INVALID_QUERY' },
        })
      }
    }

    // Validate limit
    if (limit !== undefined && limit !== null && limit !== '') {
      const l = Number(limit)
      if (!Number.isInteger(l) || l < 1 || l > 50) {
        return res.status(400).json({
          success: false,
          message: 'Tham số limit không hợp lệ, phải là số nguyên từ 1 đến 50.',
          error: { code: 'INVALID_QUERY' },
        })
      }
    }

    const result = await fetchShopProducts(shopId.trim(), { page, limit, categoryId, sort })

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách sản phẩm của gian hàng thành công.',
      data: result.data,
      meta: result.meta,
    })
  } catch (err) {
    if (err instanceof DataApiClientError) {
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
 * GET /api/v1/shops/:shopId/follow
 * Kiểm tra trạng thái theo dõi của người dùng đối với shop.
 */
export async function getFollowStatus(req, res, next) {
  try {
    const { shopId } = req.params
    const userId = req.user.id

    const isFollowing = await checkShopFollow(shopId, userId)

    return res.status(200).json({
      success: true,
      data: {
        shopId,
        isFollowing,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/shops/:shopId/follow
 * Theo dõi một gian hàng.
 */
export async function followShopAction(req, res, next) {
  try {
    const { shopId } = req.params
    const userId = req.user.id

    const result = await submitFollowShop(shopId, userId)

    return res.status(200).json({
      success: true,
      message: 'Đã theo dõi gian hàng thành công.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/shops/:shopId/follow
 * Hủy theo dõi gian hàng.
 */
export async function unfollowShopAction(req, res, next) {
  try {
    const { shopId } = req.params
    const userId = req.user.id

    const result = await submitUnfollowShop(shopId, userId)

    return res.status(200).json({
      success: true,
      message: 'Đã hủy theo dõi gian hàng.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}
