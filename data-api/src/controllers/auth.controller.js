import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { executeQuery, executeTransaction } from '../config/database.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_PATTERN.test(value.trim())
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 140) || 'shop'
}

/**
 * Tạo một dummy hash hợp lệ chuẩn bcrypt cost 12 khi khởi động module.
 * Dummy hash này được dùng để chạy bcrypt.compare khi username không tồn tại,
 * nhằm ngăn chặn kỹ thuật tấn công kênh phụ đo lường thời gian (timing side-channel attack).
 */
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('dummy_timing_salt_shopnova_credential_protection', 12)

/**
 * POST /internal/v1/auth/verify-credentials
 * Xác thực thông tin đăng nhập của người dùng.
 * - Nhận { username, password }.
 * - Validate kiểu dữ liệu và giới hạn 72 byte UTF-8 của bcrypt.
 * - Tra cứu cơ sở dữ liệu có tham số.
 * - So sánh bcrypt hash bất đồng bộ.
 * - Nếu sai tài khoản, sai mật khẩu, hoặc status 'blocked': trả 401 INVALID_CREDENTIALS cố định.
 * - Tuyệt đối không trả về password_hash hoặc ghi thông tin mật ra log.
 */
export async function verifyCredentials(req, res, next) {
  try {
    const { username, password } = req.body || {}

    // Kiểm tra định dạng dữ liệu đầu vào
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu yêu cầu không hợp lệ.',
        error: {
          code: 'VALIDATION_ERROR',
        },
      })
    }

    // Kiểm tra giới hạn 72 byte UTF-8 của thuật toán bcrypt
    // bcrypt tự động bỏ qua các byte sau 72, vì vậy cần từ chối ngay lập tức thay vì âm thầm cắt ngắn
    if (Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
        error: {
          code: 'INVALID_CREDENTIALS',
        },
      })
    }

    const normalizedUsername = username.trim().toLowerCase()

    // Truy vấn thông tin người dùng theo username đã chuẩn hóa
    const sql = `
      SELECT u.id, u.username, u.password_hash, u.full_name, u.email, u.phone, u.avatar_url, u.role, u.status,
             s.id AS shop_id, a.recipient_name, a.phone AS address_phone, a.province, a.district, a.ward, a.detail
      FROM users u
      LEFT JOIN shops s ON s.owner_id = u.id
      LEFT JOIN addresses a ON a.user_id = u.id AND a.is_default = 1 AND a.deleted_at IS NULL
      WHERE u.username = ?
      LIMIT 1
    `

    const rows = await executeQuery(sql, [normalizedUsername])

    // Trường hợp 1: Không tìm thấy người dùng
    if (!rows || rows.length === 0) {
      // Thực thi compare với dummy hash để bảo đảm thời gian phản hồi đồng nhất
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH)
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
        error: {
          code: 'INVALID_CREDENTIALS',
        },
      })
    }

    const user = rows[0]

    // Trường hợp 2: Có user, tiến hành so sánh hash
    let isMatch = false
    try {
      if (typeof user.password_hash === 'string' && user.password_hash.length > 0) {
        isMatch = await bcrypt.compare(password, user.password_hash)
      }
    } catch {
      isMatch = false
    }

    // Nếu mật khẩu không khớp hoặc tài khoản đang bị khóa (status = 'blocked')
    if (!isMatch || user.status === 'blocked') {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
        error: {
          code: 'INVALID_CREDENTIALS',
        },
      })
    }

    // Trường hợp 3: Xác thực thành công và tài khoản hoạt động bình thường
    return res.status(200).json({
      success: true,
      message: 'Xác thực thông tin đăng nhập thành công.',
      data: {
        user: {
          id: String(user.id),
          username: user.username,
          fullName: user.full_name,
          email: user.email !== null && user.email !== undefined ? user.email : null,
          phone: user.phone !== null && user.phone !== undefined ? user.phone : null,
          avatarUrl: user.avatar_url !== null && user.avatar_url !== undefined ? user.avatar_url : null,
          role: user.role,
          status: user.status,
          shopId: user.shop_id !== null && user.shop_id !== undefined ? String(user.shop_id) : null,
          address: user.recipient_name ? {
            fullName: user.recipient_name,
            phone: user.address_phone,
            province: user.province,
            district: user.district || '',
            ward: user.ward || '',
            detail: user.detail,
          } : null,
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /internal/v1/auth/google
 * Create or load the MySQL account for a Firebase identity verified by Backend.
 */
export async function loginWithGoogle(req, res, next) {
  const body = req.body || {}
  const firebaseUid = typeof body.firebaseUid === 'string' ? body.firebaseUid.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : ''

  if (
    !firebaseUid ||
    firebaseUid.length > 128 ||
    !validEmail(email) ||
    (fullName && fullName.length > 120) ||
    (avatarUrl && avatarUrl.length > 1024)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Thông tin tài khoản Google không hợp lệ.',
      error: { code: 'VALIDATION_ERROR' },
    })
  }

  const findByFirebaseUid = () => executeQuery(
    `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.avatar_url, u.role, u.status,
            s.id AS shop_id, a.recipient_name, a.phone AS address_phone, a.province, a.district, a.ward, a.detail
     FROM users u
     LEFT JOIN shops s ON s.owner_id = u.id
     LEFT JOIN addresses a ON a.user_id = u.id AND a.is_default = 1 AND a.deleted_at IS NULL
     WHERE u.firebase_uid = ?
     LIMIT 1`,
    [firebaseUid],
  )

  const respondWithUser = (user) => {
    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đang bị khóa.',
        error: { code: 'ACCOUNT_BLOCKED' },
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập Google thành công.',
      data: {
        user: {
          id: String(user.id),
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatar_url,
          role: user.role,
          status: user.status,
          shopId: user.shop_id === null || user.shop_id === undefined ? null : String(user.shop_id),
          address: user.recipient_name ? {
            fullName: user.recipient_name,
            phone: user.address_phone,
            province: user.province,
            district: user.district || '',
            ward: user.ward || '',
            detail: user.detail,
          } : null,
        },
      },
    })
  }

  try {
    const existingUsers = await findByFirebaseUid()
    if (existingUsers.length) return respondWithUser(existingUsers[0])

    const emailUsers = await executeQuery('SELECT id, status FROM users WHERE email = ? LIMIT 1', [email])
    if (emailUsers.length) {
      await executeQuery(
        'UPDATE users SET firebase_uid = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?',
        [firebaseUid, avatarUrl || null, emailUsers[0].id],
      )
      const linkedUsers = await findByFirebaseUid()
      if (linkedUsers.length) return respondWithUser(linkedUsers[0])
    }

    const username = `g_${crypto.createHash('sha256').update(firebaseUid).digest('hex').slice(0, 32)}`
    const fullNameValue = fullName || email.split('@')[0]
    const passwordHash = await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 12)

    await executeQuery(
      `INSERT INTO users (username, password_hash, firebase_uid, full_name, email, avatar_url, role, status)
       VALUES (?, ?, ?, ?, ?, ?, 'buyer', 'active')`,
      [username, passwordHash, firebaseUid, fullNameValue, email, avatarUrl || null],
    )

    const createdUsers = await findByFirebaseUid()
    if (!createdUsers.length) {
      throw new Error('Google account insert completed without a readable user record.')
    }
    return respondWithUser(createdUsers[0])
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      try {
        const users = await findByFirebaseUid()
        if (users.length) return respondWithUser(users[0])
      } catch (lookupError) {
        return next(lookupError)
      }
      return res.status(409).json({
        success: false,
        message: 'Email này đã thuộc một tài khoản Nova Shop. Hãy đăng nhập bằng tài khoản hiện có.',
        error: { code: 'EMAIL_ACCOUNT_EXISTS' },
      })
    }
    return next(err)
  }
}

/**
 * GET /internal/v1/users/:userId/auth-profile
 * Lấy hồ sơ xác thực tài khoản phục vụ kiểm tra token và phân quyền.
 */
export async function getUserAuthProfile(req, res, next) {
  try {
    const { userId } = req.params

    // Kiểm tra định dạng tham số userId (chuỗi số nguyên)
    if (!userId || typeof userId !== 'string' || !/^\d+$/.test(userId.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Mã định danh người dùng không hợp lệ.',
        error: {
          code: 'INVALID_PARAMS',
        },
      })
    }

    const sql = `
      SELECT u.id, u.username, u.full_name, u.email, u.phone, u.avatar_url, u.role, u.status,
             s.id AS shop_id, a.recipient_name, a.phone AS address_phone, a.province, a.district, a.ward, a.detail
      FROM users u
      LEFT JOIN shops s ON s.owner_id = u.id
      LEFT JOIN addresses a ON a.user_id = u.id AND a.is_default = 1 AND a.deleted_at IS NULL
      WHERE u.id = ?
      LIMIT 1
    `

    const rows = await executeQuery(sql, [userId.trim()])

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
        error: {
          code: 'USER_NOT_FOUND',
        },
      })
    }

    const user = rows[0]

    return res.status(200).json({
      success: true,
      message: 'Lấy hồ sơ xác thực thành công.',
      data: {
        user: {
          id: String(user.id),
          username: user.username,
          fullName: user.full_name,
          email: user.email !== null && user.email !== undefined ? user.email : null,
          phone: user.phone !== null && user.phone !== undefined ? user.phone : null,
          avatarUrl: user.avatar_url !== null && user.avatar_url !== undefined ? user.avatar_url : null,
          role: user.role,
          status: user.status,
          shopId: user.shop_id !== null && user.shop_id !== undefined ? String(user.shop_id) : null,
          address: user.recipient_name ? {
            fullName: user.recipient_name,
            phone: user.address_phone,
            province: user.province,
            district: user.district || '',
            ward: user.ward || '',
            detail: user.detail,
          } : null,
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /internal/v1/auth/register
 */
export async function registerUser(req, res, next) {
  try {
    const body = req.body || {}
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const shopTagline = typeof body.shopTagline === 'string' ? body.shopTagline.trim() : ''
    const role = body.role
    const password = body.password
    const rawAddress = body.address
    const address = rawAddress && typeof rawAddress === 'object' && !Array.isArray(rawAddress)
      ? {
          fullName: typeof rawAddress.fullName === 'string' ? rawAddress.fullName.trim() : '',
          phone: typeof rawAddress.phone === 'string' ? rawAddress.phone.trim() : '',
          province: typeof rawAddress.province === 'string' ? rawAddress.province.trim() : '',
          district: typeof rawAddress.district === 'string' ? rawAddress.district.trim() : '',
          ward: typeof rawAddress.ward === 'string' ? rawAddress.ward.trim() : '',
          detail: typeof rawAddress.detail === 'string' ? rawAddress.detail.trim() : '',
        }
      : null
    const invalidAddress = rawAddress !== undefined && rawAddress !== null && (
      !address || !address.fullName || address.fullName.length > 120 || !address.phone || address.phone.length > 20 ||
      !address.province || address.province.length > 120 || address.district.length > 120 || address.ward.length > 120 ||
      !address.detail || address.detail.length > 255
    )

    if (
      !/^[a-z0-9_]{3,50}$/.test(username) ||
      !fullName ||
      fullName.length > 120 ||
      !validEmail(email) ||
      invalidAddress ||
      (phone && phone.length > 20) ||
      (phone && !/^[+()\d .-]{8,20}$/.test(phone)) ||
      shopTagline.length > 255 ||
      !['buyer', 'seller'].includes(role) ||
      (role === 'seller' && (typeof body.shopName !== 'string' || !body.shopName.trim() || body.shopName.trim().length > 160)) ||
      typeof password !== 'string' ||
      password.length < 8 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        success: false,
        message: !validEmail(email) ? 'Vui lòng nhập email hợp lệ.' : 'Thông tin đăng ký không hợp lệ.',
        error: { code: !validEmail(email) ? 'INVALID_EMAIL' : 'VALIDATION_ERROR' },
      })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const shopSlug = role === 'seller'
      ? `${slugify(body.shopName)}-${crypto.randomBytes(4).toString('hex')}`
      : null
    const user = await executeTransaction(async (query) => {
      const userResult = await query(
        `INSERT INTO users (username, password_hash, full_name, email, phone, role)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [username, passwordHash, fullName, email, phone || null, role],
      )
      const userId = String(userResult.insertId)
      let shopId = null
      if (role === 'seller') {
        const shopResult = await query(
          `INSERT INTO shops (owner_id, slug, name, tagline, province, status)
           VALUES (?, ?, ?, ?, 'TP. Hồ Chí Minh', 'active')`,
          [userId, shopSlug, body.shopName.trim(), shopTagline || null],
        )
        shopId = String(shopResult.insertId)
      }
      if (address) {
        await query(
          `INSERT INTO addresses (user_id, recipient_name, phone, province, district, ward, detail, is_default)
           VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
          [userId, address.fullName, address.phone, address.province, address.district || null, address.ward || null, address.detail],
        )
      }
      return {
        id: userId,
        username,
        fullName,
        email,
        phone: phone || null,
        avatarUrl: null,
        role,
        status: 'active',
        shopId,
        address,
      }
    })

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công.',
      data: { user },
    })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const constraint = String(err.constraint || err.sqlMessage || '')
      const emailConflict = constraint.includes('uq_users_email')
      const phoneConflict = constraint.includes('uq_users_phone')
      return res.status(409).json({
        success: false,
        message: emailConflict ? 'Email này đã được sử dụng.' : phoneConflict ? 'Số điện thoại này đã được sử dụng.' : 'Tên đăng nhập này đã được sử dụng.',
        error: { code: emailConflict ? 'EMAIL_TAKEN' : phoneConflict ? 'PHONE_TAKEN' : 'USERNAME_TAKEN' },
      })
    }
    return next(err)
  }
}

/**
 * PUT /internal/v1/users/:userId/profile
 */
export async function updateUserProfile(req, res, next) {
  try {
    const userId = req.params.userId
    const body = req.body || {}
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const avatarUrl = body.avatarUrl === null ? null : typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : undefined
    const address = body.address
    if (address !== undefined && (
      !address ||
      typeof address !== 'object' ||
      typeof address.fullName !== 'string' ||
      !address.fullName.trim() ||
      address.fullName.trim().length > 120 ||
      typeof address.phone !== 'string' ||
      !address.phone.trim() ||
      address.phone.trim().length > 20 ||
      typeof address.province !== 'string' ||
      !address.province.trim() ||
      address.province.trim().length > 120 ||
      typeof address.detail !== 'string' ||
      !address.detail.trim() ||
      address.detail.trim().length > 255 ||
      (address.district && (typeof address.district !== 'string' || address.district.trim().length > 120)) ||
      (address.ward && (typeof address.ward !== 'string' || address.ward.trim().length > 120))
    )) {
      return res.status(400).json({
        success: false,
        message: 'Địa chỉ nhận hàng không hợp lệ.',
        error: { code: 'INVALID_ADDRESS' },
      })
    }

    if (
      !fullName ||
      fullName.length > 120 ||
      !validEmail(email) ||
      (phone && phone.length > 20) ||
      (avatarUrl !== undefined && avatarUrl.length > 1024)
    ) {
      return res.status(400).json({
        success: false,
        message: !validEmail(email) ? 'Vui lòng nhập email hợp lệ.' : 'Thông tin hồ sơ không hợp lệ.',
        error: { code: !validEmail(email) ? 'INVALID_EMAIL' : 'VALIDATION_ERROR' },
      })
    }

    const user = await executeTransaction(async (query) => {
      await query(
        `UPDATE users SET full_name = ?, email = ?, phone = ?, avatar_url = ?
         WHERE id = ? AND status = 'active'`,
        [fullName, email, phone || null, avatarUrl ?? null, userId],
      )
      const users = await query(
        `SELECT id FROM users WHERE id = ? AND status = 'active' FOR UPDATE`,
        [userId],
      )
      if (!users.length) return null
      if (address !== undefined) {
        const addresses = await query(
          `SELECT id FROM addresses WHERE user_id = ? AND is_default = 1 AND deleted_at IS NULL FOR UPDATE`,
          [userId],
        )
        const addressValues = [
          address.fullName.trim(),
          address.phone.trim(),
          address.province.trim(),
          address.district?.trim() || null,
          address.ward?.trim() || null,
          address.detail.trim(),
        ]
        if (addresses.length) {
          await query(
            `UPDATE addresses SET recipient_name = ?, phone = ?, province = ?, district = ?, ward = ?, detail = ?
             WHERE id = ?`,
            [...addressValues, addresses[0].id],
          )
        } else {
          await query(
            `INSERT INTO addresses (user_id, recipient_name, phone, province, district, ward, detail, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [userId, ...addressValues],
          )
        }
      }

      const rows = await query(
        `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.avatar_url, u.role, u.status,
                s.id AS shop_id, a.recipient_name, a.phone AS address_phone, a.province, a.district, a.ward, a.detail
         FROM users u
         LEFT JOIN shops s ON s.owner_id = u.id
         LEFT JOIN addresses a ON a.user_id = u.id AND a.is_default = 1 AND a.deleted_at IS NULL
         WHERE u.id = ? LIMIT 1`,
        [userId],
      )
      return rows[0]
    })
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản.',
        error: { code: 'USER_NOT_FOUND' },
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ thành công.',
      data: {
        user: {
          id: String(user.id),
          username: user.username,
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatar_url,
          role: user.role,
          status: user.status,
          shopId: user.shop_id === null ? null : String(user.shop_id),
          address: user.recipient_name ? {
            fullName: user.recipient_name,
            phone: user.address_phone,
            province: user.province,
            district: user.district || '',
            ward: user.ward || '',
            detail: user.detail,
          } : null,
        },
      },
    })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const constraint = String(err.constraint || err.sqlMessage || '')
      const phoneConflict = constraint.includes('uq_users_phone')
      return res.status(409).json({
        success: false,
        message: phoneConflict ? 'Số điện thoại này đã được sử dụng.' : 'Email này đã được sử dụng.',
        error: { code: phoneConflict ? 'PHONE_TAKEN' : 'EMAIL_TAKEN' },
      })
    }
    return next(err)
  }
}

export async function createSellerShop(req, res, next) {
  try {
    const userId = req.params.userId
    const shopName = typeof req.body?.shopName === 'string' ? req.body.shopName.trim() : ''
    if (!/^[1-9]\d{0,19}$/.test(userId) || !shopName || shopName.length > 160) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên gian hàng hợp lệ (tối đa 160 ký tự).',
        error: { code: 'INVALID_SHOP_NAME' },
      })
    }

    const result = await executeTransaction(async (query) => {
      const users = await query(
        `SELECT id, username, full_name, email, phone, avatar_url, role, status
         FROM users WHERE id = ? FOR UPDATE`,
        [userId],
      )
      if (!users.length || users[0].status !== 'active') return { error: 'USER_NOT_FOUND' }

      // 1. Kiểm tra trùng tên gian hàng với gian hàng của người khác (case-insensitive)
      const duplicateShops = await query(
        `SELECT id FROM shops WHERE LOWER(name) = LOWER(?) AND owner_id <> ? LIMIT 1`,
        [shopName, userId],
      )
      if (duplicateShops.length > 0) {
        return { error: 'DUPLICATE_SHOP_NAME' }
      }

      // 2. Kiểm tra xem người dùng đã sở hữu gian hàng hay chưa (tránh tạo trùng lặp)
      const existingShops = await query('SELECT id, name FROM shops WHERE owner_id = ? FOR UPDATE', [userId])
      let shopId
      if (existingShops.length) {
        shopId = String(existingShops[0].id)
      } else {
        const shopSlug = `${slugify(shopName)}-${crypto.randomBytes(4).toString('hex')}`
        const shop = await query(
          `INSERT INTO shops (owner_id, slug, name, province, status)
           VALUES (?, ?, ?, 'TP. Hồ Chí Minh', 'active')`,
          [userId, shopSlug, shopName],
        )
        shopId = String(shop.insertId)
      }

      // 3. Phân quyền: Người dùng buyer được nâng cấp thành seller; Admin giữ nguyên quyền admin
      const nextRole = users[0].role === 'admin' ? 'admin' : 'seller'
      if (users[0].role !== nextRole) {
        await query(`UPDATE users SET role = ? WHERE id = ?`, [nextRole, userId])
      }

      return {
        user: {
          id: String(users[0].id),
          username: users[0].username,
          fullName: users[0].full_name,
          email: users[0].email,
          phone: users[0].phone,
          avatarUrl: users[0].avatar_url,
          role: nextRole,
          status: users[0].status,
          shopId,
        },
      }
    })

    if (result.error === 'USER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản đang hoạt động.',
        error: { code: 'USER_NOT_FOUND' },
      })
    }
    if (result.error === 'DUPLICATE_SHOP_NAME') {
      return res.status(400).json({
        success: false,
        message: 'Tên gian hàng này đã được sử dụng bởi người bán khác. Vui lòng chọn tên khác.',
        error: { code: 'DUPLICATE_SHOP_NAME' },
      })
    }
    return res.status(200).json({
      success: true,
      message: 'Đã mở gian hàng thành công.',
      data: { user: result.user },
    })
  } catch (err) {
    return next(err)
  }
}
