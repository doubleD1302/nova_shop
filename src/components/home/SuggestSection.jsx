import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { suggestTabs } from '../../data/homeContent'
import ProductCard from '../product/ProductCard'
import EmptyState from '../ui/EmptyState'

const PAGE_SIZE = 18

const TAB_QUERY = {
  suggest: { sort: 'popular' },
  freeship: { freeship: true, sort: 'popular' },
  sale50: { minDiscount: 40, sort: 'discount' },
  outlet: { sort: 'newest' },
}

/** Khu "GỢI Ý HÔM NAY" với các tab lọc và nút Xem thêm */
export default function SuggestSection() {
  const { loadProducts } = useCatalog()
  const [tab, setTab] = useState('suggest')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const moreControllerRef = useRef(null)

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setLoading(true)
    setError('')
    loadProducts({ ...TAB_QUERY[tab], limit: PAGE_SIZE, offset: 0, signal: controller.signal })
      .then((result) => {
        if (!current) return
        setProducts(result.products)
        setTotal(result.total)
        setVisible(PAGE_SIZE)
      })
      .catch((loadError) => { if (current && loadError.name !== 'AbortError') setError(loadError.message || 'Could not load suggested products.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false; controller.abort(); moreControllerRef.current?.abort() }
  }, [tab, loadProducts])

  const shown = products.slice(0, visible)

  const loadMore = async () => {
    setLoading(true)
    setError('')
    moreControllerRef.current?.abort()
    const controller = new AbortController()
    moreControllerRef.current = controller
    try {
      const result = await loadProducts({ ...TAB_QUERY[tab], limit: PAGE_SIZE, offset: products.length, signal: controller.signal })
      setProducts((current) => [...current, ...result.products])
      setTotal(result.total)
      setVisible((current) => current + result.products.length)
    } catch (loadError) {
      if (loadError.name !== 'AbortError') setError(loadError.message || 'Could not load more products.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs">
      <div className="flex items-center justify-between gap-3 border-b border-[#E6D5C2] bg-[#F5E7D4] px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-base font-bold uppercase tracking-tight text-[#49352D] sm:text-lg">Gợi ý hôm nay</h2>
          <p className="mt-1 text-xs text-[#8B7566]">Sản phẩm lấy trực tiếp từ danh mục NovaShop</p>
        </div>
        <Link to="/tim-kiem" className="shrink-0 text-xs font-medium text-[#BD6E49] transition hover:text-[#A95532] sm:text-sm">
          Khám phá tất cả
        </Link>
      </div>
      <div className="grid grid-cols-2 border-b border-[#E6D5C2] bg-[#F5E7D4]/50 sm:grid-cols-4">
        {suggestTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              setVisible(PAGE_SIZE)
            }}
            className={`min-h-11 border-b-2 px-2 py-2 text-[11px] font-semibold uppercase tracking-tight transition sm:text-xs cursor-pointer ${
              tab === t.id
                ? 'border-[#BD6E49] bg-[#F4E6D2] text-[#BD6E49]'
                : 'border-transparent text-[#8B7566] hover:text-[#BD6E49]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p role="alert" className="m-3 rounded-lg bg-rose-50 p-3 text-sm text-[#B93832]">{error}</p> : null}
      {shown.length ? (
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : loading ? (
        <p className="p-10 text-center text-sm text-[#8B7566]">Đang tải sản phẩm...</p>
      ) : (
        <div>
          <EmptyState emoji="🧺" title="Chưa có sản phẩm phù hợp" description="Thử chọn tab khác để xem thêm sản phẩm." />
        </div>
      )}

      {visible < total ? (
        <div className="my-5 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="w-[390px] max-w-full rounded-full border border-[#E6D5C2] bg-[#FFFCF7] py-2.5 text-[14px] font-medium text-[#49352D] transition hover:border-[#BD6E49] hover:text-[#BD6E49] cursor-pointer"
          >
            {loading ? 'Đang tải...' : `Xem thêm ${total - visible} sản phẩm`}
          </button>
        </div>
      ) : null}

      {shown.length && visible >= total ? (
        <p className="border-t border-[#E6D5C2] px-3 py-4 text-center text-xs text-[#8B7566]">Đã hiển thị hết sản phẩm phù hợp.</p>
      ) : null}
    </section>
  )
}
