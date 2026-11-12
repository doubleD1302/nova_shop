import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../../context/CatalogContext'
import { secondsToHms } from '../../utils/format'
import { IconBolt, IconChevronRight } from '../ui/Icons'
import ProductCard from '../product/ProductCard'
import { getCurrentCampaign, getSessionLabel, rotateFlashProducts } from '../../utils/flashSaleRotator'

/** Đồng hồ đếm ngược khung giờ Flash Sale */
export function Countdown({ className = '', compact = false }) {
  const getSecondsToSession = () => {
    const now = new Date()
    const currentHour = now.getHours()
    const nextHour = currentHour + (2 - (currentHour % 2))
    const nextSession = new Date(now.getFullYear(), now.getMonth(), now.getDate(), nextHour, 0, 0)
    return Math.max(0, Math.floor((nextSession - now) / 1000))
  }
  const [left, setLeft] = useState(getSecondsToSession)

  useEffect(() => {
    const timer = window.setInterval(() => setLeft(getSecondsToSession()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const { h, m, s } = secondsToHms(left)

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 font-mono font-bold text-xs bg-black/60 text-white px-2 py-0.5 rounded ${className}`}>
        <span>{h}:{m}:{s}</span>
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
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
  const campaign = getCurrentCampaign()
  const sessionLabel = getSessionLabel()

  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setLoading(true)
    setError('')
    loadProducts({ sort: 'popular', limit: 30, offset: 0, signal: controller.signal })
      .then((result) => {
        if (current) {
          const rotated = rotateFlashProducts(result.products || [], 5)
          setFlashProducts(rotated)
        }
      })
      .catch((loadError) => {
        if (current && loadError.name !== 'AbortError') setError(loadError.message || 'Không thể tải sản phẩm Flash Sale.')
      })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false; controller.abort() }
  }, [loadProducts])

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D5C2] bg-gradient-to-r from-[#F5E7D4] via-[#FDF3E8] to-[#FFFCF7] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-base font-black uppercase tracking-tight text-[#BD6E49] sm:text-lg">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#BD6E49] text-amber-300 shadow-xs">
              <IconBolt className="h-4 w-4 fill-amber-300" />
            </span>
            Flash Sale
          </div>
          <span className="rounded-md bg-[#B93832] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-2xs">
            {campaign.badge}
          </span>
          <Countdown />
          <span className="hidden text-xs font-medium text-[#8B7566] md:inline">
            • {sessionLabel}
          </span>
        </div>
        <Link
          to="/flash-sale"
          className="group flex items-center gap-1 text-[13px] font-semibold text-[#BD6E49] transition hover:text-[#A95532]"
        >
          <span>Xem tất cả</span>
          <IconChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
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
        <div className="grid grid-cols-2 gap-3.5 p-3.5 sm:grid-cols-3 lg:grid-cols-5">
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
