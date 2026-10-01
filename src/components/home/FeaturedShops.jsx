import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { useToast } from '../../context/ToastContext'
import { formatFollowers } from '../../utils/format'
import { MallBadge } from '../ui/Badge'
import { IconChat, IconChevronRight, IconEye } from '../ui/Icons'
import ProductCard from '../product/ProductCard'
import SmartImage from '../ui/SmartImage'

/** Header của 1 gian hàng nổi bật */
function ShopHeader({ shop }) {
  const { toggleFollow } = useCatalog()
  const { pushToast } = useToast()

  const onFollow = () => {
    toggleFollow(shop.id)
    pushToast(shop.followed ? `Đã bỏ theo dõi ${shop.name}` : `Đang theo dõi ${shop.name}`, 'info')
  }

  return (
    <div className="relative overflow-hidden">
      <div
        className="h-[84px] w-full"
        style={{ backgroundImage: `linear-gradient(120deg, hsl(${shop.hue} 85% 52%), hsl(${(shop.hue + 40) % 360} 80% 62%))` }}
      />
      <div className="absolute inset-x-0 top-0 flex h-[84px] items-center gap-3 px-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-white">
          <SmartImage src={shop.avatar} fallback={shop.avatar} alt={shop.name} className="h-full w-full object-cover" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-white drop-shadow-sm">{shop.name}</span>
            {shop.mall ? <MallBadge /> : null}
          </span>
          <span className="mt-0.5 line-clamp-1 text-[11px] text-white/90">{shop.tagline}</span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 bg-white px-4 py-2">
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span>
            <b className="text-ink">{shop.productCount}</b> Sản phẩm
          </span>
          <span className="h-3 w-px bg-line" />
          <span className="flex items-center gap-1">
            <IconEye className="h-3.5 w-3.5 text-brand" />
            <b className="text-ink">{formatFollowers(shop.followers)}</b> Theo dõi
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onFollow}
            className={`flex items-center gap-1 rounded-sm border px-2.5 py-1 text-[12px] font-medium transition ${
              shop.followed
                ? 'border-line bg-white text-ink-soft hover:border-brand hover:text-brand'
                : 'border-brand bg-brand text-white hover:brightness-105'
            }`}
          >
            {shop.followed ? 'Đang Theo Dõi' : '+ Theo Dõi'}
          </button>
          <Link
            to={`/shop/${shop.id}`}
            className="flex items-center gap-1 rounded-sm border border-line px-2.5 py-1 text-[12px] text-ink-soft transition hover:border-brand hover:text-brand"
          >
            <IconChat className="h-3.5 w-3.5" />
            Xem Shop
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Khu "Gian hàng nổi bật" — 2 shop mỗi shop 3 sản phẩm */
export default function FeaturedShops() {
  const { featuredShops, getProductsByShop } = useCatalog()

  return (
    <section className="mt-3 rounded-sm border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <h2 className="text-[15px] font-bold uppercase tracking-tight text-ink md:text-[16px]">Gian Hàng Nổi Bật</h2>
        <Link to="/shop" className="flex items-center gap-0.5 text-[13px] text-brand transition hover:underline">
          Xem tất cả
          <IconChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-2">
        {featuredShops.map((shop) => {
          const products = getProductsByShop(shop.id).slice(0, 3)
          return (
            <div key={shop.id} className="overflow-hidden rounded-sm border border-line">
              <ShopHeader shop={shop} />
              <div className="grid grid-cols-3 gap-2.5 p-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} variant="mini" />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
