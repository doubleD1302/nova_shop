import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext'
import { formatNumber, formatVnd } from '../utils/format'
import Breadcrumb from '../components/ui/Breadcrumb'
import EmptyState from '../components/ui/EmptyState'
import Paginator from '../components/ui/Paginator'
import ProductCard from '../components/product/ProductCard'
import SearchFilterSidebar from '../components/search/SearchFilterSidebar'
import SortBar from '../components/search/SortBar'
import { PAGE_SIZE, SORT_OPTIONS, makeBulkParamSetter, makeParamSetter, parseSearchParams } from '../components/search/searchConfig'

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const { categories, shops, products, getCategory, queryProducts } = useCatalog()
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const paramsKey = params.toString()
  const query = useMemo(() => parseSearchParams(new URLSearchParams(paramsKey)), [paramsKey])
  const setParam = useMemo(() => makeParamSetter(new URLSearchParams(paramsKey), setParams), [paramsKey, setParams])
  const setParamsBulk = useMemo(
    () => makeBulkParamSetter(new URLSearchParams(paramsKey), setParams),
    [paramsKey, setParams],
  )

  /** Kết quả tìm kiếm — nơi này sẽ gọi API khi có backend */
  const result = useMemo(() => queryProducts(query), [query, queryProducts])
  const totalPages = Math.max(1, Math.ceil(result.length / PAGE_SIZE))
  const page = Math.min(query.page, totalPages)
  const pageItems = result.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const currentCategory = query.category ? getCategory(query.category) : null

  const activeFilters = [
    query.q ? { key: 'q', label: `Từ khoá: ${query.q}` } : null,
    currentCategory ? { key: 'category', label: currentCategory.name } : null,
    query.shop ? { key: 'shop', label: shops.find((s) => s.id === query.shop)?.name || query.shop } : null,
    query.mall ? { key: 'mall', label: 'Nova Mall' } : null,
    query.freeship ? { key: 'freeship', label: 'Miễn phí vận chuyển' } : null,
    query.flash ? { key: 'flash', label: 'Flash Sale' } : null,
    query.location ? { key: 'location', label: `Gửi từ ${query.location}` } : null,
    query.rating ? { key: 'rating', label: `Từ ${query.rating} sao` } : null,
    query.minPrice != null || query.maxPrice != null
      ? {
          key: 'price',
          label: `${query.minPrice ? formatVnd(query.minPrice) : '0₫'} - ${
            query.maxPrice ? formatVnd(query.maxPrice) : 'trở lên'
          }`,
        }
      : null,
  ].filter(Boolean)

  const clearFilter = (key) => {
    if (key === 'price') {
      setParamsBulk({ minPrice: null, maxPrice: null })
      return
    }
    setParam(key, '')
  }

  const sidebarProps = {
    query,
    setParam,
    setParams: setParamsBulk,
    categories,
    shops,
    products,
    onClearAll: () => setParams(new URLSearchParams()),
  }

  return (
    <div>
      <Breadcrumb
        className="mb-2"
        items={[
          { label: 'Trang chủ', to: '/' },
          {
            label: currentCategory ? currentCategory.name : query.q ? `Kết quả cho “${query.q}”` : 'Tất cả sản phẩm',
          },
        ]}
      />

      <div className="flex items-start gap-4">
        <SearchFilterSidebar {...sidebarProps} className="hidden lg:block" />

        {mobileFilterOpen ? (
          <div className="fixed inset-0 z-[120] flex lg:hidden">
            <button
              type="button"
              aria-label="Đóng bộ lọc"
              onClick={() => setMobileFilterOpen(false)}
              className="flex-1 bg-black/40"
            />
            <div className="thin-scroll h-full w-[280px] overflow-y-auto bg-white">
              <SearchFilterSidebar {...sidebarProps} className="w-full border-0" />
              <div className="p-3">
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="w-full rounded-sm bg-brand py-2 text-[13px] font-medium text-white"
                >
                  Xem {result.length} sản phẩm
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <SortBar
            query={query}
            setParam={setParam}
            sortOptions={SORT_OPTIONS}
            total={result.length}
            activeFilters={activeFilters}
            onClearFilter={clearFilter}
            onOpenFilters={() => setMobileFilterOpen(true)}
          />

          {pageItems.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {pageItems.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-sm border border-line bg-white">
              <EmptyState
                emoji="🛍️"
                title="Không tìm thấy sản phẩm phù hợp"
                description="Hãy thử xoá bớt bộ lọc hoặc tìm kiếm với từ khoá khác."
                action={
                  <Link
                    to="/tim-kiem"
                    className="rounded-sm bg-brand px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
                  >
                    Xem toàn bộ sản phẩm
                  </Link>
                }
              />
            </div>
          )}

          <Paginator page={page} totalPages={totalPages} onChange={(p) => setParam('page', p)} />

          <p className="pb-4 text-center text-[11px] text-muted">
            {formatNumber(result.length)} sản phẩm từ {new Set(result.map((p) => p.shopId)).size} gian hàng khác nhau
            trên ShopNova.
          </p>
        </div>
      </div>
    </div>
  )
}
