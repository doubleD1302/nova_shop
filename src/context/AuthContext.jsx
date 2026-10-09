import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { users as seedUsers } from '../data/users'
import { shopAvatar } from '../utils/image'
import { apiGetMe, apiLogin } from '../utils/api'

const AuthContext = createContext(null)
const TOKEN_KEY = 'novashop_token'

/**
 * Chuẩn hóa đối tượng người dùng từ Backend API để tương thích hoàn toàn với giao diện.
 * - Giữ ID và shopId dạng chuỗi.
 * - Sử dụng trực tiếp user, role, shopId từ Backend.
 */
function normalizeUser(apiUser) {
  if (!apiUser) return null
  const id = String(apiUser.id)
  const shopId = apiUser.shopId != null ? String(apiUser.shopId) : null
  const role = apiUser.role || 'buyer'
  const username = apiUser.username || ''
  const fullName = apiUser.fullName || username

  return {
    ...apiUser,
    id,
    shopId,
    role,
    username,
    fullName,
    email: apiUser.email || '',
    phone: apiUser.phone || '',
    avatarUrl: apiUser.avatarUrl || null,
    rank: role === 'seller' ? 'Người bán' : 'Thành viên',
    avatarEmoji: role === 'seller' ? '🏪' : '🙂',
    hue: (username.length * 37) % 360,
    address: apiUser.address || {
      fullName,
      phone: apiUser.phone || '',
      province: '',
      district: '',
      ward: '',
      detail: '',
    },
  }
}

/**
 * Quản lý xác thực Auth tích hợp Backend API.
 * - Khởi tạo từ sessionStorage (nếu có token).
 * - Khôi phục phiên bằng GET /api/v1/auth/me với Bearer token.
 * - Token hết hạn hoặc không hợp lệ -> xóa phiên.
 * - Đăng nhập async/await qua POST /api/v1/auth/login.
 * - Đăng xuất xóa token và xóa phiên.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Khôi phục phiên từ sessionStorage khi khởi tạo
  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      const token = sessionStorage.getItem(TOKEN_KEY)
      if (!token) {
        if (isMounted) setIsInitializing(false)
        return
      }

      try {
        const res = await apiGetMe(token)
        if (res.ok) {
          const data = await res.json().catch(() => null)
          if (data?.success && data?.data?.user) {
            if (isMounted) {
              setUser(normalizeUser(data.data.user))
            }
            return
          }
        }

        // Token hết hạn hoặc không hợp lệ (401 hoặc lỗi)
        sessionStorage.removeItem(TOKEN_KEY)
        if (isMounted) {
          setUser(null)
        }
      } catch (err) {
        console.error('Lỗi khi khôi phục phiên qua /auth/me:', err)
      } finally {
        if (isMounted) setIsInitializing(false)
      }
    }

    restoreSession()

    return () => {
      isMounted = false
    }
  }, [])

  /**
   * Đăng nhập async/await bằng tên đăng nhập và mật khẩu qua Backend API.
   */
  const login = useCallback(async (username, password) => {
    const u = String(username || '').trim()
    const p = String(password || '')

    if (!u || !p) {
      return { ok: false, error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' }
    }

    try {
      const res = await apiLogin(u, p)
      const data = await res.json().catch(() => null)

      if (res.ok && data?.success && data?.data?.token) {
        const { token, user: apiUser } = data.data
        sessionStorage.setItem(TOKEN_KEY, token)
        const normalized = normalizeUser(apiUser)
        setUser(normalized)
        return { ok: true, user: normalized }
      }

      if (res.status === 401) {
        return {
          ok: false,
          error: data?.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        }
      }

      if (res.status === 400) {
        return {
          ok: false,
          error: data?.message || 'Dữ liệu đăng nhập không hợp lệ.',
        }
      }

      if (res.status === 429) {
        return {
          ok: false,
          error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ 1 phút rồi thử lại.',
        }
      }

      return {
        ok: false,
        error: data?.message || `Lỗi máy chủ (${res.status}). Vui lòng thử lại sau.`,
      }
    } catch (err) {
      return {
        ok: false,
        error: 'Không thể kết nối đến máy chủ Backend. Vui lòng kiểm tra kết nối mạng và thử lại.',
      }
    }
  }, [])

  /**
   * Đăng nhập nhanh tài khoản mẫu đã bị loại bỏ khỏi luồng auth thật.
   */
  const loginAs = useCallback(() => {
    return {
      ok: false,
      error: 'Đăng nhập nhanh mẫu không khả dụng với API thực tế. Vui lòng đăng nhập bằng tài khoản và mật khẩu.',
    }
  }, [])

  /**
   * Đăng ký chưa có API Backend: không tạo phiên hoặc báo lưu thành công local.
   */
  const register = useCallback(() => {
    return {
      ok: false,
      error: 'Tính năng đăng ký tài khoản trực tuyến chưa được hỗ trợ trên Backend API.',
    }
  }, [])

  /**
   * Cập nhật hồ sơ chưa có API Backend: không báo lưu thành công local.
   */
  const updateProfile = useCallback(() => {
    return {
      ok: false,
      error: 'Tính năng cập nhật thông tin hồ sơ chưa được hỗ trợ trên Backend API.',
    }
  }, [])

  /**
   * Đăng xuất: xóa token và xóa toàn bộ phiên.
   */
  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      allUsers: seedUsers,
      isInitializing,
      isAuthenticated: Boolean(user),
      isSeller: user?.role === 'seller',
      avatar: user
        ? user.avatarUrl || shopAvatar({ name: user.fullName, emoji: user.avatarEmoji || '🙂', hue: user.hue ?? 12 })
        : '',
      login,
      loginAs,
      register,
      logout,
      updateProfile,
    }),
    [user, isInitializing, login, loginAs, register, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>')
  return ctx
}

export default AuthContext
