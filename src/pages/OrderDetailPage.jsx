import { Link, useNavigate, useParams } from 'react-router-dom'
import { useOrders } from '../context/OrderContext'
import { useToast } from '../context/ToastContext'
import { ORDER_STATUS, PAYMENT_LABEL } from '../data/orders'
import { formatDateTime } from '../utils/format'
import Breadcrumb from '../components/ui/Breadcrumb'
import EmptyState from '../components/ui/EmptyState'
import { groupItemsByShop } from '../components/order/OrderCard'
import OrderStatusBadge, { OrderTimeline } from '../components/order/OrderStatusBadge'
import { IconCheck, IconTruck } from '../components/ui/Icons'
import Price from '../components/ui/Price'
import SmartImage from '../components/ui/SmartImage'

/** TRANG CHI TIẾT ĐƠN HÀNG (phía người mua) */
export default function OrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { getOrderById, cancelOrder, confirmReceived } = useOrders()
  const { pushToast } = useToast()
  const order = getOrderById(orderId)

  if (!order) {
    return (
      <div className="rounded-sm border border-line bg-white">
        <EmptyState
          emoji="🔍"
          title="Không tìm thấy đơn hàng"
          description="Đơn hàng không tồn tại hoặc bạn không có quyền xem."
          action={
            <Link to="/don-hang" className="rounded-sm bg-brand px-5 py-2.5 text-[13px] font-medium text-white">
              Về danh sách đơn hàng
            </Link>
          }
        />
      </div>
    )
  }

  const shopGroups = groupItemsByShop(order.items)

  return (
    <div className="mx-auto max-w-[980px]">
      <Breadcrumb
        className="mb-2"
        items={[{ label: 'Trang chủ', to: '/' }, { label: 'Đơn mua', to: '/don-hang' }, { label: order.code }]}
      />

      <div className="rounded-sm bg-white px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[16px] font-bold text-ink">Chi Tiết Đơn Hàng</h1>
          <span className="text-[13px] text-muted">
            Mã đơn: <b className="text-ink">{order.code}</b>
          </span>
          <OrderStatusBadge status={order.status} className="ml-auto" />
        </div>

        <div className="mt-3 flex items-center gap-2 text-[13px] text-ink-soft">
          <IconTruck className="h-4 w-4 text-free" />
          {order.status === 'delivered'
            ? 'Đơn hàng đã được giao thành công. Cảm ơn bạn đã mua sắm tại ShopNova!'
            : order.status === 'cancelled'
              ? `Đơn hàng đã huỷ${order.cancelReason ? `: ${order.cancelReason}` : ''}`
              : 'Người bán đang chuẩn bị hàng và sẽ sớm giao tới bạn.'}
        </div>

        <div className="mt-5">
          <OrderTimeline status={order.status} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-sm bg-white p-4">
          <h2 className="mb-2 text-[14px] font-semibold text-ink">Địa chỉ nhận hàng</h2>
          <p className="text-[13px] text-ink-soft">{order.address?.fullName || order.buyerName}</p>
          <p className="text-[13px] text-ink-soft">{order.address?.phone}</p>
          <p className="text-[13px] text-ink-soft">
            {[order.address?.detail, order.address?.ward, order.address?.district, order.address?.province]
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
        <div className="rounded-sm bg-white p-4">
          <h2 className="mb-2 text-[14px] font-semibold text-ink">Thông tin thanh toán</h2>
          <p className="text-[13px] text-ink-soft">{PAYMENT_LABEL[order.payment] || order.payment}</p>
          <p className="text-[13px] text-ink-soft">Đơn vị vận chuyển: {order.shippingUnit}</p>
          <p className="text-[13px] text-ink-soft">Ngày đặt: {formatDateTime(order.createdAt)}</p>
          {order.note ? <p className="mt-1 text-[13px] text-muted">Lời nhắn: {order.note}</p> : null}
        </div>
      </div>

      <div className="mt-3 rounded-sm bg-white">
        <h2 className="border-b border-line px-4 py-3 text-[15px] font-semibold text-ink">
          Sản phẩm ({order.items.length})
        </h2>
        {shopGroups.map((g) => (
          <div key={g.shopId} className="border-b border-line last:border-b-0">
            <div className="flex items-center gap-2 bg-page/60 px-4 py-2 text-[13px]">
              <span className="rounded-[2px] bg-brand px-1 text-[10px] font-bold uppercase text-white">Shop</span>
              <Link to={`/shop/${g.shopId}`} className="font-medium text-ink hover:text-brand">
                {g.shopName}
              </Link>
            </div>
            {g.items.map((item) => (
              <div key={`${item.productId}-${item.variant}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <SmartImage
                  src={item.image}
                  fallback={item.image}
                  alt={item.name}
                  className="h-[70px] w-[70px] rounded-sm border border-line object-cover"
                />
                <span className="min-w-[180px] flex-1">
                  <Link to={`/san-pham/${item.slug}`} className="line-clamp-2 text-[13px] text-ink hover:text-brand">
                    {item.name}
                  </Link>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {item.variant || 'Mặc định'} · x{item.qty}
                  </span>
                </span>
                <Price value={item.price} size="sm" className="text-ink-soft" />
                <Price value={item.price * item.qty} size="md" className="w-[110px] text-right text-brand" />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-sm bg-white px-4 py-3 text-[13px]">
        <p className="flex justify-between text-ink-soft">
          <span>Tổng tiền hàng</span>
          <Price value={order.subtotal} size="sm" />
        </p>
        <p className="mt-1.5 flex justify-between text-ink-soft">
          <span>Phí vận chuyển</span>
          {order.shippingFee === 0 ? <span>Miễn phí</span> : <Price value={order.shippingFee} size="sm" />}
        </p>
        {order.discount ? (
          <p className="mt-1.5 flex justify-between text-free">
            <span>Voucher ShopNova</span>
            <span>
              -<Price value={order.discount} size="sm" className="text-free" />
            </span>
          </p>
        ) : null}
        <p className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[14px]">
          <span className="text-ink-soft">Tổng thanh toán</span>
          <Price value={order.total} size="lg" className="text-brand" />
        </p>
      </div>

      <div className="mt-3 rounded-sm bg-white p-4">
        <h2 className="mb-3 text-[14px] font-semibold text-ink">Lịch sử đơn hàng</h2>
        <ol className="space-y-3 border-l border-line pl-4">
          {(order.statusHistory || []).map((h, i) => (
            <li key={`${h.status}-${i}`} className="relative">
              <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-brand" />
              <p className="text-[13px] font-medium text-ink">{ORDER_STATUS[h.status]?.label || h.status}</p>
              <p className="text-[12px] text-muted">{formatDateTime(h.at)}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2 pb-6">
        <button
          type="button"
          onClick={() => pushToast('Đã gửi yêu cầu tới người bán (demo)', 'info')}
          className="rounded-sm border border-line bg-white px-4 py-2 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          Liên hệ người bán
        </button>
        {order.status === 'pending' ? (
          <button
            type="button"
            onClick={() => {
              cancelOrder(order.id)
              pushToast('Đã huỷ đơn hàng', 'success')
            }}
            className="rounded-sm border border-line bg-white px-4 py-2 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Huỷ đơn hàng
          </button>
        ) : null}
        {order.status === 'shipping' ? (
          <button
            type="button"
            onClick={() => {
              confirmReceived(order.id)
              pushToast('Đã xác nhận nhận hàng', 'success')
            }}
            className="flex items-center gap-1.5 rounded-sm bg-brand px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
          >
            <IconCheck className="h-4 w-4" />
            Đã nhận được hàng
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => navigate('/don-hang')}
          className="rounded-sm border border-line bg-white px-4 py-2 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          Về danh sách đơn
        </button>
      </div>
    </div>
  )
}
