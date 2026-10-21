import { executeQuery } from '../config/database.js'

/**
 * GET /internal/v1/seller/shop
 * Lấy thông tin chi tiết gian hàng của seller
 */
export async function getSellerShop(req, res, next) {
  try {
    const { shopId } = req.query

    if (!shopId || !/^\d+$/.test(String(shopId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã gian hàng shopId không hợp lệ.',
        error: { code: 'INVALID_SHOP_ID' },
      })
    }

    const numericShopId = BigInt(shopId)
    const sql = `
      SELECT s.id, s.owner_id, s.slug, s.name, s.logo_url, s.banner_url,
             s.tagline, s.description, s.province, s.address_detail, s.is_mall,
             s.status, s.created_at, s.updated_at,
             (SELECT COUNT(*) FROM shop_follows WHERE shop_id = s.id) AS followers_count,
             (SELECT COUNT(*) FROM products WHERE shop_id = s.id AND status = 'active') AS products_count
      FROM shops s
      WHERE s.id = ?
      LIMIT 1
    `
    const rows = await executeQuery(sql, [numericShopId])

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy gian hàng.',
        error: { code: 'SHOP_NOT_FOUND' },
      })
    }

    const s = rows[0]
    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin gian hàng thành công.',
      data: {
        id: String(s.id),
        ownerId: String(s.owner_id),
        slug: s.slug,
        name: s.name,
        logoUrl: s.logo_url,
        bannerUrl: s.banner_url,
        tagline: s.tagline,
        description: s.description,
        province: s.province,
        addressDetail: s.address_detail,
        isMall: Boolean(s.is_mall),
        status: s.status,
        followersCount: Number(s.followers_count || 0),
        productsCount: Number(s.products_count || 0),
        createdAt: s.created_at ? new Date(s.created_at).toISOString() : null,
        updatedAt: s.updated_at ? new Date(s.updated_at).toISOString() : null,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /internal/v1/seller/shop
 * Cập nhật thông tin gian hàng của seller
 */
export async function updateSellerShop(req, res, next) {
  try {
    const {
      shopId,
      name,
      logoUrl,
      bannerUrl,
      tagline,
      description,
      addressDetail,
      province,
    } = req.body || {}

    if (!shopId || !/^\d+$/.test(String(shopId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã gian hàng shopId không hợp lệ.',
        error: { code: 'INVALID_SHOP_ID' },
      })
    }

    const numericShopId = BigInt(shopId)

    const updateFields = ['updated_at = NOW(3)']
    const updateParams = []

    if (name && typeof name === 'string' && name.trim().length > 0) {
      updateFields.push('name = ?')
      updateParams.push(name.trim())
    }
    if (logoUrl !== undefined) {
      updateFields.push('logo_url = ?')
      updateParams.push(logoUrl ? String(logoUrl).trim() : null)
    }
    if (bannerUrl !== undefined) {
      updateFields.push('banner_url = ?')
      updateParams.push(bannerUrl ? String(bannerUrl).trim() : null)
    }
    if (tagline !== undefined) {
      updateFields.push('tagline = ?')
      updateParams.push(tagline ? String(tagline).trim() : null)
    }
    if (description !== undefined) {
      updateFields.push('description = ?')
      updateParams.push(description ? String(description).trim() : null)
    }
    if (addressDetail !== undefined) {
      updateFields.push('address_detail = ?')
      updateParams.push(addressDetail ? String(addressDetail).trim() : null)
    }
    if (province !== undefined) {
      updateFields.push('province = ?')
      updateParams.push(province ? String(province).trim() : 'Hà Nội')
    }

    updateParams.push(numericShopId)
    await executeQuery(
      `UPDATE shops SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams,
    )

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin gian hàng thành công.',
      data: { id: String(numericShopId), updated: true },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /internal/v1/seller/dashboard
 * Thống kê tổng quan hoạt động kinh doanh của gian hàng
 */
export async function getSellerDashboard(req, res, next) {
  try {
    const { shopId } = req.query

    if (!shopId || !/^\d+$/.test(String(shopId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã gian hàng shopId không hợp lệ.',
        error: { code: 'INVALID_SHOP_ID' },
      })
    }

    const numericShopId = BigInt(shopId)

    // 1. Thống kê đơn hàng và doanh thu
    const orderStatsSql = `
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_orders,
        COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0) AS confirmed_orders,
        COALESCE(SUM(CASE WHEN status = 'shipping' THEN 1 ELSE 0 END), 0) AS shipping_orders,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_orders,
        COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_orders
      FROM shop_orders
      WHERE shop_id = ?
    `
    const orderRows = await executeQuery(orderStatsSql, [numericShopId])
    const o = orderRows[0] || {}

    // 2. Thống kê số lượng sản phẩm
    const prodStatsSql = `
      SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active_products,
        COALESCE(SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END), 0) AS archived_products
      FROM products
      WHERE shop_id = ?
    `
    const prodRows = await executeQuery(prodStatsSql, [numericShopId])
    const p = prodRows[0] || {}

    // 3. Cảnh báo các biến thể SKU sắp hết hàng (tồn kho <= 5)
    const lowStockSql = `
      SELECT v.id, v.sku, v.name AS variant_name, v.stock_qty, v.price,
             p.id AS product_id, p.name AS product_name
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE p.shop_id = ? AND v.is_active = 1 AND v.stock_qty <= 5
      ORDER BY v.stock_qty ASC
      LIMIT 10
    `
    const lowStockRows = await executeQuery(lowStockSql, [numericShopId])

    return res.status(200).json({
      success: true,
      message: 'Lấy dữ liệu thống kê dashboard thành công.',
      data: {
        revenue: {
          totalDelivered: Number(o.total_revenue || 0),
        },
        orders: {
          total: Number(o.total_orders || 0),
          pending: Number(o.pending_orders || 0),
          confirmed: Number(o.confirmed_orders || 0),
          shipping: Number(o.shipping_orders || 0),
          delivered: Number(o.delivered_orders || 0),
          cancelled: Number(o.cancelled_orders || 0),
        },
        products: {
          total: Number(p.total_products || 0),
          active: Number(p.active_products || 0),
          archived: Number(p.archived_products || 0),
        },
        lowStockAlerts: lowStockRows.map((r) => ({
          variantId: String(r.id),
          productId: String(r.product_id),
          productName: r.product_name,
          variantName: r.variant_name,
          sku: r.sku,
          stockQty: Number(r.stock_qty),
          price: Number(r.price),
        })),
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /internal/v1/shops/:shopId/follow
 * Kiểm tra người dùng đã theo dõi shop chưa
 */
export async function getShopFollowStatus(req, res, next) {
  try {
    const { shopId } = req.params
    const { userId } = req.query

    if (!shopId || !/^\d+$/.test(String(shopId)) || !userId || !/^\d+$/.test(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Tham số không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    const numericShopId = BigInt(shopId)
    const numericUserId = BigInt(userId)

    const rows = await executeQuery(
      'SELECT 1 FROM shop_follows WHERE user_id = ? AND shop_id = ? LIMIT 1',
      [numericUserId, numericShopId],
    )

    return res.status(200).json({
      success: true,
      data: {
        shopId: String(numericShopId),
        isFollowing: rows.length > 0,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /internal/v1/shops/:shopId/follow
 * Người dùng theo dõi shop
 */
export async function followShop(req, res, next) {
  try {
    const { shopId } = req.params
    const { userId } = req.body || {}

    if (!shopId || !/^\d+$/.test(String(shopId)) || !userId || !/^\d+$/.test(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Tham số không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    const numericShopId = BigInt(shopId)
    const numericUserId = BigInt(userId)

    await executeQuery(
      'INSERT IGNORE INTO shop_follows (user_id, shop_id) VALUES (?, ?)',
      [numericUserId, numericShopId],
    )

    return res.status(200).json({
      success: true,
      message: 'Đã theo dõi gian hàng.',
      data: { shopId: String(numericShopId), isFollowing: true },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /internal/v1/shops/:shopId/follow
 * Người dùng hủy theo dõi shop
 */
export async function unfollowShop(req, res, next) {
  try {
    const { shopId } = req.params
    const { userId } = req.query

    if (!shopId || !/^\d+$/.test(String(shopId)) || !userId || !/^\d+$/.test(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Tham số không hợp lệ.',
        error: { code: 'INVALID_PARAMS' },
      })
    }

    const numericShopId = BigInt(shopId)
    const numericUserId = BigInt(userId)

    await executeQuery(
      'DELETE FROM shop_follows WHERE user_id = ? AND shop_id = ?',
      [numericUserId, numericShopId],
    )

    return res.status(200).json({
      success: true,
      message: 'Đã hủy theo dõi gian hàng.',
      data: { shopId: String(numericShopId), isFollowing: false },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /internal/v1/seller/register-shop
 * Đăng ký mở gian hàng mới cho người dùng
 */
export async function registerSellerShop(req, res, next) {
  try {
    const { userId, shopName, tagline, province = 'Toàn quốc' } = req.body || {}

    if (!userId || !/^\d+$/.test(String(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Mã người dùng không hợp lệ.',
        error: { code: 'INVALID_USER_ID' },
      })
    }

    if (!shopName || typeof shopName !== 'string' || shopName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tên gian hàng không được để trống.',
        error: { code: 'INVALID_SHOP_NAME' },
      })
    }

    const numericUserId = BigInt(userId)
    const trimmedName = shopName.trim().slice(0, 160)
    const baseSlug = String(trimmedName)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `shop-${numericUserId}`
    const uniqueSlug = `${baseSlug}-${numericUserId}-${Date.now().toString().slice(-4)}`.slice(0, 160)

    // Kiểm tra xem user đã có shop chưa
    const existingShop = await executeQuery('SELECT id FROM shops WHERE owner_id = ? LIMIT 1', [numericUserId])
    let shopId
    if (existingShop && existingShop.length > 0) {
      shopId = existingShop[0].id
      await executeQuery('UPDATE shops SET name = ?, tagline = ?, status = "active" WHERE id = ?', [
        trimmedName,
        tagline ? tagline.trim().slice(0, 255) : null,
        shopId,
      ])
    } else {
      const insertResult = await executeQuery(
        'INSERT INTO shops (owner_id, slug, name, tagline, province, status) VALUES (?, ?, ?, ?, ?, "active")',
        [numericUserId, uniqueSlug, trimmedName, tagline ? tagline.trim().slice(0, 255) : null, province || 'Toàn quốc'],
      )
      shopId = insertResult.insertId
    }

    // Cập nhật vai trò người dùng thành 'seller'
    await executeQuery('UPDATE users SET role = "seller" WHERE id = ?', [numericUserId])

    return res.status(201).json({
      success: true,
      message: 'Mở gian hàng thành công.',
      data: {
        shopId: String(shopId),
        userId: String(numericUserId),
        name: trimmedName,
        slug: uniqueSlug,
        role: 'seller',
      },
    })
  } catch (err) {
    next(err)
  }
}

