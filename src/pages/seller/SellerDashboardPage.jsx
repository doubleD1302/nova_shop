import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCatalog } from '../../context/CatalogContext'
import { useOrders } from '../../context/OrderContext'
import { ORDER_STATUS } from '../../data/orders'
import { formatNumber, formatSold, formatVnd } from '../../utils/format'
import { getCategoryName } from '../../data/categories'
import OrderStatusBadge from '../../components/order/OrderStatusBadge'
import { IconBolt, IconChart, IconPackage, IconStore, IconTruck } from '../../components/ui/Icons'
import Price from '../../components/ui/Price'
import SmartImage from '../../components/ui/SmartImage'

/** TỔNG QUAN KÊNH NGƯỜI BÁN — số liệu sản phẩm, đơn hàng, doanh thu */
export default function SellerDashboardPage() {
  const { user } = useAuth()
  const { getShop, getProductsByShop } = useCatalog()
  const { getOrdersByShop } = useOrders()

  const shop = getShop(user.shopId)
  const products = getProductsByShop(user.shopId)
  const orders = getOrdersByShop(user.shopId)

  const revenue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.totalForShop, 0)
  const pending = orders.filter((o) => o.status === 'pending')
  const shipping = orders.filter((o) => o.status === 'shipping')
  const lowStock = [...products].sort((a, b) => a.stock - b.stock).slice(0, 5)
  const bestSellers = [...products].sort((a, b) => b.sold - a.sold).slice(0, 5)

  const stats = [
    { label: 'Doanh thu (đơn không huỷ)', value: formatVnd(revenue), emoji: '💰', bg: 'bg-[#fff1ec]' },
    { label: 'Sản phẩm đang bán', value: formatNumber(products.length), emoji: '📦', bg: 'bg-[#eef2ff]' },
    { label: 'Đơn chờ xác nhận', value: formatNumber(pending.length), emoji: '⏳', bg: 'bg-[#fff8e6]' },
    { label: 'Đơn đang giao', value: formatNumber(shipping.length), emoji: '🚚', bg: 'bg-[#e9fbf3]' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-sm bg-white px-4 py-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
          <IconChart className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-[16px] font-bold text-ink">Tổng Quan Gian Hàng</h1>
          <p className="text-[12px] text-muted">
            {shop?.name} · {shop?.tagline}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link
            to="/nguoi-ban/san-pham/them-moi"
            className="rounded-sm bg-brand px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
          >
            + Đăng sản phẩm mới
          </Link>
          <Link
            to="/nguoi-ban/don-hang"
            className="rounded-sm border border-line px-4 py-2 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Xử lý đơn hàng
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-sm border border-line bg-white px-4 py-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[20px] ${s.bg}`}>
              {s.emoji}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-semibold text-ink">{s.value}</span>
              <span className="block text-[11px] text-muted">{s.label}</span>
            </span>
          </div>
        ))}
      </div>

      <section className="rounded-sm border border-line bg-white">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-ink">
            <IconTruck className="h-4 w-4 text-brand" />
            Đơn hàng mới nhất
          </h2>
          <Link to="/nguoi-ban/don-hang" className="text-[12px] text-brand hover:underline">
            Xem tất cả
          </Link>
        </header>
        <div className="divide-y divide-line">
          {orders.slice(0, 5).map((o) => (
            <Link
              key={o.id}
              to="/nguoi-ban/don-hang"
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-page/60"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{o.code}</span>
                <span className="block text-[11px] text-muted">
                  {o.buyerName} · {o.items.length} sản phẩm · {ORDER_STATUS[o.status]?.label}
                </span>
              </span>
              <OrderStatusBadge status={o.status} />
              <Price value={o.totalForShop} size="sm" className="text-brand" />
            </Link>
          ))}
          {!orders.length ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">Gian hàng chưa có đơn hàng nào.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-sm border border-line bg-white">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-ink">
            <IconBolt className="h-4 w-4 text-brand" />
            Sản phẩm bán chạy
          </h2>
          <Link to="/nguoi-ban/san-pham" className="text-[12px] text-brand hover:underline">
            Quản lý
          </Link>
        </header>
        <div className="divide-y divide-line">
          {bestSellers.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <SmartImage
                src={p.image}
                fallback={p.image}
                alt=""
                className="h-10 w-10 shrink-0 rounded-sm border border-line object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{p.name}</span>
                <span className="block text-[11px] text-muted">
                  {getCategoryName(p.categoryId)} · Đã bán {formatSold(p.sold)} · Kho {p.stock}
                </span>
              </span>
              <Price value={p.price} size="sm" className="text-brand" />
            </div>
          ))}
          {!bestSellers.length ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">Chưa có sản phẩm. Hãy đăng sản phẩm đầu tiên!</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-sm border border-line bg-white">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <IconPackage className="h-4 w-4 text-brand" />
          <h2 className="text-[14px] font-bold text-ink">Sắp hết hàng — cần nhập thêm</h2>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {lowStock.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-sm border border-line px-3 py-2">
              <SmartImage
                src={p.image}
                fallback={p.image}
                alt=""
                className="h-9 w-9 shrink-0 rounded-sm border border-line object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-ink">{p.name}</span>
                <span className={`block text-[11px] ${p.stock < 60 ? 'text-brand' : 'text-muted'}`}>
                  Còn {p.stock} sản phẩm trong kho
                </span>
              </span>
              <Link to={`/nguoi-ban/san-pham/${p.id}`} className="shrink-0 text-[12px] text-brand hover:underline">
                Sửa
              </Link>
            </div>
          ))}
          {!lowStock.length ? <p className="text-[13px] text-muted">Chưa có dữ liệu kho hàng.</p> : null}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-line bg-white px-4 py-3 text-[12px] text-muted">
        <IconStore className="h-4 w-4 text-brand" />
        Người bán: mỗi tài khoản quản lý 1 gian hàng riêng — người mua có thể mua sản phẩm từ nhiều gian hàng trong cùng
        1 giỏ và 1 đơn hàng.
      </div>
    </div>
  )
}
