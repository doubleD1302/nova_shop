import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext'
import { useToast } from '../context/ToastContext'
import { getCategoryName } from '../data/categories'
import Breadcrumb from '../components/ui/Breadcrumb'
import EmptyState from '../components/ui/EmptyState'
import Paginator from '../components/ui/Paginator'
import ProductCard from '../components/product/ProductCard'
import ShopProfileHeader from '../components/shop/ShopProfileHeader'
import ReportContentButton from '../components/ui/ReportContentButton'

const PAGE_SIZE = 18

const SORTS = [
  { id: 'popular', label: 'Phổ biến' },
  { id: 'newest', label: 'Mới nhất' },
  { id: 'price-asc', label: 'Giá thấp' },
  { id: 'price-desc', label: 'Giá cao' },
  { id: 'discount', label: 'Giảm giá nhiều' },
]

/** TRANG SHOP — người mua xem toàn bộ gian hàng của 1 người bán */
export default function ShopPage() {
  const { shopId } = useParams()
  const { getShop, loadShop, loadProducts, loadCategories, categories, toggleFollow } = useCatalog()
  const { pushToast } = useToast()
  const [sort, setSort] = useState('popular')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)

  const [shop, setShop] = useState(() => getShop(shopId))
  const [productResult, setProductResult] = useState({ products: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const currentPage = page
  const products = productResult.products
  const pageItems = products
  const totalPages = Math.max(1, Math.ceil(productResult.total / PAGE_SIZE))
  const shopCategories = categories.map((category) => [category.id, Number(category.productCount) || 0])

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setLoading(true)
    Promise.all([
      loadShop(shopId, { signal: controller.signal }),
      loadCategories({ signal: controller.signal }),
      loadProducts({ shopId, categoryId: categoryFilter, sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, signal: controller.signal }),
    ]).then(([shopData, , result]) => {
      if (!current) return
      setShop(shopData)
      setProductResult(result)
      setError('')
    }).catch((loadError) => {
      if (current && loadError.name !== 'AbortError') setError(loadError.message || 'Không thể tải gian hàng.')
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false; controller.abort() }
  }, [shopId, categoryFilter, sort, page, loadCategories, loadProducts, loadShop])

  if (!shop && loading) return <div className="rounded-sm bg-white p-8 text-center text-sm text-muted">Đang tải gian hàng...</div>
  if (!shop) {
    return (
      <div className="rounded-sm border border-line bg-white">
        <EmptyState
          emoji="🏪"
          title="Không tìm thấy gian hàng"
          description="Gian hàng này có thể đã ngừng hoạt động trên ShopNova."
          action={
            <Link
              to="/shop"
              className="rounded-sm bg-brand px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
            >
              Xem tất cả gian hàng
            </Link>
          }
        />
      </div>
    )
  }

  const onFollow = () => {
    toggleFollow(shop.id)
    pushToast(shop.followed ? `Đã bỏ theo dõi ${shop.name}` : `Đang theo dõi ${shop.name}`, 'info')
  }

  const selectCategory = (cid) => {
    setCategoryFilter(cid)
    setPage(1)
  }

  return (
    <div>
      <Breadcrumb
        className="mb-2"
        items={[{ label: 'Trang chủ', to: '/' }, { label: 'Gian hàng', to: '/shop' }, { label: shop.name }]}
      />

      <ShopProfileHeader
        shop={shop}
        productCount={shop.productCount}
        totalSold={shop.totalSold}
        onFollow={onFollow}
        onChat={() => pushToast(`Đang mở cửa sổ chat với ${shop.name} (demo)`, 'info')}
      />
      <ReportContentButton targetType="shop" targetId={shop.id} />

      <div className="mt-3 grid gap-4 lg:grid-cols-[190px_1fr]">
        <aside className="hidden h-fit rounded-sm border border-line bg-white lg:block">
          <h2 className="border-b border-line px-3 py-2.5 text-[13px] font-bold uppercase text-ink">
            Danh mục trong shop
          </h2>
          <div className="p-2">
            <button
              type="button"
              onClick={() => selectCategory('')}
              className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-[13px] transition ${
                categoryFilter === '' ? 'bg-brand-soft font-medium text-brand' : 'text-ink-soft hover:text-brand'
              }`}
            >
              Tất cả sản phẩm
              <span className="text-[11px] text-muted">{shop.productCount}</span>
            </button>
            {shopCategories.map(([cid]) => (
              <button
                key={cid}
                type="button"
                onClick={() => selectCategory(cid)}
                className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-[13px] transition ${
                  categoryFilter === cid ? 'bg-brand-soft font-medium text-brand' : 'text-ink-soft hover:text-brand'
                }`}
              >
                <span className="truncate">{getCategoryName(cid)}</span>
                <span className="text-[11px] text-muted"> </span>
              </button>
            ))}
          </div>
        </aside>

        <div>
          <div className="flex flex-wrap items-center gap-3 rounded-sm bg-white px-3 py-3">
            <span className="text-[13px] text-muted">Sắp xếp theo</span>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSort(s.id)
                    setPage(1)
                  }}
                  className={`rounded-sm px-3.5 py-1.5 text-[13px] transition ${
                    sort === s.id ? 'bg-brand text-white' : 'bg-page text-ink-soft hover:bg-brand-soft hover:text-brand'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[13px] text-ink-soft">
              <b className="text-brand">{productResult.total}</b> sản phẩm
            </span>
          </div>

          {error ? <p role="alert" className="rounded-sm bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
          {loading ? <p className="rounded-sm bg-white p-8 text-center text-sm text-muted">Đang tải sản phẩm...</p> : pageItems.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {pageItems.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-sm border border-line bg-white">
              <EmptyState emoji="📦" title="Shop chưa có sản phẩm trong danh mục này" />
            </div>
          )}

          <Paginator page={currentPage} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>
    </div>
  )
}
