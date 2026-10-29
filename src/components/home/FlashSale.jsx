import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { secondsToHms } from '../../utils/format'
import { IconBolt, IconChevronRight } from '../ui/Icons'
import ProductCard from '../product/ProductCard'

/** Đồng hồ đếm ngược khung giờ Flash Sale */
function Countdown() {
  const getSecondsToHour = () => {
    const now = new Date()
    return (59 - now.getMinutes()) * 60 + (60 - now.getSeconds())
  }
  const [left, setLeft] = useState(getSecondsToHour)

  useEffect(() => {
    const timer = window.setInterval(() => setLeft(getSecondsToHour()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const { h, m, s } = secondsToHms(left)

  return (
    <div className="flex items-center gap-1">
      <span className="hidden text-xs text-[#8B7566] sm:inline">Làm mới sau</span>
      <span className="grid h-6 w-7 place-items-center rounded-md bg-[#49352D] text-[12px] font-bold text-[#FFFCF7] shadow-2xs">
        {h}
      </span>
      <span className="text-[12px] font-bold text-[#49352D]">:</span>
      <span className="grid h-6 w-7 place-items-center rounded-md bg-[#49352D] text-[12px] font-bold text-[#FFFCF7] shadow-2xs">
        {m}
      </span>
      <span className="text-[12px] font-bold text-[#49352D]">:</span>
      <span className="grid h-6 w-7 place-items-center rounded-md bg-[#49352D] text-[12px] font-bold text-[#FFFCF7] shadow-2xs">
        {s}
      </span>
    </div>
  )
}

/** Khối FLASH SALE */
export default function FlashSale() {
  const { loadProducts } = useCatalog()
  const [flashProducts, setFlashProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setLoading(true)
    setError('')
    loadProducts({ flash: true, sort: 'popular', limit: 5, offset: 0, signal: controller.signal })
      .then((result) => { if (current) setFlashProducts(result.products) })
      .catch((loadError) => {
        if (current && loadError.name !== 'AbortError') setError(loadError.message || 'Không thể tải sản phẩm Flash Sale.')
      })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false; controller.abort() }
  }, [loadProducts])

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D5C2] bg-gradient-to-r from-[#F5E7D4] to-[#FFFCF7] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-base font-black uppercase tracking-tight text-[#BD6E49] sm:text-lg">
            <IconBolt className="h-5 w-5" />
            Flash Sale
          </span>
          <Countdown />
        </div>
        <Link to="/tim-kiem?flash=1" className="flex items-center gap-0.5 text-[13px] font-medium text-[#BD6E49] transition hover:text-[#A95532]">
          Xem tất cả
          <IconChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {error && !flashProducts.length ? (
        <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-sm text-[#B93832]">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="px-5 py-10 text-center text-sm text-[#8B7566]">Đang tải sản phẩm Flash Sale...</p>
      ) : flashProducts.length ? (
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-5">
          {flashProducts.map((p) => (
            <ProductCard key={p.id} product={p} variant="flash" />
          ))}
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-sm text-[#8B7566]">
          Chưa có sản phẩm Flash Sale đang hoạt động.
        </p>
      )}
    </section>
  )
}
