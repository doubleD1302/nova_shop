import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useToast } from '../context/ToastContext'
import { formatVnd } from '../utils/format'
import CartShopGroup, { CartCheckbox } from '../components/cart/CartShopGroup'
import Breadcrumb from '../components/ui/Breadcrumb'
import EmptyState from '../components/ui/EmptyState'
import { IconCart, IconTruck } from '../components/ui/Icons'
import Price from '../components/ui/Price'

/** TRANG GIỎ HÀNG — 1 giỏ chứa sản phẩm từ NHIỀU shop, nhóm theo từng shop */
export default function CartPage() {
  const navigate = useNavigate()
  const { items, groups, summary, selectAll, removeSelected, cartCount } = useCart()
  const { pushToast } = useToast()

  const allSelected = items.length > 0 && items.every((i) => i.selected)

  if (!items.length) {
    return (
      <div>
        <Breadcrumb className="mb-2" items={[{ label: 'Trang chủ', to: '/' }, { label: 'Giỏ hàng' }]} />
        <div className="rounded-sm bg-white">
          <EmptyState
            emoji="🛒"
            title="Giỏ hàng của bạn đang trống"
            description="Khám phá hàng nghìn sản phẩm từ nhiều gian hàng khác nhau trên ShopNova."
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
      </div>
    )
  }

  return (
    <div className="pb-24">
      <Breadcrumb className="mb-2" items={[{ label: 'Trang chủ', to: '/' }, { label: 'Giỏ hàng' }]} />

      <div className="flex items-center gap-3 rounded-sm bg-white px-4 py-3">
        <h1 className="flex items-center gap-2 text-[16px] font-bold text-ink">
          <IconCart className="h-5 w-5 text-brand" />
          Giỏ Hàng Của Tôi
        </h1>
        <span className="text-[13px] text-muted">
          {cartCount} sản phẩm · {groups.length} gian hàng
        </span>
        {summary.subtotal >= 1000000 ? (
          <span className="ml-auto flex items-center gap-1.5 rounded-sm bg-free/10 px-2.5 py-1 text-[12px] font-medium text-free">
            <IconTruck className="h-4 w-4" />
            Đơn {formatVnd(summary.subtotal)} đã được miễn phí vận chuyển
          </span>
        ) : (
          <span className="ml-auto text-[12px] text-muted">
            Mua thêm {formatVnd(Math.max(0, 1000000 - summary.subtotal))} để được miễn phí vận chuyển
          </span>
        )}
      </div>

      <div className="mt-3 rounded-sm bg-white">
        {/* Header bảng */}
        <div className="hidden items-center gap-3 border-b border-line px-3 py-3 text-[13px] text-muted md:flex">
          <span className="w-4" />
          <span className="flex-1">Sản Phẩm</span>
          <span className="w-[120px] shrink-0 text-center">Đơn Giá</span>
          <span className="w-[124px] shrink-0 text-center">Số Lượng</span>
          <span className="w-[110px] shrink-0 text-center">Số Tiền</span>
          <span className="w-[70px] shrink-0 text-center">Thao Tác</span>
        </div>

        {groups.map((g) => (
          <CartShopGroup key={g.shopId} group={g} />
        ))}
      </div>

      {/* Thanh thanh toán dính dưới */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="container-shop flex flex-wrap items-center gap-3 py-3">
          <CartCheckbox checked={allSelected} onChange={() => selectAll(!allSelected)} label="Chọn Tất Cả" />

          <button
            type="button"
            onClick={() => {
              if (!summary.selectedCount) return pushToast('Vui lòng chọn sản phẩm để xoá', 'error')
              removeSelected()
              pushToast('Đã xoá các sản phẩm đã chọn khỏi giỏ hàng', 'success')
            }}
            className="text-[13px] text-ink-soft transition hover:text-brand"
          >
            Xoá
          </button>
          <button
            type="button"
            onClick={() => pushToast('Đã lưu sản phẩm vào mục Yêu thích (demo)', 'info')}
            className="text-[13px] text-ink-soft transition hover:text-brand"
          >
            Lưu vào Yêu Thích
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-4">
            <span className="text-[13px] text-ink-soft">
              Tổng thanh toán ({summary.selectedCount} sản phẩm · {summary.shopCount} shop):
              <Price value={summary.total} size="lg" className="ml-1 text-brand" />
            </span>
            <button
              type="button"
              disabled={!summary.selectedCount}
              onClick={() => navigate('/dat-hang')}
              className="rounded-sm bg-gradient-to-b from-[#f86a4b] to-[#ee4d2d] px-10 py-2.5 text-[14px] font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mua Hàng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
