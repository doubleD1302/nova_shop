import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import SectionHeader from '../ui/SectionHeader'
import CategoryIcon from '../ui/CategoryIcon'

/** Danh mục lấy từ API, dùng chung bộ biểu tượng với khu khám phá. */
export default function CategoryStrip() {
  const { categories, loadCategories } = useCatalog()
  const [error, setError] = useState('')

  useEffect(() => {
    loadCategories()
      .then(() => setError(''))
      .catch((loadError) => {
        if (loadError?.name !== 'AbortError') setError(loadError?.message || 'Không thể tải danh mục.')
      })
  }, [loadCategories])

  const countByCategory = categories.map((c) => {
    return {
      ...c,
      count: Number(c.productCount) || 0,
    }
  })

  return (
    <section aria-label="Danh mục sản phẩm" className="mt-5 overflow-hidden rounded-xl border border-line bg-card">
      <SectionHeader
        title="Khám phá danh mục"
        rightLabel="Xem tất cả"
        rightTo="/tim-kiem"
        className="px-4 pt-5 sm:px-5"
      />

      {error && !countByCategory.length ? (
        <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-sm text-[#B93832]">
          {error}
        </p>
      ) : null}
      <div className="flex gap-1 overflow-x-auto px-3 py-5 thin-scroll">
        {countByCategory.map((c) => (
          <Link
            key={c.id || c.slug}
            to={`/tim-kiem?category=${c.id || c.slug}`}
            className="group flex min-w-[96px] flex-1 flex-col items-center rounded-lg px-2 py-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span className="category-symbol">
              <CategoryIcon slug={c.slug || c.id} className="h-7 w-7" />
            </span>

            {/* Tên danh mục */}
            <span className="mt-3 line-clamp-2 max-w-[108px] text-xs font-medium leading-5 text-ink transition-colors group-hover:text-brand">
              {c.name}
            </span>

            {/* Số lượng sản phẩm */}
            {c.count > 0 ? (
              <span className="mt-1 text-[11px] font-normal text-[#8B7566]">
                {c.count} sản phẩm
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  )
}
