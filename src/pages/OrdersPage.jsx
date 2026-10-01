import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrderContext'
import { useToast } from '../context/ToastContext'
import Breadcrumb from '../components/ui/Breadcrumb'
import EmptyState from '../components/ui/EmptyState'
import OrderCard, { ChatButton } from '../components/order/OrderCard'
import { IconPackage } from '../components/ui/Icons'

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ xác nhận' },
  { id: 'confirmed', label: 'Đã xác nhận' },
  { id: 'shipping', label: 'Đang giao' },
  { id: 'delivered', label: 'Đã giao' },
  { id: 'cancelled', label: 'Đã huỷ' },
]

/** TRANG ĐƠN MUA CỦA NGƯỜI MUA */
export default function OrdersPage() {
  const { user } = useAuth()
  const { getOrdersByBuyer, cancelOrder, confirmReceived } = useOrders()
  const { pushToast } = useToast()
  const [tab, setTab] = useState('all')
  const [keyword, setKeyword] = useState('')

  const orders = getOrdersByBuyer(user?.id)

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    return orders
      .filter((o) => (tab === 'all' ? true : o.status === tab))
      .filter((o) =>
        k ? o.code.toLowerCase().includes(k) || o.items.some((i) => i.name.toLowerCase().includes(k)) : true,
      )
  }, [orders, tab, keyword])

  const countByStatus = (id) => (id === 'all' ? orders.length : orders.filter((o) => o.status === id).length)

  return (
    <div>
      <Breadcrumb className="mb-2" items={[{ label: 'Trang chủ', to: '/' }, { label: 'Đơn mua của tôi' }]} />

      <div className="rounded-sm bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <h1 className="flex items-center gap-2 text-[16px] font-bold text-ink">
            <IconPackage className="h-5 w-5 text-brand" />
            Đơn Mua Của Tôi
          </h1>
          <span className="text-[13px] text-muted">{orders.length} đơn hàng</span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo mã đơn hoặc tên sản phẩm..."
            className="ml-auto w-[280px] max-w-full rounded-sm border border-line px-3 py-1.5 text-[13px] outline-none focus:border-brand"
          />
        </div>

        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-2">
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
        </div>

        <div className="space-y-3 bg-page p-3">
          {filtered.length ? (
            filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                role="buyer"
                actions={
                  <>
                    <ChatButton />
                    {order.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => {
                          cancelOrder(order.id)
                          pushToast('Đã huỷ đơn hàng', 'success')
                        }}
                        className="rounded-sm border border-line px-3 py-1.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
                      >
                        Huỷ đơn hàng
                      </button>
                    ) : null}
                    {order.status === 'shipping' ? (
                      <button
                        type="button"
                        onClick={() => {
                          confirmReceived(order.id)
                          pushToast('Đã xác nhận nhận hàng. Cảm ơn bạn!', 'success')
                        }}
                        className="rounded-sm bg-brand px-3 py-1.5 text-[13px] font-medium text-white transition hover:brightness-105"
                      >
                        Đã nhận được hàng
                      </button>
                    ) : null}
                    <Link
                      to={`/don-hang/${order.id}`}
                      className="rounded-sm border border-line px-3 py-1.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
                    >
                      Chi tiết đơn
                    </Link>
                  </>
                }
              />
            ))
          ) : (
            <div className="rounded-sm border border-line bg-white">
              <EmptyState
                emoji="📦"
                title="Chưa có đơn hàng nào"
                description="Các đơn hàng bạn đặt từ nhiều gian hàng sẽ xuất hiện tại đây."
                action={
                  <Link
                    to="/tim-kiem"
                    className="rounded-sm bg-brand px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
                  >
                    Mua sắm ngay
                  </Link>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
