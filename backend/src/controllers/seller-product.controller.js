import {
  fetchSellerProducts,
  createSellerProduct as insertSellerProduct,
  updateSellerProduct as modifySellerProduct,
  deleteSellerProduct as removeSellerProduct,
} from '../clients/data.client.js'

/**
 * GET /api/v1/seller/products
 * Lấy danh sách sản phẩm của gian hàng do seller sở hữu.
 */
export async function getProducts(req, res, next) {
  try {
    const shopId = req.user.shopId
    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa được liên kết với bất kỳ gian hàng nào.',
        error: { code: 'SHOP_REQUIRED' },
      })
    }

    const { status, page, limit } = req.query
    const result = await fetchSellerProducts(shopId, { status, page, limit })

    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/seller/products
 * Tạo mới sản phẩm cho gian hàng.
 */
export async function createProduct(req, res, next) {
  try {
    const shopId = req.user.shopId
    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa được liên kết với bất kỳ gian hàng nào.',
        error: { code: 'SHOP_REQUIRED' },
      })
    }

    const {
      name,
      slug,
      categoryId,
      description,
      specs,
      freeShipping,
      isFlashSale,
      isFeatured,
      images,
      variants,
    } = req.body || {}

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tên sản phẩm không được để trống.',
        error: { code: 'VALIDATION_ERROR', field: 'name' },
      })
    }

    if (!categoryId || !/^\d+$/.test(String(categoryId))) {
      return res.status(400).json({
        success: false,
        message: 'Danh mục sản phẩm không hợp lệ.',
        error: { code: 'VALIDATION_ERROR', field: 'categoryId' },
      })
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sản phẩm phải có ít nhất 1 biến thể SKU.',
        error: { code: 'VALIDATION_ERROR', field: 'variants' },
      })
    }

    const product = await insertSellerProduct({
      shopId,
      name,
      slug,
      categoryId,
      description,
      specs,
      freeShipping,
      isFlashSale,
      isFeatured,
      images,
      variants,
      actorId: req.user.id,
    })

    return res.status(201).json({
      success: true,
      message: 'Tạo sản phẩm mới thành công.',
      data: product,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/v1/seller/products/:id
 * Cập nhật thông tin sản phẩm.
 */
export async function updateProduct(req, res, next) {
  try {
    const shopId = req.user.shopId
    const { id } = req.params

    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa được liên kết với bất kỳ gian hàng nào.',
        error: { code: 'SHOP_REQUIRED' },
      })
    }

    if (!id || !/^\d+$/.test(String(id))) {
      return res.status(400).json({
        success: false,
        message: 'Mã định danh sản phẩm không hợp lệ.',
        error: { code: 'INVALID_PRODUCT_ID' },
      })
    }

    const result = await modifySellerProduct(id, {
      ...req.body,
      shopId,
    })

    return res.status(200).json({
      success: true,
      message: 'Cập nhật sản phẩm thành công.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/seller/products/:id
 * Xóa/chuyển trạng thái sản phẩm sang archived.
 */
export async function deleteProduct(req, res, next) {
  try {
    const shopId = req.user.shopId
    const { id } = req.params

    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa được liên kết với bất kỳ gian hàng nào.',
        error: { code: 'SHOP_REQUIRED' },
      })
    }

    if (!id || !/^\d+$/.test(String(id))) {
      return res.status(400).json({
        success: false,
        message: 'Mã định danh sản phẩm không hợp lệ.',
        error: { code: 'INVALID_PRODUCT_ID' },
      })
    }

    const result = await removeSellerProduct(id, shopId)

    return res.status(200).json({
      success: true,
      message: 'Đã lưu trữ (xóa) sản phẩm thành công.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}
