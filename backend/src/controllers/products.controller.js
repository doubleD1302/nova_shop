import path from 'node:path'
import { stat } from 'node:fs/promises'
import { env } from '../config/env.js'
import { headUploadedImage } from '../services/object-storage.js'
import { callDataApi } from '../clients/data.client.js'

export async function listProducts(req, res, next) {
  try {
    const params = new URLSearchParams()
    const allowed = ['limit', 'offset', 'categoryId', 'shopId', 'q', 'flash', 'mall', 'freeship', 'minPrice', 'maxPrice', 'minRating', 'minDiscount', 'location', 'sort', 'slug', 'ids', 'fullImages']
    if (allowed.some((key) => req.query[key] !== undefined && typeof req.query[key] !== 'string')) {
      return res.status(400).json({ success: false, message: 'Bộ lọc sản phẩm không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
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

export async function getProductDetail(req, res, next) {
  try {
    const key = req.params.productId
    if (!/^[a-z0-9-]{1,180}$/.test(key)) {
      return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const isId = /^[1-9]\d{0,19}$/.test(key)
    const params = new URLSearchParams({ [isId ? 'ids' : 'slug']: key, limit: '1', fullImages: '1' })
    const result = await callDataApi(`/internal/v1/products?${params}`)
    if (!Array.isArray(result?.products)) {
      return res.status(502).json({ success: false, message: 'Dữ liệu sản phẩm không hợp lệ.', error: { code: 'PRODUCT_RESULT_INVALID' } })
    }
    if (result.products.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.', error: { code: 'PRODUCT_NOT_FOUND' } })
    }
    const product = result.products[0]
    if (result.products.length !== 1 || (isId ? String(product?.id) !== key : product?.slug !== key)) {
      return res.status(502).json({ success: false, message: 'Dữ liệu sản phẩm không khớp.', error: { code: 'PRODUCT_RESULT_INVALID' } })
    }
    return res.status(200).json({ success: true, data: product })
  } catch (err) { return next(err) }
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
    const images = req.body?.images === undefined ? [] : req.body.images
    const prefix = `/uploads/review-${req.user.id}-`
    const filenamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/i
    if (!Array.isArray(images) || images.length > 5 || new Set(images).size !== images.length || images.some((url) =>
      typeof url !== 'string' || !url.startsWith(prefix) || !filenamePattern.test(url.slice(prefix.length)))) {
      return res.status(400).json({ success: false, message: 'Ảnh đánh giá không hợp lệ.', error: { code: 'INVALID_REVIEW_IMAGES' } })
    }
    for (const url of images) {
      const filename = url.slice('/uploads/'.length)
      try {
        const file = env.uploadStorage === 's3' ? await headUploadedImage(filename) : await stat(path.join(env.uploadDir, filename))
        const size = env.uploadStorage === 's3' ? file.size : file.isFile() ? file.size : 0
        if (!Number.isSafeInteger(size) || size < 1 || size > 2 * 1024 * 1024) {
          return res.status(400).json({ success: false, message: 'Ảnh đánh giá không hợp lệ.', error: { code: 'INVALID_REVIEW_IMAGES' } })
        }
      } catch (err) {
        if (err?.code === 'ENOENT' || err?.name === 'NotFound' || err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
          return res.status(400).json({ success: false, message: 'Không tìm thấy ảnh đánh giá.', error: { code: 'INVALID_REVIEW_IMAGES' } })
        }
        return res.status(503).json({ success: false, message: 'Không thể kiểm tra ảnh đánh giá.', error: { code: 'IMAGE_STORAGE_UNAVAILABLE' } })
      }
    }
    const result = await callDataApi(`/internal/v1/products/${encodeURIComponent(req.params.productId)}/reviews`, {
      method: 'POST',
      body: { ...req.body, images, userId: req.user.id },
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
    const images = Array.isArray(req.body?.images) ? req.body.images : []
    for (const image of images) {
      if (typeof image?.url !== 'string' || !image.url.startsWith('/uploads/')) continue
      const filename = image.url.slice('/uploads/'.length)
      if (!/^(?:(?:product|avatar)-[1-9]\d{0,19}-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/i.test(filename)) {
        return res.status(400).json({ success: false, message: 'Ảnh sản phẩm không hợp lệ.', error: { code: 'INVALID_PRODUCT_IMAGE' } })
      }
      try {
        const file = env.uploadStorage === 's3' ? await headUploadedImage(filename) : await stat(path.join(env.uploadDir, filename))
        const size = env.uploadStorage === 's3' ? file.size : file.isFile() ? file.size : 0
        if (!Number.isSafeInteger(size) || size < 1 || size > 5 * 1024 * 1024) {
          return res.status(400).json({ success: false, message: 'Ảnh sản phẩm không hợp lệ.', error: { code: 'INVALID_PRODUCT_IMAGE' } })
        }
      } catch (err) {
        if (err?.code === 'ENOENT' || err?.name === 'NotFound' || err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
          return res.status(400).json({ success: false, message: 'Không tìm thấy ảnh sản phẩm.', error: { code: 'INVALID_PRODUCT_IMAGE' } })
        }
        return res.status(503).json({ success: false, message: 'Không thể kiểm tra ảnh sản phẩm.', error: { code: 'IMAGE_STORAGE_UNAVAILABLE' } })
      }
    }
    const apiPath = productId
      ? `/internal/v1/seller/products/${encodeURIComponent(productId)}`
      : '/internal/v1/seller/products'
    const data = await callDataApi(apiPath, {
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

export async function getSellerCategoryAttributes(req, res, next) {
  try {
    const id = req.params.productId
    if (!/^[1-9]\d{0,19}$/.test(id)) return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    const data = await callDataApi(`/internal/v1/seller/products/${encodeURIComponent(id)}/category-attributes?userId=${encodeURIComponent(req.user.id)}`)
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
}

export async function getPublicCategoryAttributes(req, res, next) {
  try {
    const id = req.params.productId
    if (!/^[1-9]\d{0,19}$/.test(id)) return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    const data = await callDataApi(`/internal/v1/products/${encodeURIComponent(id)}/category-attributes`)
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
}
