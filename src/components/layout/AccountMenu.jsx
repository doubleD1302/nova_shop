import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { IconChevronDown, IconLogout, IconPackage, IconStore, IconUser } from '../ui/Icons'
import SmartImage from '../ui/SmartImage'

/** Khối tài khoản góc phải header (đăng nhập / menu người dùng) */
export default function AccountMenu() {
  const { user, avatar, logout, loginAs, allUsers } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (!user) {
    return (
      <div className="flex items-center gap-3 text-[13px] font-medium text-ink">
        <Link to="/dang-ky" className="transition hover:text-brand">
          Đăng Ký
        </Link>
        <span className="h-3.5 w-px bg-line" />
        <Link to="/dang-nhap" className="transition hover:text-brand">
          Đăng Nhập
        </Link>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-left"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-white">
          <SmartImage src={avatar} fallback={avatar} alt="" className="h-full w-full object-cover" />
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block truncate text-[13px] font-medium text-ink">{user.fullName}</span>
          <span className="block truncate text-[11px] text-muted">{user.rank}</span>
        </span>
        <IconChevronDown className="h-3.5 w-3.5 text-ink-soft" />
      </button>

      {open ? (
        <div className="animate-fade-up absolute right-0 top-[46px] z-50 w-[240px] overflow-hidden rounded-sm border border-line bg-white py-1 shadow-pop">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-line">
              <SmartImage src={avatar} fallback={avatar} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink">{user.fullName}</span>
              <span className="block truncate text-[11px] text-muted">@{user.username}</span>
            </span>
          </div>

          <Link
            to="/don-hang"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink-soft transition hover:bg-page hover:text-brand"
          >
            <IconPackage className="h-4 w-4" />
            Đơn mua của tôi
          </Link>
          <Link
            to="/nguoi-ban"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink-soft transition hover:bg-page hover:text-brand"
          >
            <IconStore className="h-4 w-4" />
            {user.role === 'seller' ? 'Kênh Người Bán' : 'Đăng ký bán hàng'}
          </Link>
          <Link
            to="/tai-khoan"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[13px] text-ink-soft transition hover:bg-page hover:text-brand"
          >
            <IconUser className="h-4 w-4" />
            Tài khoản của tôi
          </Link>

          <div className="mt-1 border-t border-line px-3 py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase text-muted">Đổi nhanh tài khoản (demo)</p>
            <div className="flex flex-wrap gap-1.5">
              {allUsers.slice(0, 4).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    loginAs(u.id)
                    setOpen(false)
                  }}
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                    u.id === user.id
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line text-ink-soft hover:border-brand hover:text-brand'
                  }`}
                >
                  {u.fullName}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              logout()
              setOpen(false)
              navigate('/')
            }}
            className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-[13px] text-ink-soft transition hover:bg-page hover:text-brand"
          >
            <IconLogout className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  )
}
