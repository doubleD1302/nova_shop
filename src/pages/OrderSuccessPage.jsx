import { Link, useParams } from 'react-router-dom'
import { useOrders } from '../context/OrderContext'
import { PAYMENT_LABEL } from '../data/orders'
import { formatDateTime } from '../utils/format'
import { groupItemsByShop } from '../components/order/OrderCard'
import OrderStatusBadge, { OrderTimeline } from '../components/order/OrderStatusBadge'
import { IconCheck, IconPackage, IconTruck } from '../components/ui/Icons'
import Price from '../components/ui/Price'
import SmartImage from '../components/ui/SmartImage'

/** TRANG ĐẶT HÀNG THÀNH CÔNG */
export default function OrderSuccessPage() {
  const { orderId } = useParams()
  const { getOrderById } = useOrders()
  const order = getOrderById(orderId)

  if (!order) {
    return (
      <div className="rounded-sm border border-line bg-white px-6 py-16 text-center">
        <p className="text-[15px] font-semibold text-ink">Không tìm thấy đơn hàng</p>
        <Link to="/don-hang" className="mt-4 inline-block text-[13px] text-brand underline">
          Xem danh sách đơn hàng
        </Link>
      </div>
    )
  }

  const shopGroups = groupItemsByShop(order.items)

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="rounded-sm bg-white px-6 py-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-free/10 text-free">
          <IconCheck className="h-8 w-8" />
        </span>
        <h1 className="mt-3 text-[20px] font-bold text-ink">Đặt Hàng Thành Công!</h1>
        <p className="mt-1 text-[13px] text-muted">
          Cảm ơn bạn đã mua sắm tại ShopNova. Đơn hàng đã được gửi tới{' '}
          <b className="text-ink">{shopGroups.length} người bán</b> khác nhau.
        </p>

        <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-1 rounded-sm bg-page px-4 py-2 text-[13px]">
          <span>
            Mã đơn hàng: <b className="text-ink">{order.code}</b>
          </span>
          <span>
            Ngày đặt: <b className="text-ink">{formatDateTime(order.createdAt)}</b>
          </span>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="mt-5">
          <OrderTimeline status={order.status} />
        </div>
      </div>

      {/* Địa chỉ & thanh toán */}
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
          <h2 className="mb-2 text-[14px] font-semibold text-ink">Thanh toán</h2>
          <p className="text-[13px] text-ink-soft">{PAYMENT_LABEL[order.payment] || order.payment}</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            Vận chuyển: {order.shippingUnit} ·{' '}
            {order.shippingFee === 0 ? 'Miễn phí' : <Price value={order.shippingFee} size="sm" />}
          </p>
          <p className="mt-2 text-[14px] text-ink-soft">
            Tổng thanh toán: <Price value={order.total} size="lg" className="text-brand" />
          </p>
        </div>
      </div>

      {/* Sản phẩm trong đơn */}
      <div className="mt-3 rounded-sm bg-white">
        <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-[15px] font-semibold text-ink">
          <IconPackage className="h-5 w-5 text-brand" />
          Sản phẩm trong đơn ({order.items.length})
        </h2>
        {shopGroups.map((g) => (
          <div key={g.shopId} className="border-b border-line last:border-b-0">
            <div className="flex items-center gap-2 bg-page/60 px-4 py-2 text-[13px]">
              <span className="rounded-[2px] bg-brand px-1 text-[10px] font-bold uppercase text-white">Shop</span>
              <Link to={`/shop/${g.shopId}`} className="font-medium text-ink hover:text-brand">
                {g.shopName}
              </Link>
              <span className="ml-auto flex items-center gap-1.5 text-[12px] text-free">
                <IconTruck className="h-3.5 w-3.5" />
                Người bán đã nhận thông báo đơn hàng
              </span>
            </div>
            {g.items.map((item) => (
              <div key={`${item.productId}-${item.variant}`} className="flex items-center gap-3 px-4 py-3">
                <SmartImage
                  src={item.image}
                  fallback={item.image}
                  alt={item.name}
                  className="h-[64px] w-[64px] rounded-sm border border-line object-cover"
                />
                <span className="min-w-0 flex-1">
                  <Link to={`/san-pham/${item.slug}`} className="line-clamp-2 text-[13px] text-ink hover:text-brand">
                    {item.name}
                  </Link>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {item.variant || 'Mặc định'} · x{item.qty}
                  </span>
                </span>
                <Price value={item.price * item.qty} size="md" className="text-brand" />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-3 pb-6">
        <Link
          to="/don-hang"
          className="rounded-sm bg-brand px-6 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
        >
          Xem đơn hàng của tôi
        </Link>
        <Link
          to="/tim-kiem"
          className="rounded-sm border border-line bg-white px-6 py-2.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          Tiếp tục mua sắm
        </Link>
      </div>
    </div>
  )
}
