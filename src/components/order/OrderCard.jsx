import { Link } from 'react-router-dom'
import { PAYMENT_LABEL } from '../../data/orders'
import { formatDateTime, formatVnd } from '../../utils/format'
import { IconChat, IconTruck } from '../ui/Icons'
import Price from '../ui/Price'
import SmartImage from '../ui/SmartImage'
import OrderStatusBadge from './OrderStatusBadge'

/** Nhóm sản phẩm của đơn theo shop (dùng ở trang Đơn mua & chi tiết đơn) */
export function groupItemsByShop(items = []) {
  const map = new Map()
  items.forEach((i) => {
    if (!map.has(i.shopId)) map.set(i.shopId, { shopId: i.shopId, shopName: i.shopName, shopMall: i.shopMall, items: [] })
    map.get(i.shopId).items.push(i)
  })
  return [...map.values()]
}

/**
 * Thẻ đơn hàng hiển thị trong danh sách.
 * props: order, role ('buyer' | 'seller'), actions (node nút hành động)
 */
export default function OrderCard({ order, role = 'buyer', actions = null }) {
  const shopGroups = groupItemsByShop(order.items)
  const itemsTotal = order.items.reduce((s, i) => s + i.price * i.qty, 0)

  return (
    <div className="rounded-sm border border-line bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        {role === 'buyer' ? (
          <Link to={`/shop/${shopGroups[0]?.shopId}`} className="flex items-center gap-2 text-[13px] font-medium text-ink hover:text-brand">
            <span className="rounded-[2px] bg-brand px-1 text-[10px] font-bold uppercase text-white">Shop</span>
            {shopGroups.length > 1 ? `${shopGroups.length} gian hàng` : shopGroups[0]?.shopName}
          </Link>
        ) : (
          <span className="text-[13px] text-ink-soft">
            Người mua: <b className="text-ink">{order.buyerName}</b>
          </span>
        )}

        <span className="h-4 w-px bg-line" />
        <span className="text-[12px] text-muted">Mã đơn: {order.code}</span>
        <span className="text-[12px] text-muted">· {formatDateTime(order.createdAt)}</span>

        <span className="ml-auto flex items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <Link to={`/don-hang/${order.id}`} className="text-[12px] text-brand hover:underline">
            Xem chi tiết
          </Link>
        </span>
      </div>

      {shopGroups.map((g) => (
        <div key={g.shopId} className="border-b border-line last:border-b-0">
          {role === 'buyer' && shopGroups.length > 1 ? (
            <div className="flex items-center gap-2 bg-page/60 px-4 py-1.5 text-[12px] text-ink-soft">
              <IconTruck className="h-3.5 w-3.5 text-free" />
              {g.shopName}
            </div>
          ) : null}

          {g.items.map((item) => (
            <div key={`${order.id}-${item.productId}-${item.variant}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link to={`/san-pham/${item.slug}`} className="shrink-0">
                <SmartImage
                  src={item.image}
                  fallback={item.image}
                  alt={item.name}
                  className="h-[72px] w-[72px] rounded-sm border border-line object-cover"
                />
              </Link>
              <div className="min-w-[180px] flex-1">
                <Link to={`/san-pham/${item.slug}`} className="line-clamp-2 text-[13px] leading-[18px] text-ink hover:text-brand">
                  {item.name}
                </Link>
                <span className="mt-1 block text-[11px] text-muted">Phân loại: {item.variant || 'Mặc định'}</span>
              </div>
              <span className="text-[13px] text-ink-soft">
                <Price value={item.price} size="sm" />
              </span>
              <span className="text-[13px] text-muted">x{item.qty}</span>
              <span className="w-[110px] text-right text-[14px] text-brand">
                <Price value={item.price * item.qty} size="sm" />
              </span>
            </div>
          ))}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
        <span className="text-[12px] text-muted">
          Thanh toán: {PAYMENT_LABEL[order.payment] || order.payment} · {order.shippingUnit}
        </span>
        <span className="ml-auto text-[13px] text-ink-soft">
          {role === 'seller' ? 'Doanh thu shop' : 'Thành tiền'}:
          <Price value={role === 'seller' ? order.totalForShop ?? itemsTotal : itemsTotal} size="md" className="ml-1 text-brand" />
        </span>
        {role === 'buyer' ? (
          <span className="text-[12px] text-muted">
            (Phí vận chuyển {order.shippingFee === 0 ? 'miễn phí' : formatVnd(order.shippingFee)})
          </span>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-page/40 px-4 py-3">{actions}</div>
      ) : null}
    </div>
  )
}

/** Nút chat với người bán (dùng chung) */
export function ChatButton({ label = 'Liên Hệ Người Bán' }) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
    >
      <IconChat className="h-4 w-4" />
      {label}
    </button>
  )
}
