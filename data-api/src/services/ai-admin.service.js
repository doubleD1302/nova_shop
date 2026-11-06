// Các bảng và trường được giới hạn trong danh sách cố định.
const RESOURCES = {
  users: { from:'users u', id:'u.id', email:'u.email', phone:'u.phone', select:'CAST(u.id AS CHAR) AS id, u.username, u.full_name AS fullName, u.email, u.phone, u.role, u.status', order:'u.created_at DESC, u.id DESC' },
  shops: { from:'shops s JOIN users u ON u.id = s.owner_id', id:'s.id', email:'u.email', phone:'u.phone', select:'CAST(s.id AS CHAR) AS id, s.name, s.status, s.description, s.address_detail AS address, s.province AS location, u.full_name AS ownerName, u.email AS ownerEmail, u.phone AS ownerPhone', order:'s.created_at DESC, s.id DESC' },
  products: { from:'products p JOIN shops s ON s.id = p.shop_id', id:'p.id', select:'CAST(p.id AS CHAR) AS id, p.name, p.status, p.description, p.specs, s.name AS shopName, (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS price, (SELECT COALESCE(SUM(v.stock_qty), 0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS stock', order:'p.created_at DESC, p.id DESC' },
  orders: { from:'orders o JOIN shop_orders so ON so.order_id = o.id', id:'o.id', code:'o.code', phone:'o.recipient_phone', select:'CAST(o.id AS CHAR) AS orderId, o.code, o.recipient_name AS recipientName, o.recipient_phone AS recipientPhone, o.address_detail AS address, o.province, o.district, o.ward, CAST(so.id AS CHAR) AS shopOrderId, so.shop_name AS shopName, so.total_amount AS total, so.status', order:'o.created_at DESC, o.id DESC, so.id DESC' },
  reviews: { from:'reviews r JOIN products p ON p.id = r.product_id JOIN shops s ON s.id = p.shop_id JOIN users u ON u.id = r.user_id', id:'r.id', select:'CAST(r.id AS CHAR) AS id, p.name AS productName, s.name AS shopName, u.username, r.rating, r.comment, r.status', order:'r.created_at DESC, r.id DESC' },
  reports: { from:'abuse_reports r', id:'r.id', select:'CAST(r.id AS CHAR) AS id, r.target_type AS targetType, CAST(r.target_id AS CHAR) AS targetId, CAST(r.shop_id AS CHAR) AS shopId, r.reason, r.details, r.status', order:'r.created_at DESC, r.id DESC' },
}
const validId = value => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)

export async function searchAdminData(executeQuery, input) {
  const { actorId, resource, id, email, phone, code } = input
  const config = typeof resource === 'string' && Object.hasOwn(RESOURCES, resource) ? RESOURCES[resource] : null
  const rawLimit = input.limit ?? '20'
  const rawOffset = input.offset ?? '0'
  const limit = Number(rawLimit)
  const offset = Number(rawOffset)
  if (!validId(actorId) || !config || typeof resource !== 'string' || !['string', 'number'].includes(typeof rawLimit) || !['string', 'number'].includes(typeof rawOffset) || !/^\d+$/.test(String(rawLimit)) || !/^\d+$/.test(String(rawOffset)) || !Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
      !Number.isSafeInteger(offset) || offset < 0 || (id !== undefined && !validId(id)) ||
      (email !== undefined && (typeof email !== 'string' || email.length > 254 || !config.email)) ||
      (phone !== undefined && (typeof phone !== 'string' || !/^\d{8,15}$/.test(phone) || !config.phone)) ||
      (code !== undefined && (typeof code !== 'string' || !/^[A-Za-z0-9-]{1,32}$/.test(code) || !config.code))) return { error: 'VALIDATION_ERROR' }
  const actor = await executeQuery("SELECT id FROM users WHERE id = ? AND role = 'admin' AND status = 'active' LIMIT 1", [actorId])
  if (!actor.length) return { error: 'FORBIDDEN' }
  const conditions = ["EXISTS (SELECT 1 FROM users ai_admin WHERE ai_admin.id = ? AND ai_admin.role = 'admin' AND ai_admin.status = 'active')"]
  const params = [actorId]
  if (id !== undefined) { conditions.push(`${config.id} = ?`); params.push(id) }
  if (email !== undefined) { conditions.push(`${config.email} = ?`); params.push(email) }
  if (phone !== undefined) { conditions.push(`${config.phone} = ?`); params.push(phone) }
  if (code !== undefined) { conditions.push(`${config.code} = ?`); params.push(code) }
  const where = ` WHERE ${conditions.join(' AND ')}`
  const count = await executeQuery(`SELECT COUNT(*) AS total FROM ${config.from}${where}`, params)
  const rows = await executeQuery(`SELECT ${config.select} FROM ${config.from}${where} ORDER BY ${config.order} LIMIT ? OFFSET ?`, [...params, limit, offset])
  const total = Number(count[0]?.total ?? 0)
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Invalid count')
  return { items: rows, total, limit, offset, hasMore: offset + rows.length < total }
}
