import bcrypt from 'bcryptjs'
import { executeQuery, executeWithConnection } from '../config/database.js'

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
      SELECT u.id, u.username, u.password_hash, u.full_name, u.email, u.phone, u.avatar_url, u.role, u.status, s.id AS shop_id
      FROM users u
      LEFT JOIN shops s ON s.owner_id = u.id
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
        },
      },
    })
  } catch (err) {
    next(err)
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
      SELECT u.id, u.username, u.full_name, u.email, u.phone, u.avatar_url, u.role, u.status, s.id AS shop_id
      FROM users u
      LEFT JOIN shops s ON s.owner_id = u.id
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
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /internal/v1/auth/register
 * Đăng ký tài khoản người mua hoặc người bán mới vào cơ sở dữ liệu MySQL.
 */
export async function registerUser(req, res, next) {
  try {
    const {
      username,
      password,
      fullName,
      email,
      phone,
      role = 'buyer',
      shopName,
      shopTagline,
    } = req.body || {}

    // 1. Kiểm tra username
    if (
      typeof username !== 'string' ||
      username.trim().length < 3 ||
      username.trim().length > 50 ||
      !/^[a-zA-Z0-9_.-]+$/.test(username.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập không hợp lệ (từ 3 đến 50 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang).',
        error: { code: 'INVALID_USERNAME' },
      })
    }

    // 2. Kiểm tra password
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự.',
        error: { code: 'INVALID_PASSWORD' },
      })
    }

    if (Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu vượt quá giới hạn 72 bytes UTF-8.',
        error: { code: 'INVALID_PASSWORD' },
      })
    }

    // 3. Kiểm tra fullName
    if (typeof fullName !== 'string' || fullName.trim().length === 0 || fullName.trim().length > 120) {
      return res.status(400).json({
        success: false,
        message: 'Họ và tên là bắt buộc và không quá 120 ký tự.',
        error: { code: 'INVALID_FULLNAME' },
      })
    }

    // 4. Kiểm tra role
    if (role !== 'buyer' && role !== 'seller') {
      return res.status(400).json({
        success: false,
        message: 'Vai trò người dùng phải là buyer hoặc seller.',
        error: { code: 'INVALID_ROLE' },
      })
    }

    // 5. Kiểm tra shopName nếu là seller
    if (role === 'seller' && (typeof shopName !== 'string' || shopName.trim().length === 0 || shopName.trim().length > 160)) {
      return res.status(400).json({
        success: false,
        message: 'Người bán cần cung cấp tên gian hàng hợp lệ (tối đa 160 ký tự).',
        error: { code: 'INVALID_SHOP_NAME' },
      })
    }

    // 6. Chuẩn hóa dữ liệu
    const normalizedUsername = username.trim().toLowerCase()
    const normalizedEmail = email && typeof email === 'string' && email.trim().length > 0
      ? email.trim().toLowerCase()
      : null
    const cleanedPhone = phone && typeof phone === 'string' && phone.trim().length > 0
      ? phone.trim().slice(0, 20)
      : null
    const trimmedFullName = fullName.trim()

    // 7. Kiểm tra trùng lặp username
    const existingUsers = await executeQuery(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [normalizedUsername]
    )
    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Tên đăng nhập đã tồn tại trong hệ thống.',
        error: { code: 'USERNAME_EXISTS' },
      })
    }

    // 8. Kiểm tra trùng lặp email nếu có cung cấp
    if (normalizedEmail) {
      const existingEmail = await executeQuery(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [normalizedEmail]
      )
      if (existingEmail && existingEmail.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email đã được đăng ký cho tài khoản khác.',
          error: { code: 'EMAIL_EXISTS' },
        })
      }
    }

    // 9. Băm mật khẩu bằng bcrypt cost 12
    const passwordHash = await bcrypt.hash(password, 12)

    // 10. Thực thi ghi dữ liệu an toàn trong transaction
    const createdUser = await executeWithConnection(async (conn, remainingTime) => {
      return new Promise((resolve, reject) => {
        conn.beginTransaction((beginErr) => {
          if (beginErr) return reject(beginErr)

          const insertUserSql = `
            INSERT INTO users (username, password_hash, full_name, email, phone, role, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
          `
          conn.query(
            { sql: insertUserSql, timeout: remainingTime },
            [normalizedUsername, passwordHash, trimmedFullName, normalizedEmail, cleanedPhone, role],
            (userErr, userResult) => {
              if (userErr) {
                if (userErr.code === 'ER_DUP_ENTRY') {
                  return conn.rollback(() => {
                    const conflictErr = new Error('Tên đăng nhập hoặc email đã tồn tại.')
                    conflictErr.statusCode = 409
                    conflictErr.code = 'CONFLICT'
                    reject(conflictErr)
                  })
                }
                return conn.rollback(() => reject(userErr))
              }

              const newUserId = userResult.insertId

              if (role === 'seller') {
                const baseSlug = String(shopName)
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .toLowerCase()
                  .replace(/[đĐ]/g, 'd')
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '') || `shop-${newUserId}`

                const uniqueSlug = `${baseSlug}-${newUserId}`.slice(0, 160)
                const trimmedShopName = shopName.trim().slice(0, 160)
                const trimmedTagline = shopTagline && typeof shopTagline === 'string'
                  ? shopTagline.trim().slice(0, 255)
                  : null

                const insertShopSql = `
                  INSERT INTO shops (owner_id, slug, name, tagline, province, status)
                  VALUES (?, ?, ?, ?, 'Toàn quốc', 'active')
                `
                conn.query(
                  { sql: insertShopSql, timeout: remainingTime },
                  [newUserId, uniqueSlug, trimmedShopName, trimmedTagline],
                  (shopErr, shopResult) => {
                    if (shopErr) {
                      return conn.rollback(() => reject(shopErr))
                    }

                    conn.commit((commitErr) => {
                      if (commitErr) {
                        return conn.rollback(() => reject(commitErr))
                      }
                      resolve({
                        id: String(newUserId),
                        username: normalizedUsername,
                        fullName: trimmedFullName,
                        email: normalizedEmail,
                        phone: cleanedPhone,
                        avatarUrl: null,
                        role,
                        status: 'active',
                        shopId: String(shopResult.insertId),
                      })
                    })
                  }
                )
              } else {
                conn.commit((commitErr) => {
                  if (commitErr) {
                    return conn.rollback(() => reject(commitErr))
                  }
                  resolve({
                    id: String(newUserId),
                    username: normalizedUsername,
                    fullName: trimmedFullName,
                    email: normalizedEmail,
                    phone: cleanedPhone,
                    avatarUrl: null,
                    role,
                    status: 'active',
                    shopId: null,
                  })
                })
              }
            }
          )
        })
      })
    })

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công.',
      data: {
        user: createdUser,
      },
    })
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: err.message,
        error: { code: err.code || 'CONFLICT' },
      })
    }
    next(err)
  }
}
