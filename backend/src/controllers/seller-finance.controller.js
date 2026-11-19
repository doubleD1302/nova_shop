import { callDataApi } from '../clients/data.client.js'

const TRANSACTION_TYPES = ['order_income', 'refund', 'payout']

function getShopId(req, res) {
  const shopId = req.user?.shopId
  if (!shopId) {
    res.status(403).json({
      success: false,
      message: 'Tài khoản của bạn chưa liên kết với gian hàng nào.',
      error: { code: 'SHOP_NOT_FOUND' },
    })
    return null
  }
  return String(shopId)
}

/**
 * Seller xem lịch sử giao dịch: tiền đơn hàng, hoàn tiền và rút tiền
 * Endpoint: GET /api/v1/seller/finance/transactions?type=&startDate=&endDate=&limit=&offset=
 */
export async function listSellerTransactions(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const { type } = req.query
    if (type !== undefined && type !== '' && !TRANSACTION_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Loại giao dịch không hợp lệ (order_income, refund, payout).',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    // Data API kiểm tra tiếp ngày, limit và offset
    const params = new URLSearchParams({ shopId })
    for (const key of ['type', 'startDate', 'endDate', 'limit', 'offset']) {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        params.set(key, String(req.query[key]))
      }
    }

    const data = await callDataApi(`/internal/v1/seller/finance/transactions?${params}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}
