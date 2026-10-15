import {
  getProductReviews as fetchProductReviews,
  createProductReview as submitProductReview,
} from '../clients/data.client.js'

/**
 * GET /api/v1/products/:productId/reviews
 * Lấy danh sách đánh giá của sản phẩm kèm phân trang và điểm đánh giá trung bình.
 */
export async function getProductReviews(req, res, next) {
  try {
    const { productId } = req.params
    const { page, limit } = req.query

    if (!productId || !/^\d+$/.test(String(productId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã sản phẩm không hợp lệ.',
        error: { code: 'INVALID_PRODUCT_ID' },
      })
    }

    const result = await fetchProductReviews(productId, { page, limit })

    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/reviews
 * Người mua tạo đánh giá cho sản phẩm đã nhận hàng.
 */
export async function createReview(req, res, next) {
  try {
    const userId = req.user.id
    const { orderItemId, rating, comment, images } = req.body || {}

    if (!orderItemId || !/^\d+$/.test(String(orderItemId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã dòng đơn hàng orderItemId không hợp lệ.',
        error: { code: 'INVALID_ORDER_ITEM_ID' },
      })
    }

    const numRating = Number(rating)
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Điểm đánh giá phải là số nguyên từ 1 đến 5 sao.',
        error: { code: 'INVALID_RATING' },
      })
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung nhận xét không được để trống.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const review = await submitProductReview({
      userId,
      orderItemId,
      rating: numRating,
      comment: comment.trim(),
      images: Array.isArray(images) ? images : [],
    })

    return res.status(201).json({
      success: true,
      message: 'Gửi đánh giá thành công. Cảm ơn bạn!',
      data: review,
    })
  } catch (err) {
    next(err)
  }
}
