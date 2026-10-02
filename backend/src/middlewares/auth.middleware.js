import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { getUserAuthProfile, isValidBigIntUnsignedString, DataApiClientError } from '../clients/data.client.js'

export const ACCESS_TOKEN_EXPIRES_IN = 900 // 15 phút (900 giây)
export const TOKEN_ISSUER = 'shopnova-backend'
export const TOKEN_AUDIENCE = 'shopnova-clients'
export const MAX_TOKEN_LENGTH = 2048
export const CLOCK_SKEW_TOLERANCE_SECONDS = 60 // Cho phép sai lệch đồng hồ tối đa 60 giây

/**
 * Phát hành access token JWT chuẩn HS256 với các claim bắt buộc.
 */
export function signAccessToken(user) {
  const payload = {
    sub: String(user.id),
    role: user.role,
  }

  return jwt.sign(payload, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  })
}

/**
 * Xác minh chữ ký và các claim tiêu chuẩn của JWT access token.
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret, {
    algorithms: ['HS256'],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    clockTolerance: CLOCK_SKEW_TOLERANCE_SECONDS,
  })
}

/**
 * Middleware xác thực Bearer JWT cho các route yêu cầu đăng nhập.
 * - Kiểm tra Authorization header và cấu trúc 'Bearer <token>'.
 * - Giới hạn độ dài token <= 2048 ký tự.
 * - Xác minh signature, thuật toán HS256, issuer, audience, sub, iat, exp.
 * - Kiểm tra thời gian claim phù hợp access token 900 giây và clock skew quy định rõ ràng.
 * - Validate sub trước khi gọi Data API: chuỗi ID chuẩn, không khoảng trắng, không số 0 đầu, không vượt BIGINT UNSIGNED.
 * - Token sai sub trả 401 AUTH_INVALID ngay mà không gọi Data API upstream.
 * - Đọc auth-profile thời gian thực từ Data API để lấy status và role mới nhất (không dùng role trong token).
 * - Ngăn chặn người dùng đã bị khóa (blocked) hoặc đã bị xóa tiếp tục dùng token.
 * - Gắn thông tin tài khoản hợp lệ vào req.user.
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization']

  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu bắt buộc phải có token xác thực.',
      error: {
        code: 'AUTH_REQUIRED',
      },
    })
  }

  const trimmedHeader = authHeader.trim()
  if (!trimmedHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu bắt buộc phải có token xác thực.',
      error: {
        code: 'AUTH_REQUIRED',
      },
    })
  }

  const token = trimmedHeader.slice(7).trim()
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return res.status(401).json({
      success: false,
      message: 'Token xác thực không hợp lệ.',
      error: {
        code: 'AUTH_INVALID',
      },
    })
  }

  let payload
  try {
    payload = verifyAccessToken(token)
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token xác thực đã hết hạn hiệu lực.',
        error: {
          code: 'AUTH_EXPIRED',
        },
      })
    }
    return res.status(401).json({
      success: false,
      message: 'Token xác thực không hợp lệ.',
      error: {
        code: 'AUTH_INVALID',
      },
    })
  }

  // Thẩm định cấu trúc và kiểu dữ liệu của các claim bắt buộc
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.sub !== 'string' ||
    !Number.isInteger(payload.iat) ||
    payload.iat <= 0 ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= payload.iat
  ) {
    return res.status(401).json({
      success: false,
      message: 'Token xác thực không hợp lệ.',
      error: {
        code: 'AUTH_INVALID',
      },
    })
  }

  // Kiểm tra thời gian phát hành (iat) không được ở tương lai vượt quá dung sai lệch đồng hồ cho phép
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (payload.iat > nowSeconds + CLOCK_SKEW_TOLERANCE_SECONDS) {
    return res.status(401).json({
      success: false,
      message: 'Token xác thực không hợp lệ.',
      error: {
        code: 'AUTH_INVALID',
      },
    })
  }

  // Bắt buộc thời hạn access token khớp chính xác hằng số 900 giây (exp - iat === 900)
  if (payload.exp - payload.iat !== ACCESS_TOKEN_EXPIRES_IN) {
    return res.status(401).json({
      success: false,
      message: 'Token xác thực không hợp lệ.',
      error: {
        code: 'AUTH_INVALID',
      },
    })
  }

  // Validate sub trước khi gọi Data API: chuỗi ID chuẩn, không khoảng trắng, không số 0 đầu, không ký tự lạ và không vượt BIGINT UNSIGNED.
  // Token sai sub trả 401 AUTH_INVALID mà không gọi upstream.
  if (!isValidBigIntUnsignedString(payload.sub)) {
    return res.status(401).json({
      success: false,
      message: 'Token xác thực không hợp lệ.',
      error: {
        code: 'AUTH_INVALID',
      },
    })
  }

  // Đọc thông tin tài khoản mới nhất từ Data API để xác nhận status và role
  try {
    const userProfile = await getUserAuthProfile(payload.sub)

    // Nếu tài khoản không còn tồn tại hoặc đang bị khóa (status !== 'active')
    if (!userProfile || userProfile.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại hoặc đã bị khóa.',
        error: {
          code: 'AUTH_INVALID',
        },
      })
    }

    req.user = userProfile
    next()
  } catch (err) {
    if (err instanceof DataApiClientError) {
      if (err.code === 'USER_NOT_FOUND') {
        return res.status(401).json({
          success: false,
          message: 'Tài khoản không tồn tại hoặc đã bị khóa.',
          error: {
            code: 'AUTH_INVALID',
          },
        })
      }
      return next(err)
    }
    return next(err)
  }
}

/**
 * Middleware kiểm tra vai trò (Role-based Authorization).
 * - Sử dụng req.user.role đã được xác thực từ Data API.
 * - Seller có đầy đủ quyền mua hàng (buyer). Buyer không được qua kiểm tra seller.
 * @param  {...string} allowedRoles - Danh sách vai trò được phép (ví dụ 'buyer', 'seller')
 */
export function requireRole(...allowedRoles) {
  const flattenedRoles = allowedRoles.flat()

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu chưa được xác thực.',
        error: {
          code: 'AUTH_REQUIRED',
        },
      })
    }

    const userRole = req.user.role
    // Seller kế thừa toàn bộ quyền của buyer (seller vẫn có quyền mua hàng)
    const effectiveRoles = userRole === 'seller' ? ['seller', 'buyer'] : [userRole]
    const hasPermission = flattenedRoles.some((role) => effectiveRoles.includes(role))

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này.',
        error: {
          code: 'FORBIDDEN',
        },
      })
    }

    next()
  }
}
