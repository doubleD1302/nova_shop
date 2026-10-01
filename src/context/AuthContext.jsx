import { createContext, useCallback, useContext, useMemo } from 'react'
import { DEFAULT_BUYER_ID, users as seedUsers } from '../data/users'
import { shopAvatar } from '../utils/image'
import { makeId } from '../utils/format'
import { useLocalStorageState } from '../hooks/useLocalStorageState'

const AuthContext = createContext(null)

/**
 * Quản lý phiên đăng nhập (mock).
 * - Người mua: xem sản phẩm, giỏ hàng, đặt hàng, xem đơn hàng.
 * - Người bán: có shopId => vào được Kênh Người Bán để quản lý sản phẩm & đơn.
 */
export function AuthProvider({ children }) {
  const [extraUsers, setExtraUsers] = useLocalStorageState('users:extra', [])
  const [session, setSession] = useLocalStorageState('session', { userId: DEFAULT_BUYER_ID })

  const allUsers = useMemo(() => [...seedUsers, ...extraUsers], [extraUsers])
  const user = useMemo(() => allUsers.find((u) => u.id === session?.userId) || null, [allUsers, session])

  const login = useCallback(
    (username, password) => {
      const found = allUsers.find(
        (u) => u.username.toLowerCase() === String(username).trim().toLowerCase() && u.password === password,
      )
      if (!found) return { ok: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng.' }
      setSession({ userId: found.id })
      return { ok: true, user: found }
    },
    [allUsers, setSession],
  )

  /** Đăng nhập nhanh 1 tài khoản có sẵn (dùng cho demo, không cần nhập mật khẩu) */
  const loginAs = useCallback(
    (userId) => {
      const found = allUsers.find((u) => u.id === userId)
      if (!found) return { ok: false, error: 'Không tìm thấy tài khoản.' }
      setSession({ userId: found.id })
      return { ok: true, user: found }
    },
    [allUsers, setSession],
  )

  const register = useCallback(
    ({ fullName, username, password, role = 'buyer', shopId = null, email = '', phone = '' }) => {
      const uname = String(username).trim().toLowerCase()
      if (!uname || !password) return { ok: false, error: 'Vui lòng nhập đầy đủ thông tin.' }
      if (allUsers.some((u) => u.username.toLowerCase() === uname)) {
        return { ok: false, error: 'Tên đăng nhập đã tồn tại, vui lòng chọn tên khác.' }
      }
      const newUser = {
        id: makeId('u'),
        username: uname,
        password,
        fullName: fullName || username,
        role,
        shopId,
        rank: role === 'seller' ? 'Người bán mới' : 'Thành viên Mới',
        email: email || `${uname}@shopnova.vn`,
        phone: phone || '',
        avatarEmoji: role === 'seller' ? '🏪' : '🙂',
        hue: (uname.length * 37) % 360,
        address: {
          fullName: fullName || username,
          phone: phone || '',
          province: '',
          district: '',
          ward: '',
          detail: '',
        },
      }
      setExtraUsers((list) => [...list, newUser])
      setSession({ userId: newUser.id })
      return { ok: true, user: newUser }
    },
    [allUsers, setExtraUsers, setSession],
  )

  const logout = useCallback(() => setSession({ userId: null }), [setSession])

  const updateProfile = useCallback(
    (patch) => {
      if (!user) return
      const apply = (u) => (u.id === user.id ? { ...u, ...patch } : u)
      setExtraUsers((list) => {
        if (list.some((u) => u.id === user.id)) return list.map(apply)
        // người dùng seed -> chuyển thành bản ghi "extra" để lưu được thay đổi
        return [...list, { ...seedUsers.find((u) => u.id === user.id), ...patch }]
      })
    },
    [user, setExtraUsers],
  )

  const value = useMemo(
    () => ({
      user,
      allUsers,
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
    [user, allUsers, login, loginAs, register, logout, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>')
  return ctx
}

export default AuthContext
