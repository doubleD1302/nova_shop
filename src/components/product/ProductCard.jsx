import { Link } from 'react-router-dom'
import { DiscountBadge, ProductBadgeStack } from '../ui/Badge'
import { IconCart, IconShieldCheck } from '../ui/Icons'
import Price, { OldPrice } from '../ui/Price'
import { RatingRow } from '../ui/Rating'
import SmartImage from '../ui/SmartImage'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'

/** Thanh tiến độ "ĐÃ BÁN x%" trong khối Flash Sale */
function SoldProgress({ percent = 0 }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  if (p === 0) {
    return (
      <div className="relative mt-1.5 flex h-[18px] items-center justify-center overflow-hidden rounded-full bg-[#F5E7D4] border border-[#E6D5C2]">
        <span className="text-[11px] font-semibold text-[#BD6E49]">VỪA MỞ BÁN</span>
      </div>
    )
  }
  const hot = p >= 90
  if (hot) {
    return (
      <div className="relative mt-1.5 flex h-[18px] items-center justify-center overflow-hidden rounded-full bg-[#F5E7D4] border border-[#E6D5C2]">
        <span className="text-[11px] font-bold text-[#BD6E49]">CHÁY HÀNG {p}%</span>
      </div>
    )
  }
  return (
    <div className="relative mt-1.5 h-[18px] overflow-hidden rounded-full bg-[#F5E7D4] border border-[#E6D5C2]">
      <div className="h-full rounded-full bg-[#BD6E49]" style={{ width: `${p}%` }} />
      <span
        className={`absolute inset-0 flex items-center justify-center text-[11px] font-semibold ${
          p >= 50 ? 'text-[#FFFCF7]' : 'text-[#BD6E49]'
        }`}
      >
        ĐÃ BÁN {p}%
      </span>
    </div>
  )
}

/**
 * Thẻ sản phẩm phong cách Terracotta + Cream
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
    const sku = product.variants?.[0]
    if (!sku || sku.stock < 1) {
      pushToast('Sản phẩm hiện đã hết hàng.', 'error')
      return
    }
    addToCart(product, { qty: 1, variant: sku.name, variantId: sku.id })
    pushToast(`Đã thêm "${product.name.slice(0, 34)}…" vào giỏ hàng`, 'cart')
  }

  return (
    <Link
      to={`/san-pham/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] transition duration-200 hover:-translate-y-1 hover:border-[#BD6E49] hover:shadow-pop"
    >
      {/* ---- Ảnh + nhãn ---- */}
      <div className="relative">
        <div className="relative w-full pt-[100%]">
          <SmartImage
            src={product.image}
            fallback={product.gallery?.length ? product.gallery : product.imageFallback || ''}
            alt={product.name}
            className="absolute inset-0 h-full w-full bg-[#F5E7D4]/40 object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </div>

        <ProductBadgeStack product={product} className="absolute left-0 top-0 p-1" />
        <DiscountBadge percent={product.discount} className="absolute right-0 top-0" />

        {variant !== 'mini' ? (
          <button
            type="button"
            onClick={handleAdd}
            className="absolute bottom-1.5 right-1.5 z-10 grid h-7 w-7 translate-y-1 place-items-center rounded-full bg-[#FFFCF7] text-[#BD6E49] opacity-0 shadow-pop transition group-hover:translate-y-0 group-hover:opacity-100 hover:bg-[#BD6E49] hover:text-[#FFFCF7] cursor-pointer"
            aria-label="Thêm vào giỏ hàng"
          >
            <IconCart className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* ---- Nội dung ---- */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 min-h-10 text-[13px] leading-[18px] text-[#49352D] transition group-hover:text-[#BD6E49]">{product.name}</h3>

        <div className="flex flex-wrap items-baseline gap-1.5">
          <Price value={product.price} size={variant === 'flash' ? 'md' : 'md'} className="text-[#BD6E49]" />
          {product.originalPrice > product.price ? <OldPrice value={product.originalPrice} /> : null}
        </div>

        {variant === 'flash' ? (
          <SoldProgress percent={product.soldPercent} />
        ) : (
          <>
            <RatingRow rating={product.rating} sold={product.sold} className="mt-0.5" />
            <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[11px] text-[#8B7566]">
              <span className="truncate">{product.location}</span>
              <span className="flex shrink-0 items-center gap-1 font-medium text-[#BD6E49]">
                Chi tiết
                <IconShieldCheck className="h-3.5 w-3.5 text-[#BD6E49]" />
              </span>
            </div>
          </>
        )}
      </div>
    </Link>
  )
}

/** Lưới sản phẩm: 6 cột */
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
