import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import { formatSold } from '../../utils/format'
import { DiscountBadge, ShipBadge } from '../ui/Badge'
import { IconCart, IconChat, IconShieldCheck, IconStar, IconTruck } from '../ui/Icons'
import Price, { OldPrice } from '../ui/Price'
import QuantityStepper from '../ui/QuantityStepper'

/** Panel mua hàng: giá, phân loại, số lượng, nút Thêm vào giỏ / Mua ngay */
export default function ProductPurchasePanel({ product, rating = product.rating, selected: controlledSelection, onVariantChange }) {
  const navigate = useNavigate()
  const { addToCart, buyNow } = useCart()
  const { pushToast } = useToast()
  const [qty, setQty] = useState(1)
  const [internalSelection, setInternalSelection] = useState(() => (product.variantGroups || []).map((g) => g.options?.[0] || ''))
  const selected = controlledSelection ?? internalSelection
  const variantLabel = selected.filter(Boolean).join(' / ')
  const selectedSku = product.variants?.find((variant) => variant.name === variantLabel) || product.variants?.[0]
  const displayedPrice = selectedSku?.price ?? product.price
  const displayedStock = selectedSku?.stock ?? 0
  const pickVariant = (gi, option) => {
    if (onVariantChange) onVariantChange(gi, option)
    else setInternalSelection((list) => list.map((v, i) => (i === gi ? option : v)))
  }

  const handleAddToCart = () => {
    const key = addToCart(product, { qty, variant: selectedSku?.name || variantLabel, variantId: selectedSku?.id })
    if (!key) {
      pushToast('Sản phẩm này hiện không có tồn kho khả dụng.', 'error')
      return
    }
    pushToast(`Đã thêm ${qty} sản phẩm vào giỏ hàng`, 'cart')
  }

  const handleBuyNow = () => {
    const key = buyNow(product, { qty, variant: selectedSku?.name || variantLabel, variantId: selectedSku?.id })
    if (!key) {
      pushToast('Sản phẩm này hiện không có tồn kho khả dụng.', 'error')
      return
    }
    navigate('/gio-hang')
  }

  return (
    <div className="min-w-0 flex-1 px-1 lg:px-5">
      <h1 className="text-[18px] font-medium leading-[24px] text-ink">
        <span className="mr-2 rounded-[2px] bg-brand px-1.5 py-[2px] align-middle text-[12px] font-bold uppercase text-white">
          Yêu thích
        </span>
        {product.name}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <span className="flex items-center gap-1.5">
          <span className="border-b border-brand text-[16px] font-medium text-brand">{rating}</span>
          <span className="flex text-[#ffce3d]">
            {[0, 1, 2, 3, 4].map((i) => (
              <IconStar key={i} className="h-3.5 w-3.5" filled={i < Math.round(rating)} />
            ))}
          </span>
        </span>
        <span className="h-4 w-px bg-line" />
        <span className="text-ink-soft">
          <b className="text-ink">{formatSold(product.sold)}</b> Đã bán
        </span>
        <span className="h-4 w-px bg-line" />
        <span className="flex items-center gap-1 text-muted">
          <IconCart className="h-4 w-4" />
          Yêu thích
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-page px-4 py-3">
        <div className="flex items-baseline gap-2">
          <Price value={displayedPrice} size="xl" className="text-brand font-bold" />
          {selectedSku?.originalPrice > displayedPrice ? <OldPrice value={selectedSku.originalPrice} size="md" /> : null}
        </div>
        {product.discount ? (
          <span className="flex items-center gap-1.5">
            <DiscountBadge percent={product.discount} />
            <span className="text-[12px] font-bold uppercase text-brand">Giảm giá</span>
          </span>
        ) : null}
        <span className="ml-auto text-[12px] text-muted">Kho: {displayedStock} sản phẩm</span>
      </div>
      <div className="mt-4 space-y-2 text-[13px]">
        <div className="flex items-start gap-3">
          <span className="w-[92px] shrink-0 text-muted">Vận chuyển</span>
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="flex items-center gap-2 text-ink-soft">
              <IconTruck className="h-4 w-4 text-brand" />
              Giao hàng tận nơi toàn quốc
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <ShipBadge type="freeship" />
              <ShipBadge type="extra" />
              <span className="text-[12px] text-muted">Miễn phí vận chuyển cho đơn từ 1.000.000₫</span>
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="w-[92px] shrink-0 text-muted">An tâm mua</span>
          <span className="flex items-center gap-2 text-ink-soft">
            <IconShieldCheck className="h-4 w-4 text-brand" />
            Trả hàng miễn phí trong 15 ngày · Bảo hành chính hãng
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {(product.variantGroups || []).map((group, gi) => (
          <div key={group.name} className="flex items-start gap-3">
            <span className="w-[92px] shrink-0 pt-1.5 text-[13px] text-muted">{group.name}</span>
            <div className="flex flex-wrap gap-2">
              {group.options.map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => pickVariant(gi, op)}
                  className={`relative rounded-md border px-3 py-1.5 text-[13px] transition cursor-pointer ${
                    selected[gi] === op
                      ? 'border-[#BD6E49] bg-[#F5E7D4] text-[#BD6E49] font-medium'
                      : 'border-[#E6D5C2] bg-[#FFFCF7] text-[#49352D] hover:border-[#BD6E49]'
                  }`}
                >
                  {op}
                  {selected[gi] === op ? (
                    <span
                      className="absolute -bottom-[1px] -right-[1px] h-3 w-3 bg-[#BD6E49]"
                      style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3">
          <span className="w-[92px] shrink-0 text-[13px] text-muted">Số lượng</span>
          <QuantityStepper value={qty} onChange={setQty} min={1} max={Math.max(1, Math.min(99, displayedStock))} />
          <span className="text-[13px] text-muted">{displayedStock} sản phẩm có sẵn</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!selectedSku || displayedStock < 1}
          className="flex h-12 items-center gap-2 rounded-xl border border-[#BD6E49] bg-[#F5E7D4] px-5 text-[14px] font-semibold text-[#BD6E49] transition hover:bg-[#F4E6D2] cursor-pointer"
        >
          <IconCart className="h-5 w-5" />
          Thêm Vào Giỏ Hàng
        </button>
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={!selectedSku || displayedStock < 1}
          className="flex h-12 items-center rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-10 text-[14px] font-semibold text-[#FFFCF7] transition cursor-pointer shadow-xs"
        >
          Mua Ngay
        </button>
        <button
          type="button"
          onClick={() => pushToast('Đã gửi yêu cầu chat tới người bán (demo)', 'info')}
          className="flex h-12 items-center gap-2 rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-4 text-[13px] text-[#49352D] transition hover:border-[#BD6E49] hover:text-[#BD6E49] cursor-pointer"
        >
          <IconChat className="h-5 w-5" />
          Chat với người bán
        </button>
      </div>
    </div>
  )
}
