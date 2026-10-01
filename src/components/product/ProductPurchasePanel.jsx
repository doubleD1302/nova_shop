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
export default function ProductPurchasePanel({ product }) {
  const navigate = useNavigate()
  const { addToCart, buyNow } = useCart()
  const { pushToast } = useToast()
  const [qty, setQty] = useState(1)
  const [selected, setSelected] = useState(() => (product.variantGroups || []).map((g) => g.options?.[0] || ''))

  const variantLabel = selected.filter(Boolean).join(' / ')
  const pickVariant = (gi, option) => setSelected((list) => list.map((v, i) => (i === gi ? option : v)))

  const handleAddToCart = () => {
    addToCart(product, { qty, variant: variantLabel })
    pushToast(`Đã thêm ${qty} sản phẩm vào giỏ hàng`, 'cart')
  }

  const handleBuyNow = () => {
    buyNow(product, { qty, variant: variantLabel })
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
          <span className="border-b border-brand text-[16px] font-medium text-brand">{product.rating}</span>
          <span className="flex text-[#ffce3d]">
            {[0, 1, 2, 3, 4].map((i) => (
              <IconStar key={i} className="h-3.5 w-3.5" filled={i < Math.round(product.rating)} />
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

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-sm bg-page px-4 py-3">
        <div className="flex items-baseline gap-2">
          <Price value={product.price} size="xl" className="text-brand" />
          {product.originalPrice > product.price ? <OldPrice value={product.originalPrice} size="md" /> : null}
        </div>
        {product.discount ? (
          <span className="flex items-center gap-1.5">
            <DiscountBadge percent={product.discount} />
            <span className="text-[12px] font-bold uppercase text-brand">Giảm giá</span>
          </span>
        ) : null}
        <span className="ml-auto text-[12px] text-muted">Kho: {product.stock} sản phẩm</span>
      </div>
      <div className="mt-4 space-y-2 text-[13px]">
        <div className="flex items-start gap-3">
          <span className="w-[92px] shrink-0 text-muted">Vận chuyển</span>
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="flex items-center gap-2 text-ink-soft">
              <IconTruck className="h-4 w-4 text-free" />
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
            <IconShieldCheck className="h-4 w-4 text-free" />
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
                  className={`relative rounded-[2px] border px-3 py-1.5 text-[13px] transition ${
                    selected[gi] === op
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line bg-white text-ink-soft hover:border-brand-light'
                  }`}
                >
                  {op}
                  {selected[gi] === op ? (
                    <span
                      className="absolute -bottom-[1px] -right-[1px] h-3 w-3 bg-brand"
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
          <QuantityStepper value={qty} onChange={setQty} min={1} max={Math.max(1, Math.min(99, product.stock))} />
          <span className="text-[13px] text-muted">{product.stock} sản phẩm có sẵn</span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleAddToCart}
          className="flex h-12 items-center gap-2 rounded-sm border border-brand bg-brand-soft px-5 text-[14px] font-medium text-brand transition hover:bg-[#ffe6df]"
        >
          <IconCart className="h-5 w-5" />
          Thêm Vào Giỏ Hàng
        </button>
        <button
          type="button"
          onClick={handleBuyNow}
          className="flex h-12 items-center rounded-sm bg-gradient-to-b from-[#f86a4b] to-[#ee4d2d] px-10 text-[14px] font-medium text-white transition hover:brightness-105"
        >
          Mua Ngay
        </button>
        <button
          type="button"
          onClick={() => pushToast('Đã gửi yêu cầu chat tới người bán (demo)', 'info')}
          className="flex h-12 items-center gap-2 rounded-sm border border-line px-4 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          <IconChat className="h-5 w-5" />
          Chat với người bán
        </button>
      </div>
    </div>
  )
}
