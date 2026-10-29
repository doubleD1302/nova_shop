import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import ProductCard from '../product/ProductCard'
import { IconChevronRight } from '../ui/Icons'

function HomeProductShelf({ title, sort, categoryId = '', categoryName = '' }) {
  const { loadProducts } = useCatalog()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setLoading(true)
    setError('')

    loadProducts({ sort, categoryId, limit: 5, offset: 0, signal: controller.signal })
      .then((result) => { if (current) setProducts(result.products) })
      .catch((loadError) => {
        if (current && loadError.name !== 'AbortError') setError(loadError.message || 'Không thể tải sản phẩm.')
      })
      .finally(() => { if (current) setLoading(false) })

    return () => { current = false; controller.abort() }
  }, [categoryId, loadProducts, sort])

  if (!loading && !error && products.length === 0) return null

  const searchHref = categoryId
    ? `/tim-kiem?category=${categoryId}&sort=${sort}`
    : `/tim-kiem?sort=${sort}`

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold uppercase tracking-tight text-ink sm:text-lg">{title}</h2>
          {categoryName ? <p className="mt-1 text-xs text-muted">{categoryName}</p> : null}
        </div>
        <Link to={searchHref} className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand transition hover:underline sm:text-sm">
          Xem tất cả
          <IconChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {error && !products.length ? (
        <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="px-5 py-10 text-center text-sm text-muted">Đang tải sản phẩm...</p>
      ) : products.length ? (
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : null}
    </section>
  )
}

export default function HomeProductShelves() {
  const { loadCategories } = useCatalog()
  const [categoryIds, setCategoryIds] = useState([])
  const [categoryError, setCategoryError] = useState('')

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    loadCategories({ signal: controller.signal })
      .then((result) => {
        if (current) setCategoryIds(
          result.filter((category) => Number(category.productCount) > 0).slice(0, 4).map(({ id, name }) => ({ id, name })),
        )
      })
      .catch((error) => {
        if (current && error.name !== 'AbortError') setCategoryError(error.message || 'Không thể tải ngành hàng.')
      })
    return () => { current = false; controller.abort() }
  }, [loadCategories])

  return (
    <>
      <HomeProductShelf title="Sản phẩm mới" sort="newest" />
      <HomeProductShelf title="Sản phẩm phổ biến" sort="popular" />
      {categoryError ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{categoryError}</p> : null}
      {categoryIds.map((category) => (
        <HomeProductShelf
          key={category.id}
          title={`Khám phá ${category.name}`}
          categoryName={category.name}
          categoryId={category.id}
          sort="popular"
        />
      ))}
    </>
  )
}
