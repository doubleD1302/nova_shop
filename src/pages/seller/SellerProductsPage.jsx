import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCatalog } from '../../context/CatalogContext'
import { useToast } from '../../context/ToastContext'
import { getCategoryName } from '../../data/categories'
import { formatNumber, formatSold, formatVnd } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Paginator from '../../components/ui/Paginator'
import { IconEdit, IconEye, IconPlus, IconSearch, IconTrash } from '../../components/ui/Icons'
import SmartImage from '../../components/ui/SmartImage'

const PAGE_SIZE = 10

/** QUẢN LÝ SẢN PHẨM (người bán) — tìm kiếm, sửa, xoá, cập nhật kho nhanh */
export default function SellerProductsPage() {
  const { user } = useAuth()
  const { getProductsByShop, deleteProduct, upsertProduct, categories } = useCatalog()
  const { pushToast } = useToast()
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)

  const all = getProductsByShop(user.shopId)

  const list = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    const filtered = all
      .filter((p) => (categoryId ? p.categoryId === categoryId : true))
      .filter((p) => (k ? p.name.toLowerCase().includes(k) : true))
    const sorters = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      'stock-asc': (a, b) => a.stock - b.stock,
      sold: (a, b) => b.sold - a.sold,
    }
    return [...filtered].sort(sorters[sort] || sorters.newest)
  }, [all, keyword, categoryId, sort])

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-sm bg-white px-4 py-3">
        <h1 className="text-[16px] font-bold text-ink">Quản Lý Sản Phẩm</h1>
        <span className="text-[13px] text-muted">{all.length} sản phẩm trong gian hàng</span>
        <Link
          to="/nguoi-ban/san-pham/them-moi"
          className="ml-auto flex items-center gap-1.5 rounded-sm bg-brand px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
        >
          <IconPlus className="h-4 w-4" />
          Thêm sản phẩm
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-sm bg-white px-4 py-3">
        <label className="flex h-9 items-center gap-2 rounded-sm border border-line px-2.5">
          <IconSearch className="h-4 w-4 text-muted" />
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo tên sản phẩm..."
            className="w-[220px] text-[13px] outline-none"
          />
        </label>

        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
            setPage(1)
          }}
          className="h-9 rounded-sm border border-line px-2 text-[13px] outline-none focus:border-brand"
        >
          <option value="">Tất cả ngành hàng</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-9 rounded-sm border border-line px-2 text-[13px] outline-none focus:border-brand"
        >
          <option value="newest">Mới nhất</option>
          <option value="sold">Bán chạy nhất</option>
          <option value="price-asc">Giá thấp đến cao</option>
          <option value="price-desc">Giá cao đến thấp</option>
          <option value="stock-asc">Tồn kho ít nhất</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-sm border border-line bg-white">
        <div className="hidden items-center gap-3 border-b border-line px-4 py-3 text-[12px] uppercase text-muted lg:flex">
          <span className="flex-1">Sản phẩm</span>
          <span className="w-[110px] text-center">Giá bán</span>
          <span className="w-[90px] text-center">Kho</span>
          <span className="w-[90px] text-center">Đã bán</span>
          <span className="w-[150px] text-center">Thao tác</span>
        </div>

        {pageItems.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
            <SmartImage
              src={p.image}
              fallback={p.image}
              alt=""
              className="h-12 w-12 shrink-0 rounded-sm border border-line object-cover"
            />
            <span className="min-w-[200px] flex-1">
              <Link to={`/san-pham/${p.slug}`} className="line-clamp-2 text-[13px] text-ink hover:text-brand">
                {p.name}
              </Link>
              <span className="mt-0.5 block text-[11px] text-muted">
                {getCategoryName(p.categoryId)} · {p.location}
                {p.mall ? ' · Nova Mall' : ''}
              </span>
            </span>

            <span className="w-[110px] shrink-0 text-center text-[13px] text-brand">{formatVnd(p.price)}</span>

            <span className="w-[90px] shrink-0 text-center">
              <input
                type="number"
                min="0"
                value={p.stock}
                onChange={(e) => upsertProduct({ ...p, stock: Number(e.target.value) })}
                className="w-[70px] rounded-sm border border-line px-2 py-1 text-center text-[13px] outline-none focus:border-brand"
                aria-label="Cập nhật kho"
              />
            </span>

            <span className="w-[90px] shrink-0 text-center text-[13px] text-ink-soft">{formatSold(p.sold)}</span>

            <span className="flex w-[150px] shrink-0 items-center justify-center gap-2">
              <Link
                to={`/san-pham/${p.slug}`}
                className="grid h-8 w-8 place-items-center rounded-sm border border-line text-ink-soft transition hover:border-brand hover:text-brand"
                aria-label="Xem sản phẩm"
              >
                <IconEye className="h-4 w-4" />
              </Link>
              <Link
                to={`/nguoi-ban/san-pham/${p.id}`}
                className="grid h-8 w-8 place-items-center rounded-sm border border-line text-ink-soft transition hover:border-brand hover:text-brand"
                aria-label="Sửa sản phẩm"
              >
                <IconEdit className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Xoá sản phẩm "${p.name}"?`)) {
                    deleteProduct(p.id)
                    pushToast('Đã xoá sản phẩm khỏi gian hàng', 'success')
                  }
                }}
                className="grid h-8 w-8 place-items-center rounded-sm border border-line text-ink-soft transition hover:border-brand hover:text-brand"
                aria-label="Xoá sản phẩm"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </span>
          </div>
        ))}

        {!pageItems.length ? (
          <EmptyState
            emoji="📦"
            title="Chưa có sản phẩm phù hợp"
            description="Thử đổi từ khoá hoặc đăng sản phẩm mới cho gian hàng của bạn."
            action={
              <Link
                to="/nguoi-ban/san-pham/them-moi"
                className="rounded-sm bg-brand px-4 py-2 text-[13px] font-medium text-white"
              >
                + Đăng sản phẩm
              </Link>
            }
          />
        ) : null}
      </div>

      <Paginator page={currentPage} totalPages={totalPages} onChange={setPage} />

      <p className="text-center text-[11px] text-muted">
        Tổng giá trị hàng tồn kho của shop: {formatNumber(all.reduce((s, p) => s + p.price * p.stock, 0))}₫
      </p>
    </div>
  )
}
