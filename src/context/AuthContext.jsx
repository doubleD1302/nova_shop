import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { users as seedUsers } from '../data/users'
import { shopAvatar } from '../utils/image'
import { apiGetMe, apiLogin, apiRegister, apiUpdateProfile } from '../utils/api'

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
 * - Có cơ chế chống race condition: dùng authVersionRef và AbortController để ngăn phản hồi /me cũ
 *   ghi đè user hoặc xóa token khi đã có lần đăng nhập mới hoặc đăng xuất.
 * - Token hết hạn hoặc không hợp lệ -> xóa phiên (nếu vẫn ở cùng version).
 * - Đăng nhập async/await qua POST /api/v1/auth/login.
 * - Đăng xuất xóa token và xóa phiên.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY))
  const [isInitializing, setIsInitializing] = useState(true)

  // Version của hành động auth để ngăn chặn race condition từ các request bất đồng bộ cũ
  const authVersionRef = useRef(0)
  const restoreAbortRef = useRef(null)

  // Khôi phục phiên từ sessionStorage khi khởi tạo
  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      const storedToken = sessionStorage.getItem(TOKEN_KEY)
      if (!storedToken) {
        if (isMounted) {
          setToken(null)
          setIsInitializing(false)
        }
        return
      }

      // Tạo version mới và AbortController cho lần restore này
      const version = ++authVersionRef.current
      restoreAbortRef.current?.abort()
      const controller = new AbortController()
      restoreAbortRef.current = controller

      try {
        const res = await apiGetMe(storedToken, { signal: controller.signal })

        // Nếu đã có hành động auth mới hơn (login mới hoặc logout) hoặc token trong sessionStorage đã đổi: hủy bỏ xử lý
        if (authVersionRef.current !== version || sessionStorage.getItem(TOKEN_KEY) !== storedToken) {
          return
        }

        if (res.ok) {
          const data = await res.json().catch(() => null)
          // Kiểm tra lại version sau khi await json
          if (authVersionRef.current !== version || sessionStorage.getItem(TOKEN_KEY) !== storedToken) {
            return
          }
          if (data?.success && data?.data?.user) {
            if (isMounted) {
              setToken(storedToken)
              setUser(normalizeUser(data.data.user))
            }
            return
          }
        }

        // Token hết hạn hoặc không hợp lệ (401 hoặc lỗi):
        // Chỉ xóa token và đặt user null nếu version vẫn khớp và token chưa bị thay thế
        if (authVersionRef.current === version && sessionStorage.getItem(TOKEN_KEY) === storedToken) {
          sessionStorage.removeItem(TOKEN_KEY)
          if (isMounted) {
            setToken(null)
            setUser(null)
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          return // Bỏ qua nếu bị abort chủ động
        }
        console.error('Lỗi khi khôi phục phiên qua /auth/me:', err)
      } finally {
        if (isMounted && authVersionRef.current === version) {
          setIsInitializing(false)
        }
      }
    }

    restoreSession()

    return () => {
      isMounted = false
      restoreAbortRef.current?.abort()
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
        // Hủy bỏ bất kỳ restoreSession cũ nào đang chờ và tăng version auth
        restoreAbortRef.current?.abort()
        authVersionRef.current += 1

        const { token: receivedToken, user: apiUser } = data.data
        sessionStorage.setItem(TOKEN_KEY, receivedToken)
        setToken(receivedToken)
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
   * Đăng ký tài khoản mới qua Backend API.
   */
  const register = useCallback(async (formData) => {
    try {
      const res = await apiRegister(formData)
      const data = await res.json().catch(() => null)

      if (res.ok && data?.success && data?.data?.token) {
        restoreAbortRef.current?.abort()
        authVersionRef.current += 1

        const { token: receivedToken, user: apiUser } = data.data
        sessionStorage.setItem(TOKEN_KEY, receivedToken)
        setToken(receivedToken)
        const normalized = normalizeUser(apiUser)
        setUser(normalized)
        return { ok: true, user: normalized }
      }

      if (res.status === 409) {
        return {
          ok: false,
          error: data?.message || 'Tên đăng nhập hoặc email đã tồn tại.',
        }
      }

      if (res.status === 400) {
        return {
          ok: false,
          error: data?.message || 'Thông tin đăng ký không hợp lệ.',
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
   * Cập nhật hồ sơ kết nối trực tiếp với Backend API.
   */
  const updateProfile = useCallback(async (profileData) => {
    const curToken = sessionStorage.getItem(TOKEN_KEY)
    if (!curToken) {
      return { ok: false, error: 'Chưa đăng nhập hoặc phiên đã hết hạn.' }
    }
    try {
      const res = await apiUpdateProfile(curToken, profileData)
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        if (data.data?.user) {
          setUser(normalizeUser(data.data.user))
        } else {
          setUser((prev) => ({ ...prev, ...profileData }))
        }
        return { ok: true }
      }
      return { ok: false, error: data?.message || 'Cập nhật hồ sơ thất bại.' }
    } catch (err) {
      return { ok: false, error: 'Không thể kết nối đến máy chủ Backend.' }
    }
  }, [])

  /**
   * Cập nhật phiên sau khi đăng ký gian hàng người bán thành công.
   */
  const applyShopRegistration = useCallback(({ token: newToken, user: updatedUser }) => {
    if (newToken) {
      sessionStorage.setItem(TOKEN_KEY, newToken)
      setToken(newToken)
    }
    if (updatedUser) {
      setUser(normalizeUser(updatedUser))
    }
  }, [])

  /**
   * Tải lại thông tin người dùng từ Backend API.
   */
  const refreshUser = useCallback(async () => {
    const curToken = sessionStorage.getItem(TOKEN_KEY)
    if (!curToken) return null
    try {
      const res = await apiGetMe(curToken)
      if (res.ok) {
        const data = await res.json().catch(() => null)
        if (data?.success && data?.data?.user) {
          const norm = normalizeUser(data.data.user)
          setUser(norm)
          return norm
        }
      }
    } catch (e) {
      console.warn('refreshUser failed:', e)
    }
    return null
  }, [])

  /**
   * Đăng xuất: hủy bỏ restoreSession đang bay, tăng version auth, xóa token và xóa toàn bộ phiên.
   */
  const logout = useCallback(() => {
    restoreAbortRef.current?.abort()
    authVersionRef.current += 1
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
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
      applyShopRegistration,
      refreshUser,
    }),
    [user, token, isInitializing, login, loginAs, register, logout, updateProfile, applyShopRegistration, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>')
  return ctx
}

export default AuthContext
