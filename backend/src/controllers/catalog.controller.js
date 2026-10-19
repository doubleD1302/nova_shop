import {
  getCategories as fetchCategories,
  getProducts as fetchProducts,
  getProductByIdOrSlug as fetchProductDetail,
  getFeaturedHomeData as fetchFeaturedHomeData,
  DataApiClientError,
} from '../clients/data.client.js'

/**
 * GET /api/v1/categories
 * Lấy danh sách ngành hàng / danh mục công khai.
 */
export async function getCategories(req, res, next) {
  try {
    const categories = await fetchCategories()

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách danh mục thành công.',
      data: categories,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/products
 * Tìm kiếm, lọc và phân trang danh sách sản phẩm công khai.
 */
export async function getProducts(req, res, next) {
  try {
    const { page, limit, q, categoryId, shopId, sort } = req.query

    // 1. Kiểm tra tính hợp lệ cơ bản của query params tại tầng Backend
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

    if (limit !== undefined && limit !== null && limit !== '') {
      const l = Number(limit)
      if (!Number.isInteger(l) || l < 1 || l > 100) {
        return res.status(400).json({
          success: false,
          message: 'Tham số limit không hợp lệ, phải là số nguyên từ 1 đến 100.',
          error: { code: 'INVALID_QUERY' },
        })
      }
    }

    if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
      const c = Number(categoryId)
      if (!Number.isInteger(c) || c < 1) {
        return res.status(400).json({
          success: false,
          message: 'Mã danh mục categoryId không hợp lệ.',
          error: { code: 'INVALID_QUERY' },
        })
      }
    }

    if (shopId !== undefined && shopId !== null && shopId !== '') {
      const s = Number(shopId)
      if (!Number.isInteger(s) || s < 1) {
        return res.status(400).json({
          success: false,
          message: 'Mã gian hàng shopId không hợp lệ.',
          error: { code: 'INVALID_QUERY' },
        })
      }
    }

    // 2. Chuyển tiếp truy vấn sang Data API qua HTTP client
    const result = await fetchProducts(req.query)

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách sản phẩm thành công.',
      data: result.data,
      meta: result.meta,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/products/:idOrSlug
 * Lấy chi tiết sản phẩm kèm danh sách biến thể SKU và gallery ảnh theo ID hoặc slug.
 */
export async function getProductDetail(req, res, next) {
  try {
    const { idOrSlug } = req.params

    if (!idOrSlug || typeof idOrSlug !== 'string' || idOrSlug.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mã định danh sản phẩm không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    const product = await fetchProductDetail(idOrSlug.trim())

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết sản phẩm thành công.',
      data: product,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/products/featured
 * Lấy dữ liệu sản phẩm nổi bật & Flash Sale cho trang chủ.
 */
export async function getFeaturedProducts(req, res, next) {
  try {
    const data = await fetchFeaturedHomeData()

    return res.status(200).json({
      success: true,
      message: 'Lấy dữ liệu trang chủ thành công.',
      data,
    })
  } catch (err) {
    next(err)
  }
}
