import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCatalog } from '../../context/CatalogContext'
import { useOrders } from '../../context/OrderContext'
import { useToast } from '../../context/ToastContext'
import { ORDER_STATUS, PAYMENT_LABEL } from '../../data/orders'
import { formatDateTime, formatVnd } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import OrderStatusBadge from '../../components/order/OrderStatusBadge'
import { IconCheck, IconSearch, IconTruck } from '../../components/ui/Icons'
import Price from '../../components/ui/Price'
import SmartImage from '../../components/ui/SmartImage'

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ xác nhận' },
  { id: 'confirmed', label: 'Chờ lấy hàng' },
  { id: 'shipping', label: 'Đang giao' },
  { id: 'delivered', label: 'Đã giao' },
  { id: 'cancelled', label: 'Đã huỷ' },
]

/** QUẢN LÝ ĐƠN HÀNG (người bán) — chỉ hiển thị phần sản phẩm thuộc shop của mình */
export default function SellerOrdersPage() {
  const { user } = useAuth()
  const { getShop } = useCatalog()
  const { getOrdersByShop, updateOrderStatus, cancelOrder } = useOrders()
  const { pushToast } = useToast()
  const [tab, setTab] = useState('all')
  const [keyword, setKeyword] = useState('')

  const shop = getShop(user.shopId)
  const orders = getOrdersByShop(user.shopId)

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    return orders
      .filter((o) => (tab === 'all' ? true : o.status === tab))
      .filter((o) =>
        k
          ? o.code.toLowerCase().includes(k) ||
            o.buyerName.toLowerCase().includes(k) ||
            o.items.some((i) => i.name.toLowerCase().includes(k))
          : true,
      )
  }, [orders, tab, keyword])

  const countByStatus = (id) => (id === 'all' ? orders.length : orders.filter((o) => o.status === id).length)
  const revenue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.totalForShop, 0)

  const act = (orderId, status, message) => {
    updateOrderStatus(orderId, status)
    pushToast(message, 'success')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-sm bg-white px-4 py-3">
        <h1 className="text-[16px] font-bold text-ink">Quản Lý Đơn Hàng</h1>
        <span className="text-[13px] text-muted">
          Gian hàng {shop?.name} · {orders.length} đơn chứa sản phẩm của shop
        </span>
        <span className="ml-auto text-[13px] text-ink-soft">
          Doanh thu: <Price value={revenue} size="md" className="text-brand" />
        </span>
      </div>

      <div className="rounded-sm bg-white">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-line px-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-[13px] transition ${
                tab === t.id ? 'border-brand font-medium text-brand' : 'border-transparent text-ink-soft hover:text-brand'
              }`}
            >
              {t.label} ({countByStatus(t.id)})
            </button>
          ))}
          <label className="ml-auto flex h-9 items-center gap-2 rounded-sm border border-line px-2.5">
            <IconSearch className="h-4 w-4 text-muted" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Mã đơn / người mua..."
              className="w-[180px] text-[13px] outline-none"
            />
          </label>
        </div>
      </div>

      <div className="space-y-3 rounded-sm bg-page p-3">
        {filtered.map((order) => (
          <div key={order.id} className="rounded-sm border border-line bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <span className="text-[13px] font-medium text-ink">{order.code}</span>
              <span className="text-[12px] text-muted">{formatDateTime(order.createdAt)}</span>
              <span className="text-[12px] text-muted">· Người mua: {order.buyerName}</span>
              <OrderStatusBadge status={order.status} className="ml-auto" />
            </div>

            {order.items.map((item) => (
              <div
                key={`${order.id}-${item.productId}-${item.variant}`}
                className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <SmartImage
                  src={item.image}
                  fallback={item.image}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-sm border border-line object-cover"
                />
                <span className="min-w-[180px] flex-1">
                  <span className="line-clamp-2 text-[13px] text-ink">{item.name}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {item.variant || 'Mặc định'} · x{item.qty}
                  </span>
                </span>
                <Price value={item.price * item.qty} size="md" className="text-brand" />
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-3 border-t border-line bg-page/40 px-4 py-3">
              <span className="text-[12px] text-muted">
                Thanh toán: {PAYMENT_LABEL[order.payment] || order.payment} · {order.shippingUnit} ·{' '}
                {order.shippingFee === 0 ? 'Miễn phí vận chuyển' : formatVnd(order.shippingFee)}
              </span>
              <span className="ml-auto text-[13px] text-ink-soft">
                Doanh thu shop: <Price value={order.totalForShop} size="md" className="text-brand" />
              </span>

              <div className="flex w-full flex-wrap items-center justify-end gap-2">
                <Link
                  to={`/don-hang/${order.id}`}
                  className="rounded-sm border border-line px-3 py-1.5 text-[12px] text-ink-soft transition hover:border-brand hover:text-brand"
                >
                  Xem chi tiết
                </Link>

                {order.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => act(order.id, 'confirmed', 'Đã xác nhận đơn hàng')}
                      className="flex items-center gap-1.5 rounded-sm bg-brand px-3 py-1.5 text-[12px] font-medium text-white transition hover:brightness-105"
                    >
                      <IconCheck className="h-3.5 w-3.5" />
                      Xác nhận đơn
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        cancelOrder(order.id, 'Người bán huỷ đơn')
                        pushToast('Đã huỷ đơn hàng', 'info')
                      }}
                      className="rounded-sm border border-line px-3 py-1.5 text-[12px] text-ink-soft transition hover:border-brand hover:text-brand"
                    >
                      Huỷ đơn
                    </button>
                  </>
                ) : null}

                {order.status === 'confirmed' ? (
                  <button
                    type="button"
                    onClick={() => act(order.id, 'shipping', 'Đã bàn giao cho đơn vị vận chuyển')}
                    className="flex items-center gap-1.5 rounded-sm bg-brand px-3 py-1.5 text-[12px] font-medium text-white transition hover:brightness-105"
                  >
                    <IconTruck className="h-3.5 w-3.5" />
                    Giao hàng
                  </button>
                ) : null}

                {order.status === 'shipping' ? (
                  <button
                    type="button"
                    onClick={() => act(order.id, 'delivered', 'Đơn hàng đã giao thành công')}
                    className="rounded-sm bg-free px-3 py-1.5 text-[12px] font-medium text-white transition hover:brightness-105"
                  >
                    Đã giao hàng
                  </button>
                ) : null}

                <span className="text-[11px] text-muted">Trạng thái: {ORDER_STATUS[order.status]?.label}</span>
              </div>
            </div>
          </div>
        ))}

        {!filtered.length ? (
          <div className="rounded-sm border border-line bg-white">
            <EmptyState
              emoji="🧾"
              title="Không có đơn hàng nào"
              description="Đơn hàng của người mua sẽ xuất hiện tại đây khi họ đặt sản phẩm của gian hàng bạn."
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
