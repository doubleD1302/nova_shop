import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCatalog } from '../context/CatalogContext'
import { useToast } from '../context/ToastContext'
import AuthLayout from '../components/auth/AuthLayout'
import { IconStore, IconUser } from '../components/ui/Icons'

/** TRANG ĐĂNG KÝ — chọn vai trò người mua hoặc người bán */
export default function RegisterPage() {
  const { register } = useAuth()
  const { addShop } = useCatalog()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const [role, setRole] = useState('buyer')
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

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.fullName.trim() || !form.username.trim() || !form.password) {
      setError('Vui lòng nhập họ tên, tên đăng nhập và mật khẩu.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Mật khẩu nhập lại không khớp.')
      return
    }
    if (role === 'seller' && !form.shopName.trim()) {
      setError('Người bán cần nhập tên gian hàng.')
      return
    }

    let shop = null
    if (role === 'seller') {
      shop = addShop({
        name: form.shopName.trim(),
        tagline: form.shopTagline.trim() || 'Gian hàng mới trên ShopNova',
        location: 'TP. Hồ Chí Minh',
        emoji: '🏪',
        hue: form.shopName.length * 13 % 360,
      })
    }

    const res = register({
      fullName: form.fullName,
      username: form.username,
      password: form.password,
      email: form.email,
      phone: form.phone,
      role,
      shopId: shop?.id || null,
    })

    if (!res.ok) {
      setError(res.error)
      return
    }

    pushToast('Đăng ký thành công!', 'success')
    navigate(role === 'seller' ? '/nguoi-ban' : '/')
  }

  const inputClass =
    'w-full rounded-sm border border-line px-3 py-2.5 text-[14px] outline-none focus:border-brand'

  return (
    <AuthLayout
      title="Đăng Ký"
      subtitle="Tạo tài khoản người mua để đặt hàng, hoặc tài khoản người bán để mở gian hàng riêng."
      bannerTitle="Bán hàng chuyên nghiệp, miễn phí gian hàng"
      bannerEmojis="🏪"
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
            className={`flex flex-col items-start gap-1 rounded-sm border p-3 text-left transition ${
              role === r.id ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-soft hover:border-brand-light'
            }`}
          >
            {r.icon}
            <span className="text-[13px] font-semibold">{r.label}</span>
            <span className="text-[11px] text-muted">{r.desc}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid gap-3.5 md:grid-cols-2">
          <input value={form.fullName} onChange={set('fullName')} placeholder="Họ và tên" className={inputClass} />
          <input value={form.username} onChange={set('username')} placeholder="Tên đăng nhập" className={inputClass} />
          <input value={form.phone} onChange={set('phone')} placeholder="Số điện thoại" className={inputClass} />
          <input value={form.email} onChange={set('email')} placeholder="Email" className={inputClass} />
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="Mật khẩu"
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
          <div className="grid gap-3.5 rounded-sm border border-dashed border-brand/40 bg-brand-soft/40 p-3 md:grid-cols-2">
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

        {error ? <p className="rounded-sm bg-rose-50 px-3 py-2 text-[13px] text-rose-600">{error}</p> : null}

        <button
          type="submit"
          className="w-full rounded-sm bg-gradient-to-b from-[#f86a4b] to-[#ee4d2d] py-2.5 text-[14px] font-medium text-white transition hover:brightness-105"
        >
          Đăng Ký {role === 'seller' ? '& Mở Gian Hàng' : 'Tài Khoản'}
        </button>

        <p className="text-center text-[13px] text-muted">
          Đã có tài khoản?{' '}
          <Link to="/dang-nhap" className="text-brand hover:underline">
            Đăng nhập
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
