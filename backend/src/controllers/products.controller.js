import { callDataApi } from '../clients/data.client.js'

export async function listProducts(req, res, next) {
  try {
    const params = new URLSearchParams()
    const allowed = ['limit', 'offset', 'categoryId', 'shopId', 'q', 'flash', 'mall', 'freeship', 'minPrice', 'maxPrice', 'minRating', 'minDiscount', 'location', 'sort', 'slug', 'ids', 'fullImages']
    for (const key of allowed) {
      const value = req.query[key]
      if (value !== undefined && value !== '') params.set(key, String(value))
    }
    const result = await callDataApi(`/internal/v1/products?${params}`)
    const requestedSlug = typeof req.query.slug === 'string' ? req.query.slug : ''
    if (requestedSlug && !Array.isArray(result?.products)) {
      return res.status(502).json({
        success: false,
        message: 'Data API returned an invalid product result for the requested slug.',
        error: { code: 'PRODUCT_RESULT_INVALID' },
      })
    }
    if (requestedSlug && result.products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
        error: { code: 'PRODUCT_NOT_FOUND' },
      })
    }
    if (requestedSlug && (result.products.length !== 1 || result.products.some((product) => product?.slug !== requestedSlug))) {
      return res.status(502).json({
        success: false,
        message: 'Data API returned a product that does not match the requested slug.',
        error: { code: 'PRODUCT_SLUG_MISMATCH' },
      })
    }
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

export async function listProductReviews(req, res, next) {
  try {
    const result = await callDataApi(`/internal/v1/products/${encodeURIComponent(req.params.productId)}/reviews`)
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

export async function listEligibleReviewItems(req, res, next) {
  try {
    const result = await callDataApi(
      `/internal/v1/products/${encodeURIComponent(req.params.productId)}/reviews/eligible?userId=${encodeURIComponent(req.user.id)}`,
    )
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

export async function createProductReview(req, res, next) {
  try {
    const result = await callDataApi(`/internal/v1/products/${encodeURIComponent(req.params.productId)}/reviews`, {
      method: 'POST',
      body: { ...req.body, userId: req.user.id },
    })
    return res.status(201).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}

export async function listSellerProducts(req, res, next) {
  try {
    const params = new URLSearchParams({ userId: String(req.user.id) })
    for (const key of ['limit', 'offset', 'productId']) {
      if (req.query[key] !== undefined && req.query[key] !== '') params.set(key, String(req.query[key]))
    }
    const data = await callDataApi(`/internal/v1/seller/products?${params}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function saveSellerProduct(req, res, next) {
  try {
    const productId = req.params.productId
    const path = productId
      ? `/internal/v1/seller/products/${encodeURIComponent(productId)}`
      : '/internal/v1/seller/products'
    const data = await callDataApi(path, {
      method: productId ? 'PUT' : 'POST',
      body: { ...(req.body || {}), userId: req.user.id },
    })
    return res.status(productId ? 200 : 201).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function archiveSellerProduct(req, res, next) {
  try {
    const data = await callDataApi(`/internal/v1/seller/products/${encodeURIComponent(req.params.productId)}`, {
      method: 'DELETE',
      body: { userId: req.user.id },
    })
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}
