import { callDataApi } from '../clients/data.client.js'

export async function previewCheckout(req, res, next) {
  try {
    const result = await callDataApi('/internal/v1/orders/preview', {
      method: 'POST',
      body: { ...(req.body || {}), userId: req.user.id },
    })
    return res.status(200).json({ success: true, data: result })
  } catch (err) {
    return next(err)
  }
}
