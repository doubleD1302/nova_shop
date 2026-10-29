import { executeQuery, executeTransaction } from '../config/database.js'

const imageUrlIsAllowed = (value) => value === null || value === undefined || value === '' || (
  typeof value === 'string' && value.length <= 1024 &&
  (value.startsWith('/uploads/') || /^https:\/\/[^\s]+$/i.test(value))
)

const shopSelect = `
  SELECT s.id, s.owner_id, s.slug, s.name, s.logo_url, s.banner_url, s.tagline,
         s.description, s.province, s.address_detail, s.is_mall, s.status,
         s.suspension_reason, s.created_at,
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
    const limitValue = Number(req.query.limit)
    const offsetValue = Number(req.query.offset)
    const limit = Number.isInteger(limitValue) && limitValue >= 1 && limitValue <= 100 ? limitValue : 24
    const offset = Number.isInteger(offsetValue) && offsetValue >= 0 ? offsetValue : 0
    const where = ["s.status = 'active'"]
    const params = []
    const query = String(req.query.q || '').trim().slice(0, 120)
    if (query) { where.push('(s.name LIKE ? OR s.tagline LIKE ?)'); params.push(`%${query}%`, `%${query}%`) }
    if (req.query.mall === '1' || req.query.featured === '1') where.push('s.is_mall = 1')
    const whereSql = where.join(' AND ')
    const [rows, countRows] = await Promise.all([
      executeQuery(`${shopSelect} WHERE ${whereSql} ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
      executeQuery(`SELECT COUNT(*) AS total FROM shops s WHERE ${whereSql}`, params),
    ])
    return res.status(200).json({ success: true, data: { shops: rows.map(serializeShop), total: Number(countRows[0]?.total || 0), limit, offset } })
  } catch (err) {
    return next(err)
  }
}

export async function getShop(req, res, next) {
  try {
    const key = String(req.params.shopId || '')
    const rows = await executeQuery(
      `${shopSelect} WHERE (s.id = ? OR s.slug = ?) LIMIT 1`,
      [key, key],
    )
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng.', error: { code: 'SHOP_NOT_FOUND' } })
    }
    return res.status(200).json({ success: true, data: { shop: serializeShop(rows[0]) } })
  } catch (err) {
    return next(err)
  }
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
      tagline.length > 255 || description.length > 5000 || !province || province.length > 120 ||
      address.length > 255 || !imageUrlIsAllowed(body.logoUrl) || !imageUrlIsAllowed(body.bannerUrl)
    ) {
      return res.status(400).json({ success: false, message: 'Thông tin gian hàng chưa hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    }

    const shop = await executeTransaction(async (query) => {
      const rows = await query(
        `SELECT id FROM shops WHERE owner_id = ? AND status = 'active' FOR UPDATE`,
        [userId],
      )
      if (!rows.length) return null
      await query(
        `UPDATE shops SET name = ?, tagline = ?, description = ?, province = ?, address_detail = ?,
           logo_url = ?, banner_url = ? WHERE id = ? AND owner_id = ?`,
        [name, tagline || null, description || null, province, address || null,
          body.logoUrl || null, body.bannerUrl || null, rows[0].id, userId],
      )
      const updated = await query(`${shopSelect} WHERE s.id = ? AND s.owner_id = ? LIMIT 1`, [rows[0].id, userId])
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
