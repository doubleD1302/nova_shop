import { prepareSellerProfile, encryptIdentity, decryptIdentity, saveSellerProfile } from '../utils/seller-profile.js'
import { executeQuery, executeTransaction } from '../config/database.js'

export async function getSellerRegistration(req, res, next) {
  try {
    const userId = String(req.params.userId || req.query.userId || '')
    const shopId = req.params.shopId
    if (!/^[1-9]\d{0,19}$/.test(userId) || (shopId && !/^[1-9]\d{0,19}$/.test(shopId))) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR' } })
    }
    const access = shopId
      ? "s.id = ? AND EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND u.role = 'admin' AND u.status = 'active')"
      : 's.owner_id = ?'
    const values = shopId ? [shopId, userId] : [userId]
    const rows = await executeQuery(`SELECT p.pickup_address, p.province, p.contact_email, p.contact_phone,
      p.shipping_methods, p.business_type, p.owner_name, p.identity_last4, p.tax_code, p.invoice_email, p.agreed_at
      FROM seller_registration_profiles p JOIN shops s ON s.id = p.shop_id WHERE ${access} LIMIT 1`, values)
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ.', error: { code: 'SELLER_PROFILE_NOT_FOUND' } })
    const p = rows[0]
    const methods = typeof p.shipping_methods === 'string' ? JSON.parse(p.shipping_methods) : p.shipping_methods
    return res.json({ success: true, data: { profile: {
      pickupAddress: p.pickup_address, province: p.province, contactEmail: p.contact_email,
      contactPhone: p.contact_phone, shippingMethods: methods, businessType: p.business_type,
      ownerName: p.owner_name, identityLast4: p.identity_last4, taxCode: p.tax_code,
      invoiceEmail: p.invoice_email, agreedAt: p.agreed_at,
    } } })
  } catch (err) { return next(err) }
}

export async function updateSellerRegistration(req, res, next) {
  try {
    const userId = String(req.params.userId || '')
    const profile = prepareSellerProfile(req.body)
    if (!/^[1-9]\d{0,19}$/.test(userId) || !profile) return res.status(400).json({ success: false, message: 'Hồ sơ người bán không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
    const encrypted = encryptIdentity(profile.idCard)
    if (!encrypted) return res.status(503).json({ success: false, message: 'Chưa cấu hình bảo vệ hồ sơ người bán.', error: { code: 'SELLER_PROFILE_NOT_CONFIGURED' } })
    const result = await executeTransaction(async (query) => {
      const shops = await query('SELECT id, status FROM shops WHERE owner_id = ? FOR UPDATE', [userId])
      if (!shops.length) return 'missing'
      if (!['pending', 'rejected'].includes(shops[0].status)) return 'locked'
      const shopId = shops[0].id
      const rows = await query('SELECT shop_id FROM seller_registration_profiles WHERE shop_id = ? FOR UPDATE', [shopId])
      if (rows.length) {
        await query(`UPDATE seller_registration_profiles SET pickup_address = ?, province = ?, contact_email = ?, contact_phone = ?,
          shipping_methods = ?, business_type = ?, owner_name = ?, identity_encrypted = ?, identity_last4 = ?, tax_code = ?, invoice_email = ?, agreed_at = UTC_TIMESTAMP()
          WHERE shop_id = ?`, [profile.pickupAddress, profile.province, profile.contactEmail, profile.contactPhone,
          JSON.stringify(profile.shippingMethods), profile.businessType, profile.ownerName, encrypted, profile.idCard.slice(-4),
          profile.taxCode || null, profile.invoiceEmail || null, shopId])
      } else await saveSellerProfile(query, shopId, profile, encrypted)
      await query('UPDATE shops SET province = ?, address_detail = ?, approval_version = approval_version + 1 WHERE id = ? AND owner_id = ?', [profile.province, profile.pickupAddress, shopId, userId])
      return 'ok'
    })
    if (result === 'missing') return res.status(404).json({ success: false, message: 'Không tìm thấy gian hàng.', error: { code: 'SHOP_NOT_FOUND' } })
    if (result === 'locked') return res.status(409).json({ success: false, message: 'Chỉ có thể sửa hồ sơ đang chờ duyệt hoặc bị từ chối.', error: { code: 'SHOP_PROFILE_LOCKED' } })
    return res.json({ success: true, data: {} })
  } catch (err) { return next(err) }
}

// Trả giấy tờ chỉ cho admin đang hoạt động và chỉ sau khi ghi nhật ký trong transaction.
export async function revealSellerIdentity(req, res, next) {
  res.set('Cache-Control', 'no-store')
  try {
    const shopId = String(req.params.shopId || '')
    const adminId = String(req.body?.userId || '')
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
    if (!/^[1-9]\d{0,19}$/.test(shopId) || !/^[1-9]\d{0,19}$/.test(adminId) || reason.length < 10 || reason.length > 500) {
      return res.status(400).json({ success: false, message: 'Cần cung cấp lý do kiểm tra từ 10 đến 500 ký tự.', error: { code: 'VALIDATION_ERROR' } })
    }
    const result = await executeTransaction(async (query) => {
      const admins = await query("SELECT id FROM users WHERE id = ? AND role = 'admin' AND status = 'active' FOR UPDATE", [adminId])
      if (!admins.length) return { error: 'ADMIN_REQUIRED' }
      const rows = await query('SELECT identity_encrypted FROM seller_registration_profiles WHERE shop_id = ? FOR UPDATE', [shopId])
      if (!rows.length) return { error: 'SELLER_PROFILE_NOT_FOUND' }
      let identity
      try { identity = decryptIdentity(rows[0].identity_encrypted) } catch { return { error: 'IDENTITY_UNAVAILABLE' } }
      await query('INSERT INTO seller_identity_access_events (shop_id, admin_id, reason) VALUES (?, ?, ?)', [shopId, adminId, reason])
      return { identity }
    })
    if (result.error) {
      const status = result.error === 'ADMIN_REQUIRED' ? 403 : result.error === 'SELLER_PROFILE_NOT_FOUND' ? 404 : 503
      return res.status(status).json({ success: false, message: 'Không thể truy xuất giấy tờ.', error: { code: result.error } })
    }
    return res.json({ success: true, data: { idCard: result.identity } })
  } catch (err) { return next(err) }
}
export async function listSellerIdentityAccessEvents(req, res, next) {
  res.set('Cache-Control', 'no-store')
  try {
    const shopId = String(req.params.shopId || '')
    const adminId = String(req.query.userId || '')
    if (!/^[1-9]\d{0,19}$/.test(shopId) || !/^[1-9]\d{0,19}$/.test(adminId)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR' } })
    }
    const admins = await executeQuery("SELECT id FROM users WHERE id = ? AND role = 'admin' AND status = 'active'", [adminId])
    if (!admins.length) return res.status(403).json({ success: false, error: { code: 'ADMIN_REQUIRED' } })
    const shops = await executeQuery('SELECT id FROM shops WHERE id = ?', [shopId])
    if (!shops.length) return res.status(404).json({ success: false, error: { code: 'SHOP_NOT_FOUND' } })
    const rows = await executeQuery('SELECT id, admin_id, reason, created_at FROM seller_identity_access_events WHERE shop_id = ? ORDER BY id DESC LIMIT 100', [shopId])
    return res.json({ success: true, data: { events: rows.map((row) => ({
      id: String(row.id), adminId: String(row.admin_id), reason: row.reason,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    })) } })
  } catch (err) { return next(err) }
}
