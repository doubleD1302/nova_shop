import { executeQuery } from '../config/database.js'

/**
 * Chuẩn hóa đối tượng danh mục thành định dạng an toàn cho API.
 */
function formatCategory(row) {
  return {
    id: String(row.id),
    parentId: row.parent_id !== null && row.parent_id !== undefined ? String(row.parent_id) : null,
    slug: row.slug,
    name: row.name,
    imageUrl: row.image_url || null,
    sortOrder: Number(row.sort_order) || 0,
  }
}

/**
 * Chuyển đổi specs từ JSON Object sang mảng [{ label, value }] theo hợp đồng API.
 */
function formatSpecs(rawSpecs) {
  if (!rawSpecs) return []
  let specsObj = rawSpecs
  if (typeof rawSpecs === 'string') {
    try {
      specsObj = JSON.parse(rawSpecs)
    } catch {
      return []
    }
  }
  if (typeof specsObj !== 'object' || specsObj === null || Array.isArray(specsObj)) {
    return []
  }
  return Object.entries(specsObj).map(([label, value]) => ({
    label,
    value: String(value),
  }))
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
 * GET /internal/v1/categories
 * Đọc danh sách tất cả các ngành hàng / danh mục đang hoạt động.
 */
export async function getCategories(req, res, next) {
  try {
    const sql = `
      SELECT id, parent_id, slug, name, image_url, sort_order
      FROM categories
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `
    const rows = await executeQuery(sql)
    const categories = rows.map(formatCategory)

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách danh mục thành công.',
      data: categories,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /internal/v1/products
 * Danh sách sản phẩm công khai kèm phân trang và bộ lọc.
 */
export async function getProducts(req, res, next) {
  try {
    let { page = '1', limit = '24', q, categoryId, shopId, sort = 'newest' } = req.query

    // 1. Kiểm tra tham số phân trang
    const parsedPage = Number(page)
    const parsedLimit = Number(limit)

    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        success: false,
        message: 'Tham số page không hợp lệ, phải là số nguyên dương.',
        error: { code: 'INVALID_QUERY' },
      })
    }

    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Tham số limit không hợp lệ, phải là số nguyên từ 1 đến 100.',
        error: { code: 'INVALID_QUERY' },
      })
    }

    // 2. Xây dựng điều kiện WHERE động có tham số hóa
    const conditions = ["p.status = 'active'", "s.status = 'active'"]
    const params = []

    if (q && typeof q === 'string' && q.trim().length > 0) {
      const keyword = `%${q.trim()}%`
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)')
      params.push(keyword, keyword)
    }

    if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
      const catId = Number(categoryId)
      if (!Number.isInteger(catId) || catId < 1) {
        return res.status(400).json({
          success: false,
          message: 'Mã danh mục categoryId không hợp lệ.',
          error: { code: 'INVALID_QUERY' },
        })
      }
      conditions.push('p.category_id = ?')
      params.push(catId)
    }

    if (shopId !== undefined && shopId !== null && shopId !== '') {
      const sId = Number(shopId)
      if (!Number.isInteger(sId) || sId < 1) {
        return res.status(400).json({
          success: false,
          message: 'Mã gian hàng shopId không hợp lệ.',
          error: { code: 'INVALID_QUERY' },
        })
      }
      conditions.push('p.shop_id = ?')
      params.push(sId)
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // 3. Đếm tổng số bản ghi thỏa mãn điều kiện
    const countSql = `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM products p
      INNER JOIN shops s ON s.id = p.shop_id
      ${whereClause}
    `
    const countRows = await executeQuery(countSql, params)
    const total = Number(countRows[0]?.total || 0)
    const totalPages = Math.ceil(total / parsedLimit) || (total === 0 ? 0 : 1)
    const offset = (parsedPage - 1) * parsedLimit

    // 4. Xử lý sắp xếp ổn định (Stable Sort)
    let orderClause = 'ORDER BY p.created_at DESC, p.id DESC'
    if (sort === 'price_asc') {
      orderClause = 'ORDER BY min_price ASC, p.id DESC'
    } else if (sort === 'price_desc') {
      orderClause = 'ORDER BY min_price DESC, p.id DESC'
    } else if (sort === 'featured' || sort === 'popular') {
      orderClause = 'ORDER BY p.is_featured DESC, p.created_at DESC, p.id DESC'
    }

    // 5. Truy vấn danh sách sản phẩm kèm tổng hợp giá từ SKU và ảnh đại diện
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
      message: 'Lấy danh sách sản phẩm thành công.',
      data: products,
      meta: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /internal/v1/products/:idOrSlug
 * Đọc chi tiết sản phẩm kèm danh sách biến thể SKU và gallery ảnh.
 */
export async function getProductDetail(req, res, next) {
  try {
    const { idOrSlug } = req.params

    if (!idOrSlug || typeof idOrSlug !== 'string' || idOrSlug.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Mã định danh sản phẩm không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    const identifier = idOrSlug.trim()
    const isNumericId = /^[0-9]+$/.test(identifier)

    // 1. Truy vấn thông tin sản phẩm và gian hàng
    const productSql = `
      SELECT
        p.id,
        p.shop_id,
        p.category_id,
        p.slug,
        p.name,
        p.description,
        p.specs,
        p.badges,
        p.is_featured,
        p.is_flash_sale,
        p.free_shipping,
        p.created_at,
        p.updated_at,
        s.name AS shop_name,
        s.slug AS shop_slug,
        s.logo_url AS shop_logo,
        s.banner_url AS shop_banner,
        s.tagline AS shop_tagline,
        s.province AS shop_province,
        s.is_mall AS shop_is_mall,
        c.name AS category_name,
        c.slug AS category_slug
      FROM products p
      INNER JOIN shops s ON s.id = p.shop_id
      INNER JOIN categories c ON c.id = p.category_id
      WHERE ${isNumericId ? 'p.id = ?' : 'p.slug = ?'}
        AND p.status = 'active'
        AND s.status = 'active'
      LIMIT 1
    `

    const productRows = await executeQuery(productSql, [isNumericId ? Number(identifier) : identifier])
    if (productRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm.',
        error: { code: 'PRODUCT_NOT_FOUND' },
      })
    }

    const p = productRows[0]
    const productId = p.id

    // 2. Truy vấn danh sách biến thể SKU của sản phẩm
    const variantsSql = `
      SELECT id, sku, variant_key, name, attributes, price, original_price, stock_qty, is_active
      FROM product_variants
      WHERE product_id = ? AND is_active = 1
      ORDER BY id ASC
    `
    const variantRows = await executeQuery(variantsSql, [productId])

    const variants = variantRows.map((v) => {
      let attrs = v.attributes
      if (typeof attrs === 'string') {
        try {
          attrs = JSON.parse(attrs)
        } catch {
          attrs = {}
        }
      }
      return {
        id: String(v.id),
        sku: v.sku,
        variantKey: v.variant_key,
        name: v.name,
        attributes: attrs && typeof attrs === 'object' ? attrs : {},
        price: Number(v.price) || 0,
        originalPrice: v.original_price !== null && v.original_price !== undefined ? Number(v.original_price) : null,
        stockQty: Number(v.stock_qty) || 0,
        isActive: Boolean(v.is_active),
      }
    })

    // Tính giá và tồn kho đại diện
    let minPrice = 0
    let minOriginalPrice = null
    let totalStock = 0

    if (variants.length > 0) {
      minPrice = Math.min(...variants.map((v) => v.price))
      const withOrig = variants.filter((v) => v.originalPrice !== null)
      if (withOrig.length > 0) {
        minOriginalPrice = Math.min(...withOrig.map((v) => v.originalPrice))
      }
      totalStock = variants.reduce((sum, v) => sum + v.stockQty, 0)
    }

    const discount =
      minOriginalPrice && minOriginalPrice > minPrice
        ? Math.round(((minOriginalPrice - minPrice) / minOriginalPrice) * 100)
        : 0

    // 3. Truy vấn gallery ảnh của sản phẩm
    const imagesSql = `
      SELECT url, sort_order
      FROM product_images
      WHERE product_id = ?
      ORDER BY sort_order ASC, id ASC
    `
    const imageRows = await executeQuery(imagesSql, [productId])
    const images = imageRows.map((img) => img.url)
    const imageUrl = images.length > 0 ? images[0] : null

    // 4. Định dạng đối tượng sản phẩm hoàn chỉnh
    const result = {
      id: String(p.id),
      name: p.name,
      slug: p.slug,
      description: p.description || null,
      price: minPrice,
      originalPrice: minOriginalPrice || minPrice,
      discount,
      imageUrl,
      images,
      province: p.shop_province,
      isMall: Boolean(p.shop_is_mall),
      freeShipping: Boolean(p.free_shipping),
      badges: formatBadges(p.badges),
      stock: totalStock,
      specs: formatSpecs(p.specs),
      variants,
      shop: {
        id: String(p.shop_id),
        name: p.shop_name,
        slug: p.shop_slug,
        logoUrl: p.shop_logo || null,
        bannerUrl: p.shop_banner || null,
        tagline: p.shop_tagline || null,
        isMall: Boolean(p.shop_is_mall),
        province: p.shop_province,
      },
      category: {
        id: String(p.category_id),
        name: p.category_name,
        slug: p.category_slug,
      },
      createdAt: p.created_at ? new Date(p.created_at).toISOString() : null,
      updatedAt: p.updated_at ? new Date(p.updated_at).toISOString() : null,
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết sản phẩm thành công.',
      data: result,
    })
  } catch (err) {
    next(err)
  }
}
