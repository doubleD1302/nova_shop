import crypto from 'node:crypto'
import { signAccessToken, ACCESS_TOKEN_EXPIRES_IN } from '../middlewares/auth.middleware.js'
import {
  callDataApi,
  DataApiClientError,
  verifyCredentials,
  createSession,
  refreshSession as refreshUserSession,
  revokeSession as revokeUserSession,
  changeUserPassword,
} from '../clients/data.client.js'
import { findUserByUsername, loadShops, verifyPassword } from '../store/users.store.js'
import {
  FirebaseAdminNotConfiguredError,
  InvalidFirebaseIdTokenError,
  verifyFirebaseIdToken,
} from '../services/firebase-admin.js'

export const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 3600 // 7 ngày (604800 giây)

function sanitizePublicUser(user) {
  return {
    id: String(user.id),
    username: user.username,
    fullName: user.fullName,
    email: user.email ?? null,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    shopId: user.shopId === null || user.shopId === undefined ? null : String(user.shopId),
    address: user.address || null,
  }
}

export async function createSessionForUser(userId) {
  try {
    const refreshToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000).toISOString()
    await createSession(userId, tokenHash, expiresAt)
    return refreshToken
  } catch (err) {
    console.warn('[Auth] Không thể tạo session phiên đăng nhập:', err.message)
    return null
  }
}

function authResponse(user, message = 'Đăng nhập thành công.', refreshToken = null) {
  return {
    success: true,
    message,
    data: {
      token: signAccessToken(user),
      ...(refreshToken ? { refreshToken } : {}),
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      user: sanitizePublicUser(user),
    },
  }
}

function validEmail(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function validLegacyAddress(address) {
  return address && typeof address === 'object' &&
    typeof address.fullName === 'string' && address.fullName.trim() &&
    typeof address.phone === 'string' && address.phone.trim() &&
    typeof address.province === 'string' && address.province.trim() &&
    typeof address.detail === 'string' && address.detail.trim()
    ? address
    : undefined
}

/**
 * Accounts created by the old local JSON auth flow are imported only after
 * their old scrypt password has been verified. The Data API hashes the same
 * password with the current database auth scheme and creates the seller shop
 * in the same transaction. The JSON files are left untouched.
 */
async function migrateVerifiedLegacyAccount(username, password) {
  const legacyUser = findUserByUsername(username.trim().toLowerCase())
  if (!legacyUser || legacyUser.status !== 'active' || !verifyPassword(legacyUser.passwordHash, password)) return null
  if (!['buyer', 'seller'].includes(legacyUser.role) || !validEmail(legacyUser.email)) return null

  const legacyShop = legacyUser.role === 'seller'
    ? loadShops().find((shop) => String(shop.id) === String(legacyUser.shopId))
    : null
  const result = await callDataApi('/internal/v1/auth/register', {
    method: 'POST',
    body: {
      username: legacyUser.username,
      password,
      fullName: legacyUser.fullName || legacyUser.username,
      email: legacyUser.email,
      phone: legacyUser.phone || '',
      role: legacyUser.role,
      shopName: legacyUser.role === 'seller' ? (legacyShop?.name || legacyUser.username) : undefined,
      shopTagline: legacyShop?.tagline || '',
      address: validLegacyAddress(legacyUser.address),
    },
  })
  return result.user
}

export async function login(req, res, next) {
  const { username, password } = req.body || {}
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({
      success: false,
      message: 'Tên đăng nhập và mật khẩu là bắt buộc.',
      error: { code: 'VALIDATION_ERROR' },
    })
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(401).json({
      success: false,
      message: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
      error: { code: 'INVALID_CREDENTIALS' },
    })
  }

  try {
    let user
    try {
      user = await verifyCredentials(username.trim().toLowerCase(), password)
    } catch (err) {
      if (!(err instanceof DataApiClientError) || err.code !== 'INVALID_CREDENTIALS') throw err
      user = await migrateVerifiedLegacyAccount(username, password)
      if (!user) throw err
    }
    const refreshToken = await createSessionForUser(user.id)
    return res.status(200).json(authResponse(user, 'Đăng nhập thành công.', refreshToken))
  } catch (err) {
    if (err instanceof DataApiClientError && err.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
        error: { code: 'INVALID_CREDENTIALS' },
      })
    }
    // A username collision during legacy import must not reveal whether the
    // conflicting database account exists or allow one account to overwrite another.
    if (err instanceof DataApiClientError && err.status === 409) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không hợp lệ.',
        error: { code: 'INVALID_CREDENTIALS' },
      })
    }
    return next(err)
  }
}

export async function loginWithGoogle(req, res, next) {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : ''
  if (!idToken || idToken.length > 16384) {
    return res.status(400).json({
      success: false,
      message: 'Token đăng nhập Google không hợp lệ.',
      error: { code: 'VALIDATION_ERROR' },
    })
  }

  try {
    const identity = await verifyFirebaseIdToken(idToken)
    const result = await callDataApi('/internal/v1/auth/google', {
      method: 'POST',
      body: identity,
    })
    const refreshToken = await createSessionForUser(result.user.id)
    return res.status(200).json(authResponse(result.user, 'Đăng nhập Google thành công.', refreshToken))
  } catch (err) {
    if (err instanceof FirebaseAdminNotConfiguredError) {
      return res.status(503).json({
        success: false,
        message: err.message,
        error: { code: 'GOOGLE_AUTH_NOT_CONFIGURED' },
      })
    }
    if (err instanceof InvalidFirebaseIdTokenError) {
      return res.status(401).json({
        success: false,
        message: err.message,
        error: { code: 'GOOGLE_TOKEN_INVALID' },
      })
    }
    if (err instanceof DataApiClientError && err.code === 'EMAIL_ACCOUNT_EXISTS') {
      return res.status(409).json({
        success: false,
        message: err.message,
        error: { code: 'EMAIL_ACCOUNT_EXISTS' },
      })
    }
    return next(err)
  }
}

export async function register(req, res, next) {
  const body = req.body || {}
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const role = body.role || 'buyer'

  if (!/^[a-z0-9_]{3,50}$/.test(username) || !fullName || fullName.length > 120) {
    return res.status(400).json({
      success: false,
      message: 'Tên đăng nhập hoặc họ tên không hợp lệ.',
      error: { code: 'VALIDATION_ERROR' },
    })
  }
  if (!validEmail(email)) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập email hợp lệ.', error: { code: 'INVALID_EMAIL' } })
  }
  if (
    typeof body.password !== 'string' || body.password.length < 8 || Buffer.byteLength(body.password, 'utf8') > 72 ||
    (phone && (!/^[+()\d .-]{8,20}$/.test(phone))) || !['buyer', 'seller'].includes(role) ||
    (role === 'seller' && (typeof body.shopName !== 'string' || !body.shopName.trim() || body.shopName.trim().length > 160)) ||
    (typeof body.shopTagline === 'string' && body.shopTagline.trim().length > 255)
  ) {
    return res.status(400).json({
      success: false,
      message: 'Thông tin đăng ký không hợp lệ.',
      error: { code: 'VALIDATION_ERROR' },
    })
  }

  try {
    const result = await callDataApi('/internal/v1/auth/register', {
      method: 'POST',
      body: {
        username,
        password: body.password,
        fullName,
        email,
        phone,
        role,
        shopName: role === 'seller' ? body.shopName.trim() : undefined,
        shopTagline: typeof body.shopTagline === 'string' ? body.shopTagline.trim() : '',
      },
    })
    const refreshToken = await createSessionForUser(result.user.id)
    return res.status(201).json(authResponse(result.user, 'Đăng ký thành công.', refreshToken))
  } catch (err) {
    return next(err)
  }
}

export async function updateProfile(req, res, next) {
  const body = req.body || {}
  if (body.email !== undefined && !validEmail(body.email)) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập email hợp lệ.', error: { code: 'INVALID_EMAIL' } })
  }
  try {
    const result = await callDataApi(`/internal/v1/users/${encodeURIComponent(req.user.id)}/profile`, {
      method: 'PUT',
      body,
    })
    return res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ thành công.',
      data: { user: sanitizePublicUser(result.user) },
    })
  } catch (err) {
    return next(err)
  }
}

export async function createSellerShop(req, res, next) {
  const shopName = req.body?.shopName
  if (typeof shopName !== 'string' || !shopName.trim() || shopName.trim().length > 160) {
    return res.status(400).json({
      success: false,
      message: 'Tên gian hàng là bắt buộc (tối đa 160 ký tự).',
      error: { code: 'VALIDATION_ERROR' },
    })
  }
  try {
    const result = await callDataApi(`/internal/v1/users/${encodeURIComponent(req.user.id)}/seller-shop`, {
      method: 'POST',
      body: { shopName: shopName.trim() },
    })
    const refreshToken = await createSessionForUser(result.user.id)
    return res.status(200).json({
      success: true,
      message: 'Đã mở gian hàng thành công.',
      data: {
        token: signAccessToken(result.user),
        ...(refreshToken ? { refreshToken } : {}),
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        user: sanitizePublicUser(result.user),
      },
    })
  } catch (err) {
    if (err instanceof DataApiClientError && err.code === 'DUPLICATE_SHOP_NAME') {
      return res.status(400).json({
        success: false,
        message: err.message,
        error: { code: 'DUPLICATE_SHOP_NAME' },
      })
    }
    return next(err)
  }
}

export function getMe(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu bắt buộc phải có token xác thực.',
      error: { code: 'AUTH_REQUIRED' },
    })
  }
  return res.status(200).json({
    success: true,
    message: 'Lấy thông tin tài khoản thành công.',
    data: { user: sanitizePublicUser(req.user) },
  })
}

/**
 * POST /api/v1/auth/refresh
 * Làm mới access token từ refresh token hợp lệ.
 */
export async function refreshToken(req, res, next) {
  const { refreshToken: incomingToken } = req.body || {}
  if (typeof incomingToken !== 'string' || !incomingToken.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token là bắt buộc.',
      error: { code: 'VALIDATION_ERROR' },
    })
  }

  const trimmedToken = incomingToken.trim()
  if (!/^[a-f0-9]{32,128}$/i.test(trimmedToken)) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token không hợp lệ.',
      error: { code: 'AUTH_INVALID' },
    })
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(trimmedToken).digest('hex')
    const newRefreshToken = crypto.randomBytes(32).toString('hex')
    const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex')
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000).toISOString()

    const user = await refreshUserSession(tokenHash, newRefreshTokenHash, newExpiresAt)
    return res.status(200).json({
      success: true,
      message: 'Làm mới phiên đăng nhập thành công.',
      data: {
        token: signAccessToken(user),
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        user: sanitizePublicUser(user),
      },
    })
  } catch (err) {
    if (
      err instanceof DataApiClientError &&
      (err.status === 401 || err.code === 'AUTH_INVALID' || err.code === 'SESSION_EXPIRED' || err.code === 'SESSION_REVOKED' || err.code === 'ACCOUNT_BLOCKED')
    ) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
        error: { code: 'AUTH_EXPIRED' },
      })
    }
    return next(err)
  }
}

/**
 * POST /api/v1/auth/logout
 * Đăng xuất và thu hồi phiên đăng nhập hiện tại trên hệ thống.
 */
export async function logout(req, res, next) {
  const { refreshToken: incomingToken } = req.body || {}
  if (typeof incomingToken === 'string' && /^[a-f0-9]{32,128}$/i.test(incomingToken.trim())) {
    try {
      const tokenHash = crypto.createHash('sha256').update(incomingToken.trim()).digest('hex')
      await revokeUserSession(tokenHash)
    } catch {
      // Bỏ qua lỗi upstream, đảm bảo phản hồi đăng xuất luôn thành công cho client
    }
  }
  return res.status(200).json({
    success: true,
    message: 'Đăng xuất thành công.',
  })
}

/**
 * POST /api/v1/auth/change-password
 * Đổi mật khẩu tài khoản và thu hồi toàn bộ các phiên cũ trên mọi thiết bị.
 */
export async function changePassword(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Yêu cầu bắt buộc phải có token xác thực.',
      error: { code: 'AUTH_REQUIRED' },
    })
  }

  const { currentPassword, newPassword } = req.body || {}
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập mật khẩu hiện tại.',
      error: { code: 'VALIDATION_ERROR' },
    })
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
      error: { code: 'VALIDATION_ERROR' },
    })
  }

  if (Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({
      success: false,
      message: 'Mật khẩu mới không được dài quá 72 byte.',
      error: { code: 'VALIDATION_ERROR' },
    })
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.',
      error: { code: 'VALIDATION_ERROR' },
    })
  }

  try {
    await changeUserPassword(req.user.id, currentPassword, newPassword)
    // Cấp phiên mới cho người dùng sau khi toàn bộ phiên cũ đã được thu hồi
    const newRefreshToken = await createSessionForUser(req.user.id)
    return res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công.',
      data: {
        token: signAccessToken(req.user),
        ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        user: sanitizePublicUser(req.user),
      },
    })
  } catch (err) {
    if (err instanceof DataApiClientError && err.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        success: false,
        message: 'Mật khẩu hiện tại không chính xác.',
        error: { code: 'INVALID_CREDENTIALS' },
      })
    }
    return next(err)
  }
}
