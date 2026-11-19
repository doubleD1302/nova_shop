import { executeQuery, executeTransaction } from '../config/database.js'
import { readPagination } from '../utils/pagination.js'

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
const invalid = (res, msg = 'Dữ liệu không hợp lệ.') =>
  res.status(400).json({ success: false, message: msg, error: { code: 'VALIDATION_ERROR' } })

const MAX_REPLY_LENGTH = 1000

/**
 * Danh sách đánh giá đang hiển thị của các sản phẩm thuộc shop.
 * Bộ lọc: rating (1-5), replied (true/false), productId.
 * summary luôn tính trên toàn bộ đánh giá của shop, không phụ thuộc bộ lọc.
 */
export async function listSellerReviews(req, res, next) {
  try {
    const { shopId, rating, replied, productId } = req.query
    const page = readPagination(req.query)
    if (!validId(shopId) || !page ||
        (rating !== undefined && !/^[1-5]$/.test(rating)) ||
        (replied !== undefined && replied !== 'true' && replied !== 'false') ||
        (productId !== undefined && !validId(productId))) {
      return invalid(res, 'Bộ lọc đánh giá không hợp lệ.')
    }
    const { limit, offset } = page

    let where = "p.shop_id = ? AND r.status = 'visible'"
    const params = [shopId]
    if (rating !== undefined) {
      where += ' AND r.rating = ?'
      params.push(Number(rating))
    }
    if (replied === 'true') where += ' AND r.seller_reply IS NOT NULL'
    if (replied === 'false') where += ' AND r.seller_reply IS NULL'
    if (productId !== undefined) {
      where += ' AND r.product_id = ?'
      params.push(productId)
    }

    // COUNT, danh sách và thống kê độc lập nhau nên chạy song song
    const [counts, rows, stats] = await Promise.all([
      executeQuery(
        `SELECT COUNT(*) AS total FROM reviews r JOIN products p ON p.id = r.product_id WHERE ${where}`,
        params,
      ),
      executeQuery(
        `SELECT r.id, r.product_id, r.rating, r.comment, r.created_at, r.seller_reply, r.replied_at,
                p.name AS product_name, u.full_name AS buyer_name, oi.variant_name
         FROM reviews r
         JOIN products p ON p.id = r.product_id
         JOIN users u ON u.id = r.user_id
         JOIN order_items oi ON oi.id = r.order_item_id
         WHERE ${where}
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      executeQuery(
        `SELECT COUNT(*) AS total, COALESCE(AVG(r.rating), 0) AS average,
                COALESCE(SUM(r.seller_reply IS NULL), 0) AS unreplied,
                COALESCE(SUM(r.rating = 1), 0) AS star1, COALESCE(SUM(r.rating = 2), 0) AS star2,
                COALESCE(SUM(r.rating = 3), 0) AS star3, COALESCE(SUM(r.rating = 4), 0) AS star4,
                COALESCE(SUM(r.rating = 5), 0) AS star5
         FROM reviews r JOIN products p ON p.id = r.product_id
         WHERE p.shop_id = ? AND r.status = 'visible'`,
        [shopId],
      ),
    ])

    let imageRows = []
    if (rows.length) {
      imageRows = await executeQuery(
        `SELECT review_id, url FROM review_images
         WHERE review_id IN (${rows.map(() => '?').join(', ')})
         ORDER BY review_id, sort_order`,
        rows.map((row) => row.id),
      )
    }

    const stat = stats[0] || {}

    return res.status(200).json({
      success: true,
      data: {
        items: rows.map((r) => ({
          id: String(r.id),
          productId: String(r.product_id),
          productName: r.product_name,
          buyerName: r.buyer_name,
          variant: r.variant_name,
          rating: Number(r.rating),
          comment: r.comment,
          images: imageRows.filter((image) => String(image.review_id) === String(r.id)).map((image) => image.url),
          sellerReply: r.seller_reply || null,
          repliedAt: r.replied_at ? new Date(r.replied_at).toISOString() : null,
          createdAt: new Date(r.created_at).toISOString(),
        })),
        total: Number(counts[0]?.total || 0),
        limit,
        offset,
        summary: {
          totalReviews: Number(stat.total || 0),
          averageRating: Number(Number(stat.average || 0).toFixed(2)),
          unreplied: Number(stat.unreplied || 0),
          byRating: {
            1: Number(stat.star1 || 0),
            2: Number(stat.star2 || 0),
            3: Number(stat.star3 || 0),
            4: Number(stat.star4 || 0),
            5: Number(stat.star5 || 0),
          },
        },
      },
    })
  } catch (err) {
    return next(err)
  }
}

// Lấy đánh giá của shop và khóa dòng. Đánh giá của shop khác, đã bị ẩn hoặc không tồn tại
// đều trả REVIEW_NOT_FOUND để không lộ dữ liệu. Chỉ chủ shop mới được thay mặt shop phản hồi.
async function findOwnReview(query, { reviewId, shopId, userId }) {
  const owned = await query('SELECT id FROM shops WHERE id = ? AND owner_id = ? LIMIT 1', [shopId, userId])
  if (!owned.length) return { error: 'FORBIDDEN' }

  const reviews = await query(
    `SELECT id, user_id, product_id, status, seller_reply
     FROM reviews WHERE id = ? FOR UPDATE`,
    [reviewId],
  )
  if (!reviews.length || reviews[0].status !== 'visible') return { error: 'REVIEW_NOT_FOUND' }

  const products = await query('SELECT id, shop_id, name, slug FROM products WHERE id = ? LIMIT 1', [reviews[0].product_id])
  if (!products.length || String(products[0].shop_id) !== String(shopId)) return { error: 'REVIEW_NOT_FOUND' }

  return { review: reviews[0], product: products[0] }
}

const REPLY_ERRORS = {
  FORBIDDEN: [403, 'Bạn không có quyền phản hồi thay gian hàng này.'],
  REVIEW_NOT_FOUND: [404, 'Không tìm thấy đánh giá.'],
  REVIEW_ALREADY_REPLIED: [409, 'Đánh giá này đã được phản hồi.'],
  REVIEW_NOT_REPLIED: [409, 'Đánh giá này chưa có phản hồi.'],
}

function sendReplyError(res, code) {
  const [status, message] = REPLY_ERRORS[code]
  return res.status(status).json({ success: false, message, error: { code } })
}

function readReplyInput(source) {
  const { shopId, userId, reply } = source || {}
  return { shopId: String(shopId ?? ''), userId: String(userId ?? ''), text: typeof reply === 'string' ? reply.trim() : '' }
}

/**
 * Shop trả lời một đánh giá. Mỗi đánh giá chỉ trả lời một lần; muốn đổi thì dùng sửa phản hồi.
 */
export async function replySellerReview(req, res, next) {
  try {
    const { reviewId } = req.params
    const { shopId, userId, text } = readReplyInput(req.body)
    if (!validId(reviewId) || !validId(shopId) || !validId(userId) || !text || text.length > MAX_REPLY_LENGTH) {
      return invalid(res, `Nội dung phản hồi phải từ 1 đến ${MAX_REPLY_LENGTH} ký tự.`)
    }

    const result = await executeTransaction(async (query) => {
      const found = await findOwnReview(query, { reviewId, shopId, userId })
      if (found.error) return found
      const { review, product } = found
      if (review.seller_reply) return { error: 'REVIEW_ALREADY_REPLIED' }

      await query(
        `UPDATE reviews SET seller_reply = ?, replied_by = ?, replied_at = UTC_TIMESTAMP(3)
         WHERE id = ? AND seller_reply IS NULL`,
        [text, userId, reviewId],
      )
      const saved = await query('SELECT replied_at FROM reviews WHERE id = ?', [reviewId])

      return {
        review: {
          id: String(reviewId),
          productId: String(product.id),
          productName: product.name,
          productSlug: product.slug,
          buyerId: String(review.user_id),
          sellerReply: text,
          repliedAt: new Date(saved[0].replied_at).toISOString(),
        },
      }
    })

    if (result.error) return sendReplyError(res, result.error)
    return res.status(201).json({ success: true, message: 'Đã gửi phản hồi đánh giá.', data: result.review })
  } catch (err) {
    return next(err)
  }
}

/**
 * Shop sửa phản hồi đã gửi. `repliedAt` được cập nhật thành thời điểm lưu gần nhất.
 * Không gửi lại thông báo cho người mua.
 */
export async function updateSellerReviewReply(req, res, next) {
  try {
    const { reviewId } = req.params
    const { shopId, userId, text } = readReplyInput(req.body)
    if (!validId(reviewId) || !validId(shopId) || !validId(userId) || !text || text.length > MAX_REPLY_LENGTH) {
      return invalid(res, `Nội dung phản hồi phải từ 1 đến ${MAX_REPLY_LENGTH} ký tự.`)
    }

    const result = await executeTransaction(async (query) => {
      const found = await findOwnReview(query, { reviewId, shopId, userId })
      if (found.error) return found
      if (!found.review.seller_reply) return { error: 'REVIEW_NOT_REPLIED' }

      await query(
        `UPDATE reviews SET seller_reply = ?, replied_by = ?, replied_at = UTC_TIMESTAMP(3)
         WHERE id = ? AND seller_reply IS NOT NULL`,
        [text, userId, reviewId],
      )
      const saved = await query('SELECT replied_at FROM reviews WHERE id = ?', [reviewId])
      return {
        review: {
          id: String(reviewId),
          productId: String(found.product.id),
          productName: found.product.name,
          sellerReply: text,
          repliedAt: new Date(saved[0].replied_at).toISOString(),
        },
      }
    })

    if (result.error) return sendReplyError(res, result.error)
    return res.status(200).json({ success: true, message: 'Đã cập nhật phản hồi đánh giá.', data: result.review })
  } catch (err) {
    return next(err)
  }
}

/**
 * Shop xóa phản hồi đã gửi để đánh giá quay về trạng thái chưa phản hồi (có thể trả lời lại).
 * shopId và userId nằm ở query vì DELETE không có body.
 */
export async function deleteSellerReviewReply(req, res, next) {
  try {
    const { reviewId } = req.params
    const shopId = typeof req.query.shopId === 'string' ? req.query.shopId : ''
    const userId = typeof req.query.userId === 'string' ? req.query.userId : ''
    if (!validId(reviewId) || !validId(shopId) || !validId(userId)) return invalid(res, 'Yêu cầu xóa phản hồi không hợp lệ.')

    const result = await executeTransaction(async (query) => {
      const found = await findOwnReview(query, { reviewId, shopId, userId })
      if (found.error) return found
      if (!found.review.seller_reply) return { error: 'REVIEW_NOT_REPLIED' }

      await query(
        `UPDATE reviews SET seller_reply = NULL, replied_by = NULL, replied_at = NULL
         WHERE id = ? AND seller_reply IS NOT NULL`,
        [reviewId],
      )
      return { review: { id: String(reviewId), productId: String(found.product.id), sellerReply: null, repliedAt: null } }
    })

    if (result.error) return sendReplyError(res, result.error)
    return res.status(200).json({ success: true, message: 'Đã xóa phản hồi đánh giá.', data: result.review })
  } catch (err) {
    return next(err)
  }
}
