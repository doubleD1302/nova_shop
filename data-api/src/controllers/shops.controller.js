import { getCategoryDefinitions } from '../utils/category-attributes.js'
import { readPagination } from '../utils/pagination.js'
import { executeQuery, executeTransaction } from '../config/database.js'

const imageUrlIsAllowed = (value) => value === null || value === undefined || value === '' || (
  typeof value === 'string' && value.length <= 1024 &&
  (value.startsWith('/uploads/') || /^https:\/\/[^\s]+$/i.test(value))
)

const shopSelect = `
  SELECT s.id, s.owner_id, s.slug, s.name, s.logo_url, s.banner_url, s.tagline,
         s.description, s.province, s.address_detail, s.is_mall, s.status,
         __SUSPENSION_REASON__, s.approval_version, s.rejection_reason, s.created_at,
         u.full_name AS owner_name,
         COALESCE(ps.product_count, 0) AS product_count,
         COALESCE(ps.total_sold, 0) AS total_sold,
         COALESCE(rs.rating, 0) AS rating,
         COALESCE(rs.rating_count, 0) AS rating_count,
         COALESCE(fs.followers, 0) AS followers
  FROM shops s
  JOIN users u ON u.id = s.owner_id AND u.status = 'active'
  LEFT JOIN (
    SELECT p.shop_id, COUNT(*) AS product_count,
           COALESCE(SUM(sd.sold_count), 0) AS total_sold
    FROM products p
    LEFT JOIN (
      SELECT oi.product_id, SUM(oi.qty) AS sold_count
      FROM order_items oi
      JOIN shop_orders so ON so.id = oi.shop_order_id
      WHERE so.status = 'delivered'
      GROUP BY oi.product_id
    ) sd ON sd.product_id = p.id
    WHERE p.status = 'active'
    GROUP BY p.shop_id
  ) ps ON ps.shop_id = s.id
  LEFT JOIN (
    SELECT p.shop_id, AVG(r.rating) AS rating, COUNT(*) AS rating_count
    FROM reviews r
    JOIN products p ON p.id = r.product_id
    JOIN users reviewer ON reviewer.id = r.user_id AND reviewer.status = 'active'
    WHERE r.status = 'visible' AND p.status = 'active'
    GROUP BY p.shop_id
  ) rs ON rs.shop_id = s.id
  LEFT JOIN (
    SELECT shop_id, COUNT(*) AS followers FROM shop_follows GROUP BY shop_id
  ) fs ON fs.shop_id = s.id
`

async function getShopSelect() {
  const columns = await executeQuery("SELECT 1 FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shops' AND COLUMN_NAME = 'suspension_reason' LIMIT 1")
  return shopSelect.replace('__SUSPENSION_REASON__', columns.length ? 's.suspension_reason' : 'NULL AS suspension_reason')
}

function serializeShop(row) {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    ownerName: row.owner_name,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    bannerUrl: row.banner_url,
    tagline: row.tagline || '',
    description: row.description || '',
    location: row.province,
    address: row.address_detail || '',
    mall: Boolean(row.is_mall),
    status: row.status,
    approvalVersion: Number(row.approval_version),
    rejectionReason: row.rejection_reason || null,
    suspensionReason: row.suspension_reason || null,
    productCount: Number(row.product_count),
    totalSold: Number(row.total_sold),
    rating: Number(Number(row.rating).toFixed(2)),
    ratingCount: Number(row.rating_count),
    followers: Number(row.followers),
    joined: row.created_at instanceof Date ? String(row.created_at.getFullYear()) : String(row.created_at || '').slice(0, 4),
  }
}

export async function listCategories(req, res, next) {
  try {
    const rows = await executeQuery(
      `SELECT c.id, c.slug, c.name, c.image_url,
              (SELECT COUNT(*) FROM products p
               JOIN shops s ON s.id = p.shop_id AND s.status = 'active'
               WHERE p.category_id = c.id AND p.status = 'active'
                 AND (SELECT COUNT(*) FROM product_images pi WHERE pi.product_id = p.id) = 4) AS product_count
       FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order, c.id`,
    )
    return res.status(200).json({
      success: true,
      data: { categories: rows.map((row) => ({ id: row.slug, slug: row.slug, name: row.name, imageUrl: row.image_url, productCount: Number(row.product_count) || 0 })) },
    })
  } catch (err) {
    return next(err)
  }
}
export async function listShops(req, res, next) {
  try {
    const page = readPagination(req.query, { defaultLimit: 24 })
    if (!page) return res.status(400).json({ success: false, message: 'Phân trang không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    const { limit, offset } = page
    if ((req.query.q !== undefined && (typeof req.query.q !== 'string' || req.query.q.length > 120)) ||
        ['mall', 'featured'].some((key) => req.query[key] !== undefined && !['0', '1', 'true', 'false'].includes(req.query[key]))) {
      return res.status(400).json({ success: false, message: 'Bộ lọc shop không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const where = ["s.status = 'active'"]
    const params = []
    const query = String(req.query.q || '').trim().slice(0, 120)
    if (query) { where.push('(s.name LIKE ? OR s.tagline LIKE ?)'); params.push(`%${query}%`, `%${query}%`) }
    if (['1', 'true'].includes(req.query.mall) || ['1', 'true'].includes(req.query.featured)) where.push('s.is_mall = 1')
    const whereSql = where.join(' AND ')
    const select = await getShopSelect()
    const [rows, countRows] = await Promise.all([
      executeQuery(`${select} WHERE ${whereSql} ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      executeQuery(`SELECT COUNT(*) AS total FROM shops s WHERE ${whereSql}`, params),
    ])
    return res.status(200).json({ success: true, data: { shops: rows.map(serializeShop), total: Number(countRows[0]?.total || 0), limit, offset } })
  } catch (err) {
    return next(err)
  }
}
export async function getShop(req, res, next) {
  try {
    const key = req.params.shopId
    if (!/^[a-z0-9-]{1,160}$/.test(key)) return res.status(400).json({ success: false, message: 'Mã gian hàng không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    const select = await getShopSelect()
    const match = /^[1-9]\d{0,19}$/.test(key) ? 's.id = ?' : 's.slug = ?'
    const rows = await executeQuery(
      `${select} WHERE ${match} AND s.status = 'active' LIMIT 1`,
      [key],
    )
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng.', error: { code: 'SHOP_NOT_FOUND' } })
    }
    return res.status(200).json({ success: true, data: { shop: serializeShop(rows[0]) } })
  } catch (err) {
    return next(err)
  }
}
export async function getSellerShop(req, res, next) {
  try {
    const userId = String(req.params.userId || '')
    if (!/^[1-9]\d{0,19}$/.test(userId)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR' } })
    const select = await getShopSelect()
    const rows = await executeQuery(`${select} WHERE s.owner_id = ? LIMIT 1`, [userId])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng.', error: { code: 'SHOP_NOT_FOUND' } })
    return res.status(200).json({ success: true, data: { shop: serializeShop(rows[0]) } })
  } catch (err) { return next(err) }
}

export async function resubmitSellerShop(req, res, next) {
  try {
    const userId = String(req.params.userId || '')
    if (!/^[1-9]\d{0,19}$/.test(userId)) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR' } })
    const result = await executeTransaction(async (query) => {
      const shops = await query('SELECT id, status, approval_version FROM shops WHERE owner_id = ? FOR UPDATE', [userId])
      if (!shops.length) return { error: 'SHOP_NOT_FOUND' }
      if (shops[0].status !== 'rejected') return { error: 'SHOP_NOT_REJECTED' }
      const version = Number(shops[0].approval_version) + 1
      await query("UPDATE shops SET status = 'pending', rejection_reason = NULL, approval_version = ? WHERE id = ?", [version, shops[0].id])
      await query("INSERT INTO shop_approval_events (shop_id, actor_id, action, profile_version) VALUES (?, ?, 'submitted', ?)", [shops[0].id, userId, version])
      return { shopId: String(shops[0].id), status: 'pending', approvalVersion: version }
    })
    if (result.error) return res.status(result.error === 'SHOP_NOT_FOUND' ? 404 : 409).json({ success: false, message: 'Không thể gửi lại hồ sơ.', error: { code: result.error } })
    return res.status(200).json({ success: true, data: result })
  } catch (err) { return next(err) }
}

export async function updateSellerShop(req, res, next) {
  try {
    const userId = String(req.body?.userId || '')
    const body = req.body || {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const tagline = typeof body.tagline === 'string' ? body.tagline.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const province = typeof body.province === 'string' ? body.province.trim() : ''
    const address = typeof body.address === 'string' ? body.address.trim() : ''
    if (
      !/^[1-9]\d{0,19}$/.test(userId) || !name || name.length > 160 ||
      ['tagline', 'description', 'address'].some((field) => body[field] !== undefined && body[field] !== null && typeof body[field] !== 'string') ||
      tagline.length > 255 || description.length > 5000 || !province || province.length > 120 ||
      address.length > 255 || !imageUrlIsAllowed(body.logoUrl) || !imageUrlIsAllowed(body.bannerUrl)
    ) {
      return res.status(400).json({ success: false, message: 'Thông tin gian hàng chưa hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    const select = await getShopSelect()
    const shop = await executeTransaction(async (query) => {
      const rows = await query(
        `SELECT id FROM shops WHERE owner_id = ? AND status IN ('pending', 'rejected', 'active') FOR UPDATE`,
        [userId],
      )
      if (!rows.length) return null
      await query(
        `UPDATE shops SET name = ?, tagline = ?, description = ?, province = ?, address_detail = ?,
           logo_url = ?, banner_url = ?, approval_version = approval_version + IF(status IN ('pending', 'rejected'), 1, 0) WHERE id = ? AND owner_id = ?`,
        [name, tagline || null, description || null, province, address || null,
          body.logoUrl || null, body.bannerUrl || null, rows[0].id, userId],
      )
      const updated = await query(`${select} WHERE s.id = ? AND s.owner_id = ? LIMIT 1`, [rows[0].id, userId])
      return updated[0] || null
    })
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng thuộc tài khoản này.', error: { code: 'SHOP_NOT_FOUND' } })
    }
    return res.status(200).json({ success: true, data: { shop: serializeShop(shop) } })
  } catch (err) {
    return next(err)
  }
}
export async function getCategoryAttributes(req, res, next) {
  try {
    const slug = req.params.categorySlug
    if (!/^[a-z0-9-]{1,160}$/.test(slug)) return res.status(400).json({ success: false, message: 'Danh mục không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    const version = req.query.version === undefined ? 2 : Number(req.query.version)
    if (req.query.version !== undefined && !['1', '2'].includes(req.query.version)) return res.status(400).json({ success: false, message: 'Phiên bản không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    const rows = await executeQuery('SELECT id FROM categories WHERE slug = ? AND is_active = 1', [slug])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.', error: { code: 'CATEGORY_NOT_FOUND' } })
    return res.json({ success: true, data: { categoryId: slug, ...getCategoryDefinitions(slug, version), example: version === 1 } })
  } catch (err) { return next(err) }
}

export async function getShopFollowStatus(req, res, next) {
  try {
    const { shopId } = req.params
    const userId = req.query.userId
    if (!/^[1-9]\d{0,19}$/.test(String(userId || ''))) {
      return res.status(400).json({ success: false, message: 'Mã tài khoản không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const isId = /^[1-9]\d{0,19}$/.test(shopId)
    const shopRows = await executeQuery(
      `SELECT id FROM shops WHERE ${isId ? 'id = ?' : 'slug = ?'} AND status = 'active' LIMIT 1`,
      [shopId],
    )
    if (!shopRows.length) {
      return res.status(404).json({ success: false, message: 'Gian hàng không tồn tại.', error: { code: 'SHOP_NOT_FOUND' } })
    }
    const resolvedShopId = String(shopRows[0].id)
    const followRows = await executeQuery(
      'SELECT 1 FROM shop_follows WHERE user_id = ? AND shop_id = ? LIMIT 1',
      [userId, resolvedShopId],
    )
    const isFollowing = followRows.length > 0
    return res.status(200).json({
      success: true,
      data: { isFollowing, isFollowed: isFollowing, shopId: resolvedShopId },
    })
  } catch (err) {
    return next(err)
  }
}
export async function followShop(req, res, next) {
  try {
    const { shopId } = req.params
    const userId = req.body?.userId
    if (!/^[1-9]\d{0,19}$/.test(String(userId || ''))) {
      return res.status(400).json({ success: false, message: 'Mã tài khoản không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const isId = /^[1-9]\d{0,19}$/.test(shopId)
    const shopRows = await executeQuery(
      `SELECT id FROM shops WHERE ${isId ? 'id = ?' : 'slug = ?'} AND status = 'active' LIMIT 1`,
      [shopId],
    )
    if (!shopRows.length) {
      return res.status(404).json({ success: false, message: 'Gian hàng không tồn tại.', error: { code: 'SHOP_NOT_FOUND' } })
    }
    const resolvedShopId = String(shopRows[0].id)
    await executeQuery(
      `INSERT INTO shop_follows (user_id, shop_id, created_at)
       VALUES (?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE shop_id = shop_id`,
      [userId, resolvedShopId],
    )
    return res.status(200).json({
      success: true,
      message: 'Đã theo dõi gian hàng thành công.',
      data: { isFollowing: true, isFollowed: true, shopId: resolvedShopId },
    })
  } catch (err) {
    return next(err)
  }
}
export async function unfollowShop(req, res, next) {
  try {
    const { shopId } = req.params
    const userId = req.body?.userId || req.query?.userId
    if (!/^[1-9]\d{0,19}$/.test(String(userId || ''))) {
      return res.status(400).json({ success: false, message: 'Mã tài khoản không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }
    const isId = /^[1-9]\d{0,19}$/.test(shopId)
    const shopRows = await executeQuery(
      `SELECT id FROM shops WHERE ${isId ? 'id = ?' : 'slug = ?'} LIMIT 1`,
      [shopId],
    )
    if (!shopRows.length) {
      return res.status(404).json({ success: false, message: 'Gian hàng không tồn tại.', error: { code: 'SHOP_NOT_FOUND' } })
    }
    const resolvedShopId = String(shopRows[0].id)
    await executeQuery(
      'DELETE FROM shop_follows WHERE user_id = ? AND shop_id = ?',
      [userId, resolvedShopId],
    )
    return res.status(200).json({
      success: true,
      message: 'Đã hủy theo dõi gian hàng.',
      data: { isFollowing: false, isFollowed: false, shopId: resolvedShopId },
    })
  } catch (err) {
    return next(err)
  }
}
