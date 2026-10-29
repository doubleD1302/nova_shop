import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { IconChevronDown, IconLogout, IconPackage, IconStore, IconUser } from '../ui/Icons'
import SmartImage from '../ui/SmartImage'

/** Khối tài khoản góc phải header (đăng nhập / menu người dùng) */
export default function AccountMenu() {
  const { user, avatar, logout } = useAuth()
  const { pushToast } = useToast()
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
      <div className="flex items-center gap-2 text-xs font-medium text-[#49352D] sm:gap-3 sm:text-[13px]">
        <Link to="/dang-ky" className="whitespace-nowrap transition hover:text-[#BD6E49]">
          Đăng Ký
        </Link>
        <span className="h-3.5 w-px bg-[#E6D5C2]" />
        <Link to="/dang-nhap" className="whitespace-nowrap transition hover:text-[#BD6E49]">
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
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#E6D5C2] bg-[#FFFCF7]">
          <SmartImage src={avatar} fallback={avatar} alt="" className="h-full w-full object-cover" />
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block truncate text-[13px] font-medium text-[#49352D]">{user.fullName}</span>
          <span className="block truncate text-[11px] text-[#8B7566]">{user.rank}</span>
        </span>
        <IconChevronDown className="h-3.5 w-3.5 text-[#8B7566]" />
      </button>

      {open ? (
        <div className="animate-fade-up absolute right-0 top-[46px] z-50 w-[240px] overflow-hidden rounded-lg border border-[#E6D5C2] bg-[#FFFCF7] py-1 shadow-lg">
          <div className="flex items-center gap-2 border-b border-[#E6D5C2] px-3 py-2">
            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-[#E6D5C2]">
              <SmartImage src={avatar} fallback={avatar} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-[#49352D]">{user.fullName}</span>
              <span className="block truncate text-[11px] text-[#8B7566]">@{user.username}</span>
            </span>
          </div>

          <Link
            to="/don-hang"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#49352D] transition hover:bg-[#F5E7D4] hover:text-[#BD6E49]"
          >
            <IconPackage className="h-4 w-4" />
            Đơn mua của tôi
          </Link>
          <Link
            to="/nguoi-ban"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#49352D] transition hover:bg-[#F5E7D4] hover:text-[#BD6E49]"
          >
            <IconStore className="h-4 w-4" />
            {user.role === 'seller' || user.shopId ? 'Kênh Người Bán' : 'Đăng ký bán hàng'}
          </Link>
          <Link
            to="/tai-khoan"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#49352D] transition hover:bg-[#F5E7D4] hover:text-[#BD6E49]"
          >
            <IconUser className="h-4 w-4" />
            Tài khoản của tôi
          </Link>

          {user.role === 'admin' ? (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#49352D] transition hover:bg-[#F5E7D4] hover:text-[#BD6E49]"
            >
              <IconUser className="h-4 w-4" />
              Quản trị hệ thống
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => {
              logout()
              setOpen(false)
              navigate('/')
            }}
            className="flex w-full items-center gap-2 border-t border-[#E6D5C2] px-3 py-2 text-[13px] text-[#49352D] transition hover:bg-[#F5E7D4] hover:text-[#B93832]"
          >
            <IconLogout className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  )
}
