import { signAccessToken, ACCESS_TOKEN_EXPIRES_IN } from '../middlewares/auth.middleware.js'
import { callDataApi, DataApiClientError, verifyCredentials } from '../clients/data.client.js'
import { findUserByUsername, loadShops, verifyPassword } from '../store/users.store.js'
import {
  FirebaseAdminNotConfiguredError,
  InvalidFirebaseIdTokenError,
  verifyFirebaseIdToken,
} from '../services/firebase-admin.js'

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

function authResponse(user, message = 'Đăng nhập thành công.') {
  return {
    success: true,
    message,
    data: {
      token: signAccessToken(user),
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
    return res.status(200).json(authResponse(user))
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
    return res.status(200).json(authResponse(result.user, 'Đăng nhập Google thành công.'))
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
    return res.status(201).json(authResponse(result.user, 'Đăng ký thành công.'))
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
    return res.status(200).json({
      success: true,
      message: 'Đã mở gian hàng thành công.',
      data: {
        token: signAccessToken(result.user),
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
