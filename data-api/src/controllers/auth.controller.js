import bcrypt from 'bcryptjs'
import { executeQuery } from '../config/database.js'

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
