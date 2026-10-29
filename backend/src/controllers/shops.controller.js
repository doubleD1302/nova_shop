import { callDataApi } from '../clients/data.client.js'

export async function listShops(req, res, next) {
  try {
    const params = new URLSearchParams()
    for (const key of ['limit', 'offset', 'q', 'mall', 'featured']) {
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
