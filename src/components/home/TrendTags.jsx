import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { IconChevronRight, IconSparkle } from '../ui/Icons'

/**
 * Khu "Xu hướng tìm kiếm / Thương hiệu" — thanh từ khoá chạy ngang,
 * giúp người mua khám phá nhiều shop & ngành hàng khác nhau.
 */
export default function TrendTags() {
  const { shops, categories } = useCatalog()

  const groups = useMemo(
    () => [
      { title: 'Bạn đang tìm gì hôm nay?', items: categories.slice(0, 8).map((c) => ({ label: c.name, to: `/tim-kiem?category=${c.id}` })) },
      {
        title: 'Thương hiệu nổi bật',
        items: shops.filter((s) => s.mall).map((s) => ({ label: s.name, to: `/shop/${s.id}` })),
      },
      {
        title: 'Gian hàng uy tín',
        items: shops.filter((s) => !s.mall).slice(0, 6).map((s) => ({ label: s.name, to: `/shop/${s.id}` })),
      },
    ],
    [categories, shops],
  )

  return (
    <section className="mt-3 overflow-hidden rounded-sm border border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <IconSparkle className="h-4 w-4 text-brand" />
        <h2 className="text-[15px] font-bold uppercase tracking-tight text-ink md:text-[16px]">
          Khám Phá Gian Hàng & Ngành Hàng
        </h2>
        <Link to="/shop" className="ml-auto flex items-center gap-0.5 text-[13px] text-brand hover:underline">
          Xem tất cả gian hàng
          <IconChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="space-y-3 p-3">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-[12px] font-semibold uppercase text-muted">{g.title}</p>
            <div className="flex flex-wrap gap-2">
              {g.items.map((item) => (
                <Link
                  key={`${g.title}-${item.label}`}
                  to={item.to}
                  className="rounded-full border border-line bg-page px-3 py-1.5 text-[12px] text-ink-soft transition hover:border-brand hover:bg-brand-soft hover:text-brand"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
