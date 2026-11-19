import { callDataApi } from '../clients/data.client.js'
import { notifyUser } from '../services/notification.service.js'

const MAX_REPLY_LENGTH = 1000

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
 * Seller xem đánh giá sản phẩm của shop
 * Endpoint: GET /api/v1/seller/reviews?rating=&replied=&productId=&limit=&offset=
 */
export async function listSellerReviews(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    // Data API kiểm tra giá trị từng bộ lọc
    const params = new URLSearchParams({ shopId })
    for (const key of ['rating', 'replied', 'productId', 'limit', 'offset']) {
      if (req.query[key] !== undefined && req.query[key] !== '') {
        params.set(key, String(req.query[key]))
      }
    }

    const data = await callDataApi(`/internal/v1/seller/reviews?${params}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Seller trả lời một đánh giá (mỗi đánh giá một lần)
 * Endpoint: POST /api/v1/seller/reviews/:reviewId/reply
 */
export async function replySellerReview(req, res, next) {
  try {
    const shopId = getShopId(req, res)
    if (!shopId) return

    const { reply } = req.body || {}
    const text = typeof reply === 'string' ? reply.trim() : ''
    if (!text || text.length > MAX_REPLY_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Nội dung phản hồi phải từ 1 đến ${MAX_REPLY_LENGTH} ký tự.`,
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const data = await callDataApi(`/internal/v1/seller/reviews/${encodeURIComponent(req.params.reviewId)}/reply`, {
      method: 'POST',
      body: { shopId, userId: String(req.user.id), reply: text },
    })

    // Báo cho người mua biết shop đã phản hồi; lỗi gửi thông báo không làm hỏng phản hồi
    notifyUser({
      userId: data.buyerId,
      title: 'Shop đã phản hồi đánh giá của bạn',
      content: `Shop đã trả lời đánh giá của bạn về "${data.productName}".`,
      type: 'system',
      link: data.productSlug ? `/san-pham/${data.productSlug}` : null,
      metadata: { reviewId: data.id, productId: data.productId },
    }).catch(() => {})

    // buyerId chỉ dùng để gửi thông báo nên không trả cho seller
    const result = {
      id: data.id,
      productId: data.productId,
      productName: data.productName,
      sellerReply: data.sellerReply,
      repliedAt: data.repliedAt,
    }
    return res.status(201).json({ success: true, message: 'Đã gửi phản hồi đánh giá.', data: result })
  } catch (err) {
    return next(err)
  }
}
