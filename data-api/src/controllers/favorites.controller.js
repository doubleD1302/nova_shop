import { executeQuery } from '../config/database.js'

const parseJson = (value, fallback) => {
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) return value
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const asDateString = (value) => (value instanceof Date ? value.toISOString() : String(value || ''))

/**
 * Lấy danh sách sản phẩm yêu thích của người dùng
 * GET /internal/v1/users/:userId/favorites
 */
export async function listFavorites(req, res, next) {
  try {
    const userId = req.params.userId || req.query.userId
    if (!/^[1-9]\d{0,19}$/.test(String(userId || ''))) {
      return res.status(400).json({ success: false, message: 'Mã tài khoản không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    const favRows = await executeQuery(
      `SELECT pf.product_id, pf.created_at AS favorited_at
       FROM product_favorites pf
       WHERE pf.user_id = ?
       ORDER BY pf.created_at DESC`,
      [userId],
    )

    if (!favRows.length) {
      return res.status(200).json({ success: true, data: [] })
    }

    const productIds = favRows.map((r) => String(r.product_id))
    const placeholders = productIds.map(() => '?').join(',')

    const products = await executeQuery(`
      SELECT p.id, p.shop_id, p.category_id, p.slug, p.name, p.description, p.specs, p.badges,
             p.is_featured, p.is_flash_sale, p.free_shipping, p.created_at,
             s.name AS shop_name, s.slug AS shop_slug, s.province AS shop_province, s.is_mall,
             s.logo_url AS shop_logo_url, s.banner_url AS shop_banner_url, s.tagline AS shop_tagline,
             c.name AS category_name, c.slug AS category_slug,
             COALESCE(rv.rating, 0) AS rating, COALESCE(rv.rating_count, 0) AS rating_count,
             COALESCE(sd.sold_count, 0) AS sold_count,
             COALESCE(st.stock, 0) AS stock
      FROM products p
      JOIN shops s ON s.id = p.shop_id AND s.status = 'active'
      JOIN users shop_owner ON shop_owner.id = s.owner_id AND shop_owner.status = 'active'
      JOIN categories c ON c.id = p.category_id AND c.is_active = 1
      LEFT JOIN (
        SELECT product_id, AVG(rating) AS rating, COUNT(*) AS rating_count
        FROM reviews r JOIN users reviewer ON reviewer.id = r.user_id AND reviewer.status = 'active'
        WHERE r.status = 'visible' AND r.product_id IN (${placeholders}) GROUP BY product_id
      ) rv ON rv.product_id = p.id
      LEFT JOIN (
        SELECT oi.product_id, SUM(oi.qty) AS sold_count
        FROM order_items oi JOIN shop_orders so ON so.id = oi.shop_order_id
        WHERE so.status = 'delivered' AND oi.product_id IN (${placeholders}) GROUP BY oi.product_id
      ) sd ON sd.product_id = p.id
      LEFT JOIN (
        SELECT product_id, SUM(stock_qty) AS stock
        FROM product_variants WHERE is_active = 1 AND product_id IN (${placeholders}) GROUP BY product_id
      ) st ON st.product_id = p.id
      WHERE p.id IN (${placeholders}) AND p.status = 'active'
      ORDER BY FIELD(p.id, ${placeholders})
    `, [...productIds, ...productIds, ...productIds, ...productIds, ...productIds])

    const validIds = products.map((p) => String(p.id))
    if (!validIds.length) {
      return res.status(200).json({ success: true, data: [] })
    }
    const validPlaceholders = validIds.map(() => '?').join(',')

    const [variants, images] = await Promise.all([
      executeQuery(
        `SELECT id, product_id, name, attributes, price, original_price, stock_qty
         FROM product_variants WHERE is_active = 1 AND product_id IN (${validPlaceholders})
         ORDER BY product_id, id`,
        validIds,
      ),
      executeQuery(
        `SELECT product_id, url, sort_order FROM product_images
         WHERE product_id IN (${validPlaceholders})
         ORDER BY product_id, sort_order ASC`,
        validIds,
      ),
    ])

    const items = products.map((product) => {
      const pVariants = variants.filter((v) => String(v.product_id) === String(product.id))
      const pImages = images.filter((img) => String(img.product_id) === String(product.id))
      const minPrice = pVariants.length ? Math.min(...pVariants.map((v) => Number(v.price))) : 0
      const origPrices = pVariants.map((v) => Number(v.original_price)).filter((p) => p && p > 0)
      const minOrigPrice = origPrices.length ? Math.min(...origPrices) : minPrice
      const discount = minOrigPrice > minPrice ? Math.round(((minOrigPrice - minPrice) / minOrigPrice) * 100) : 0
      const imageUrl = pImages.length ? pImages[0].url : ''
      const allImages = pImages.map((img) => img.url)

      return {
        id: String(product.id),
        name: product.name,
        slug: product.slug,
        price: minPrice,
        originalPrice: minOrigPrice,
        discount,
        imageUrl,
        images: allImages,
        rating: Number(Number(product.rating).toFixed(1)),
        ratingCount: Number(product.rating_count),
        soldCount: Number(product.sold_count),
        province: product.shop_province,
        isMall: Boolean(product.is_mall),
        freeShipping: Boolean(product.free_shipping),
        badges: parseJson(product.badges, []),
        stock: Number(product.stock),
        isFavorite: true,
        shop: {
          id: String(product.shop_id),
          name: product.shop_name,
          slug: product.shop_slug,
          isMall: Boolean(product.is_mall),
          province: product.shop_province,
        },
        category: {
          id: product.category_slug,
          name: product.category_name,
          slug: product.category_slug,
        },
        createdAt: asDateString(product.created_at),
      }
    })

    return res.status(200).json({ success: true, data: items })
  } catch (err) {
    return next(err)
  }
}

/**
 * Thêm sản phẩm vào danh sách yêu thích
 * POST /internal/v1/users/:userId/favorites/:productId
 */
export async function addFavorite(req, res, next) {
  try {
    const userId = req.params.userId || req.body?.userId
    const productId = req.params.productId
    if (!/^[1-9]\d{0,19}$/.test(String(userId || '')) || !/^[1-9]\d{0,19}$/.test(String(productId || ''))) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    const productCheck = await executeQuery(
      `SELECT id FROM products WHERE id = ? AND status = 'active' LIMIT 1`,
      [productId],
    )
    if (!productCheck.length) {
      return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại.', error: { code: 'PRODUCT_NOT_FOUND' } })
    }

    await executeQuery(
      `INSERT INTO product_favorites (user_id, product_id, created_at)
       VALUES (?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE product_id = product_id`,
      [userId, productId],
    )

    return res.status(200).json({
      success: true,
      message: 'Đã thêm vào danh sách yêu thích.',
      data: { isFavorite: true, productId: String(productId) },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Xóa sản phẩm khỏi danh sách yêu thích
 * DELETE /internal/v1/users/:userId/favorites/:productId
 */
export async function removeFavorite(req, res, next) {
  try {
    const userId = req.params.userId || req.query?.userId
    const productId = req.params.productId
    if (!/^[1-9]\d{0,19}$/.test(String(userId || '')) || !/^[1-9]\d{0,19}$/.test(String(productId || ''))) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    await executeQuery(
      `DELETE FROM product_favorites WHERE user_id = ? AND product_id = ?`,
      [userId, productId],
    )

    return res.status(200).json({
      success: true,
      message: 'Đã xóa khỏi danh sách yêu thích.',
      data: { isFavorite: false, productId: String(productId) },
    })
  } catch (err) {
    return next(err)
  }
}
