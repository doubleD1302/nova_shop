import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import AuthLayout from '../components/auth/AuthLayout'
import { IconUser, IconLock, IconEye } from '../components/ui/Icons'

/** TRANG ĐĂNG NHẬP - Thiết kế theo phong cách Terracotta + Cream */
export default function LoginPage() {
  const { login, loginWithGoogle, user, authError } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Đảm bảo không hiển thị cảnh báo lỗi cố định khi vừa vào trang
  useEffect(() => {
    setError('')
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (loading || googleLoading) return
    setError('')

    const username = form.username.trim()
    const password = form.password

    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.')
      return
    }

    setLoading(true)
    try {
      const res = await login(username, password)
      if (!res.ok) {
        setError(res.error)
        return
      }
      pushToast(`Xin chào ${res.user.fullName || res.user.username}!`, 'success')
      const returnTo = typeof location.state?.from === 'string' && location.state.from.startsWith('/')
        ? location.state.from
        : null
      navigate(returnTo || (res.user.role === 'admin' ? '/admin' : res.user.role === 'seller' ? '/nguoi-ban' : '/'), { replace: true })
    } catch (err) {
      setError('Đã xảy ra lỗi không thể kết nối tới máy chủ.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleClick = async () => {
    if (loading || googleLoading) return
    setError('')
    setGoogleLoading(true)
    try {
      const res = await loginWithGoogle()
      if (!res.ok) {
        setError(res.error)
        return
      }
      pushToast(`Xin chào ${res.user.fullName || res.user.username}! Đăng nhập Google thành công.`, 'success')
      const returnTo = typeof location.state?.from === 'string' && location.state.from.startsWith('/')
        ? location.state.from
        : null
      navigate(returnTo || (res.user.role === 'admin' ? '/admin' : res.user.role === 'seller' ? '/nguoi-ban' : '/'), { replace: true })
    } catch (err) {
      setError('Đã xảy ra lỗi khi xác thực tài khoản Google.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleFacebookClick = () => {
    pushToast('Chức năng đăng nhập Facebook chưa được hỗ trợ ở bước này. Vui lòng đăng nhập bằng Google hoặc tài khoản Nova Shop.', 'info')
  }

  return (
    <AuthLayout
      title="Đăng Nhập"
      subtitle="Dùng tài khoản người mua hoặc người bán để tiếp tục."
      bannerTitle="Mua sắm & bán hàng trên cùng một sàn"
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Tên đăng nhập */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[#49352D]">
            Tên đăng nhập
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-[#8B7566]">
              <IconUser className="h-4.5 w-4.5" />
            </span>
            <input
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              placeholder="Nhập số điện thoại / email / tên tài khoản"
              disabled={loading}
              className="w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] pl-10 pr-3.5 py-3 text-[14px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#BD6E49] focus:ring-2 focus:ring-[#BD6E49]/20 disabled:bg-[#FBF3E8]"
            />
          </div>
        </div>

        {/* Mật khẩu */}
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-[#49352D]">
            Mật khẩu
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-[#8B7566]">
              <IconLock className="h-4.5 w-4.5" />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Nhập mật khẩu"
              disabled={loading}
              className="w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] pl-10 pr-10 py-3 text-[14px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#BD6E49] focus:ring-2 focus:ring-[#BD6E49]/20 disabled:bg-[#FBF3E8]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 text-[#8B7566] transition hover:text-[#BD6E49] cursor-pointer"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              <IconEye className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Thông báo lỗi nếu có - Nâu đất & be kem Terracotta */}
        {error ? (
          <p className="rounded-xl border border-[#BD6E49]/40 bg-[#F5E7D4] px-3.5 py-2.5 text-[13px] font-medium text-[#80513B] shadow-2xs">
            {error}
          </p>
        ) : null}

        {/* Nút Đăng Nhập phong cách Terracotta */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#BD6E49] hover:bg-[#A95532] active:scale-[0.99] py-3 text-[15px] font-semibold text-[#FFFCF7] shadow-2xs transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {loading ? 'Đang Đăng Nhập...' : 'Đăng Nhập'}
        </button>
      </form>

      {/* Liên kết Đăng ký & Quên mật khẩu */}
      <div className="mt-3.5 flex items-center justify-between text-[13px]">
        <Link to="/dang-ky" className="font-medium text-[#80513B] transition hover:text-[#BD6E49] hover:underline">
          Đăng ký tài khoản mới
        </Link>
        <button
          type="button"
          onClick={() => pushToast('Vui lòng liên hệ hỗ trợ hoặc dùng tài khoản có sẵn: demo_buyer / demo_seller_a (mật khẩu Buyer123456 / Seller123456)', 'info')}
          className="text-[#8B7566] transition hover:text-[#BD6E49] cursor-pointer"
        >
          Quên mật khẩu?
        </button>
      </div>

      {/* Đường phân cách */}
      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E6D5C2]" />
        </div>
        <span className="relative bg-[#FFFCF7] px-3 text-[12px] text-[#8B7566]">
          hoặc đăng nhập bằng
        </span>
      </div>

      {/* Các nút mạng xã hội */}
      <div className="grid grid-cols-2 gap-3">
        {/* Nút Google thật kết nối Firebase Authentication */}
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={loading || googleLoading}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] py-2.5 px-3 text-[13px] font-medium text-[#49352D] shadow-2xs transition hover:bg-[#F5E7D4] hover:border-[#BD6E49] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {googleLoading ? (
            <svg className="h-4.5 w-4.5 animate-spin text-[#BD6E49]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span className="truncate">{googleLoading ? 'Đang kết nối...' : 'Tiếp tục với Google'}</span>
        </button>

        {/* Nút Facebook */}
        <button
          type="button"
          onClick={handleFacebookClick}
          disabled={loading || googleLoading}
          className="flex items-center justify-center gap-2 rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] py-2.5 px-3 text-[13px] font-medium text-[#49352D] shadow-2xs transition hover:bg-[#F5E7D4] hover:border-[#BD6E49] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          <svg className="h-4.5 w-4.5 shrink-0 fill-[#1877F2]" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span className="truncate">Tiếp tục với Facebook</span>
        </button>
      </div>

      {/* Hiển thị tài khoản đang đăng nhập nếu có */}
      {user ? (
        <div className="mt-4 rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3 text-[12px] text-[#8B7566]">
          Đang đăng nhập với <b className="text-[#49352D]">{user.fullName || user.username}</b> ({user.role === 'seller' ? 'người bán' : 'người mua'}).
        </div>
      ) : null}
    </AuthLayout>
  )
}
