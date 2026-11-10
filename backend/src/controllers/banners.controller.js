import { callDataApi } from '../clients/data.client.js'

/**
 * Lấy danh sách banner quảng cáo trang chủ
 * GET /api/v1/banners
 */
export async function listBanners(req, res, next) {
  try {
    const data = await callDataApi('/internal/v1/banners')
    return res.status(200).json({ success: true, data: data || [] })
  } catch (err) {
    return next(err)
  }
}
