import { Link } from 'react-router-dom'
import { formatFollowers, formatNumber, formatVnd } from '../../utils/format'
import { FavoriteBadge, MallBadge } from '../ui/Badge'
import { IconChevronRight, IconLocation, IconStar, IconStore } from '../ui/Icons'
import SmartImage from '../ui/SmartImage'

export default function RecommendedShopCard({
  shop,
  products = [],
  searchKeyword = '',
  categoryName = '',
  otherShops = [],
  onSelectShop,
  className = '',
}) {
  if (!shop) return null

  const shopUrl = `/shop/${shop.slug || shop.id}`
  const displayProducts = (products || []).slice(0, 4)

  return (
    <div
      className={`mb-4 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-gradient-to-br from-[#FFFDF9] via-[#FAF3EA] to-[#F5ECE2] p-4 shadow-xs transition hover:shadow-sm sm:p-5 ${className}`}
    >
      {/* Header bar */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#E6D5C2]/70 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#BD6E49]/15 text-[#BD6E49]">
            <IconStore className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[13px] font-bold text-[#49352D] sm:text-[14px]">
              Shop đề xuất cho {searchKeyword ? `“${searchKeyword}”` : categoryName ? `ngành hàng “${categoryName}”` : 'mặt hàng bạn tìm kiếm'}
            </h2>
            <p className="text-[11px] text-[#8B7566]">
              Gian hàng uy tín & có nhiều sản phẩm phù hợp nhất với tìm kiếm của bạn
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {shop.mall ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              Chính Hãng Mall
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#BD6E49]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#BD6E49]">
              ★ Shop Được Yêu Thích
            </span>
          )}
        </div>
      </div>

      {/* Main Content: Shop info on Left, Mini Products Showcase on Right */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Shop identity & metrics */}
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center lg:max-w-[420px]">
          <Link
            to={shopUrl}
            className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white bg-white shadow-sm ring-1 ring-[#E6D5C2] transition group-hover:scale-105 sm:h-20 sm:w-20"
          >
            <SmartImage
              src={shop.avatar || shop.logoUrl}
              fallback={shop.avatar || shop.logoUrl}
              alt={shop.name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
            />
            {shop.mall ? (
              <span className="absolute bottom-0 left-0 right-0 bg-red-600 py-0.5 text-center text-[8px] font-extrabold uppercase tracking-wider text-white">
                Mall
              </span>
            ) : null}
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link
                to={shopUrl}
                className="truncate text-[15px] font-bold text-[#49352D] transition hover:text-[#BD6E49] sm:text-[16px]"
              >
                {shop.name}
              </Link>
              {shop.mall ? <MallBadge /> : <FavoriteBadge />}
            </div>

            {shop.tagline ? (
              <p className="mt-0.5 line-clamp-1 text-[12px] text-[#8B7566]">{shop.tagline}</p>
            ) : null}

            {/* Quick stats pills */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6C5347]">
              <span className="flex items-center gap-1 font-semibold text-amber-600">
                <IconStar className="h-3.5 w-3.5 fill-current" />
                <span>{shop.rating || 4.9}</span>
                <span className="font-normal text-[#8B7566]">
                  ({formatFollowers(shop.ratingCount || 120)})
                </span>
              </span>
              <span>•</span>
              <span>
                <b className="font-semibold text-[#49352D]">{formatFollowers(shop.followers || 1500)}</b> theo dõi
              </span>
              <span>•</span>
              <span>
                <b className="font-semibold text-[#49352D]">{shop.productCount || products.length}</b> sản phẩm
              </span>
              {shop.location ? (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-[#8B7566]">
                    <IconLocation className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[120px]">{shop.location}</span>
                  </span>
                </>
              ) : null}
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex items-center gap-2">
              <Link
                to={shopUrl}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#BD6E49] px-4 py-1.5 text-[12px] font-semibold text-white shadow-xs transition hover:bg-[#A95532] active:scale-95"
              >
                <IconStore className="h-3.5 w-3.5" />
                <span>Xem Shop</span>
                <IconChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to={shopUrl}
                className="inline-flex items-center rounded-full border border-[#D5C2B1] bg-white/80 px-3 py-1.5 text-[12px] font-medium text-[#6C5347] transition hover:border-[#BD6E49] hover:text-[#BD6E49]"
              >
                Ghé thăm gian hàng
              </Link>
            </div>
          </div>
        </div>

        {/* Divider on desktop */}
        <div className="hidden h-28 w-[1px] bg-[#E6D5C2]/80 lg:block" />

        {/* Right: Matching products showcase */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#6C5347]">
              Sản phẩm nổi bật của shop ({products.length} mặt hàng phù hợp):
            </span>
            <Link
              to={shopUrl}
              className="text-[11px] font-medium text-[#BD6E49] hover:underline"
            >
              Xem tất cả &gt;
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {displayProducts.map((p) => {
              const productUrl = `/san-pham/${p.slug || p.id}`
              const hasDiscount = p.originalPrice && p.originalPrice > p.price
              return (
                <Link
                  key={p.id}
                  to={productUrl}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#E6D5C2]/80 bg-white p-1.5 shadow-2xs transition hover:border-[#BD6E49] hover:shadow-xs"
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-stone-100">
                    <SmartImage
                      src={p.image}
                      fallback={p.image}
                      alt={p.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    {hasDiscount ? (
                      <span className="absolute left-1 top-1 rounded-[3px] bg-red-600 px-1 py-0.5 text-[9px] font-bold text-white shadow-2xs">
                        -{Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}%
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex flex-1 flex-col justify-between">
                    <p className="line-clamp-1 text-[11px] font-medium text-[#49352D] group-hover:text-[#BD6E49]">
                      {p.name}
                    </p>
                    <div className="mt-1 flex items-baseline justify-between gap-1">
                      <span className="text-[12px] font-bold text-[#BD6E49]">
                        {formatVnd(p.price)}
                      </span>
                      {p.sold ? (
                        <span className="text-[10px] text-[#8B7566]">
                          Đã bán {p.sold > 1000 ? `${(p.sold / 1000).toFixed(1)}k` : p.sold}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Alternative recommended shops (if any) */}
      {otherShops && otherShops.length > 0 ? (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[#E6D5C2]/60 pt-2.5">
          <span className="text-[11px] font-medium text-[#8B7566]">
            Các shop đề xuất khác cùng mặt hàng:
          </span>
          {otherShops.map((other) => (
            <button
              key={other.id}
              type="button"
              onClick={() => onSelectShop && onSelectShop(other.id)}
              className="flex items-center gap-1.5 rounded-full border border-[#D5C2B1] bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#6C5347] transition hover:border-[#BD6E49] hover:bg-white hover:text-[#BD6E49] cursor-pointer"
            >
              <SmartImage
                src={other.avatar || other.logoUrl}
                fallback={other.avatar || other.logoUrl}
                alt=""
                className="h-4 w-4 rounded-full object-cover"
              />
              <span className="max-w-[120px] truncate">{other.name}</span>
              {other.rating ? (
                <span className="flex items-center text-amber-600 text-[10px]">
                  ★ {other.rating}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
