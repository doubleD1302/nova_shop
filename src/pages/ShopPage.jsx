import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext'
import { useToast } from '../context/ToastContext'
import { getCategoryName } from '../data/categories'
import Breadcrumb from '../components/ui/Breadcrumb'
import EmptyState from '../components/ui/EmptyState'
import Paginator from '../components/ui/Paginator'
import ProductCard from '../components/product/ProductCard'
import ShopProfileHeader from '../components/shop/ShopProfileHeader'

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
  const { getShop, queryProducts, toggleFollow } = useCatalog()
  const { pushToast } = useToast()
  const [sort, setSort] = useState('popular')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)

  const shop = getShop(shopId)
  const allProducts = useMemo(() => queryProducts({ shopId, sort }), [shopId, sort, queryProducts])

  const shopCategories = useMemo(() => {
    const map = new Map()
    allProducts.forEach((p) => map.set(p.categoryId, (map.get(p.categoryId) || 0) + 1))
    return [...map.entries()]
  }, [allProducts])

  const products = categoryFilter ? allProducts.filter((p) => p.categoryId === categoryFilter) : allProducts
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const totalSold = allProducts.reduce((s, p) => s + p.sold, 0)

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
        productCount={allProducts.length}
        totalSold={totalSold}
        onFollow={onFollow}
        onChat={() => pushToast(`Đang mở cửa sổ chat với ${shop.name} (demo)`, 'info')}
      />

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
              <span className="text-[11px] text-muted">{allProducts.length}</span>
            </button>
            {shopCategories.map(([cid, count]) => (
              <button
                key={cid}
                type="button"
                onClick={() => selectCategory(cid)}
                className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-[13px] transition ${
                  categoryFilter === cid ? 'bg-brand-soft font-medium text-brand' : 'text-ink-soft hover:text-brand'
                }`}
              >
                <span className="truncate">{getCategoryName(cid)}</span>
                <span className="text-[11px] text-muted">{count}</span>
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
              <b className="text-brand">{products.length}</b> sản phẩm
            </span>
          </div>

          {pageItems.length ? (
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
