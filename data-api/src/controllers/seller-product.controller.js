import { executeQuery, executeTransaction } from '../config/database.js'

/**
 * Định dạng sản phẩm trả về cho seller
 */
function formatSellerProduct(prod, images = [], variants = []) {
  return {
    id: String(prod.id),
    shopId: String(prod.shop_id),
    categoryId: String(prod.category_id),
    categoryName: prod.category_name,
    name: prod.name,
    slug: prod.slug,
    description: prod.description || null,
    specs: prod.specs || {},
    status: prod.status,
    isFeatured: Boolean(prod.is_featured),
    isFlashSale: Boolean(prod.is_flash_sale),
    freeShipping: Boolean(prod.free_shipping),
    minPrice: Number(prod.min_price || 0),
    maxPrice: Number(prod.max_price || 0),
    totalStock: Number(prod.total_stock || 0),
    imageUrl: prod.thumbnail_url || (images[0]?.url ?? null),
    images: images.map((img) => ({
      id: String(img.id),
      url: img.url,
      sortOrder: Number(img.sort_order),
    })),
    variants: variants.map((v) => ({
      id: String(v.id),
      sku: v.sku,
      variantKey: v.variant_key,
      name: v.name,
      attributes: v.attributes,
      price: Number(v.price),
      originalPrice: v.original_price ? Number(v.original_price) : null,
      stockQty: Number(v.stock_qty),
      isActive: Boolean(v.is_active),
    })),
    createdAt: prod.created_at ? new Date(prod.created_at).toISOString() : null,
    updatedAt: prod.updated_at ? new Date(prod.updated_at).toISOString() : null,
  }
}

/**
 * GET /internal/v1/seller/products
 * Lấy danh sách sản phẩm của shop người bán
 */
export async function getSellerProducts(req, res, next) {
  try {
    const { shopId, status, page = '1', limit = '10' } = req.query

    if (!shopId || !/^\d+$/.test(String(shopId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã gian hàng shopId không hợp lệ.',
        error: { code: 'INVALID_SHOP_ID' },
      })
    }

    const numericShopId = BigInt(shopId)
    const parsedPage = Math.max(1, Number(page) || 1)
    const parsedLimit = Math.min(50, Math.max(1, Number(limit) || 10))
    const offset = (parsedPage - 1) * parsedLimit

    const whereClauses = ['p.shop_id = ?']
    const params = [numericShopId]

    if (status) {
      whereClauses.push('p.status = ?')
      params.push(status)
    }

    const whereSql = whereClauses.join(' AND ')

    // Đếm tổng số sản phẩm
    const countSql = `SELECT COUNT(*) AS total FROM products p WHERE ${whereSql}`
    const countRows = await executeQuery(countSql, params)
    const total = Number(countRows[0]?.total || 0)

    // Truy vấn sản phẩm kèm danh mục và khoảng giá SKU
    const sql = `
      SELECT p.id, p.shop_id, p.category_id, p.name, p.slug, p.description,
             p.specs, p.status, p.is_featured, p.is_flash_sale, p.free_shipping,
             p.created_at, p.updated_at,
             c.name AS category_name,
             COALESCE(MIN(v.price), 0) AS min_price,
             COALESCE(MAX(v.price), 0) AS max_price,
             COALESCE(SUM(v.stock_qty), 0) AS total_stock,
             (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1) AS thumbnail_url
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_variants v ON v.product_id = p.id
      WHERE ${whereSql}
      GROUP BY p.id, c.name
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `
    const productRows = await executeQuery(sql, [...params, parsedLimit, offset])

    // Lấy SKU và ảnh đính kèm
    let formattedList = []
    if (productRows && productRows.length > 0) {
      const prodIds = productRows.map((p) => p.id)
      const placeholders = prodIds.map(() => '?').join(',')

      const [imageRows, variantRows] = await Promise.all([
        executeQuery(
          `SELECT id, product_id, url, sort_order FROM product_images WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC`,
          prodIds,
        ),
        executeQuery(
          `SELECT id, product_id, sku, variant_key, name, attributes, price, original_price, stock_qty, is_active FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY id ASC`,
          prodIds,
        ),
      ])

      const imagesByProd = new Map()
      for (const img of imageRows) {
        const pId = String(img.product_id)
        if (!imagesByProd.has(pId)) imagesByProd.set(pId, [])
        imagesByProd.get(pId).push(img)
      }

      const variantsByProd = new Map()
      for (const v of variantRows) {
        const pId = String(v.product_id)
        if (!variantsByProd.has(pId)) variantsByProd.set(pId, [])
        variantsByProd.get(pId).push(v)
      }

      formattedList = productRows.map((p) =>
        formatSellerProduct(
          p,
          imagesByProd.get(String(p.id)) || [],
          variantsByProd.get(String(p.id)) || [],
        ),
      )
    }

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách sản phẩm của người bán thành công.',
      data: formattedList,
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
 * POST /internal/v1/seller/products
 * Tạo mới một sản phẩm cho gian hàng
 */
export async function createSellerProduct(req, res, next) {
  try {
    const {
      shopId,
      name,
      slug,
      categoryId,
      description,
      specs = {},
      freeShipping = false,
      isFlashSale = false,
      isFeatured = false,
      images = [],
      variants = [],
      actorId,
    } = req.body || {}

    if (!shopId || !name || !categoryId || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin sản phẩm bắt buộc (tên, danh mục, gian hàng, ít nhất 1 biến thể SKU) không đầy đủ.',
        error: { code: 'VALIDATION_ERROR' },
      })
    }

    const numericShopId = BigInt(shopId)
    const numericCategoryId = BigInt(categoryId)
    const numericActorId = actorId && /^\d+$/.test(String(actorId)) ? BigInt(actorId) : null

    // Tạo slug nếu chưa có
    const finalSlug = slug && slug.trim().length > 0
      ? slug.trim().toLowerCase()
      : `${name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-6)}`

    const createdProduct = await executeTransaction(async (query) => {
      // 1. Tạo bản ghi sản phẩm
      const insertProdSql = `
        INSERT INTO products (shop_id, category_id, slug, name, description, specs, badges, status, is_featured, is_flash_sale, free_shipping)
        VALUES (?, ?, ?, ?, ?, ?, JSON_ARRAY(), 'active', ?, ?, ?)
      `
      const prodResult = await query(insertProdSql, [
        numericShopId,
        numericCategoryId,
        finalSlug,
        name.trim(),
        description ? description.trim() : null,
        JSON.stringify(specs || {}),
        isFeatured ? 1 : 0,
        isFlashSale ? 1 : 0,
        freeShipping ? 1 : 0,
      ])
      const productId = prodResult.insertId

      // 2. Tạo ảnh đính kèm
      if (Array.isArray(images) && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const url = typeof images[i] === 'string' ? images[i] : images[i]?.url
          if (url && url.trim().length > 0) {
            await query(
              'INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)',
              [productId, url.trim(), i],
            )
          }
        }
      }

      // 3. Tạo các SKU biến thể và nhập kho
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i]
        const skuCode = v.sku && v.sku.trim().length > 0
          ? v.sku.trim()
          : `SKU-${productId}-${i + 1}`
        const vKey = v.variantKey || `opt-${i + 1}`
        const vName = v.name ? v.name.trim() : 'Mặc định'
        const vPrice = Number(v.price) || 100000
        const vOrigPrice = v.originalPrice ? Number(v.originalPrice) : null
        const vStock = Math.max(0, Number(v.stockQty) || 0)

        const varResult = await query(
          `INSERT INTO product_variants (product_id, sku, variant_key, name, attributes, price, original_price, stock_qty, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            productId,
            skuCode,
            vKey,
            vName,
            JSON.stringify(v.attributes || {}),
            vPrice,
            vOrigPrice,
            vStock,
          ],
        )

        // Ghi sổ biến động kho ban đầu
        if (vStock > 0) {
          await query(
            `INSERT INTO stock_moves (variant_id, reason, delta_qty, actor_id, note)
             VALUES (?, 'restock', ?, ?, 'Nhập kho ban đầu khi tạo sản phẩm')`,
            [varResult.insertId, vStock, numericActorId],
          )
        }
      }

      return {
        id: String(productId),
        name: name.trim(),
        slug: finalSlug,
        shopId: String(numericShopId),
        categoryId: String(numericCategoryId),
      }
    })

    return res.status(201).json({
      success: true,
      message: 'Tạo sản phẩm mới thành công.',
      data: createdProduct,
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
 * PUT /internal/v1/seller/products/:productId
 * Cập nhật thông tin sản phẩm
 */
export async function updateSellerProduct(req, res, next) {
  try {
    const { productId } = req.params
    const {
      shopId,
      name,
      categoryId,
      description,
      specs,
      status,
      freeShipping,
      isFlashSale,
      isFeatured,
    } = req.body || {}

    if (!productId || !/^\d+$/.test(String(productId)) || !shopId || !/^\d+$/.test(String(shopId))) {
      return res.status(400).json({
        success: false,
        message: 'Tham số không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    const numericProductId = BigInt(productId)
    const numericShopId = BigInt(shopId)

    // Kiểm tra sản phẩm thuộc shop
    const prodRows = await executeQuery(
      'SELECT id FROM products WHERE id = ? AND shop_id = ? LIMIT 1',
      [numericProductId, numericShopId],
    )
    if (!prodRows || prodRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm thuộc gian hàng của bạn.',
        error: { code: 'PRODUCT_NOT_FOUND' },
      })
    }

    const updateFields = ['updated_at = NOW(3)']
    const updateParams = []

    if (name && typeof name === 'string') {
      updateFields.push('name = ?')
      updateParams.push(name.trim())
    }
    if (categoryId && /^\d+$/.test(String(categoryId))) {
      updateFields.push('category_id = ?')
      updateParams.push(BigInt(categoryId))
    }
    if (description !== undefined) {
      updateFields.push('description = ?')
      updateParams.push(description ? String(description).trim() : null)
    }
    if (specs && typeof specs === 'object') {
      updateFields.push('specs = ?')
      updateParams.push(JSON.stringify(specs))
    }
    if (status && ['draft', 'active', 'hidden', 'archived'].includes(status)) {
      updateFields.push('status = ?')
      updateParams.push(status)
    }
    if (freeShipping !== undefined) {
      updateFields.push('free_shipping = ?')
      updateParams.push(freeShipping ? 1 : 0)
    }
    if (isFlashSale !== undefined) {
      updateFields.push('is_flash_sale = ?')
      updateParams.push(isFlashSale ? 1 : 0)
    }
    if (isFeatured !== undefined) {
      updateFields.push('is_featured = ?')
      updateParams.push(isFeatured ? 1 : 0)
    }

    updateParams.push(numericProductId)
    await executeQuery(
      `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams,
    )

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin sản phẩm thành công.',
      data: { id: String(numericProductId), updated: true },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /internal/v1/seller/products/:productId
 * Xóa sản phẩm (chuyển sang trạng thái archived)
 */
export async function deleteSellerProduct(req, res, next) {
  try {
    const { productId } = req.params
    const { shopId } = req.query

    if (!productId || !/^\d+$/.test(String(productId)) || !shopId || !/^\d+$/.test(String(shopId))) {
      return res.status(400).json({
        success: false,
        message: 'Tham số không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    const numericProductId = BigInt(productId)
    const numericShopId = BigInt(shopId)

    const result = await executeQuery(
      "UPDATE products SET status = 'archived', updated_at = NOW(3) WHERE id = ? AND shop_id = ?",
      [numericProductId, numericShopId],
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm thuộc gian hàng của bạn.',
        error: { code: 'PRODUCT_NOT_FOUND' },
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Đã lưu trữ (xóa) sản phẩm thành công.',
      data: { id: String(numericProductId), archived: true },
    })
  } catch (err) {
    next(err)
  }
}
