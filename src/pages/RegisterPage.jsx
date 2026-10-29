import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { isValidEmail, normalizeEmail } from '../utils/validation'
import AuthLayout from '../components/auth/AuthLayout'
import { IconStore, IconUser } from '../components/ui/Icons'

/** TRANG ĐĂNG KÝ — chọn vai trò người mua hoặc người bán */
export default function RegisterPage() {
  const { register } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [role, setRole] = useState(searchParams.get('role') === 'seller' ? 'seller' : 'buyer')
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    password: '',
    confirm: '',
    email: '',
    phone: '',
    shopName: '',
    shopTagline: '',
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
    if (role === 'seller' && !form.shopName.trim()) {
      setError('Người bán cần nhập tên gian hàng.')
      return
    }
    if (role === 'seller' && (form.shopName.trim().length > 160 || form.shopTagline.trim().length > 255)) {
      setError('Tên gian hàng tối đa 160 ký tự và slogan tối đa 255 ký tự.')
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
        role,
        shopName: form.shopName.trim(),
        shopTagline: form.shopTagline.trim(),
      })
      if (!res.ok) {
        if (res.error?.toLowerCase().includes('email')) setEmailError(res.error)
        else setError(res.error)
        return
      }
      pushToast('Đăng ký thành công!', 'success')
      navigate(role === 'seller' ? '/nguoi-ban' : '/')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3.5 py-2.5 text-[14px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#BD6E49] focus:ring-2 focus:ring-[#BD6E49]/20'

  return (
    <AuthLayout
      title="Đăng Ký"
      subtitle="Tạo tài khoản người mua để đặt hàng, hoặc tài khoản người bán để mở gian hàng riêng."
      bannerTitle="Bán hàng chuyên nghiệp, miễn phí gian hàng"
    >
      <div className="mb-5 grid grid-cols-2 gap-3">
        {[
          { id: 'buyer', label: 'Tôi là Người Mua', desc: 'Đặt hàng từ nhiều shop', icon: <IconUser className="h-5 w-5" /> },
          { id: 'seller', label: 'Tôi là Người Bán', desc: 'Mở gian hàng & bán', icon: <IconStore className="h-5 w-5" /> },
        ].map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRole(r.id)}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition cursor-pointer ${
              role === r.id ? 'border-[#BD6E49] bg-[#F5E7D4] text-[#80513B] font-medium shadow-2xs' : 'border-[#E6D5C2] bg-[#FFFCF7] text-[#8B7566] hover:border-[#BD6E49]'
            }`}
          >
            {r.icon}
            <span className="text-[13px] font-semibold text-[#49352D]">{r.label}</span>
            <span className="text-[11px] text-[#8B7566]">{r.desc}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="space-y-3.5">
        <div className="grid gap-3.5 md:grid-cols-2">
          <input value={form.fullName} onChange={set('fullName')} placeholder="Họ và tên" className={inputClass} />
          <input value={form.username} onChange={set('username')} placeholder="Tên đăng nhập" className={inputClass} />
          <input value={form.phone} onChange={set('phone')} placeholder="Số điện thoại" className={inputClass} />
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

        {role === 'seller' ? (
          <div className="grid gap-3.5 rounded-xl border border-dashed border-[#BD6E49] bg-[#F5E7D4] p-3.5 md:grid-cols-2">
            <input
              value={form.shopName}
              onChange={set('shopName')}
              placeholder="Tên gian hàng (bắt buộc)"
              className={inputClass}
            />
            <input
              value={form.shopTagline}
              onChange={set('shopTagline')}
              placeholder="Slogan gian hàng"
              className={inputClass}
            />
          </div>
        ) : null}

        {error ? <p className="rounded-xl border border-[#BD6E49]/40 bg-[#F5E7D4] px-3.5 py-2.5 text-[13px] font-medium text-[#80513B] shadow-2xs">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#BD6E49] hover:bg-[#A95532] active:scale-[0.99] py-3 text-[15px] font-semibold text-[#FFFCF7] shadow-2xs transition-all duration-200 disabled:opacity-60 cursor-pointer"
        >
          {loading ? 'Đang đăng ký...' : `Đăng Ký ${role === 'seller' ? '& Mở Gian Hàng' : 'Tài Khoản'}`}
        </button>

        <p className="text-center text-[13px] text-[#8B7566]">
          Đã có tài khoản?{' '}
          <Link to="/dang-nhap" className="font-medium text-[#80513B] hover:text-[#BD6E49] hover:underline">
            Đăng nhập
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
