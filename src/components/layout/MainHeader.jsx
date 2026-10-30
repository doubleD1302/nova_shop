import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { IconCart, IconUser } from '../ui/Icons'
import AccountMenu from './AccountMenu'
import NotificationBell from './NotificationBell'
import SearchBar from './SearchBar'

/** Header chính: Logo NovaShop Terracotta + Ô tìm kiếm bo tròn + Đăng ký / Đăng nhập / Giỏ hàng */
export default function MainHeader() {
  const { cartCount } = useCart()
  const { user } = useAuth()

  return (
    <header className="border-b border-[#E6D5C2] bg-[#FFFCF7]">
      <div className="container-shop flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3 lg:flex-nowrap lg:gap-8 lg:py-3.5">
        {/* Logo NovaShop chuẩn theo thiết kế Terracotta */}
        <Link to="/" className="group order-1 flex shrink-0 items-center gap-2.5">
          <img
            src="/images/logo.png"
            alt="NovaShop"
            className="h-10 w-10 sm:h-11 sm:w-11 object-contain transition-transform duration-300 group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="max-[360px]:hidden text-[22px] sm:text-[24px] font-black tracking-tight text-[#49352D]">
              Nova<span className="text-[#BD6E49]">Shop</span>
            </span>
          </div>
        </Link>

        {/* Thanh tìm kiếm bo tròn pill ở giữa */}
        <div className="order-3 w-full flex-none lg:order-2 lg:w-auto lg:flex-1">
          <SearchBar />
        </div>

        {/* Nhóm tài khoản & Giỏ hàng bên phải */}
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2.5 sm:gap-4 lg:order-3 lg:ml-0">
          {/* Nút Nova AI Copilot thông minh */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-nova-ai'))}
            title="Trợ lý mua sắm Nova AI Copilot"
            className="flex items-center gap-1.5 rounded-full border border-[#E6D5C2] bg-[#F5E7D4] px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold text-[#80513B] shadow-2xs transition-all duration-200 hover:border-[#BD6E49] hover:bg-[#BD6E49] hover:text-white cursor-pointer"
          >
            <span className="text-sm">✨</span>
            <span className="hidden sm:inline">Nova AI</span>
          </button>

          <NotificationBell />

          {/* Đăng ký / Đăng nhập nếu chưa login */}
          {!user ? (
            <div className="flex items-center gap-2 text-[14px] font-medium text-[#49352D]">
              <Link
                to="/dang-ky"
                className="flex items-center gap-1.5 transition hover:text-[#BD6E49]"
              >
                <IconUser className="h-4 w-4 text-[#8B7566]" />
                <span>Đăng Ký</span>
              </Link>
              <span className="h-3 w-px bg-[#E6D5C2]" />
              <Link
                to="/dang-nhap"
                className="transition hover:text-[#BD6E49]"
              >
                Đăng Nhập
              </Link>
            </div>
          ) : (
            <AccountMenu />
          )}

          <span className="h-4 w-px bg-[#E6D5C2]" />

          {/* Giỏ hàng với badge terracotta */}
          <Link
            to="/gio-hang"
            className="flex items-center gap-1.5 text-[14px] font-medium text-[#49352D] transition hover:text-[#BD6E49]"
          >
            <div className="relative">
              <IconCart className="h-5 w-5 text-[#49352D]" />
              <span className="absolute -right-2.5 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-[#BD6E49] px-1 text-[10px] font-bold text-[#FFFCF7] shadow-xs">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            </div>
            <span className="hidden sm:inline">Giỏ hàng</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
