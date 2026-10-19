import { executeQuery } from '../config/database.js'

/**
 * Chuẩn hóa đối tượng shop thành định dạng an toàn cho API.
 */
function formatShop(row) {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url || null,
    bannerUrl: row.banner_url || null,
    tagline: row.tagline || null,
    description: row.description || null,
    province: row.province,
    addressDetail: row.address_detail || null,
    isMall: Boolean(row.is_mall),
    rating: Number(row.rating) || 5.0,
    ratingCount: Number(row.rating_count) || 0,
    followersCount: Number(row.followers_count) || 0,
    productsCount: Number(row.products_count) || 0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  }
}

/**
 * Chuẩn hóa badges thành mảng chuỗi.
 */
function formatBadges(rawBadges) {
  if (!rawBadges) return []
  if (Array.isArray(rawBadges)) return rawBadges.map(String)
  if (typeof rawBadges === 'string') {
    try {
      const parsed = JSON.parse(rawBadges)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

/**
 * GET /internal/v1/shops
 * Lấy danh sách gian hàng trên sàn kèm bộ lọc, sắp xếp và phân trang.
 */
export async function getShops(req, res, next) {
  try {
    let { page = '1', limit = '20', mall, keyword, province, sort = 'popular' } = req.query

    const parsedPage = Number(page)
    const parsedLimit = Number(limit)

    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        success: false,
        message: 'Tham số page không hợp lệ, phải là số nguyên dương.',
        error: { code: 'INVALID_QUERY' },
      })
    }

    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return res.status(400).json({
        success: false,
        message: 'Tham số limit không hợp lệ, phải là số nguyên từ 1 đến 50.',
        error: { code: 'INVALID_QUERY' },
      })
    }

    const conditions = ["s.status = 'active'"]
    const params = []

    if (mall !== undefined) {
      if (mall === 'true' || mall === '1') {
        conditions.push('s.is_mall = 1')
      } else if (mall === 'false' || mall === '0') {
        conditions.push('s.is_mall = 0')
      }
    }

    if (keyword && typeof keyword === 'string' && keyword.trim().length > 0) {
      conditions.push('(s.name LIKE ? OR s.tagline LIKE ?)')
      const pattern = `%${keyword.trim()}%`
      params.push(pattern, pattern)
    }

    if (province && typeof province === 'string' && province.trim().length > 0) {
      conditions.push('s.province = ?')
      params.push(province.trim())
    }

    const whereClause = conditions.join(' AND ')

    // Đếm tổng số shop phù hợp
    const countSql = `
      SELECT COUNT(*) AS total
      FROM shops s
      WHERE ${whereClause}
    `
    const countRows = await executeQuery(countSql, params)
    const total = Number(countRows[0]?.total || 0)

    // Xác định thứ tự sắp xếp
    let orderBy = 'followers_count DESC, s.id DESC'
    if (sort === 'rating') {
      orderBy = 'rating DESC, rating_count DESC, s.id DESC'
    } else if (sort === 'newest') {
      orderBy = 's.created_at DESC, s.id DESC'
    }

    const offset = (parsedPage - 1) * parsedLimit

    const sql = `
      SELECT
        s.id, s.slug, s.name, s.logo_url, s.banner_url, s.tagline, s.description,
        s.province, s.address_detail, s.is_mall, s.created_at,
        COALESCE(sf.followers_count, 0) AS followers_count,
        COALESCE(pr.rating_avg, 5.0) AS rating,
        COALESCE(pr.rating_count, 0) AS rating_count,
        COALESCE(sp.products_count, 0) AS products_count
      FROM shops s
      LEFT JOIN (
        SELECT shop_id, COUNT(*) AS followers_count FROM shop_follows GROUP BY shop_id
      ) sf ON sf.shop_id = s.id
      LEFT JOIN (
        SELECT p.shop_id, ROUND(AVG(r.rating), 1) AS rating_avg, COUNT(r.id) AS rating_count
        FROM products p
        JOIN reviews r ON r.product_id = p.id AND r.status = 'visible'
        GROUP BY p.shop_id
      ) pr ON pr.shop_id = s.id
      LEFT JOIN (
        SELECT shop_id, COUNT(*) AS products_count FROM products WHERE status = 'active' GROUP BY shop_id
      ) sp ON sp.shop_id = s.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `

    const listParams = [...params, parsedLimit, offset]
    const rows = await executeQuery(sql, listParams)
    const shops = rows.map(formatShop)

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách gian hàng thành công.',
      data: shops,
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
 * GET /internal/v1/shops/:idOrSlug
 * Lấy thông tin chi tiết một gian hàng theo ID hoặc Slug.
 */
export async function getShopDetail(req, res, next) {
  try {
    const { idOrSlug } = req.params

    if (!idOrSlug || typeof idOrSlug !== 'string' || idOrSlug.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Định danh shop không hợp lệ.',
        error: { code: 'INVALID_SHOP_ID' },
      })
    }

    const trimmed = idOrSlug.trim()
    const isNumericId = /^\d+$/.test(trimmed)

    let whereClause = 's.slug = ?'
    let param = trimmed
    if (isNumericId) {
      whereClause = 's.id = ?'
      param = BigInt(trimmed)
    }

    const sql = `
      SELECT
        s.id, s.slug, s.name, s.logo_url, s.banner_url, s.tagline, s.description,
        s.province, s.address_detail, s.is_mall, s.created_at,
        COALESCE(sf.followers_count, 0) AS followers_count,
        COALESCE(pr.rating_avg, 5.0) AS rating,
        COALESCE(pr.rating_count, 0) AS rating_count,
        COALESCE(sp.products_count, 0) AS products_count
      FROM shops s
      LEFT JOIN (
        SELECT shop_id, COUNT(*) AS followers_count FROM shop_follows GROUP BY shop_id
      ) sf ON sf.shop_id = s.id
      LEFT JOIN (
        SELECT p.shop_id, ROUND(AVG(r.rating), 1) AS rating_avg, COUNT(r.id) AS rating_count
        FROM products p
        JOIN reviews r ON r.product_id = p.id AND r.status = 'visible'
        GROUP BY p.shop_id
      ) pr ON pr.shop_id = s.id
      LEFT JOIN (
        SELECT shop_id, COUNT(*) AS products_count FROM products WHERE status = 'active' GROUP BY shop_id
      ) sp ON sp.shop_id = s.id
      WHERE ${whereClause} AND s.status = 'active'
      LIMIT 1
    `

    const rows = await executeQuery(sql, [param])
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin gian hàng.',
        error: { code: 'SHOP_NOT_FOUND' },
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin gian hàng thành công.',
      data: formatShop(rows[0]),
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /internal/v1/shops/:idOrSlug/products
 * Lấy danh sách sản phẩm của một gian hàng.
 */
export async function getShopProducts(req, res, next) {
  try {
    const { idOrSlug } = req.params
    let { page = '1', limit = '24', categoryId, sort = 'newest' } = req.query

    if (!idOrSlug || typeof idOrSlug !== 'string' || idOrSlug.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Định danh shop không hợp lệ.',
        error: { code: 'INVALID_SHOP_ID' },
      })
    }

    const trimmed = idOrSlug.trim()
    const isNumericId = /^\d+$/.test(trimmed)

    let shopWhere = 'slug = ?'
    let shopParam = trimmed
    if (isNumericId) {
      shopWhere = 'id = ?'
      shopParam = BigInt(trimmed)
    }

    // 1. Xác thực shop tồn tại
    const shopRows = await executeQuery(
      `SELECT id, slug, name, province, is_mall FROM shops WHERE ${shopWhere} AND status = 'active' LIMIT 1`,
      [shopParam],
    )
    if (!shopRows || shopRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin gian hàng.',
        error: { code: 'SHOP_NOT_FOUND' },
      })
    }
    const currentShop = shopRows[0]
    const realShopId = currentShop.id

    // 2. Validate phân trang
    const parsedPage = Number(page)
    const parsedLimit = Number(limit)
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        success: false,
        message: 'Tham số page không hợp lệ, phải là số nguyên dương.',
        error: { code: 'INVALID_QUERY' },
      })
    }
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return res.status(400).json({
        success: false,
        message: 'Tham số limit không hợp lệ, phải là số nguyên từ 1 đến 50.',
        error: { code: 'INVALID_QUERY' },
      })
    }

    // 3. Xây dựng điều kiện lọc sản phẩm
    const conditions = ["p.status = 'active'", 'p.shop_id = ?']
    const params = [realShopId]

    if (categoryId && typeof categoryId === 'string' && /^\d+$/.test(categoryId.trim())) {
      conditions.push('p.category_id = ?')
      params.push(BigInt(categoryId.trim()))
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Đếm tổng số sản phẩm của shop
    const countSql = `
      SELECT COUNT(*) AS total
      FROM products p
      ${whereClause}
    `
    const countRows = await executeQuery(countSql, params)
    const total = Number(countRows[0]?.total || 0)
    const offset = (parsedPage - 1) * parsedLimit

    // Thứ tự sắp xếp
    let orderClause = 'ORDER BY p.created_at DESC, p.id DESC'
    if (sort === 'price_asc') {
      orderClause = 'ORDER BY min_price ASC, p.id DESC'
    } else if (sort === 'price_desc') {
      orderClause = 'ORDER BY min_price DESC, p.id DESC'
    } else if (sort === 'popular') {
      orderClause = 'ORDER BY p.is_featured DESC, p.created_at DESC, p.id DESC'
    }

    const listSql = `
      SELECT
        p.id,
        p.shop_id,
        p.category_id,
        p.slug,
        p.name,
        p.badges,
        p.is_featured,
        p.is_flash_sale,
        p.free_shipping,
        p.created_at,
        s.name AS shop_name,
        s.slug AS shop_slug,
        s.province AS shop_province,
        s.is_mall AS shop_is_mall,
        c.name AS category_name,
        c.slug AS category_slug,
        COALESCE(MIN(v.price), 0) AS min_price,
        COALESCE(MIN(v.original_price), MIN(v.price), 0) AS min_original_price,
        COALESCE(SUM(v.stock_qty), 0) AS total_stock,
        (
          SELECT pi.url
          FROM product_images pi
          WHERE pi.product_id = p.id
          ORDER BY pi.sort_order ASC, pi.id ASC
          LIMIT 1
        ) AS image_url
      FROM products p
      INNER JOIN shops s ON s.id = p.shop_id
      INNER JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = 1
      ${whereClause}
      GROUP BY p.id, s.id, c.id
      ${orderClause}
      LIMIT ? OFFSET ?
    `

    const listParams = [...params, parsedLimit, offset]
    const rows = await executeQuery(listSql, listParams)

    const products = rows.map((row) => {
      const price = Number(row.min_price) || 0
      const originalPrice = Number(row.min_original_price) || price
      const discount =
        originalPrice > price && originalPrice > 0
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
        province: row.shop_province,
        isMall: Boolean(row.shop_is_mall),
        freeShipping: Boolean(row.free_shipping),
        badges: formatBadges(row.badges),
        stock: Number(row.total_stock) || 0,
        shop: {
          id: String(row.shop_id),
          name: row.shop_name,
          slug: row.shop_slug,
          isMall: Boolean(row.shop_is_mall),
          province: row.shop_province,
        },
        category: {
          id: String(row.category_id),
          name: row.category_name,
          slug: row.category_slug,
        },
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách sản phẩm của gian hàng thành công.',
      data: products,
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
