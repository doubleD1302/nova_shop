import crypto from 'node:crypto'
import { executeQuery, executeTransaction } from '../config/database.js'
import {
  resolveSellerProductStatus,
  validUploadedImage,
  validateSellerProductInput,
} from '../utils/seller-product.validation.js'

const parseJson = (value, fallback) => {
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) return value
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const asDateString = (value) => value instanceof Date ? value.toISOString() : String(value || '')

async function hasColumn(tableName, columnName) {
  const rows = await executeQuery(
    'SELECT 1 FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [tableName, columnName],
  )
  return rows.length > 0
}

export async function listProducts(req, res, next) {
  try {
    const requestedLimit = Number(req.query.limit)
    const requestedOffset = Number(req.query.offset)
    const limit = Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 100
    const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0
    const hasApprovalStatusColumn = await hasColumn('products', 'approval_status')
    const where = [
      "p.status = 'active'",
      "s.status = 'active'",
      "shop_owner.status = 'active'",
      'c.is_active = 1',
      ...(hasApprovalStatusColumn ? ["p.approval_status = 'approved'"] : []),
    ]
    const params = []
    const categoryId = String(req.query.categoryId || '').trim()
    const shopId = String(req.query.shopId || '').trim()
    const query = String(req.query.q || '').trim().slice(0, 120)
    const location = String(req.query.location || '').trim().slice(0, 120)
    if (categoryId) { where.push('c.slug = ?'); params.push(categoryId) }
    if (shopId) {
      where.push(/^\d+$/.test(shopId) ? 's.id = ?' : 's.slug = ?')
      params.push(shopId)
    }
    if (query) {
      where.push('(p.name LIKE ? OR s.name LIKE ? OR c.name LIKE ?)')
      const pattern = `%${query}%`
      params.push(pattern, pattern, pattern)
    }
    if (location) { where.push('s.province = ?'); params.push(location) }
    for (const [key, column] of [['flash', 'p.is_flash_sale'], ['mall', 's.is_mall'], ['freeship', 'p.free_shipping']]) {
      if (req.query[key] === '1' || req.query[key] === 'true') where.push(`${column} = 1`)
    }
    const minPrice = Number(req.query.minPrice)
    const maxPrice = Number(req.query.maxPrice)
    if (req.query.minPrice !== undefined && Number.isFinite(minPrice) && minPrice >= 0) {
      where.push('EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1 AND pv.price >= ?)')
      params.push(minPrice)
    }
    if (req.query.maxPrice !== undefined && Number.isFinite(maxPrice) && maxPrice >= 0) {
      where.push('EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1 AND pv.price <= ?)')
      params.push(maxPrice)
    }
    const minRating = Number(req.query.minRating)
    if (req.query.minRating !== undefined && Number.isFinite(minRating) && minRating > 0 && minRating <= 5) {
      where.push(`COALESCE((SELECT AVG(r_filter.rating) FROM reviews r_filter
        JOIN users u_filter ON u_filter.id = r_filter.user_id AND u_filter.status = 'active'
        WHERE r_filter.product_id = p.id AND r_filter.status = 'visible'), 0) >= ?`)
      params.push(minRating)
    }
    const minDiscount = Number(req.query.minDiscount)
    if (req.query.minDiscount !== undefined && Number.isFinite(minDiscount) && minDiscount > 0 && minDiscount < 100) {
      where.push(`EXISTS (SELECT 1 FROM product_variants vd WHERE vd.product_id = p.id AND vd.is_active = 1
        AND vd.original_price > vd.price AND (100 * (vd.original_price - vd.price) / vd.original_price) >= ?)`)
      params.push(minDiscount)
    }
    if (req.query.slug) { where.push('p.slug = ?'); params.push(String(req.query.slug).slice(0, 180)) }
    if (req.query.ids) {
      const ids = String(req.query.ids).split(',').filter((id) => /^[1-9]\d{0,19}$/.test(id)).slice(0, 50)
      if (!ids.length) return res.status(200).json({ success: true, data: { products: [], total: 0, limit, offset } })
      where.push(`p.id IN (${ids.map(() => '?').join(',')})`)
      params.push(...ids)
    }
    if (req.query.fullImages === '1' || req.query.slug) {
      // Không ép buộc 4 ảnh; nhiều sản phẩm demo/dev đang thiếu ảnh, điều này làm catalog rỗng trên màn hình chính.
    }
    const sortSql = ({
      popular: `(SELECT COALESCE(SUM(oi_sort.qty), 0) FROM order_items oi_sort
        JOIN shop_orders so_sort ON so_sort.id = oi_sort.shop_order_id
        WHERE oi_sort.product_id = p.id AND so_sort.status = 'delivered') DESC, p.id DESC`,
      newest: 'p.created_at DESC, p.id DESC',
      'price-asc': '(SELECT MIN(sort_v.price) FROM product_variants sort_v WHERE sort_v.product_id = p.id AND sort_v.is_active = 1) ASC, p.id DESC',
      'price-desc': '(SELECT MAX(sort_v.price) FROM product_variants sort_v WHERE sort_v.product_id = p.id AND sort_v.is_active = 1) DESC, p.id DESC',
      rating: `(SELECT COALESCE(AVG(r_sort.rating), 0) FROM reviews r_sort
        JOIN users u_sort ON u_sort.id = r_sort.user_id AND u_sort.status = 'active'
        WHERE r_sort.product_id = p.id AND r_sort.status = 'visible') DESC, p.id DESC`,
      discount: '(SELECT MAX(100 * (vd.original_price - vd.price) / vd.original_price) FROM product_variants vd WHERE vd.product_id = p.id AND vd.is_active = 1 AND vd.original_price > vd.price) DESC, p.id DESC',
    })[String(req.query.sort || 'newest')] || 'p.created_at DESC, p.id DESC'
    const whereSql = where.join('\n        AND ')
    const totalRows = await executeQuery(`
      SELECT COUNT(*) AS total
      FROM products p
      JOIN shops s ON s.id = p.shop_id
      JOIN users shop_owner ON shop_owner.id = s.owner_id
      JOIN categories c ON c.id = p.category_id
      WHERE ${whereSql}
    `, params)
    const pageRows = await executeQuery(`
      SELECT p.id
      FROM products p
      JOIN shops s ON s.id = p.shop_id
      JOIN users shop_owner ON shop_owner.id = s.owner_id
      JOIN categories c ON c.id = p.category_id
      WHERE ${whereSql}
      ORDER BY ${sortSql}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])

    if (!pageRows.length) {
      return res.status(200).json({ success: true, data: { products: [], total: Number(totalRows[0]?.total || 0), limit, offset } })
    }
    const ids = pageRows.map((row) => String(row.id))
    const placeholders = ids.map(() => '?').join(',')
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
      WHERE p.id IN (${placeholders})
      ORDER BY FIELD(p.id, ${placeholders})
    `, [...ids, ...ids, ...ids, ...ids, ...ids])

    const [variants, images] = await Promise.all([
      executeQuery(
        `SELECT id, product_id, name, attributes, price, original_price, stock_qty
         FROM product_variants WHERE is_active = 1 AND product_id IN (${placeholders})
         ORDER BY product_id, id`,
        ids,
      ),
      executeQuery(
        `SELECT product_id, url, alt_text, sort_order, source_page_url, author, license_name, license_url FROM product_images
         WHERE product_id IN (${placeholders})
         ${req.query.fullImages === '1' || req.query.slug ? '' : 'AND sort_order = (SELECT MIN(first_image.sort_order) FROM product_images first_image WHERE first_image.product_id = product_images.product_id)'}
         ORDER BY product_id, sort_order`,
        ids,
      ),
    ])

    const productData = products.map((product) => {
      const productVariants = variants
        .filter((variant) => String(variant.product_id) === String(product.id))
        .map((variant) => ({
          id: String(variant.id),
          name: variant.name,
          attributes: parseJson(variant.attributes, {}),
          price: Number(variant.price),
          originalPrice: variant.original_price === null ? null : Number(variant.original_price),
          stock: Number(variant.stock_qty),
        }))
      const productImages = images
        .filter((image) => String(image.product_id) === String(product.id))
        .map((image) => ({
          url: image.url,
          altText: image.alt_text || product.name,
          sortOrder: Number(image.sort_order),
          sourcePageUrl: image.source_page_url,
          author: image.author,
          licenseName: image.license_name,
          licenseUrl: image.license_url,
        }))
      const originalPrices = productVariants
        .map((variant) => variant.originalPrice)
        .filter((price) => price !== null)
      const result = {
        id: String(product.id),
        shopId: String(product.shop_id),
        shopName: product.shop_name,
        shopSlug: product.shop_slug,
        location: product.shop_province,
        shopMall: Boolean(product.is_mall),
        shopLogoUrl: product.shop_logo_url,
        shopBannerUrl: product.shop_banner_url,
        shopTagline: product.shop_tagline,
        categoryId: product.category_slug,
        categoryName: product.category_name,
        slug: product.slug,
        name: product.name,
        description: product.description || '',
        specs: parseJson(product.specs, {}),
        badges: parseJson(product.badges, []),
        featured: Boolean(product.is_featured),
        flash: Boolean(product.is_flash_sale),
        freeship: Boolean(product.free_shipping),
        createdAt: asDateString(product.created_at),
        rating: Number(product.rating),
        ratingCount: Number(product.rating_count),
        sold: Number(product.sold_count),
        stock: Number(product.stock),
        price: productVariants.length ? Math.min(...productVariants.map((variant) => variant.price)) : 0,
        originalPrice: originalPrices.length ? Math.min(...originalPrices) : null,
        variants: productVariants,
        images: productImages,
      }
      return result
    })

    return res.status(200).json({ success: true, data: { products: productData, total: Number(totalRows[0]?.total || 0), limit, offset } })
  } catch (err) {
    return next(err)
  }
}

export async function listProductReviews(req, res, next) {
  try {
    const { productId } = req.params
    if (!/^[1-9]\d{0,19}$/.test(productId)) {
      return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.', error: { code: 'INVALID_PRODUCT_ID' } })
    }
    const rows = await executeQuery(
      `SELECT r.id, r.product_id, r.rating, r.comment, r.created_at, r.seller_reply,
              u.id AS user_id, u.full_name, oi.variant_name, oi.variant_attributes
       FROM reviews r
       JOIN users u ON u.id = r.user_id AND u.status = 'active'
       JOIN order_items oi ON oi.id = r.order_item_id
       JOIN products p ON p.id = r.product_id AND p.status = 'active' AND p.approval_status = 'approved'
       JOIN shops s ON s.id = p.shop_id AND s.status = 'active'
       JOIN users shop_owner ON shop_owner.id = s.owner_id AND shop_owner.status = 'active'
       WHERE r.product_id = ? AND r.status = 'visible'
       ORDER BY r.created_at DESC, r.id DESC`,
      [productId],
    )
    const reviews = rows.map((row) => ({
      id: String(row.id),
      productId: String(row.product_id),
      userId: String(row.user_id),
      user: row.full_name,
      rating: Number(row.rating),
      comment: row.comment,
      variant: row.variant_name,
      variantAttributes: parseJson(row.variant_attributes, {}),
      sellerReply: row.seller_reply || null,
      createdAt: asDateString(row.created_at),
    }))
    const ratingCount = reviews.length
    const rating = ratingCount
      ? Number((reviews.reduce((total, review) => total + review.rating, 0) / ratingCount).toFixed(2))
      : 0
    return res.status(200).json({ success: true, data: { reviews, rating, ratingCount } })
  } catch (err) {
    return next(err)
  }
}

export async function listEligibleReviewItems(req, res, next) {
  try {
    const { productId } = req.params
    if (!/^[1-9]\d{0,19}$/.test(productId)) {
      return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.', error: { code: 'INVALID_PRODUCT_ID' } })
    }
    const rows = await executeQuery(
      `SELECT oi.id AS order_item_id, oi.product_id, oi.variant_name, oi.created_at
       FROM order_items oi
       JOIN shop_orders so ON so.id = oi.shop_order_id
       JOIN orders o ON o.id = so.order_id
       LEFT JOIN reviews r ON r.order_item_id = oi.id
       WHERE o.buyer_id = ? AND oi.product_id = ? AND so.status = 'delivered' AND r.id IS NULL
       ORDER BY oi.created_at DESC`,
      [req.query.userId, productId],
    )
    return res.status(200).json({
      success: true,
      data: {
        items: rows.map((row) => ({
          orderItemId: String(row.order_item_id),
          productId: String(row.product_id),
          variant: row.variant_name,
          purchasedAt: asDateString(row.created_at),
        })),
      },
    })
  } catch (err) {
    return next(err)
  }
}

export async function createProductReview(req, res, next) {
  try {
    const { productId } = req.params
    const { userId, orderItemId, rating, comment } = req.body || {}
    const message = typeof comment === 'string' ? comment.trim() : ''
    if (
      !/^[1-9]\d{0,19}$/.test(productId) ||
      !/^[1-9]\d{0,19}$/.test(String(orderItemId || '')) ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      !message ||
      message.length > 5000
    ) {
      return res.status(400).json({ success: false, message: 'Nội dung đánh giá không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    const review = await executeTransaction(async (query) => {
      const purchasedItems = await query(
        `SELECT oi.id, oi.product_id, so.status, o.buyer_id
         FROM order_items oi
         JOIN shop_orders so ON so.id = oi.shop_order_id
         JOIN orders o ON o.id = so.order_id
         WHERE oi.id = ? AND oi.product_id = ? AND o.buyer_id = ?
         FOR UPDATE`,
        [orderItemId, productId, userId],
      )
      if (!purchasedItems.length || purchasedItems[0].status !== 'delivered') {
        return { error: 'REVIEW_NOT_ELIGIBLE' }
      }
      const result = await query(
        `INSERT INTO reviews (order_item_id, user_id, product_id, rating, comment, status)
         VALUES (?, ?, ?, ?, ?, 'visible')`,
        [orderItemId, userId, productId, rating, message],
      )
      const rows = await query(
        `SELECT r.id, r.product_id, r.rating, r.comment, r.created_at, u.id AS user_id, u.full_name, oi.variant_name
         FROM reviews r
         JOIN users u ON u.id = r.user_id
         JOIN order_items oi ON oi.id = r.order_item_id
         WHERE r.id = ?`,
        [result.insertId],
      )
      return rows[0]
    })
    if (review.error) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người mua đã nhận sản phẩm mới được đánh giá.',
        error: { code: review.error },
      })
    }
    return res.status(201).json({
      success: true,
      data: {
        review: {
          id: String(review.id),
          productId: String(review.product_id),
          userId: String(review.user_id),
          user: review.full_name,
          rating: Number(review.rating),
          comment: review.comment,
          variant: review.variant_name,
          createdAt: asDateString(review.created_at),
        },
      },
    })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Bạn đã đánh giá đơn hàng này rồi.',
        error: { code: 'REVIEW_ALREADY_EXISTS' },
      })
    }
    return next(err)
  }
}

const validId = (value) => /^[1-9]\d{0,19}$/.test(String(value || ''))

function productSlug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 150) || 'san-pham'
}

function mapSellerProduct(row, variants, images) {
  const productVariants = variants.filter((variant) => String(variant.product_id) === String(row.id)).map((variant) => ({
    id: String(variant.id),
    name: variant.name,
    attributes: parseJson(variant.attributes, {}),
    price: Number(variant.price),
    originalPrice: variant.original_price === null ? null : Number(variant.original_price),
    stock: Number(variant.stock_qty),
  }))
  const productImages = images.filter((image) => String(image.product_id) === String(row.id)).map((image) => ({
    url: image.url,
    altText: image.alt_text || row.name,
    sortOrder: Number(image.sort_order),
    sourcePageUrl: image.source_page_url,
    author: image.author,
    licenseName: image.license_name,
    licenseUrl: image.license_url,
  }))
  const originalPrices = productVariants.map((variant) => variant.originalPrice).filter((price) => price !== null)
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    shopName: row.shop_name,
    shopSlug: row.shop_slug,
    location: row.shop_province,
    shopLogoUrl: row.shop_logo_url,
    shopBannerUrl: row.shop_banner_url,
    shopTagline: row.shop_tagline,
    categoryId: row.category_slug,
    categoryName: row.category_name,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    specs: parseJson(row.specs, {}),
    badges: parseJson(row.badges, []),
    featured: Boolean(row.is_featured),
    flash: Boolean(row.is_flash_sale),
    freeship: Boolean(row.free_shipping),
    status: row.status,
    approvalStatus: row.approval_status || 'pending',
    rejectionReason: row.rejection_reason || null,
    reviewedAt: row.reviewed_at ? asDateString(row.reviewed_at) : null,
    createdAt: asDateString(row.created_at),
    rating: Number(row.rating),
    ratingCount: Number(row.rating_count),
    sold: Number(row.sold_count),
    stock: productVariants.reduce((sum, variant) => sum + variant.stock, 0),
    price: productVariants.length ? Math.min(...productVariants.map((variant) => variant.price)) : 0,
    originalPrice: originalPrices.length ? Math.min(...originalPrices) : null,
    variants: productVariants,
    images: productImages,
  }
}

export async function listSellerProducts(req, res, next) {
  try {
    const userId = String(req.query.userId || '')
    if (!validId(userId)) {
      return res.status(400).json({ success: false, message: 'Tài khoản không hợp lệ.', error: { code: 'INVALID_USER_ID' } })
    }
    const requestedLimit = Number(req.query.limit)
    const requestedOffset = Number(req.query.offset)
    const limit = Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 100 ? requestedLimit : 50
    const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0
    const productId = req.query.productId ? String(req.query.productId) : ''
    if (productId && !validId(productId)) {
      return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.', error: { code: 'INVALID_PRODUCT_ID' } })
    }
    const productFilter = productId ? 'AND p.id = ?' : ''
    const filterParams = productId ? [userId, productId] : [userId]
    const countRows = await executeQuery(
      `SELECT COUNT(*) AS total FROM products p JOIN shops s ON s.id = p.shop_id AND s.owner_id = ?
       WHERE p.status <> 'archived' ${productFilter}`,
      filterParams,
    )
    const rows = await executeQuery(`
      SELECT p.id, p.shop_id, p.category_id, p.slug, p.name, p.description, p.specs, p.badges,
             p.status, p.approval_status, p.rejection_reason, p.reviewed_at, p.is_featured, p.is_flash_sale, p.free_shipping, p.created_at,
             s.name AS shop_name, s.slug AS shop_slug, s.province AS shop_province,
             s.logo_url AS shop_logo_url, s.banner_url AS shop_banner_url, s.tagline AS shop_tagline,
             c.name AS category_name, c.slug AS category_slug,
             COALESCE(rv.rating, 0) AS rating, COALESCE(rv.rating_count, 0) AS rating_count,
             COALESCE(sd.sold_count, 0) AS sold_count
      FROM products p
      JOIN shops s ON s.id = p.shop_id AND s.owner_id = ?
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN (
        SELECT product_id, AVG(rating) AS rating, COUNT(*) AS rating_count
        FROM reviews r JOIN users reviewer ON reviewer.id = r.user_id AND reviewer.status = 'active'
        WHERE r.status = 'visible' GROUP BY product_id
      ) rv ON rv.product_id = p.id
      LEFT JOIN (
        SELECT oi.product_id, SUM(oi.qty) AS sold_count
        FROM order_items oi JOIN shop_orders so ON so.id = oi.shop_order_id
        WHERE so.status = 'delivered' GROUP BY oi.product_id
      ) sd ON sd.product_id = p.id
      WHERE p.status <> 'archived' ${productFilter}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?
    `, [...filterParams, limit, offset])
    if (!rows.length) return res.status(200).json({ success: true, data: { products: [], total: Number(countRows[0]?.total || 0), limit, offset } })
    const ids = rows.map((row) => String(row.id))
    const placeholders = ids.map(() => '?').join(',')
    const [variants, images] = await Promise.all([
      executeQuery(
        `SELECT id, product_id, name, attributes, price, original_price, stock_qty
         FROM product_variants WHERE product_id IN (${placeholders}) AND is_active = 1 ORDER BY product_id, id`, ids,
      ),
      executeQuery(
        `SELECT product_id, url, alt_text, sort_order, source_page_url, author, license_name, license_url FROM product_images
         WHERE product_id IN (${placeholders}) ORDER BY product_id, sort_order`, ids,
      ),
    ])
    return res.status(200).json({
      success: true,
      data: { products: rows.map((row) => mapSellerProduct(row, variants, images)), total: Number(countRows[0]?.total || 0), limit, offset },
    })
  } catch (err) {
    return next(err)
  }
}

export async function saveSellerProduct(req, res, next) {
  try {
    const body = req.body || {}
    const userId = String(body.userId || '')
    const productId = req.params.productId ? String(req.params.productId) : null
    // Kiểm tra trạng thái gian hàng: Shop bị tạm khóa không được phép đăng hoặc sửa sản phẩm
    const ownedShops = await executeQuery(`SELECT id, status, suspension_reason FROM shops WHERE owner_id = ? LIMIT 1`, [userId])
    if (ownedShops.length && ownedShops[0].status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: `Gian hàng của bạn hiện đang bị tạm khóa: ${ownedShops[0].suspension_reason || 'Vi phạm chính sách sàn'}. Không thể đăng hoặc sửa sản phẩm.`,
        error: { code: 'SHOP_SUSPENDED' },
      })
    }

    const validation = validateSellerProductInput({ body, userId, productId })
    if (!validation.ok) {
      return res.status(400).json({ success: false, message: 'Cần nhập đủ thông tin và đúng 4 ảnh khác nhau đã kiểm tra, thuộc ảnh tải lên hoặc có giấy phép Commons phù hợp.', error: { code: 'VALIDATION_ERROR' } })
    }
    const { name, categorySlug, description, price, originalPrice, stock, images, status } = validation.value

    const result = await executeTransaction(async (query) => {
      const shops = await query(`SELECT id, status, suspension_reason FROM shops WHERE owner_id = ? FOR UPDATE`, [userId])
      if (!shops.length) return { error: 'SHOP_NOT_FOUND' }
      if (shops[0].status === 'suspended') {
        return {
          error: 'SHOP_SUSPENDED',
          message: `Gian hàng của bạn hiện đang bị tạm khóa: ${shops[0].suspension_reason || 'Vi phạm chính sách'}. Không thể đăng hoặc sửa sản phẩm.`,
        }
      }
      if (shops[0].status !== 'active') return { error: 'SHOP_INACTIVE', message: 'Gian hàng hiện không hoạt động.' }
      const categories = await query(`SELECT id FROM categories WHERE slug = ? AND is_active = 1 LIMIT 1`, [categorySlug])
      if (!categories.length) return { error: 'CATEGORY_NOT_FOUND' }
      let id = productId
      if (productId) {
        const owned = await query(`SELECT id, status, approval_status, rejection_reason, reviewed_by, reviewed_at FROM products WHERE id = ? AND shop_id = ? AND status <> 'archived' FOR UPDATE`, [productId, shops[0].id])
        if (!owned.length) return { error: 'PRODUCT_NOT_FOUND' }
        let nextApprovalStatus = owned[0].approval_status
        let nextRejectionReason = owned[0].rejection_reason
        let nextReviewedBy = owned[0].reviewed_by || null
        let nextReviewedAt = owned[0].reviewed_at || null
        if (owned[0].approval_status === 'rejected') {
          nextApprovalStatus = 'pending'
          nextRejectionReason = null
          nextReviewedBy = null
          nextReviewedAt = null
        }
        let nextStatus = resolveSellerProductStatus(owned[0].status, status)
        if (nextApprovalStatus !== 'approved' && nextStatus === 'active') {
          nextStatus = 'draft'
        }
        await query(
          `UPDATE products SET category_id = ?, name = ?, description = ?, free_shipping = ?, status = ?, approval_status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND shop_id = ?`,
          [categories[0].id, name, description || null, body.freeShipping ? 1 : 0, nextStatus, nextApprovalStatus, nextRejectionReason, nextReviewedBy, nextReviewedAt, productId, shops[0].id],
        )
        const ownedVariants = await query(
          `SELECT id, stock_qty FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY id LIMIT 1 FOR UPDATE`,
          [productId],
        )
        if (ownedVariants.length) {
          const stockDelta = stock - Number(ownedVariants[0].stock_qty)
          await query(
            `UPDATE product_variants SET price = ?, original_price = ?, stock_qty = ? WHERE id = ? AND product_id = ?`,
            [price, originalPrice, stock, ownedVariants[0].id, productId],
          )
          if (stockDelta !== 0) {
            await query(
              `INSERT INTO stock_moves (variant_id, order_item_id, reason, delta_qty, actor_id, note)
               VALUES (?, NULL, 'adjust', ?, ?, 'Seller inventory adjustment')`,
              [ownedVariants[0].id, stockDelta, userId],
            )
          }
        } else {
          await query(
            `INSERT INTO product_variants (product_id, sku, variant_key, name, attributes, price, original_price, stock_qty)
             VALUES (?, ?, 'default', 'Mặc định', '{}', ?, ?, ?)`,
            [productId, `SN-${crypto.randomBytes(12).toString('hex').toUpperCase()}`, price, originalPrice, stock],
          )
        }
      } else {
        const slug = `${productSlug(name)}-${crypto.randomBytes(5).toString('hex')}`
        const initialStatus = status === 'hidden' ? 'hidden' : 'draft'
        const inserted = await query(
          `INSERT INTO products (shop_id, category_id, slug, name, description, badges, status, approval_status, free_shipping)
           VALUES (?, ?, ?, ?, ?, JSON_ARRAY(), ?, 'pending', ?)`,
          [shops[0].id, categories[0].id, slug, name, description || null, initialStatus, body.freeShipping ? 1 : 0],
        )
        id = String(inserted.insertId)
        await query(
          `INSERT INTO product_variants (product_id, sku, variant_key, name, attributes, price, original_price, stock_qty)
           VALUES (?, ?, 'default', 'Mặc định', '{}', ?, ?, ?)`,
          [id, `SN-${crypto.randomBytes(12).toString('hex').toUpperCase()}`, price, originalPrice, stock],
        )
      }

      await query(`DELETE FROM product_images WHERE product_id = ?`, [id])
      for (let index = 0; index < images.length; index += 1) {
        const image = images[index]
        const isUpload = validUploadedImage(image.url)
        await query(
          `INSERT INTO product_images (product_id, url, alt_text, sort_order, source_page_url, author, license_name, license_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            image.url,
            typeof image.altText === 'string' ? image.altText.trim().slice(0, 200) || name : name,
            index,
            isUpload ? null : image.sourcePageUrl,
            isUpload ? 'Ảnh do người bán tải lên' : image.author.trim(),
            isUpload ? 'Ảnh do người bán cung cấp' : image.licenseName.trim(),
            isUpload ? null : image.licenseUrl,
          ],
        )
      }
      return { id: String(id) }
    })
    if (result.error) {
      if (result.error === 'SHOP_SUSPENDED') {
        return res.status(403).json({
          success: false,
          message: result.message || 'Gian hàng hiện đang bị tạm khóa.',
          error: { code: 'SHOP_SUSPENDED' },
        })
      }
      const notFound = result.error !== 'CATEGORY_NOT_FOUND' && result.error !== 'SHOP_INACTIVE'
      return res.status(notFound ? 404 : 400).json({
        success: false,
        message: result.error === 'SHOP_NOT_FOUND' ? 'Tài khoản chưa có gian hàng đang hoạt động.' :
          result.error === 'CATEGORY_NOT_FOUND' ? 'Danh mục đã chọn không còn hoạt động.' : 'Không tìm thấy sản phẩm thuộc gian hàng này.',
        error: { code: result.error },
      })
    }
    return res.status(productId ? 200 : 201).json({ success: true, data: { productId: result.id } })
  } catch (err) {
    return next(err)
  }
}

export async function archiveSellerProduct(req, res, next) {
  try {
    const productId = String(req.params.productId || '')
    const userId = String(req.body?.userId || '')
    if (!validId(productId) || !validId(userId)) {
      return res.status(400).json({ success: false, message: 'Mã sản phẩm hoặc tài khoản không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const result = await executeQuery(
      `UPDATE products p JOIN shops s ON s.id = p.shop_id
       SET p.status = 'archived' WHERE p.id = ? AND s.owner_id = ? AND p.status <> 'archived'`,
      [productId, userId],
    )
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm thuộc gian hàng này.', error: { code: 'PRODUCT_NOT_FOUND' } })
    }
    return res.status(200).json({ success: true, data: { productId, archived: true } })
  } catch (err) {
    return next(err)
  }
}
