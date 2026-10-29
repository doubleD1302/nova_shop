import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useCatalog } from '../context/CatalogContext'
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
  const { loadProducts } = useCatalog()
  const { pushToast } = useToast()

  useEffect(() => {
    const ids = [...new Set(items.filter((item) => item.unavailable).map((item) => item.productId).filter(Boolean))]
    if (ids.length) loadProducts({ ids: ids.slice(0, 50).join(','), limit: Math.min(ids.length, 50), offset: 0 })
      .catch((error) => console.error('Không thể làm mới sản phẩm trong giỏ:', error))
  }, [items, loadProducts])

  const allSelected = items.length > 0 && items.every((i) => i.selected)

  if (!items.length) {
    return (
      <div>
        <Breadcrumb className="mb-2" items={[{ label: 'Trang chủ', to: '/' }, { label: 'Giỏ hàng' }]} />
        <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7]">
          <EmptyState
            emoji="🛒"
            title="Giỏ hàng của bạn đang trống"
            description="Khám phá hàng nghìn sản phẩm từ nhiều gian hàng khác nhau trên NovaShop."
            action={
              <Link
                to="/tim-kiem"
                className="rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-5 py-2.5 text-[13px] font-medium text-[#FFFCF7] transition"
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

      <div className="flex items-center gap-3 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] px-4 py-3">
        <h1 className="flex items-center gap-2 text-[16px] font-bold text-[#49352D]">
          <IconCart className="h-5 w-5 text-[#BD6E49]" />
          Giỏ Hàng Của Tôi
        </h1>
        <span className="text-[13px] text-[#8B7566]">
          {cartCount} sản phẩm · {groups.length} gian hàng
        </span>
        {summary.subtotal >= 1000000 ? (
          <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#547653]/10 px-2.5 py-1 text-[12px] font-medium text-[#547653]">
            <IconTruck className="h-4 w-4" />
            Đơn {formatVnd(summary.subtotal)} đã được miễn phí vận chuyển
          </span>
        ) : (
          <span className="ml-auto text-[12px] text-[#8B7566]">
            Mua thêm {formatVnd(Math.max(0, 1000000 - summary.subtotal))} để được miễn phí vận chuyển
          </span>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] overflow-hidden">
        {/* Header bảng */}
        <div className="hidden items-center gap-3 border-b border-[#E6D5C2] bg-[#F5E7D4] px-3 py-3 text-[13px] font-medium text-[#49352D] md:flex">
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
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E6D5C2] bg-[#FFFCF7] shadow-[0_-4px_16px_rgba(128,81,59,0.08)]">
        <div className="container-shop flex flex-wrap items-center gap-3 py-3">
          <CartCheckbox checked={allSelected} onChange={() => selectAll(!allSelected)} label="Chọn Tất Cả" />

          <button
            type="button"
            onClick={() => {
              if (!summary.selectedCount) return pushToast('Vui lòng chọn sản phẩm để xoá', 'error')
              removeSelected()
              pushToast('Đã xoá các sản phẩm đã chọn khỏi giỏ hàng', 'success')
            }}
            className="text-[13px] text-[#8B7566] transition hover:text-[#BD6E49] cursor-pointer"
          >
            Xoá
          </button>
          <button
            type="button"
            onClick={() => pushToast('Đã lưu sản phẩm vào mục Yêu thích (demo)', 'info')}
            className="text-[13px] text-[#8B7566] transition hover:text-[#BD6E49] cursor-pointer"
          >
            Lưu vào Yêu Thích
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-4">
            <span className="text-[13px] text-[#49352D]">
              Tổng thanh toán ({summary.selectedCount} sản phẩm · {summary.shopCount} shop):
              <Price value={summary.total} size="lg" className="ml-1 text-[#BD6E49] font-bold" />
            </span>
            <button
              type="button"
              disabled={!summary.selectedCount}
              onClick={() => navigate('/dat-hang')}
              className="rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-10 py-2.5 text-[14px] font-semibold text-[#FFFCF7] transition cursor-pointer shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mua Hàng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
