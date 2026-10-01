import { Link } from 'react-router-dom'
import { DiscountBadge, ProductBadgeStack } from '../ui/Badge'
import { IconCart, IconShieldCheck } from '../ui/Icons'
import Price, { OldPrice } from '../ui/Price'
import { RatingRow } from '../ui/Rating'
import SmartImage from '../ui/SmartImage'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'

/** Thanh tiến độ "ĐÃ BÁN x%" trong khối Flash Sale */
function SoldProgress({ percent }) {
  const hot = percent >= 90
  if (hot) {
    return (
      <div className="relative mt-1.5 flex h-[18px] items-center justify-center overflow-hidden rounded-full bg-[#ffd9d0]">
        <span className="text-[11px] font-bold text-brand">CHÁY HÀNG {percent}%</span>
      </div>
    )
  }
  return (
    <div className="relative mt-1.5 h-[18px] overflow-hidden rounded-full bg-[#ffd9d0]">
      <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      <span
        className={`absolute inset-0 flex items-center justify-center text-[11px] font-semibold ${
          percent >= 50 ? 'text-white' : 'text-brand'
        }`}
      >
        ĐÃ BÁN {percent}%
      </span>
    </div>
  )
}

/**
 * Thẻ sản phẩm.
 * variant:
 *  - 'grid'  : thẻ đầy đủ (Gợi ý hôm nay, trang tìm kiếm, trang shop)
 *  - 'flash' : thẻ Flash Sale (có thanh tiến độ đã bán)
 *  - 'mini'  : thẻ nhỏ trong khu "Gian hàng nổi bật"
 */
export default function ProductCard({ product, variant = 'grid' }) {
  const { addToCart } = useCart()
  const { pushToast } = useToast()

  const handleAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    addToCart(product, { qty: 1, variant: product.variantGroups?.[0]?.options?.[0] || '' })
    pushToast(`Đã thêm "${product.name.slice(0, 34)}…" vào giỏ hàng`, 'cart')
  }

  return (
    <Link
      to={`/san-pham/${product.slug}`}
      className="group relative flex flex-col border border-transparent bg-white transition duration-150 hover:z-10 hover:-translate-y-[1px] hover:border-brand hover:shadow-card"
    >
      {/* ---- Ảnh + nhãn ---- */}
      <div className="relative">
        <div className="relative w-full pt-[100%]">
          <SmartImage
            src={product.image}
            fallback={product.image}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        <ProductBadgeStack product={product} className="absolute left-0 top-0 p-1" />
        <DiscountBadge percent={product.discount} className="absolute right-0 top-0" />

        {variant !== 'mini' ? (
          <button
            type="button"
            onClick={handleAdd}
            className="absolute bottom-1.5 right-1.5 z-10 grid h-7 w-7 translate-y-1 place-items-center rounded-full bg-white text-brand opacity-0 shadow-pop transition group-hover:translate-y-0 group-hover:opacity-100"
            aria-label="Thêm vào giỏ hàng"
          >
            <IconCart className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* ---- Nội dung ---- */}
      <div className="flex flex-1 flex-col gap-1 p-2">
        <h3 className="line-clamp-2 min-h-[36px] text-[13px] leading-[18px] text-ink">{product.name}</h3>

        <div className="flex flex-wrap items-baseline gap-1.5">
          <Price value={product.price} size={variant === 'flash' ? 'md' : 'md'} className="text-brand" />
          {product.originalPrice > product.price ? <OldPrice value={product.originalPrice} /> : null}
        </div>

        {variant === 'flash' ? (
          <SoldProgress percent={product.soldPercent} />
        ) : (
          <>
            <RatingRow rating={product.rating} sold={product.sold} className="mt-0.5" />
            <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-muted">
              <span className="truncate">{product.location}</span>
              <IconShieldCheck className="h-3.5 w-3.5 shrink-0 text-free" />
            </div>
          </>
        )}
      </div>
    </Link>
  )
}

/** Lưới sản phẩm: 6 cột giống thiết kế gốc */
export function ProductGrid({ products = [], columns = 6, gap = 'gap-2.5', className = '' }) {
  const cols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
  }[columns]

  return (
    <div className={`grid ${cols} ${gap} ${className}`}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
