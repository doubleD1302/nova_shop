import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { IconBell, IconCart } from '../ui/Icons'
import AccountMenu from './AccountMenu'
import SearchBar from './SearchBar'

/** Header chính: logo + ô tìm kiếm + thông báo/giỏ hàng/tài khoản */
export default function MainHeader() {
  const { cartCount } = useCart()

  return (
    <div className="bg-gradient-to-b from-topbar to-[#f8faff]">
      <div className="container-shop flex items-center gap-4 py-3 lg:gap-8">
        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-[#f86a4b] to-[#ee4d2d] text-[19px] font-black text-white shadow-sm">
            S
          </span>
          <span className="hidden text-[22px] font-extrabold tracking-tight text-[#14224a] sm:block">
            Shop<span className="text-brand">Nova</span>
          </span>
        </Link>

        {/* Ô tìm kiếm */}
        <div className="flex-1">
          <SearchBar />
        </div>

        {/* Thông báo / Giỏ hàng / Tài khoản */}
        <div className="flex shrink-0 items-center gap-4">
          <Link
            to="/don-hang"
            className="relative hidden items-center gap-1.5 text-[13px] text-ink transition hover:text-brand md:flex"
          >
            <IconBell className="h-5 w-5" />
            <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
              3
            </span>
          </Link>

          <Link to="/gio-hang" className="relative flex items-center text-ink transition hover:text-brand">
            <IconCart className="h-6 w-6" />
            {cartCount > 0 ? (
              <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full border border-white bg-brand px-1 text-[10px] font-bold text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </Link>

          <span className="hidden h-6 w-px bg-line sm:block" />

          <AccountMenu />
        </div>
      </div>
    </div>
  )
}
