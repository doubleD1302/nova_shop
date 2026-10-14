import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { categoryImage } from '../../utils/image'
import SectionHeader from '../ui/SectionHeader'
import SmartImage from '../ui/SmartImage'

/** Khu "Danh Mục" — các ô danh mục dẫn tới trang tìm kiếm theo ngành hàng */
export default function CategoryStrip() {
  const { categories, products } = useCatalog()
  const countByCategory = categories.map((c) => ({
    ...c,
    count: products.filter((p) => p.categoryId === c.id).length,
  }))

  return (
    <section className="mt-3 rounded-sm border border-line bg-white">
      <SectionHeader
        title="Danh Mục"
        rightLabel="Xem tất cả"
        rightTo="/tim-kiem"
        className="border-b border-line px-3 py-2.5"
      />

      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-10">
        {countByCategory.map((c) => (
          <Link
            key={c.id}
            to={`/tim-kiem?category=${c.id}`}
            className="group flex flex-col items-center gap-2 border-b border-r border-line px-2 py-4 text-center transition hover:shadow-[inset_0_0_0_1px_#ee4d2d]"
          >
            <span className="grid h-[74px] w-[74px] place-items-center overflow-hidden rounded-full border border-line bg-white">
              <SmartImage
                src={categoryImage(c)}
                fallback={categoryImage(c)}
                alt={c.name}
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
            </span>
            <span className="text-[12px] leading-[15px] text-ink-soft transition group-hover:text-brand">
              {c.name}
            </span>
            <span className="text-[10px] text-muted">{c.count} sản phẩm</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
