export async function listPublicVouchers(req, res, next) {
  try {
    const result = await callDataApi('/internal/v1/vouchers')
    return res.status(200).json({ success: true, data: result.data || result })
  } catch (err) {
    return next(err)
  }
}

import { callDataApi } from '../clients/data.client.js'

export async function listWallet(req, res, next) {
  try {
    const page = req.query.page === undefined ? '1' : req.query.page
    if (typeof page !== 'string' || !/^[1-9]\d{0,3}$/.test(page)) {
      return res.status(400).json({ success: false, message: 'Trang không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const data = await callDataApi(`/internal/v1/vouchers/wallet?userId=${encodeURIComponent(req.user.id)}&page=${page}`)
    return res.json({ success: true, data })
  } catch (err) { return next(err) }
}

export async function saveVoucher(req, res, next) {
  try {
    const code = req.body?.code
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(code.trim())) {
      return res.status(400).json({ success: false, message: 'Mã voucher không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const data = await callDataApi('/internal/v1/vouchers/wallet', {
      method: 'POST', body: { userId: req.user.id, code: code.trim().toUpperCase() },
    })
    return res.status(200).json({ success: true, data })
  } catch (err) { return next(err) }
}
