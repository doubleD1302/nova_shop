import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { suggestTabs } from '../../data/homeContent'
import ProductCard from '../product/ProductCard'
import EmptyState from '../ui/EmptyState'

const PAGE_SIZE = 18

const TAB_QUERY = {
  suggest: { sort: 'popular' },
  freeship: { freeship: true, sort: 'popular' },
  sale50: { minPrice: null, sort: 'discount' },
  outlet: { sort: 'price-asc' },
}

/** Khu "GỢI Ý HÔM NAY" với các tab lọc và nút Xem thêm */
export default function SuggestSection() {
  const { queryProducts } = useCatalog()
  const [tab, setTab] = useState('suggest')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const products = useMemo(() => {
    const base = queryProducts({ ...TAB_QUERY[tab], limit: null })
    const filtered = tab === 'sale50' ? base.filter((p) => p.discount >= 40) : base
    return filtered
  }, [tab, queryProducts])

  const shown = products.slice(0, visible)

  return (
    <section className="mt-3">
      <div className="sticky top-0 z-20 grid grid-cols-2 gap-0 rounded-sm border border-line bg-white md:grid-cols-4">
        {suggestTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              setVisible(PAGE_SIZE)
            }}
            className={`h-11 border-b-2 px-2 text-[13px] font-semibold uppercase tracking-tight transition ${
              tab === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-soft hover:text-brand'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shown.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-sm border border-line">
          <EmptyState emoji="🧺" title="Chưa có sản phẩm phù hợp" description="Thử chọn tab khác để xem thêm sản phẩm." />
        </div>
      )}

      {visible < products.length ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="w-[390px] max-w-full rounded-sm border border-line bg-white py-2.5 text-[14px] text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Xem thêm {products.length - visible} sản phẩm
          </button>
        </div>
      ) : null}

      <p className="mt-3 text-center text-[11px] text-muted">
        Bạn đã xem hết sản phẩm gợi ý.{' '}
        <Link to="/tim-kiem" className="text-brand hover:underline">
          Khám phá thêm toàn bộ sàn
        </Link>
      </p>
    </section>
  )
}
