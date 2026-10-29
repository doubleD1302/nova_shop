import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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

/**
 * QUẢN LÝ ĐƠN HÀNG (NGƯỜI BÁN) - PHONG CÁCH SHOPEE SELLER CENTRE HỒNG PASTEL
 */
export default function SellerOrdersPage() {
  const { user } = useAuth()
  const { getShop } = useCatalog()
  const {
    getOrdersByShop,
    updateOrderStatus,
    loadSellerOrders,
    sellerOrdersLoading,
    sellerOrdersSummary,
  } = useOrders()
  const { pushToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const tab = searchParams.get('tab') || 'all'
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    loadSellerOrders().catch((error) => console.error('Could not load seller orders:', error))
  }, [loadSellerOrders])

  const shop = getShop(user?.shopId)
  const orders = getOrdersByShop(user?.shopId)

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

  const countByStatus = (id) =>
    id === 'all' ? sellerOrdersSummary.total || 0 : Number(sellerOrdersSummary[id]) || 0
  const revenue = sellerOrdersSummary.revenue || 0

  const handleTabChange = (tabId) => {
    if (tabId === 'all') {
      searchParams.delete('tab')
    } else {
      searchParams.set('tab', tabId)
    }
    setSearchParams(searchParams)
  }

  const act = async (shopOrderId, status, message) => {
    if (await updateOrderStatus(shopOrderId, status)) {
      pushToast(message, 'success')
    }
  }

  return (
    <div className="space-y-4">
      {/* Tiêu đề & Tổng doanh thu */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] px-5 py-4 shadow-2xs">
        <div>
          <h1 className="text-[18px] font-bold text-[#49352D]">Quản Lý Đơn Hàng</h1>
          <p className="mt-0.5 text-[12px] text-[#8B7566]">
            Gian hàng <b className="text-[#49352D]">{shop?.name || user?.username}</b> · {orders.length}/
            {sellerOrdersSummary.total || orders.length} đơn hàng
          </p>
        </div>

        <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] px-4 py-2 text-right">
          <span className="block text-[11px] text-[#8B7566]">Doanh thu từ đơn đã giao</span>
          <span className="text-[16px] font-bold text-[#A95532]">{formatVnd(revenue)}</span>
        </div>
      </div>

      {/* Tabs đơn hàng & Thanh tìm kiếm */}
      <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs">
        <div className="no-scrollbar flex items-center overflow-x-auto border-b border-[#E6D5C2] px-4">
          {TABS.map((t) => {
            const active = tab === t.id
            const count = countByStatus(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTabChange(t.id)}
                className={`whitespace-nowrap border-b-2 py-3.5 px-4 text-[13px] transition ${
                  active
                    ? 'border-[#A95532] font-bold text-[#A95532]'
                    : 'border-transparent font-medium text-[#8B7566] hover:text-[#A95532]'
                }`}
              >
                {t.label} ({count})
              </button>
            )
          })}
        </div>

        <div className="p-4">
          <div className="relative flex max-w-md items-center">
            <span className="absolute left-3 text-[#8B7566]">
              <IconSearch className="h-4 w-4" />
            </span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo mã đơn hàng, người mua hoặc sản phẩm..."
              className="w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] pl-9 pr-3.5 py-2 text-[13px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#BD6E49]"
            />
          </div>
        </div>
      </div>

      {/* Danh sách đơn hàng */}
      <div className="space-y-3">
        {sellerOrdersLoading ? (
          <p className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 text-center text-[13px] text-[#8B7566]">
            Đang tải dữ liệu đơn hàng...
          </p>
        ) : null}

        {filtered.map((order) => (
          <div
            key={order.id}
            className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] overflow-hidden shadow-2xs transition hover:border-[#BD6E49]"
          >
            {/* Header đơn */}
            <div className="flex flex-wrap items-center gap-3 border-b border-[#E6D5C2] bg-[#FBF3E8] px-5 py-3">
              <span className="text-[13px] font-bold text-[#49352D]">{order.code}</span>
              <span className="text-[12px] text-[#8B7566]">{formatDateTime(order.createdAt)}</span>
              <span className="text-[12px] text-[#8B7566]">· Người mua: <b className="text-[#49352D]">{order.buyerName}</b></span>
              <OrderStatusBadge status={order.status} className="ml-auto" />
            </div>

            {/* Danh sách sản phẩm trong đơn */}
            <div className="divide-y divide-[#E6D5C2]/60">
              {order.items.map((item) => (
                <div
                  key={`${order.id}-${item.productId}-${item.variant}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <SmartImage
                    src={item.image}
                    fallback={item.imageFallback || item.image}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl border border-[#E6D5C2] object-cover"
                  />
                  <div className="min-w-[180px] flex-1">
                    <span className="line-clamp-2 text-[13px] font-medium text-[#49352D]">{item.name}</span>
                    <span className="mt-0.5 block text-[11px] text-[#8B7566]">
                      Phân loại: {item.variant || 'Mặc định'} · Số lượng: x{item.qty}
                    </span>
                  </div>
                  <span className="text-[14px] font-bold text-[#A95532]">
                    {formatVnd(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer đơn: thanh toán, phí ship, tổng tiền và các nút thao tác */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6D5C2] bg-[#FBF3E8]/50 px-5 py-3.5">
              <div className="text-[12px] text-[#8B7566]">
                Phương thức: <b className="text-[#49352D]">{PAYMENT_LABEL[order.payment] || order.payment}</b> ·{' '}
                {order.shippingUnit} ·{' '}
                {order.shippingFee === 0 ? 'Freeship' : formatVnd(order.shippingFee)}
              </div>

              <div className="text-[13px] text-[#8B7566]">
                Tổng thu gian hàng: <b className="text-[15px] font-bold text-[#A95532]">{formatVnd(order.totalForShop)}</b>
              </div>

              <div className="flex w-full flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#E6D5C2]/50">
                <Link
                  to={`/don-hang/${order.id}`}
                  className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3.5 py-1.5 text-[12px] font-medium text-[#8B7566] transition hover:border-[#BD6E49] hover:text-[#A95532]"
                >
                  Xem chi tiết đơn
                </Link>

                {order.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => act(order.shopOrderId, 'confirmed', 'Đã xác nhận đơn hàng')}
                      className="flex items-center gap-1.5 rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-3.5 py-1.5 text-[12px] font-semibold text-[#FFFCF7] shadow-2xs transition active:scale-[0.99]"
                    >
                      <IconCheck className="h-3.5 w-3.5" />
                      Xác nhận đơn
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Bạn có chắc chắn muốn hủy đơn hàng này?')) {
                          updateOrderStatus(order.shopOrderId, 'cancelled').then((ok) => {
                            if (ok) pushToast('Đã huỷ đơn hàng', 'success')
                          })
                        }
                      }}
                      className="rounded-xl border border-rose-200 bg-[#FFFCF7] px-3.5 py-1.5 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      Huỷ đơn
                    </button>
                  </>
                ) : null}

                {order.status === 'confirmed' ? (
                  <button
                    type="button"
                    onClick={() => act(order.shopOrderId, 'shipping', 'Đã bàn giao cho đơn vị vận chuyển')}
                    className="flex items-center gap-1.5 rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-3.5 py-1.5 text-[12px] font-semibold text-[#FFFCF7] shadow-2xs transition active:scale-[0.99]"
                  >
                    <IconTruck className="h-3.5 w-3.5" />
                    Bàn giao vận chuyển
                  </button>
                ) : null}

                {order.status === 'shipping' ? (
                  <button
                    type="button"
                    onClick={() => act(order.shopOrderId, 'delivered', 'Đơn hàng đã giao thành công')}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-[12px] font-semibold text-[#FFFCF7] shadow-2xs transition active:scale-[0.99]"
                  >
                    <IconCheck className="h-3.5 w-3.5" />
                    Đã giao thành công
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}

        {!filtered.length ? (
          <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-8">
            <EmptyState
              emoji="🧾"
              title="Không có đơn hàng nào"
              description="Đơn hàng của người mua sẽ hiển thị tại đây khi khách đặt mua sản phẩm của shop."
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
