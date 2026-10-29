import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { useToast } from '../../context/ToastContext'
import { IconChevronRight, IconStore } from '../ui/Icons'

function ShopLogo({ shop }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [shop.logoUrl])

  if (!shop.logoUrl || failed) {
    return (
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#F5E7D4] text-sm font-bold text-[#BD6E49]">
        {shop.name.trim().slice(0, 2).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={shop.logoUrl}
      alt={`Logo ${shop.name}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-full border border-[#E6D5C2] bg-[#FFFCF7] object-cover"
    />
  )
}

function FeaturedShopCard({ shop, categoryNames, onFollow }) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs transition duration-200 hover:-translate-y-0.5 hover:border-[#BD6E49] hover:shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <ShopLogo shop={shop} />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[#49352D]" title={shop.name}>{shop.name}</h3>
          <p className="mt-1 line-clamp-1 text-xs text-[#8B7566]">
            {categoryNames.length ? categoryNames.join(' · ') : shop.tagline || 'Gian hàng NovaShop'}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#E6D5C2] pt-3">
        <span className="text-xs text-[#8B7566]">{Number(shop.productCount) || 0} sản phẩm</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onFollow(shop)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              shop.followed
                ? 'border-[#E6D5C2] text-[#8B7566] hover:border-[#BD6E49] hover:text-[#BD6E49]'
                : 'border-[#E6D5C2] bg-[#F5E7D4] text-[#BD6E49] hover:bg-[#F4E6D2]'
            }`}
          >
            {shop.followed ? 'Đang theo dõi' : 'Theo dõi'}
          </button>
          <Link
            to={`/shop/${shop.id}`}
            className="rounded-full bg-[#BD6E49] hover:bg-[#A95532] px-3 py-1.5 text-xs font-semibold text-[#FFFCF7] transition"
          >
            Xem gian hàng
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function FeaturedShops() {
  const { loadShops, loadProducts, loadCategories, toggleFollow } = useCatalog()
  const { pushToast } = useToast()
  const [featuredShops, setFeaturedShops] = useState([])
  const [categoryNames, setCategoryNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    const controller = new AbortController()

    Promise.all([
      loadShops({ featured: true, limit: 12, offset: 0, signal: controller.signal }),
      loadCategories({ signal: controller.signal }),
    ]).then(async ([shopResult, categories]) => {
      const activeShops = shopResult.shops.filter((shop) => Number(shop.productCount) > 0)
      const productResults = await Promise.all(activeShops.map((shop) => (
        loadProducts({ shopId: shop.id, limit: 50, offset: 0, signal: controller.signal })
      )))
      if (!current) return

      const namesByShop = {}
      const shopsWithProducts = activeShops.filter((shop, index) => {
        const products = productResults[index]?.products || []
        namesByShop[shop.id] = [...new Set(products.map((product) => (
          categories.find((category) => category.id === product.categoryId)?.name
        )).filter(Boolean))].slice(0, 2)
        return products.length > 0
      })
      setCategoryNames(namesByShop)
      setFeaturedShops(shopsWithProducts.length ? shopsWithProducts : activeShops.slice(0, 6))
    }).catch((loadError) => {
      if (current && loadError.name !== 'AbortError') setError(loadError.message || 'Không thể tải gian hàng nổi bật.')
    }).finally(() => { if (current) setLoading(false) })

    return () => { current = false; controller.abort() }
  }, [loadCategories, loadProducts, loadShops])

  const onFollow = (shop) => {
    toggleFollow(shop.id)
    pushToast(shop.followed ? `Đã bỏ theo dõi ${shop.name}` : `Đang theo dõi ${shop.name}`, 'info')
  }

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs">
      <div className="flex items-center justify-between gap-3 border-b border-[#E6D5C2] bg-[#F5E7D4] px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <IconStore className="h-5 w-5 text-[#BD6E49]" />
          <h2 className="text-base font-bold uppercase tracking-tight text-[#49352D] sm:text-lg">Gian hàng nổi bật</h2>
        </div>
        <Link to="/shop" className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#BD6E49] transition hover:text-[#A95532] sm:text-sm">
          Tất cả gian hàng
          <IconChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {error && !featuredShops.length ? (
        <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-sm text-[#B93832]">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="px-5 py-10 text-center text-sm text-[#8B7566]">Đang tải gian hàng...</p>
      ) : featuredShops.length ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {featuredShops.map((shop) => (
            <FeaturedShopCard
              key={shop.id}
              shop={shop}
              categoryNames={categoryNames[shop.id] || []}
              onFollow={onFollow}
            />
          ))}
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-[#8B7566]">Chưa có gian hàng nổi bật đang bán sản phẩm.</p>
      )}
    </section>
  )
}
