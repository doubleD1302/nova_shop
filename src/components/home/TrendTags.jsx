import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { categoryImage } from '../../utils/image'
import { IconChevronRight, IconSparkle } from '../ui/Icons'
import SmartImage from '../ui/SmartImage'

export default function TrendTags() {
  const { categories, shops, loadCategories, loadShops } = useCatalog()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    const controller = new AbortController()

    Promise.all([
      loadCategories({ signal: controller.signal }),
      loadShops({ limit: 30, offset: 0, signal: controller.signal }),
    ]).catch((loadError) => {
      if (current && loadError.name !== 'AbortError') setError(loadError.message || 'Không thể tải danh mục khám phá.')
    }).finally(() => { if (current) setLoading(false) })

    return () => { current = false; controller.abort() }
  }, [loadCategories, loadShops])

  const filteredCats = categories.filter((category) => Number(category.productCount) > 0)
  const activeCategories = (filteredCats.length ? filteredCats : categories).slice(0, 8)
  const filteredShops = shops.filter((shop) => Number(shop.productCount) > 0)
  const activeShops = (filteredShops.length ? filteredShops : shops).slice(0, 4)

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <IconSparkle className="h-5 w-5 text-brand" />
          <h2 className="text-base font-bold uppercase tracking-tight text-ink sm:text-lg">
            Khám phá gian hàng & ngành hàng
          </h2>
        </div>
        <Link to="/shop" className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand transition hover:underline sm:text-sm">
          Tất cả gian hàng
          <IconChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {error && !activeCategories.length ? <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="p-4 sm:p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Ngành hàng đang có sản phẩm</h3>
        {activeCategories.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {activeCategories.map((category) => (
              <Link
                key={category.id}
                to={`/tim-kiem?category=${category.id}`}
                className="group flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-line px-2 py-3 text-center transition hover:border-orange-200 hover:bg-orange-50/50"
              >
                <SmartImage
                  src={category.image}
                  fallback={category.fallbackImage || categoryImage(category)}
                  alt=""
                  className="h-12 w-12 rounded-xl object-cover transition group-hover:-translate-y-0.5"
                />
                <span className="line-clamp-2 text-xs leading-4 text-ink-soft group-hover:text-brand">{category.name}</span>
              </Link>
            ))}
          </div>
        ) : !loading ? (
          <p className="rounded-xl bg-page px-4 py-6 text-center text-sm text-muted">Chưa có ngành hàng nào đang có sản phẩm.</p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">Gian hàng đang hoạt động</span>
          {activeShops.map((shop) => (
            <Link
              key={shop.id}
              to={`/shop/${shop.id}`}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink-soft transition hover:border-brand hover:bg-brand-soft hover:text-brand"
            >
              {shop.name}
            </Link>
          ))}
          {!loading && activeShops.length === 0 ? <span className="text-xs text-muted">Chưa có gian hàng phù hợp.</span> : null}
        </div>
      </div>
    </section>
  )
}
