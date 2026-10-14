import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { secondsToHms } from '../../utils/format'
import { IconBolt, IconChevronRight } from '../ui/Icons'
import ProductCard from '../product/ProductCard'

/** Đồng hồ đếm ngược khung giờ Flash Sale */
function Countdown() {
  const [left, setLeft] = useState(3600 * 3 + 1520)

  useEffect(() => {
    const timer = window.setInterval(() => setLeft((s) => (s <= 1 ? 3600 * 3 : s - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const { h, m, s } = secondsToHms(left)

  return (
    <div className="flex items-center gap-1">
      <span className="text-[13px] text-ink-soft">Kết thúc trong</span>
      <span className="grid h-6 w-7 place-items-center rounded-[3px] bg-black text-[12px] font-bold text-white">
        {h}
      </span>
      <span className="text-[12px] font-bold text-ink">:</span>
      <span className="grid h-6 w-7 place-items-center rounded-[3px] bg-black text-[12px] font-bold text-white">
        {m}
      </span>
      <span className="text-[12px] font-bold text-ink">:</span>
      <span className="grid h-6 w-7 place-items-center rounded-[3px] bg-black text-[12px] font-bold text-white">
        {s}
      </span>
    </div>
  )
}

/** Khối FLASH SALE (nền cam nhạt, 5 sản phẩm) */
export default function FlashSale() {
  const { flashProducts } = useCatalog()

  return (
    <section className="mt-3 overflow-hidden rounded-sm border border-line bg-white">
      <div className="flex items-center justify-between gap-3 bg-[#fff7f5] px-3 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[16px] font-black uppercase italic tracking-tight text-brand">
            <IconBolt className="h-5 w-5" />
            Flash Sale
          </span>
          <Countdown />
        </div>
        <Link to="/tim-kiem?flash=1" className="flex items-center gap-0.5 text-[13px] text-brand transition hover:underline">
          Xem tất cả
          <IconChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {flashProducts.map((p) => (
          <ProductCard key={p.id} product={p} variant="flash" />
        ))}
      </div>
    </section>
  )
}
