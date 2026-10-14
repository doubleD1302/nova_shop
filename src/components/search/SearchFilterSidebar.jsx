import { useMemo } from 'react'
import { FilterBlock, FilterCheckbox, RatingFilter } from './FilterParts'
import LocationFilter from './LocationFilter'
import { PRICE_RANGES } from './searchConfig'
import { IconFilter } from '../ui/Icons'

/** Sidebar bộ lọc của trang tìm kiếm — tích vào là lọc ngay */
export default function SearchFilterSidebar({
  query,
  setParam,
  setParams,
  categories,
  shops,
  products,
  onClearAll,
  className = '',
}) {
  const categoryCount = (id) => products.filter((p) => p.categoryId === id).length
  const shopCount = (id) => products.filter((p) => p.shopId === id).length
  const priceChecked = (range) => query.minPrice === range.min && query.maxPrice === range.max

  /** Đếm số sản phẩm theo từng tỉnh / thành phố */
  const locationCounts = useMemo(() => {
    const map = {}
    products.forEach((p) => {
      if (!p.location) return
      map[p.location] = (map[p.location] || 0) + 1
    })
    return map
  }, [products])

  return (
    <aside className={`w-[210px] shrink-0 rounded-sm border border-line bg-white ${className}`}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <IconFilter className="h-4 w-4 text-ink" />
        <h2 className="text-[13px] font-bold uppercase text-ink">Bộ lọc tìm kiếm</h2>
      </div>

      <FilterBlock title="Theo Ngành Hàng">
        <div className="thin-scroll max-h-[190px] overflow-y-auto pr-1">
          <FilterCheckbox label="Tất cả ngành hàng" checked={!query.category} onChange={() => setParam('category', '')} />
          {categories.map((c) => (
            <FilterCheckbox
              key={c.id}
              label={c.name}
              count={categoryCount(c.id)}
              checked={query.category === c.id}
              onChange={() => setParam('category', query.category === c.id ? '' : c.id)}
            />
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title="Theo Gian Hàng">
        <div className="thin-scroll max-h-[190px] overflow-y-auto pr-1">
          <FilterCheckbox label="Tất cả gian hàng" checked={!query.shop} onChange={() => setParam('shop', '')} />
          {shops.map((s) => (
            <FilterCheckbox
              key={s.id}
              label={s.name}
              count={shopCount(s.id)}
              checked={query.shop === s.id}
              onChange={() => setParam('shop', query.shop === s.id ? '' : s.id)}
            />
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title="Nơi Bán">
        <LocationFilter value={query.location} counts={locationCounts} onChange={(v) => setParam('location', v)} />
      </FilterBlock>

      <FilterBlock title="Khoảng Giá">
        {PRICE_RANGES.map((r) => (
          <FilterCheckbox
            key={r.id}
            label={r.label}
            checked={priceChecked(r)}
            onChange={() => {
              // Cập nhật cả minPrice + maxPrice trong 1 lần để không bị mất giá trị
              if (priceChecked(r)) setParams({ minPrice: null, maxPrice: null })
              else setParams({ minPrice: r.min, maxPrice: r.max })
            }}
          />
        ))}
      </FilterBlock>

      <FilterBlock title="Đánh Giá">
        <RatingFilter value={query.rating} onChange={(v) => setParam('rating', v || '')} />
      </FilterBlock>

      <div className="p-3">
        <button
          type="button"
          onClick={onClearAll}
          className="w-full rounded-sm border border-line py-2 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          Xoá tất cả bộ lọc
        </button>
      </div>
    </aside>
  )
}
