import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import SectionHeader from '../ui/SectionHeader'
import SmartImage from '../ui/SmartImage'

/** Khu "DANH MỤC NỔI BẬT" — Hiển thị 10 ngành hàng bằng ảnh chụp thật 100% sắc nét */
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
    const slug = c.slug || c.id || ''
    const realImg = c.image || c.imageUrl || (slug ? `/images/categories/${slug}.jpg` : '')
    return {
      ...c,
      image: realImg,
      count: Number(c.productCount) || 0,
    }
  })

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs">
      <SectionHeader
        title="DANH MỤC NỔI BẬT"
        rightLabel="Xem tất cả"
        rightTo="/tim-kiem"
        className="border-b border-[#E6D5C2] bg-[#F5E7D4] px-4 py-3.5 sm:px-5"
      />

      {error && !countByCategory.length ? (
        <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-sm text-[#B93832]">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10 divide-x divide-y divide-[#E6D5C2]">
        {countByCategory.map((c) => (
          <Link
            key={c.id || c.slug}
            to={`/tim-kiem?category=${c.id || c.slug}`}
            className="group flex min-h-[160px] flex-col items-center justify-center p-3 text-center transition-all duration-200 hover:bg-[#FBF3E8]"
          >
            {/* Hộp ảnh sản phẩm thật sắc nét */}
            <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#F5E7D4] shadow-2xs transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[#BD6E49] group-hover:shadow-md sm:h-[72px] sm:w-[72px]">
              <SmartImage
                src={c.image}
                fallback={c.fallbackImage || c.image}
                alt={c.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </span>

            {/* Tên danh mục */}
            <span className="mt-2.5 line-clamp-2 max-w-[95px] text-[12px] font-semibold leading-tight text-[#49352D] transition-colors group-hover:text-[#BD6E49]">
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
