import { verifyCredentials, registerUser, updateUserProfile, DataApiClientError } from '../clients/data.client.js'
import { signAccessToken, ACCESS_TOKEN_EXPIRES_IN } from '../middlewares/auth.middleware.js'

/**
 * Lọc và chỉ trả về các trường thông tin người dùng an toàn theo whitelist quy định.
 */
function sanitizePublicUser(user) {
  return {
    id: String(user.id),
    username: user.username,
    fullName: user.fullName,
    email: user.email !== null && user.email !== undefined ? user.email : null,
    phone: user.phone !== null && user.phone !== undefined ? user.phone : null,
    avatarUrl: user.avatarUrl !== null && user.avatarUrl !== undefined ? user.avatarUrl : null,
    role: user.role,
    shopId: user.shopId !== null && user.shopId !== undefined ? String(user.shopId) : null,
  }
}

/**
 * POST /api/v1/auth/login
 * Đăng nhập người dùng bằng username và password.
 * - Chỉ nhận username và password.
 * - Chuẩn hóa username thành chữ thường.
 * - Giữ nguyên vẹn password, kiểm tra giới hạn 72 bytes UTF-8.
 * - Gọi Data API để kiểm tra credentials.
 * - Phát hành access token JWT 15 phút (900 giây).
 */
export async function login(req, res, next) {
  try {
    const { username, password } = req.body || {}

    // 1. Kiểm tra sự tồn tại và kiểu dữ liệu
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.trim().length === 0 ||
      password.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập và mật khẩu là bắt buộc.',
        error: {
          code: 'VALIDATION_ERROR',
        },
      })
    }

    // 2. Kiểm tra giới hạn 72 bytes UTF-8 của bcrypt
    if (Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
        error: {
          code: 'INVALID_CREDENTIALS',
        },
      })
    }

    // Chuẩn hóa username thành chữ thường theo schema
    const normalizedUsername = username.trim().toLowerCase()

    // 3. Xác thực với Data API
    let user
    try {
      user = await verifyCredentials(normalizedUsername, password)
    } catch (err) {
      if (err instanceof DataApiClientError && err.code === 'INVALID_CREDENTIALS') {
        return res.status(401).json({
          success: false,
          message: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
          error: {
            code: 'INVALID_CREDENTIALS',
          },
        })
      }
      return next(err)
    }

    // 4. Phát hành access token JWT
    const token = signAccessToken(user)

    // 5. Trả phản hồi thành công với whitelist user
    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công.',
      data: {
        token,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        user: sanitizePublicUser(user),
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/auth/me
 * Lấy hồ sơ tài khoản hiện tại từ req.user đã được middleware xác thực thẩm định.
 * Tránh việc gọi lặp lại sang Data API.
 */
export function getMe(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu bắt buộc phải có token xác thực.',
      error: {
        code: 'AUTH_REQUIRED',
      },
    })
  }

  return res.status(200).json({
    success: true,
    message: 'Lấy thông tin tài khoản thành công.',
    data: {
      user: sanitizePublicUser(req.user),
    },
  })
}

/**
 * POST /api/v1/auth/register
 * Đăng ký tài khoản người dùng mới (người mua hoặc người bán).
 */
export async function register(req, res, next) {
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

    // 1. Kiểm tra các trường bắt buộc cơ bản
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      typeof fullName !== 'string' ||
      username.trim().length === 0 ||
      password.length === 0 ||
      fullName.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Họ tên, tên đăng nhập và mật khẩu là bắt buộc.',
        error: {
          code: 'VALIDATION_ERROR',
        },
      })
    }

    if (username.trim().length < 3 || username.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập phải có từ 3 đến 50 ký tự.',
        error: {
          code: 'VALIDATION_ERROR',
        },
      })
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu chấm, gạch dưới hoặc gạch ngang.',
        error: {
          code: 'VALIDATION_ERROR',
        },
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.',
        error: {
          code: 'VALIDATION_ERROR',
        },
      })
    }

    if (Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu vượt quá giới hạn 72 bytes UTF-8.',
        error: {
          code: 'VALIDATION_ERROR',
        },
      })
    }

    if (role !== 'buyer' && role !== 'seller') {
      return res.status(400).json({
        success: false,
        message: 'Vai trò người dùng phải là buyer hoặc seller.',
        error: {
          code: 'VALIDATION_ERROR',
        },
      })
    }

    if (role === 'seller' && (!shopName || typeof shopName !== 'string' || shopName.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Người bán cần cung cấp tên gian hàng.',
        error: {
          code: 'VALIDATION_ERROR',
        },
      })
    }

    // 2. Gọi Data API để đăng ký tài khoản
    let user
    try {
      user = await registerUser({
        username: username.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        email: email && typeof email === 'string' && email.trim().length > 0 ? email.trim().toLowerCase() : null,
        phone: phone && typeof phone === 'string' && phone.trim().length > 0 ? phone.trim() : null,
        role,
        shopName: shopName && typeof shopName === 'string' ? shopName.trim() : null,
        shopTagline: shopTagline && typeof shopTagline === 'string' ? shopTagline.trim() : null,
      })
    } catch (err) {
      if (err instanceof DataApiClientError && (err.status === 400 || err.status === 409)) {
        return res.status(err.status).json({
          success: false,
          message: err.message,
          error: {
            code: err.code,
          },
        })
      }
      return next(err)
    }

    // 3. Phát hành access token JWT
    const token = signAccessToken(user)

    // 4. Trả phản hồi thành công
    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công.',
      data: {
        token,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        user: sanitizePublicUser(user),
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/v1/auth/profile
 * Cập nhật thông tin hồ sơ của người dùng hiện tại (Bearer JWT).
 */
export async function updateProfile(req, res, next) {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu bắt buộc phải có token xác thực.',
        error: { code: 'AUTH_REQUIRED' },
      })
    }

    const { fullName, phone, email, avatarUrl } = req.body || {}

    const updatedUser = await updateUserProfile(userId, {
      fullName,
      phone,
      email,
      avatarUrl,
    })

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin hồ sơ thành công.',
      data: {
        user: sanitizePublicUser(updatedUser),
      },
    })
  } catch (err) {
    if (err instanceof DataApiClientError) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        error: { code: err.code },
      })
    }
    next(err)
  }
}
