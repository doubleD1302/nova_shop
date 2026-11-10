import { executeQuery, executeTransaction } from '../config/database.js'

const validId = (value) => /^[1-9]\d{0,19}$/.test(String(value || ''))
const columns = 'id, recipient_name, phone, province, district, ward, detail, is_default'
const format = (row) => ({
  id: String(row.id), fullName: row.recipient_name, phone: row.phone,
  province: row.province, district: row.district || '', ward: row.ward || '',
  detail: row.detail, isDefault: Boolean(row.is_default),
})

function readAddress(body) {
  const limits = { fullName: 120, phone: 20, province: 120, district: 120, ward: 120, detail: 255 }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const result = {}
  for (const [key, limit] of Object.entries(limits)) {
    if (body[key] != null && typeof body[key] !== 'string') return null
    result[key] = (body[key] || '').trim()
    if (result[key].length > limit) return null
  }
  if (!result.fullName || !result.phone || !result.province || !result.detail ||
    !/^[+()\d .-]{8,20}$/.test(result.phone) ||
    (body.isDefault !== undefined && typeof body.isDefault !== 'boolean')) return null
  return result
}

function invalid(res) {
  return res.status(400).json({ success: false, message: 'Địa chỉ không hợp lệ.', error: { code: 'VALIDATION_ERROR' } })
}
function missing(res) {
  return res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ.', error: { code: 'ADDRESS_NOT_FOUND' } })
}

export async function listAddresses(req, res, next) {
  try {
    if (!validId(req.params.userId)) return invalid(res)
    const rows = await executeQuery(`SELECT ${columns} FROM addresses WHERE user_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, id DESC`, [req.params.userId])
    return res.json({ success: true, data: { addresses: rows.map(format) } })
  } catch (err) { return next(err) }
}

export async function saveAddress(req, res, next) {
  try {
    const userId = req.params.userId
    const id = req.params.addressId
    const input = readAddress(req.body)
    if (!validId(userId) || (id && !validId(id)) || !input) return invalid(res)
    const saved = await executeTransaction(async (query) => {
      const user = await query('SELECT id FROM users WHERE id = ? AND status = \'active\' FOR UPDATE', [userId])
      if (!user.length) return null
      if (id) {
        const rows = await query('SELECT id FROM addresses WHERE id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE', [id, userId])
        if (!rows.length) return null
      }
      const defaults = await query('SELECT id FROM addresses WHERE user_id = ? AND is_default = 1 AND deleted_at IS NULL FOR UPDATE', [userId])
      const makeDefault = req.body.isDefault === true || (!id && !defaults.length)
      if (makeDefault) await query('UPDATE addresses SET is_default = 0 WHERE user_id = ? AND is_default = 1 AND deleted_at IS NULL', [userId])
      const values = [input.fullName, input.phone, input.province, input.district || null, input.ward || null, input.detail]
      let addressId = id
      if (id) {
        await query('UPDATE addresses SET recipient_name = ?, phone = ?, province = ?, district = ?, ward = ?, detail = ? WHERE id = ? AND user_id = ?', [...values, id, userId])
        if (makeDefault) await query('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [id, userId])
      } else {
        const result = await query('INSERT INTO addresses (user_id, recipient_name, phone, province, district, ward, detail, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [userId, ...values, makeDefault ? 1 : 0])
        addressId = String(result.insertId)
      }
      const rows = await query(`SELECT ${columns} FROM addresses WHERE id = ? AND user_id = ? AND deleted_at IS NULL`, [addressId, userId])
      return rows[0] || null
    })
    if (!saved) return missing(res)
    return res.status(id ? 200 : 201).json({ success: true, data: { address: format(saved) } })
  } catch (err) { return next(err) }
}

export async function deleteAddress(req, res, next) {
  try {
    const { userId, addressId } = req.params
    if (!validId(userId) || !validId(addressId)) return invalid(res)
    const deleted = await executeTransaction(async (query) => {
      const users = await query("SELECT id FROM users WHERE id = ? AND status = 'active' FOR UPDATE", [userId])
      if (!users.length) return false
      const rows = await query('SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE', [addressId, userId])
      if (!rows.length) return false
      await query('UPDATE addresses SET is_default = 0, deleted_at = UTC_TIMESTAMP() WHERE id = ? AND user_id = ?', [addressId, userId])
      if (rows[0].is_default) {
        const remaining = await query('SELECT id FROM addresses WHERE user_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE', [userId])
        if (remaining.length) await query('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [remaining[0].id, userId])
      }
      return true
    })
    return deleted ? res.json({ success: true, data: {} }) : missing(res)
  } catch (err) { return next(err) }
}
export async function setDefaultAddress(req, res, next) {
  try {
    const { userId, addressId } = req.params
    if (!validId(userId) || !validId(addressId)) return invalid(res)
    const result = await executeTransaction(async (query) => {
      const users = await query("SELECT id FROM users WHERE id = ? AND status = 'active' FOR UPDATE", [userId])
      if (!users.length) return false
      const rows = await query('SELECT id FROM addresses WHERE id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE', [addressId, userId])
      if (!rows.length) return false
      await query('UPDATE addresses SET is_default = 0 WHERE user_id = ? AND is_default = 1 AND deleted_at IS NULL', [userId])
      await query('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [addressId, userId])
      return true
    })
    return result ? res.json({ success: true, data: {} }) : missing(res)
  } catch (err) { return next(err) }
}
