import { executeQuery, executeTransaction } from '../config/database.js'

/**
 * Định dạng review cho API response.
 */
function formatReview(row, images = []) {
  return {
    id: String(row.id),
    orderItemId: String(row.order_item_id),
    productId: String(row.product_id),
    rating: Number(row.rating),
    comment: row.comment,
    user: {
      id: String(row.user_id),
      fullName: row.full_name,
      avatarUrl: row.avatar_url || null,
    },
    images: images.map((img) => img.url),
    sellerReply: row.seller_reply || null,
    repliedAt: row.replied_at ? new Date(row.replied_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  }
}

/**
 * GET /internal/v1/products/featured
 * Lấy dữ liệu tổng hợp cho trang chủ: Flash Sale, Sản phẩm nổi bật, Gợi ý.
 */
export async function getFeaturedHomeData(req, res, next) {
  try {
    // 1. Sản phẩm Flash Sale
    const flashSaleSql = `
      SELECT p.id, p.name, p.slug, p.is_flash_sale,
             COALESCE(MIN(v.price), 0) AS price,
             COALESCE(MIN(v.original_price), MIN(v.price), 0) AS original_price,
             (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1) AS image_url,
             COALESCE(SUM(v.stock_qty), 0) AS stock_qty
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = 1
      WHERE p.status = 'active' AND p.is_flash_sale = 1
      GROUP BY p.id
      ORDER BY p.id DESC
      LIMIT 12
    `
    const flashSaleRows = await executeQuery(flashSaleSql)
    const flashSale = flashSaleRows.map((row) => {
      const price = Number(row.price)
      const originalPrice = Number(row.original_price) || price
      const discount = originalPrice > price && originalPrice > 0
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0
      return {
        id: String(row.id),
        name: row.name,
        slug: row.slug,
        price,
        originalPrice,
        discount,
        imageUrl: row.image_url || null,
        stock: Number(row.stock_qty),
      }
    })

    // 2. Sản phẩm Nổi bật (Featured)
    const featuredSql = `
      SELECT p.id, p.name, p.slug, p.free_shipping,
             s.name AS shop_name, s.is_mall, s.province,
             COALESCE(MIN(v.price), 0) AS price,
             COALESCE(MIN(v.original_price), MIN(v.price), 0) AS original_price,
             (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1) AS image_url
      FROM products p
      JOIN shops s ON s.id = p.shop_id
      LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = 1
      WHERE p.status = 'active' AND p.is_featured = 1
      GROUP BY p.id, s.id
      ORDER BY p.id DESC
      LIMIT 12
    `
    const featuredRows = await executeQuery(featuredSql)
    const featuredProducts = featuredRows.map((row) => {
      const price = Number(row.price)
      const originalPrice = Number(row.original_price) || price
      const discount = originalPrice > price && originalPrice > 0
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0
      return {
        id: String(row.id),
        name: row.name,
        slug: row.slug,
        price,
        originalPrice,
        discount,
        imageUrl: row.image_url || null,
        shopName: row.shop_name,
        isMall: Boolean(row.is_mall),
        province: row.province,
        freeShipping: Boolean(row.free_shipping),
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Lấy dữ liệu trang chủ thành công.',
      data: {
        flashSale,
        featuredProducts,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /internal/v1/products/:productId/reviews
 * Lấy danh sách đánh giá của sản phẩm.
 */
export async function getProductReviews(req, res, next) {
  try {
    const { productId } = req.params
    const { page = '1', limit = '10' } = req.query

    if (!productId || !/^\d+$/.test(String(productId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã sản phẩm không hợp lệ.',
        error: { code: 'INVALID_PRODUCT_ID' },
      })
    }

    const numericProductId = BigInt(productId)
    const parsedPage = Math.max(1, Number(page) || 1)
    const parsedLimit = Math.min(50, Math.max(1, Number(limit) || 10))
    const offset = (parsedPage - 1) * parsedLimit

    // Đếm tổng số đánh giá hiển thị
    const countRows = await executeQuery(
      `SELECT COUNT(*) AS total, ROUND(AVG(rating), 1) AS avg_rating
       FROM reviews
       WHERE product_id = ? AND status = 'visible'`,
      [numericProductId],
    )
    const total = Number(countRows[0]?.total || 0)
    const averageRating = Number(countRows[0]?.avg_rating || 5.0)

    // Truy vấn reviews
    const sql = `
      SELECT r.id, r.order_item_id, r.user_id, r.product_id, r.rating, r.comment,
             r.seller_reply, r.replied_at, r.created_at,
             u.full_name, u.avatar_url
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ? AND r.status = 'visible'
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ? OFFSET ?
    `
    const reviewRows = await executeQuery(sql, [numericProductId, parsedLimit, offset])

    // Lấy ảnh đính kèm
    let reviewsWithImages = []
    if (reviewRows && reviewRows.length > 0) {
      const reviewIds = reviewRows.map((r) => r.id)
      const placeholders = reviewIds.map(() => '?').join(',')
      const imageRows = await executeQuery(
        `SELECT review_id, url FROM review_images WHERE review_id IN (${placeholders}) ORDER BY sort_order ASC`,
        reviewIds,
      )

      const imagesByReview = new Map()
      for (const img of imageRows) {
        const rId = String(img.review_id)
        if (!imagesByReview.has(rId)) imagesByReview.set(rId, [])
        imagesByReview.get(rId).push(img)
      }

      reviewsWithImages = reviewRows.map((r) =>
        formatReview(r, imagesByReview.get(String(r.id)) || []),
      )
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách đánh giá thành công.',
      data: {
        averageRating,
        totalReviews: total,
        reviews: reviewsWithImages,
      },
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit) || 1,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /internal/v1/reviews
 * Người mua tạo đánh giá cho dòng sản phẩm đã mua và đã nhận hàng.
 */
export async function createReview(req, res, next) {
  try {
    const { userId, orderItemId, rating, comment, images = [] } = req.body || {}

    if (!userId || !orderItemId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin đánh giá (sao, nội dung, đơn mua) không được để trống.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const numRating = Number(rating)
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Đánh giá phải từ 1 đến 5 sao.',
        error: { code: 'INVALID_RATING' },
      })
    }

    const numericUserId = BigInt(userId)
    const numericOrderItemId = BigInt(orderItemId)

    const createdReview = await executeTransaction(async (query) => {
      // 1. Kiểm tra dòng hàng tồn tại, thuộc user và đơn hàng đã giao thành công
      const checkSql = `
        SELECT oi.id, oi.product_id, so.status AS shop_status, o.buyer_id
        FROM order_items oi
        JOIN shop_orders so ON so.id = oi.shop_order_id
        JOIN orders o ON o.id = so.order_id
        WHERE oi.id = ? AND o.buyer_id = ?
        LIMIT 1
      `
      const orderItemRows = await query(checkSql, [numericOrderItemId, numericUserId])
      if (!orderItemRows || orderItemRows.length === 0) {
        const err = new Error('Bạn không có quyền đánh giá sản phẩm của đơn hàng này.')
        err.status = 403
        err.code = 'FORBIDDEN'
        throw err
      }

      const item = orderItemRows[0]
      if (item.shop_status !== 'delivered') {
        const err = new Error('Bạn chỉ có thể đánh giá sau khi đã nhận được hàng.')
        err.status = 400
        err.code = 'ORDER_NOT_DELIVERED'
        throw err
      }

      // 2. Kiểm tra đã đánh giá dòng này chưa
      const dupRows = await query('SELECT id FROM reviews WHERE order_item_id = ? LIMIT 1', [numericOrderItemId])
      if (dupRows && dupRows.length > 0) {
        const err = new Error('Bạn đã đánh giá sản phẩm này rồi.')
        err.status = 409
        err.code = 'REVIEW_ALREADY_EXISTS'
        throw err
      }

      // 3. Insert review
      const insertReviewSql = `
        INSERT INTO reviews (order_item_id, user_id, product_id, rating, comment, status)
        VALUES (?, ?, ?, ?, ?, 'visible')
      `
      const reviewResult = await query(insertReviewSql, [
        numericOrderItemId,
        numericUserId,
        item.product_id,
        numRating,
        comment.trim(),
      ])

      const reviewId = reviewResult.insertId

      // 4. Insert ảnh đính kèm nếu có
      if (Array.isArray(images) && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const url = String(images[i]).trim()
          if (url.length > 0) {
            await query(
              'INSERT INTO review_images (review_id, url, sort_order) VALUES (?, ?, ?)',
              [reviewId, url, i],
            )
          }
        }
      }

      return {
        id: String(reviewId),
        orderItemId: String(numericOrderItemId),
        productId: String(item.product_id),
        rating: numRating,
        comment: comment.trim(),
        images,
      }
    })

    return res.status(201).json({
      success: true,
      message: 'Gửi đánh giá thành công. Cảm ơn bạn!',
      data: createdReview,
    })
  } catch (err) {
    if (err.status && err.code) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        error: { code: err.code },
      })
    }
    next(err)
  }
}

/**
 * GET /internal/v1/users/:userId/favorites
 * Lấy danh sách sản phẩm yêu thích của người dùng.
 */
export async function getFavorites(req, res, next) {
  try {
    const { userId } = req.params

    if (!userId || !/^\d+$/.test(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã người dùng không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    const numericUserId = BigInt(userId)
    const sql = `
      SELECT p.id, p.name, p.slug, p.free_shipping, pf.created_at AS favorited_at,
             s.name AS shop_name, s.is_mall, s.province,
             COALESCE(MIN(v.price), 0) AS price,
             COALESCE(MIN(v.original_price), MIN(v.price), 0) AS original_price,
             (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1) AS image_url
      FROM product_favorites pf
      JOIN products p ON p.id = pf.product_id
      JOIN shops s ON s.id = p.shop_id
      LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = 1
      WHERE pf.user_id = ? AND p.status = 'active'
      GROUP BY p.id, s.id, pf.created_at
      ORDER BY pf.created_at DESC
    `

    const rows = await executeQuery(sql, [numericUserId])
    const favorites = rows.map((row) => {
      const price = Number(row.price)
      const originalPrice = Number(row.original_price) || price
      const discount = originalPrice > price && originalPrice > 0
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0
      return {
        id: String(row.id),
        name: row.name,
        slug: row.slug,
        price,
        originalPrice,
        discount,
        imageUrl: row.image_url || null,
        shopName: row.shop_name,
        isMall: Boolean(row.is_mall),
        province: row.province,
        freeShipping: Boolean(row.free_shipping),
        isFavorite: true,
        favoritedAt: row.favorited_at ? new Date(row.favorited_at).toISOString() : null,
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách sản phẩm yêu thích thành công.',
      data: favorites,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /internal/v1/users/:userId/favorites/:productId
 * Thêm sản phẩm vào danh sách yêu thích.
 */
export async function addFavorite(req, res, next) {
  try {
    const { userId, productId } = req.params

    if (!userId || !/^\d+$/.test(String(userId)) || !productId || !/^\d+$/.test(String(productId))) {
      return res.status(400).json({
        success: false,
        message: 'Tham số không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    const numericUserId = BigInt(userId)
    const numericProductId = BigInt(productId)

    // Kiểm tra sản phẩm tồn tại
    const prodRows = await executeQuery("SELECT id FROM products WHERE id = ? AND status = 'active' LIMIT 1", [numericProductId])
    if (!prodRows || prodRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sản phẩm không tồn tại.',
        error: { code: 'PRODUCT_NOT_FOUND' },
      })
    }

    // INSERT IGNORE vào product_favorites
    await executeQuery(
      'INSERT IGNORE INTO product_favorites (user_id, product_id) VALUES (?, ?)',
      [numericUserId, numericProductId],
    )

    return res.status(200).json({
      success: true,
      message: 'Đã thêm sản phẩm vào danh sách yêu thích.',
      data: { favorited: true, productId: String(numericProductId) },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /internal/v1/users/:userId/favorites/:productId
 * Xóa sản phẩm khỏi danh sách yêu thích.
 */
export async function removeFavorite(req, res, next) {
  try {
    const { userId, productId } = req.params

    if (!userId || !/^\d+$/.test(String(userId)) || !productId || !/^\d+$/.test(String(productId))) {
      return res.status(400).json({
        success: false,
        message: 'Tham số không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    const numericUserId = BigInt(userId)
    const numericProductId = BigInt(productId)

    await executeQuery(
      'DELETE FROM product_favorites WHERE user_id = ? AND product_id = ?',
      [numericUserId, numericProductId],
    )

    return res.status(200).json({
      success: true,
      message: 'Đã bỏ sản phẩm khỏi danh sách yêu thích.',
      data: { favorited: false, productId: String(numericProductId) },
    })
  } catch (err) {
    next(err)
  }
}
