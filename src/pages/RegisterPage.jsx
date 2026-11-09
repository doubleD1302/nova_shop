import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { isValidEmail, normalizeEmail } from '../utils/validation'
import AuthLayout from '../components/auth/AuthLayout'
import { IconStore } from '../components/ui/Icons'

/** TRANG ĐĂNG KÝ — Dành riêng cho Người Mua (Buyer) */
export default function RegisterPage() {
  const { register } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Nếu người dùng truy cập với ?role=seller, tự động điều hướng sang Kênh Người Bán
  useEffect(() => {
    if (searchParams.get('role') === 'seller') {
      navigate('/nguoi-ban', { replace: true })
    }
  }, [searchParams, navigate])

  const [form, setForm] = useState({
    fullName: '',
    username: '',
    password: '',
    confirm: '',
    email: '',
    phone: '',
  })
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (key === 'email') setEmailError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (loading) return
    if (!form.fullName.trim() || !form.username.trim() || !form.password) {
      setError('Vui lòng nhập họ tên, tên đăng nhập và mật khẩu.')
      return
    }
    if (form.fullName.trim().length > 120 || !/^[a-z0-9_]{3,50}$/i.test(form.username.trim())) {
      setError('Tên cần tối đa 120 ký tự; tên đăng nhập phải có 3–50 chữ cái, chữ số hoặc dấu gạch dưới.')
      return
    }
    if (!isValidEmail(form.email)) {
      setEmailError('Vui lòng nhập email đúng định dạng.')
      return
    }
    if (form.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.')
      return
    }
    if (new TextEncoder().encode(form.password).length > 72) {
      setError('Mật khẩu không được dài quá 72 byte.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Mật khẩu nhập lại không khớp.')
      return
    }
    if (form.phone.trim() && !/^[+()\d .-]{8,20}$/.test(form.phone.trim())) {
      setError('Số điện thoại chỉ được chứa chữ số và ký tự +, khoảng trắng, dấu ngoặc hoặc dấu gạch ngang.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await register({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        password: form.password,
        email: normalizeEmail(form.email),
        phone: form.phone.trim(),
        role: 'buyer',
      })
      if (!res.ok) {
        if (res.error?.toLowerCase().includes('email')) setEmailError(res.error)
        else setError(res.error)
        return
      }
      pushToast('Đăng ký tài khoản thành công! Chào mừng bạn đến với NovaShop.', 'success')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3.5 py-2.5 text-[14px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#BD6E49] focus:ring-2 focus:ring-[#BD6E49]/20'

  return (
    <AuthLayout
      title="Đăng Ký Tài Khoản"
      subtitle="Tạo tài khoản người mua để khám phá hàng ngàn sản phẩm và đặt hàng tiện lợi."
      bannerTitle="Mua sắm thông minh, ngập tràn ưu đãi mỗi ngày"
    >
      <form onSubmit={submit} noValidate className="space-y-3.5">
        <div className="grid gap-3.5 md:grid-cols-2">
          <input
            value={form.fullName}
            onChange={set('fullName')}
            placeholder="Họ và tên"
            className={inputClass}
          />
          <input
            value={form.username}
            onChange={set('username')}
            placeholder="Tên đăng nhập"
            className={inputClass}
          />
          <input
            value={form.phone}
            onChange={set('phone')}
            placeholder="Số điện thoại"
            className={inputClass}
          />
          <div>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              onBlur={() => {
                if (!isValidEmail(form.email)) setEmailError('Vui lòng nhập email đúng định dạng.')
              }}
              placeholder="Email"
              aria-invalid={Boolean(emailError)}
              className={`${inputClass} ${emailError ? 'border-[#BD6E49]' : ''}`}
            />
            {emailError ? <p className="mt-1 text-[12px] font-medium text-[#80513B]">{emailError}</p> : null}
          </div>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="Mật khẩu (tối thiểu 8 ký tự)"
            className={inputClass}
          />
          <input
            type="password"
            value={form.confirm}
            onChange={set('confirm')}
            placeholder="Nhập lại mật khẩu"
            className={inputClass}
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-[#BD6E49]/40 bg-[#F5E7D4] px-3.5 py-2.5 text-[13px] font-medium text-[#80513B] shadow-2xs">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#BD6E49] hover:bg-[#A95532] active:scale-[0.99] py-3 text-[15px] font-semibold text-[#FFFCF7] shadow-2xs transition-all duration-200 disabled:opacity-60 cursor-pointer"
        >
          {loading ? 'Đang tạo tài khoản...' : 'Đăng Ký Tài Khoản'}
        </button>

        <p className="text-center text-[13px] text-[#8B7566]">
          Đã có tài khoản?{' '}
          <Link to="/dang-nhap" className="font-medium text-[#80513B] hover:text-[#BD6E49] hover:underline">
            Đăng nhập
          </Link>
        </p>

        {/* Cầu nối sang Kênh Người Bán */}
        <div className="mt-6 border-t border-[#E6D5C2]/70 pt-4 text-center">
          <p className="text-[12px] text-[#8B7566]">
            Bạn là đối tác bán hàng?{' '}
            <Link
              to="/nguoi-ban"
              className="inline-flex items-center gap-1 font-semibold text-[#BD6E49] hover:text-[#A95532] hover:underline"
            >
              <IconStore className="h-3.5 w-3.5" />
              <span>Đăng ký mở gian hàng tại Kênh Người Bán</span>
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  )
}
