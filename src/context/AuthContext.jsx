import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { shopAvatar } from '../utils/image'
import { apiChangePassword, apiCreateSellerShop, apiGetMe, apiGoogleLogin, apiLogin, apiLogout, apiRegister, apiUpdateProfile, REFRESH_TOKEN_KEY, refreshAccessToken } from '../utils/api'
import {
  getFirebaseConfigError,
  isFirebaseConfigured,
  signInWithGooglePopup,
  firebaseSignOut,
  subscribeToFirebaseAuthState,
} from '../services/firebase'

const AuthContext = createContext(null)
const TOKEN_KEY = 'novashop_token'
const AUTH_PROVIDER_KEY = 'novashop_auth_provider'

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
    rank: role === 'admin' ? '\u0051u\u1EA3n tr\u1ECB vi\u00EAn' : role === 'seller' ? 'Ng\u01B0\u1EDDi b\u00E1n' : 'Th\u00E0nh vi\u00EAn',
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
  const [isInitializing, setIsInitializing] = useState(true)
  const [authError, setAuthError] = useState('')

  // Version của hành động auth để ngăn chặn race condition từ các request bất đồng bộ cũ
  const authVersionRef = useRef(0)
  const restoreAbortRef = useRef(null)
  const googleLoginInProgressRef = useRef(false)

  // Khôi phục phiên từ sessionStorage khi khởi tạo
  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      let token = sessionStorage.getItem(TOKEN_KEY)
      if (!token) {
        const refreshed = await refreshAccessToken()
        if (refreshed?.token) {
          token = refreshed.token
        } else {
          if (!isFirebaseConfigured() && isMounted) setIsInitializing(false)
          return
        }
      }

      // Tạo version mới và AbortController cho lần restore này
      const version = ++authVersionRef.current
      restoreAbortRef.current?.abort()
      const controller = new AbortController()
      restoreAbortRef.current = controller

      try {
        const res = await apiGetMe(token, { signal: controller.signal })

        // Nếu đã có hành động auth mới hơn (login mới hoặc logout) hoặc token trong sessionStorage đã đổi: hủy bỏ xử lý
        if (authVersionRef.current !== version || sessionStorage.getItem(TOKEN_KEY) !== token) {
          return
        }

        if (res.ok) {
          const data = await res.json().catch(() => null)
          // Kiểm tra lại version sau khi await json
          if (authVersionRef.current !== version || sessionStorage.getItem(TOKEN_KEY) !== token) {
            return
          }
          if (data?.success && data?.data?.user) {
            if (isMounted) {
              setUser(normalizeUser(data.data.user))
              setAuthError('')
            }
            return
          }
        }

        // Token hết hạn: Thử làm mới phiên ngầm trước khi xóa
        const refreshed = await refreshAccessToken()
        if (refreshed?.token && authVersionRef.current === version) {
          const retryRes = await apiGetMe(refreshed.token, { signal: controller.signal })
          if (retryRes.ok) {
            const retryData = await retryRes.json().catch(() => null)
            if (retryData?.success && retryData?.data?.user && isMounted) {
              setUser(normalizeUser(retryData.data.user))
              setAuthError('')
              return
            }
          }
        }

        // Nếu refresh cũng không thành công: xóa phiên
        if (authVersionRef.current === version) {
          sessionStorage.removeItem(TOKEN_KEY)
          sessionStorage.removeItem(REFRESH_TOKEN_KEY)
          localStorage.removeItem(REFRESH_TOKEN_KEY)
          if (isMounted) {
            setUser(null)
            setAuthError('')
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

  // Lắng nghe trạng thái đăng nhập Firebase (khi người dùng đăng nhập bằng Google)
  useEffect(() => {
    if (!isFirebaseConfigured()) return
    let isMounted = true

    const unsubscribe = subscribeToFirebaseAuthState((firebaseUser) => {
      const token = sessionStorage.getItem(TOKEN_KEY)
      if (token) return
      if (googleLoginInProgressRef.current) return

      if (firebaseUser) {
        const version = ++authVersionRef.current
        restoreAbortRef.current?.abort()
        const controller = new AbortController()
        restoreAbortRef.current = controller
        setIsInitializing(true)
        setAuthError('')

        Promise.resolve()
          .then(() => firebaseUser.getIdToken())
          .then((idToken) => apiGoogleLogin(idToken, { signal: controller.signal }))
          .then(async (res) => {
            const data = await res.json().catch(() => null)
            if (!isMounted || authVersionRef.current !== version || sessionStorage.getItem(TOKEN_KEY)) return
            if (!res.ok || !data?.success || !data?.data?.token || !data?.data?.user) {
              setUser(null)
              try { await firebaseSignOut() } catch {}
              return
            }
            sessionStorage.setItem(TOKEN_KEY, data.data.token)
            sessionStorage.setItem(AUTH_PROVIDER_KEY, 'google')
            setUser(normalizeUser(data.data.user))
          })
          .catch(async (error) => {
            if (!isMounted || error?.name === 'AbortError' || authVersionRef.current !== version) return
            setUser(null)
            try { await firebaseSignOut() } catch {}
          })
          .finally(() => {
            if (isMounted && authVersionRef.current === version) setIsInitializing(false)
          })
      } else {
        const currentProvider = sessionStorage.getItem(AUTH_PROVIDER_KEY)
        if (currentProvider === 'google') {
          sessionStorage.removeItem(AUTH_PROVIDER_KEY)
          setUser(null)
        }
        setIsInitializing(false)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
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
      setAuthError('')
      const res = await apiLogin(u, p)
      const data = await res.json().catch(() => null)

      if (res.ok && data?.success && data?.data?.token) {
        // Hủy bỏ bất kỳ restoreSession cũ nào đang chờ và tăng version auth
        restoreAbortRef.current?.abort()
        authVersionRef.current += 1

        const { token, refreshToken, user: apiUser } = data.data
        sessionStorage.setItem(TOKEN_KEY, token)
        if (refreshToken) {
          sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
        }
        sessionStorage.setItem(AUTH_PROVIDER_KEY, 'password')
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

  const register = useCallback(async (payload) => {
    try {
      const res = await apiRegister(payload)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success || !data?.data?.token || !data?.data?.user) {
        const responseType = res.headers.get('content-type') || ''
        const error = data?.message || (responseType.includes('application/json')
          ? `Máy chủ từ chối đăng ký (HTTP ${res.status}). Vui lòng kiểm tra dữ liệu và cấu hình dịch vụ.`
          : `API không trả về JSON hợp lệ (HTTP ${res.status}). Hãy kiểm tra địa chỉ API và bảo đảm Backend đang chạy.`)
        return { ok: false, error }
      }
      restoreAbortRef.current?.abort()
      authVersionRef.current += 1
      sessionStorage.setItem(TOKEN_KEY, data.data.token)
      if (data.data.refreshToken) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken)
      }
      sessionStorage.setItem(AUTH_PROVIDER_KEY, 'password')
      const normalized = normalizeUser(data.data.user)
      setAuthError('')
      setUser(normalized)
      return { ok: true, user: normalized }
    } catch (error) {
      return {
        ok: false,
        error: error?.name === 'TypeError'
          ? 'Không thể kết nối Backend. Hãy khởi động Backend API hoặc kiểm tra địa chỉ API.'
          : 'Có lỗi khi gửi yêu cầu đăng ký. Vui lòng thử lại.',
      }
    }
  }, [])

  /**
   * Đăng nhập bằng Google qua Firebase Authentication.
   */
  const loginWithGoogle = useCallback(async () => {
    const configError = getFirebaseConfigError()
    if (configError) {
      return {
        ok: false,
        error: configError,
      }
    }

    googleLoginInProgressRef.current = true
    restoreAbortRef.current?.abort()
    const version = ++authVersionRef.current
    setAuthError('')

    try {
      const res = await signInWithGooglePopup()
      if (!res.ok) {
        return res
      }

      const response = await apiGoogleLogin(res.idToken)
      const data = await response.json().catch(() => null)
      if (authVersionRef.current !== version) {
        return { ok: false, error: 'Yêu cầu đăng nhập Google đã bị hủy.' }
      }
      if (!response.ok || !data?.success || !data?.data?.token || !data?.data?.user) {
        return {
          ok: false,
          error: data?.message || 'Backend không thể xác thực và lưu tài khoản Google.',
        }
      }

      sessionStorage.setItem(TOKEN_KEY, data.data.token)
      if (data.data.refreshToken) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken)
      }
      sessionStorage.setItem(AUTH_PROVIDER_KEY, 'google')
      const normalized = normalizeUser(data.data.user)
      setUser(normalized)
      setAuthError('')
      return { ok: true, user: normalized }
    } catch (err) {
      return {
        ok: false,
        error: err?.name === 'TypeError'
          ? 'Không thể kết nối Backend. Hãy khởi động Backend API rồi thử lại.'
          : err?.message || 'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.',
      }
    } finally {
      googleLoginInProgressRef.current = false
      if (authVersionRef.current === version) setIsInitializing(false)
    }
  }, [])

  const updateProfile = useCallback(async (patch) => {
    const current = user
    if (!current) return { ok: false, error: 'Vui lòng đăng nhập để cập nhật hồ sơ.' }
    const payload = {
      fullName: patch.fullName ?? current.fullName,
      email: patch.email ?? current.email,
      phone: patch.phone ?? current.phone,
      avatarUrl: patch.avatarUrl === undefined ? current.avatarUrl : patch.avatarUrl,
      ...(patch.address === undefined ? {} : { address: patch.address }),
    }
    try {
      const res = await apiUpdateProfile(payload)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success || !data?.data?.user) {
        return { ok: false, error: data?.message || 'Không thể cập nhật hồ sơ.' }
      }
      const normalized = normalizeUser(data.data.user)
      setAuthError('')
      setUser(normalized)
      return { ok: true, user: normalized }
    } catch {
      return { ok: false, error: 'Không thể kết nối đến máy chủ Backend. Vui lòng thử lại.' }
    }
  }, [user])

  const openSellerShop = useCallback(async (shopName) => {
    if (!user) return { ok: false, error: 'Vui lòng đăng nhập để mở gian hàng.' }
    try {
      const res = await apiCreateSellerShop(shopName)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success || !data?.data?.user) {
        if (res.status === 401 || data?.error?.code === 'AUTH_EXPIRED') {
          sessionStorage.removeItem(TOKEN_KEY)
          setUser(null)
          return { ok: false, error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để mở gian hàng.' }
        }
        return { ok: false, error: data?.message || 'Không thể mở gian hàng.' }
      }
      if (data?.data?.token) {
        sessionStorage.setItem(TOKEN_KEY, data.data.token)
      }
      if (data?.data?.refreshToken) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken)
      }
      const normalized = normalizeUser(data.data.user)
      setAuthError('')
      setUser(normalized)
      return { ok: true, user: normalized }
    } catch {
      return { ok: false, error: 'Không thể kết nối đến máy chủ Backend. Vui lòng thử lại.' }
    }
  }, [user])

  /**
   * Đăng xuất: hủy bỏ restoreSession đang bay, tăng version auth, xóa token và xóa toàn bộ phiên (cả Backend và Firebase).
   */
  const logout = useCallback(async () => {
    restoreAbortRef.current?.abort()
    authVersionRef.current += 1
    const currentRefreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY)
    if (currentRefreshToken) {
      apiLogout(currentRefreshToken).catch(() => {})
    }
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.removeItem(AUTH_PROVIDER_KEY)
    setAuthError('')
    if (isFirebaseConfigured()) {
      try {
        await firebaseSignOut()
      } catch (err) {
        console.warn('Lỗi khi đăng xuất Firebase:', err)
      }
    }
    setUser(null)
  }, [])

  /**
   * Đổi mật khẩu tài khoản và cập nhật token mới.
   */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      const res = await apiChangePassword(currentPassword, newPassword)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        return {
          ok: false,
          error: data?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.',
        }
      }
      if (data.data?.token) {
        sessionStorage.setItem(TOKEN_KEY, data.data.token)
      }
      if (data.data?.refreshToken) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken)
      }
      return { ok: true, message: data.message || 'Đổi mật khẩu thành công.' }
    } catch {
      return { ok: false, error: 'Lỗi kết nối khi đổi mật khẩu.' }
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isInitializing,
      authError,
      isAuthenticated: Boolean(user),
      isSeller: Boolean(user?.role === 'seller' || user?.shopId),
      isFirebaseConfigured: isFirebaseConfigured(),
      avatar: user
        ? user.avatarUrl || shopAvatar({ name: user.fullName, emoji: user.avatarEmoji || '🙂', hue: user.hue ?? 12 })
        : '',
      login,
      loginWithGoogle,
      loginAs,
      register,
      openSellerShop,
      changePassword,
      logout,
      updateProfile,
    }),
    [user, isInitializing, authError, login, loginWithGoogle, loginAs, register, openSellerShop, logout, updateProfile, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>')
  return ctx
}

export default AuthContext
