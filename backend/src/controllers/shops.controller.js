import { callDataApi } from '../clients/data.client.js'
import { listProducts } from './products.controller.js'

export async function listShops(req, res, next) {
  try {
    const params = new URLSearchParams()
    const allowed = ['limit', 'offset', 'q', 'mall', 'featured']
    if (allowed.some((key) => req.query[key] !== undefined && typeof req.query[key] !== 'string')) {
      return res.status(400).json({ success: false, message: 'Bộ lọc shop không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    for (const key of allowed) {
      const value = req.query[key]
      if (value !== undefined && value !== '') params.set(key, String(value))
    }
    const data = await callDataApi(`/internal/v1/shops${params.size ? `?${params}` : ''}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function getShop(req, res, next) {
  try {
    const data = await callDataApi(`/internal/v1/shops/${encodeURIComponent(req.params.shopId)}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function listCategories(req, res, next) {
  try {
    const data = await callDataApi('/internal/v1/categories')
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function updateSellerShop(req, res, next) {
  try {
    const data = await callDataApi(`/internal/v1/users/${encodeURIComponent(req.user.id)}/seller-shop`, {
      method: 'PUT',
      body: { ...(req.body || {}), userId: req.user.id },
    })
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function getSellerShop(req, res, next) {
  try {
    const data = await callDataApi(`/internal/v1/users/${encodeURIComponent(req.user.id)}/seller-shop`)
    return res.status(200).json({ success: true, data })
  } catch (err) { return next(err) }
}

export async function resubmitSellerShop(req, res, next) {
  try {
    const data = await callDataApi(`/internal/v1/users/${encodeURIComponent(req.user.id)}/seller-shop/resubmit`, { method: 'POST' })
    return res.status(200).json({ success: true, data })
  } catch (err) { return next(err) }
}

export async function getCategoryAttributes(req, res, next) {
  try {
    const slug = req.params.categorySlug
    if (!/^[a-z0-9-]{1,160}$/.test(slug)) return res.status(400).json({ success: false, message: 'Danh mục không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    const version = req.query.version
    if (version !== undefined && !['1', '2'].includes(version)) return res.status(400).json({ success: false, message: 'Phiên bản không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    const suffix = version ? `?version=${encodeURIComponent(version)}` : ''
    const data = await callDataApi(`/internal/v1/categories/${encodeURIComponent(slug)}/attributes${suffix}`)
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
}

export async function getShopFollowStatus(req, res, next) {
  try {
    const { shopId } = req.params
    const data = await callDataApi(`/internal/v1/shops/${encodeURIComponent(shopId)}/follow?userId=${encodeURIComponent(req.user.id)}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function followShop(req, res, next) {
  try {
    const { shopId } = req.params
    const data = await callDataApi(`/internal/v1/shops/${encodeURIComponent(shopId)}/follow`, {
      method: 'POST',
      body: { userId: req.user.id },
    })
    return res.status(200).json({ success: true, message: 'Đã theo dõi gian hàng.', data })
  } catch (err) {
    return next(err)
  }
}

export async function unfollowShop(req, res, next) {
  try {
    const { shopId } = req.params
    const data = await callDataApi(`/internal/v1/shops/${encodeURIComponent(shopId)}/follow`, {
      method: 'DELETE',
      body: { userId: req.user.id },
    })
    return res.status(200).json({ success: true, message: 'Đã hủy theo dõi gian hàng.', data })
  } catch (err) {
    return next(err)
  }
}

export async function getShopProducts(req, res, next) {
  try {
    req.query.shopId = req.params.shopId
    return listProducts(req, res, next)
  } catch (err) {
    return next(err)
  }
}
