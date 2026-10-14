import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import AuthLayout, { DemoAccounts } from '../components/auth/AuthLayout'

/** TRANG ĐĂNG NHẬP */
export default function LoginPage() {
  const { login, user } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (loading) return
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
      navigate(res.user.role === 'seller' ? '/nguoi-ban' : '/')
    } catch (err) {
      setError('Đã xảy ra lỗi không thể kết nối tới máy chủ.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Đăng Nhập"
      subtitle="Dùng tài khoản người mua hoặc người bán để tiếp tục."
      bannerTitle="Mua sắm & bán hàng trên cùng một sàn"
      bannerEmojis="🤝"
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] text-ink-soft">Tên đăng nhập</label>
          <input
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="minhanh / ankerseller / cocoonseller"
            disabled={loading}
            className="w-full rounded-sm border border-line px-3 py-2.5 text-[14px] outline-none focus:border-brand disabled:bg-gray-50"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] text-ink-soft">Mật khẩu</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Mật khẩu tài khoản"
            disabled={loading}
            className="w-full rounded-sm border border-line px-3 py-2.5 text-[14px] outline-none focus:border-brand disabled:bg-gray-50"
          />
        </div>

        {error ? <p className="rounded-sm bg-rose-50 px-3 py-2 text-[13px] text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-gradient-to-b from-[#f86a4b] to-[#ee4d2d] py-2.5 text-[14px] font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Đang Đăng Nhập...' : 'Đăng Nhập'}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-[13px]">
        <Link to="/dang-ky" className="text-brand hover:underline">
          Đăng ký tài khoản mới
        </Link>
        <span className="text-muted">Quên mật khẩu?</span>
      </div>

      {user ? (
        <p className="mt-3 rounded-sm bg-page px-3 py-2 text-[12px] text-muted">
          Đang đăng nhập với <b className="text-ink">{user.fullName}</b> ({user.role === 'seller' ? 'người bán' : 'người mua'}).
        </p>
      ) : null}

      <DemoAccounts
        onPick={(u) => {
          setForm((f) => ({ ...f, username: u.username, password: '' }))
          setError('')
          pushToast(`Đã chọn tài khoản: ${u.fullName} (@${u.username}). Vui lòng nhập mật khẩu.`, 'info')
        }}
      />
    </AuthLayout>
  )
}
