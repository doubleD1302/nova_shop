import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCatalog } from '../../context/CatalogContext'
import { formatNumber } from '../../utils/format'
import { IconChart, IconPackage, IconStore, IconUser } from '../ui/Icons'
import SmartImage from '../ui/SmartImage'

const NAV = [
  { to: '/nguoi-ban', label: 'Tổng quan', icon: <IconChart className="h-4 w-4" />, end: true },
  { to: '/nguoi-ban/san-pham', label: 'Quản lý sản phẩm', icon: <IconPackage className="h-4 w-4" /> },
  { to: '/nguoi-ban/don-hang', label: 'Quản lý đơn hàng', icon: <IconStore className="h-4 w-4" /> },
  { to: '/nguoi-ban/gian-hang', label: 'Thông tin gian hàng', icon: <IconUser className="h-4 w-4" /> },
]

/**
 * KHU VỰC NGƯỜI BÁN (Kênh Người Bán).
 * Chỉ tài khoản có role 'seller' mới truy cập được.
 */
export default function SellerLayout() {
  const { user, loginAs, allUsers } = useAuth()
  const { getShop, getProductsByShop } = useCatalog()
  const location = useLocation()

  if (!user || user.role !== 'seller') {
    const sellers = allUsers.filter((u) => u.role === 'seller')
    return (
      <div className="container-shop py-10">
        <div className="mx-auto max-w-[640px] rounded-sm bg-white px-6 py-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-[24px] text-brand">
            🏪
          </span>
          <h1 className="mt-3 text-[18px] font-bold text-ink">Kênh Người Bán ShopNova</h1>
          <p className="mt-1 text-[13px] text-muted">
            Bạn cần đăng nhập bằng tài khoản <b>người bán</b> để quản lý sản phẩm, đơn hàng và gian hàng.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {sellers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loginAs(s.id)}
                className="flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
              >
                <span>{s.avatarEmoji}</span>
                Đăng nhập với {s.fullName}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-3 text-[13px]">
            <NavLink to="/dang-nhap" className="text-brand underline">
              Đăng nhập người bán
            </NavLink>
            <NavLink to="/dang-ky" className="text-brand underline">
              Đăng ký mở gian hàng
            </NavLink>
            <NavLink to="/" className="text-muted underline">
              Về trang người mua
            </NavLink>
          </div>
        </div>
      </div>
    )
  }

  const shop = getShop(user.shopId)
  const productCount = getProductsByShop(user.shopId).length

  return (
    <div className="min-h-screen bg-page">
      {/* Header kênh người bán */}
      <header className="bg-gradient-to-r from-[#ee4d2d] to-[#f97a3c] text-white">
        <div className="container-shop flex flex-wrap items-center gap-4 py-3">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-white/20 text-[16px] font-black">S</span>
            <span className="text-[18px] font-extrabold">
              Shop<span className="text-white/80">Nova</span>
            </span>
          </NavLink>
          <span className="text-[14px] font-medium">Kênh Người Bán</span>

          <div className="ml-auto flex items-center gap-4 text-[13px]">
            <span className="hidden sm:inline">Xin chào, {user.fullName}</span>
            {shop ? (
              <span className="flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1">
                <span className="grid h-5 w-5 place-items-center overflow-hidden rounded-full bg-white">
                  <SmartImage src={shop.avatar} fallback={shop.avatar} alt="" className="h-full w-full object-cover" />
                </span>
                {shop.name}
              </span>
            ) : null}
            <NavLink to="/" className="rounded-sm bg-white/15 px-3 py-1.5 transition hover:bg-white/25">
              Về trang mua sắm
            </NavLink>
          </div>
        </div>
      </header>

      <div className="container-shop grid gap-4 py-4 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-sm border border-line bg-white p-2">
          <div className="mb-2 rounded-sm bg-page px-3 py-2 text-[11px] text-muted">
            Gian hàng:{' '}
            <b className="text-ink">{shop?.name || 'Chưa có gian hàng'}</b>
            <br />
            {formatNumber(productCount)} sản phẩm đang bán
          </div>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-sm px-3 py-2 text-[13px] transition ${
                  isActive ? 'bg-brand-soft font-medium text-brand' : 'text-ink-soft hover:text-brand'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
          <div className="mt-2 border-t border-line px-3 py-2 text-[11px] text-muted">
            Đang xem: {location.pathname}
          </div>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
