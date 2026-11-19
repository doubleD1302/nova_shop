import { executeQuery, executeTransaction } from '../config/database.js'
import { readPagination } from '../utils/pagination.js'

// Quản trị chiến dịch marketing và duyệt đăng ký tham gia của shop.
// Duyệt đăng ký chỉ ghi trạng thái và ghi chú; chưa tự đổi giá sản phẩm hay bật Flash Sale.

const validId = (value) => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)
const invalid = (res, msg = 'Dữ liệu không hợp lệ.') =>
  res.status(400).json({ success: false, message: msg, error: { code: 'VALIDATION_ERROR' } })
const fail = (res, status, code, message) => res.status(status).json({ success: false, message, error: { code } })

const TYPES = ['flash_sale', 'mega_sale', 'category_day']
const REGISTRATION_STATUSES = ['pending', 'approved', 'rejected']
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

// Thời điểm bắt buộc có múi giờ để kết quả không phụ thuộc máy chủ. Trả null nếu sai.
function readInstant(value) {
  if (typeof value !== 'string' || !INSTANT.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const bannerIsAllowed = (value) => value === null || value === '' || (
  typeof value === 'string' && value.length <= 500 &&
  (value.startsWith('/uploads/') || /^https:\/\/[^\s]+$/i.test(value))
)

async function requireAdmin(query, userId) {
  if (!validId(userId)) return false
  const rows = await query("SELECT id FROM users WHERE id = ? AND role = 'admin' AND status = 'active'", [userId])
  return rows.length > 0
}

const forbidden = (res) => fail(res, 403, 'ADMIN_REQUIRED', 'Chỉ quản trị viên mới thực hiện được thao tác này.')

function toCampaign(row) {
  return {
    id: String(row.id),
    name: row.name,
    type: row.type,
    description: row.description,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    bannerUrl: row.banner_url,
    isActive: Boolean(row.is_active),
    registrations: row.pending === undefined ? undefined : {
      pending: Number(row.pending), approved: Number(row.approved), rejected: Number(row.rejected),
    },
  }
}

// Đọc dữ liệu chiến dịch. Tạo mới cần đủ name/type/startsAt/endsAt; sửa chỉ cần trường nào muốn đổi.
// Trả { error } khi sai, { values } là các cột cần ghi (tên cột -> giá trị).
function readCampaign(body, { partial }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Dữ liệu chiến dịch không hợp lệ.' }
  const allowed = ['name', 'type', 'description', 'startsAt', 'endsAt', 'bannerUrl', 'isActive', 'userId']
  if (Object.keys(body).some((key) => !allowed.includes(key))) return { error: 'Dữ liệu chiến dịch có trường không được hỗ trợ.' }
  const values = {}
  if (!partial || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 150) return { error: 'Tên chiến dịch phải từ 1 đến 150 ký tự.' }
    values.name = name
  }
  if (!partial || body.type !== undefined) {
    if (!TYPES.includes(body.type)) return { error: 'Loại chiến dịch phải là flash_sale, mega_sale hoặc category_day.' }
    values.type = body.type
  }
  if (body.description !== undefined) {
    if (body.description !== null && (typeof body.description !== 'string' || body.description.length > 2000)) return { error: 'Mô tả tối đa 2000 ký tự.' }
    values.description = body.description ? body.description.trim() || null : null
  }
  if (!partial || body.startsAt !== undefined) {
    const startsAt = readInstant(body.startsAt)
    if (!startsAt) return { error: 'Thời điểm bắt đầu phải theo ISO 8601 và có múi giờ (Z hoặc +07:00).' }
    values.starts_at = startsAt
  }
  if (!partial || body.endsAt !== undefined) {
    const endsAt = readInstant(body.endsAt)
    if (!endsAt) return { error: 'Thời điểm kết thúc phải theo ISO 8601 và có múi giờ (Z hoặc +07:00).' }
    values.ends_at = endsAt
  }
  if (body.bannerUrl !== undefined) {
    if (!bannerIsAllowed(body.bannerUrl)) return { error: 'Banner chỉ nhận đường dẫn /uploads/ hoặc https, tối đa 500 ký tự.' }
    values.banner_url = body.bannerUrl || null
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') return { error: 'isActive phải là true hoặc false.' }
    values.is_active = body.isActive ? 1 : 0
  }
  if (partial && !Object.keys(values).length) return { error: 'Không có trường nào để cập nhật.' }
  if (values.starts_at && values.ends_at && values.ends_at <= values.starts_at) return { error: 'Thời điểm kết thúc phải sau thời điểm bắt đầu.' }
  return { values }
}

/**
 * Danh sách mọi chiến dịch (cả đã tắt hoặc đã kết thúc) kèm số đăng ký theo trạng thái.
 */
export async function listAdminCampaigns(req, res, next) {
  try {
    const page = readPagination(req.query)
    if (!page || !validId(req.query.userId)) return invalid(res, 'Bộ lọc chiến dịch không hợp lệ.')
    if (!(await requireAdmin(executeQuery, req.query.userId))) return forbidden(res)

    const [counts, rows] = await Promise.all([
      executeQuery('SELECT COUNT(*) AS total FROM marketing_campaigns'),
      executeQuery(
        `SELECT c.id, c.name, c.type, c.description, c.starts_at, c.ends_at, c.banner_url, c.is_active,
                COALESCE(SUM(r.status = 'pending'), 0) AS pending,
                COALESCE(SUM(r.status = 'approved'), 0) AS approved,
                COALESCE(SUM(r.status = 'rejected'), 0) AS rejected
         FROM marketing_campaigns c
         LEFT JOIN campaign_registrations r ON r.campaign_id = c.id
         GROUP BY c.id, c.name, c.type, c.description, c.starts_at, c.ends_at, c.banner_url, c.is_active
         ORDER BY c.starts_at DESC, c.id DESC
         LIMIT ? OFFSET ?`,
        [page.limit, page.offset],
      ),
    ])
    return res.status(200).json({
      success: true,
      data: { items: rows.map(toCampaign), total: Number(counts[0]?.total || 0), limit: page.limit, offset: page.offset },
    })
  } catch (err) {
    return next(err)
  }
}

export async function createAdminCampaign(req, res, next) {
  try {
    const { error, values } = readCampaign(req.body, { partial: false })
    if (error) return invalid(res, error)
    if (!validId(String(req.body.userId ?? ''))) return invalid(res, 'Thiếu thông tin quản trị viên.')
    if (!(await requireAdmin(executeQuery, String(req.body.userId)))) return forbidden(res)

    const columns = { is_active: 1, ...values }
    const names = Object.keys(columns)
    const inserted = await executeQuery(
      `INSERT INTO marketing_campaigns (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
      names.map((name) => columns[name]),
    )
    const rows = await executeQuery(
      `SELECT id, name, type, description, starts_at, ends_at, banner_url, is_active FROM marketing_campaigns WHERE id = ?`,
      [inserted.insertId],
    )
    return res.status(201).json({ success: true, message: 'Đã tạo chiến dịch.', data: toCampaign(rows[0]) })
  } catch (err) {
    return next(err)
  }
}

export async function updateAdminCampaign(req, res, next) {
  try {
    const { campaignId } = req.params
    const { error, values } = readCampaign(req.body, { partial: true })
    if (error || !validId(campaignId)) return invalid(res, error || 'Mã chiến dịch không hợp lệ.')
    if (!validId(String(req.body.userId ?? ''))) return invalid(res, 'Thiếu thông tin quản trị viên.')

    const result = await executeTransaction(async (query) => {
      if (!(await requireAdmin(query, String(req.body.userId)))) return { error: 'ADMIN_REQUIRED' }
      const rows = await query('SELECT id, starts_at, ends_at FROM marketing_campaigns WHERE id = ? FOR UPDATE', [campaignId])
      if (!rows.length) return { error: 'CAMPAIGN_NOT_FOUND' }
      // Kiểm tra lại khoảng thời gian sau khi ghép với giá trị đang lưu
      const startsAt = values.starts_at || new Date(rows[0].starts_at)
      const endsAt = values.ends_at || new Date(rows[0].ends_at)
      if (endsAt <= startsAt) return { error: 'INVALID_RANGE' }
      const names = Object.keys(values)
      await query(`UPDATE marketing_campaigns SET ${names.map((name) => `${name} = ?`).join(', ')} WHERE id = ?`, [...names.map((name) => values[name]), campaignId])
      const saved = await query('SELECT id, name, type, description, starts_at, ends_at, banner_url, is_active FROM marketing_campaigns WHERE id = ?', [campaignId])
      return { campaign: toCampaign(saved[0]) }
    })

    if (result.error === 'ADMIN_REQUIRED') return forbidden(res)
    if (result.error === 'CAMPAIGN_NOT_FOUND') return fail(res, 404, 'CAMPAIGN_NOT_FOUND', 'Không tìm thấy chiến dịch.')
    if (result.error === 'INVALID_RANGE') return invalid(res, 'Thời điểm kết thúc phải sau thời điểm bắt đầu.')
    return res.status(200).json({ success: true, message: 'Đã cập nhật chiến dịch.', data: result.campaign })
  } catch (err) {
    return next(err)
  }
}

/**
 * Danh sách đăng ký tham gia chiến dịch của mọi shop. Bộ lọc: campaignId, status (mặc định mọi trạng thái).
 */
export async function listAdminCampaignRegistrations(req, res, next) {
  try {
    const { userId, campaignId, status } = req.query
    const page = readPagination(req.query)
    if (!page || !validId(userId) || (campaignId !== undefined && !validId(campaignId)) ||
        (status !== undefined && !REGISTRATION_STATUSES.includes(status))) {
      return invalid(res, 'Bộ lọc đăng ký chiến dịch không hợp lệ.')
    }
    if (!(await requireAdmin(executeQuery, userId))) return forbidden(res)

    let where = '1 = 1'
    const params = []
    if (campaignId !== undefined) { where += ' AND r.campaign_id = ?'; params.push(campaignId) }
    if (status !== undefined) { where += ' AND r.status = ?'; params.push(status) }

    const [counts, rows] = await Promise.all([
      executeQuery(`SELECT COUNT(*) AS total FROM campaign_registrations r WHERE ${where}`, params),
      executeQuery(
        `SELECT r.id, r.campaign_id, r.shop_id, r.product_id, r.discount_price, r.status, r.note, r.created_at, r.updated_at,
                c.name AS campaign_name, c.type AS campaign_type, c.starts_at, c.ends_at,
                s.name AS shop_name, p.name AS product_name,
                (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id = r.product_id AND v.is_active = 1) AS current_price
         FROM campaign_registrations r
         JOIN marketing_campaigns c ON c.id = r.campaign_id
         JOIN shops s ON s.id = r.shop_id
         JOIN products p ON p.id = r.product_id
         WHERE ${where}
         ORDER BY (r.status = 'pending') DESC, r.id DESC
         LIMIT ? OFFSET ?`,
        [...params, page.limit, page.offset],
      ),
    ])
    return res.status(200).json({
      success: true,
      data: {
        items: rows.map((r) => ({
          id: String(r.id),
          campaignId: String(r.campaign_id),
          campaignName: r.campaign_name,
          campaignType: r.campaign_type,
          campaignStartsAt: new Date(r.starts_at).toISOString(),
          campaignEndsAt: new Date(r.ends_at).toISOString(),
          shopId: String(r.shop_id),
          shopName: r.shop_name,
          productId: String(r.product_id),
          productName: r.product_name,
          currentPrice: r.current_price === null ? null : Number(r.current_price),
          discountPrice: Number(r.discount_price),
          status: r.status,
          note: r.note,
          createdAt: new Date(r.created_at).toISOString(),
          updatedAt: new Date(r.updated_at).toISOString(),
        })),
        total: Number(counts[0]?.total || 0),
        limit: page.limit,
        offset: page.offset,
      },
    })
  } catch (err) {
    return next(err)
  }
}

/**
 * Admin duyệt hoặc từ chối một đăng ký đang chờ. Từ chối bắt buộc có lý do (note).
 * Trả thông tin chủ shop để Backend gửi thông báo.
 */
export async function reviewCampaignRegistration(req, res, next) {
  try {
    const { registrationId } = req.params
    const { userId, status } = req.body || {}
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : req.body?.note
    if (!validId(registrationId) || !validId(String(userId ?? '')) || !['approved', 'rejected'].includes(status) ||
        (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 255)) ||
        (status === 'rejected' && !note)) {
      return invalid(res, 'Cần chọn duyệt hoặc từ chối; từ chối phải kèm lý do tối đa 255 ký tự.')
    }

    const result = await executeTransaction(async (query) => {
      if (!(await requireAdmin(query, String(userId)))) return { error: 'ADMIN_REQUIRED' }
      const rows = await query(
        `SELECT r.id, r.campaign_id, r.shop_id, r.product_id, r.status, c.name AS campaign_name, c.is_active,
                (c.ends_at > UTC_TIMESTAMP(3)) AS running, s.owner_id, p.name AS product_name, p.status AS product_status,
                p.approval_status AS product_approval
         FROM campaign_registrations r
         JOIN marketing_campaigns c ON c.id = r.campaign_id
         JOIN shops s ON s.id = r.shop_id
         JOIN products p ON p.id = r.product_id
         WHERE r.id = ? FOR UPDATE`,
        [registrationId],
      )
      if (!rows.length) return { error: 'REGISTRATION_NOT_FOUND' }
      const reg = rows[0]
      if (reg.status !== 'pending') return { error: 'REGISTRATION_ALREADY_REVIEWED', current: reg.status }
      if (status === 'approved') {
        if (!Number(reg.is_active) || !Number(reg.running)) return { error: 'CAMPAIGN_ENDED' }
        if (reg.product_status !== 'active' || reg.product_approval !== 'approved') return { error: 'PRODUCT_NOT_ELIGIBLE' }
      }
      await query('UPDATE campaign_registrations SET status = ?, note = ? WHERE id = ? AND status = \'pending\'', [status, note || null, registrationId])
      return {
        registration: {
          id: String(reg.id),
          campaignId: String(reg.campaign_id),
          campaignName: reg.campaign_name,
          shopId: String(reg.shop_id),
          ownerId: String(reg.owner_id),
          productId: String(reg.product_id),
          productName: reg.product_name,
          status,
          note: note || null,
        },
      }
    })

    const errors = {
      ADMIN_REQUIRED: () => forbidden(res),
      REGISTRATION_NOT_FOUND: () => fail(res, 404, 'REGISTRATION_NOT_FOUND', 'Không tìm thấy đăng ký.'),
      REGISTRATION_ALREADY_REVIEWED: () => fail(res, 409, 'REGISTRATION_ALREADY_REVIEWED', 'Đăng ký này đã được xử lý.'),
      CAMPAIGN_ENDED: () => fail(res, 409, 'CAMPAIGN_ENDED', 'Chiến dịch đã kết thúc hoặc đang tắt nên không thể duyệt.'),
      PRODUCT_NOT_ELIGIBLE: () => fail(res, 409, 'PRODUCT_NOT_ELIGIBLE', 'Sản phẩm không còn đang bán hoặc chưa được kiểm duyệt.'),
    }
    if (result.error) return errors[result.error]()
    return res.status(200).json({
      success: true,
      message: status === 'approved' ? 'Đã duyệt đăng ký.' : 'Đã từ chối đăng ký.',
      data: result.registration,
    })
  } catch (err) {
    return next(err)
  }
}
