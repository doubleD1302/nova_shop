import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext'
import { useToast } from '../context/ToastContext'
import { secondsToHms } from '../utils/format'
import { getCurrentCampaign, getFlashSessions, rotateFlashProducts } from '../utils/flashSaleRotator'
import Breadcrumb from '../components/ui/Breadcrumb'
import ProductCard from '../components/product/ProductCard'
import EmptyState from '../components/ui/EmptyState'
import {
  IconBolt,
  IconClock,
  IconFlame,
  IconShieldCheck,
  IconTruck,
  IconSparkle,
  IconBell,
  IconCheck,
  IconGrid,
  IconMedalCheck,
  IconPackage,
  IconDress,
  IconTShirt,
  IconDeviceMobile,
  IconLaptopScreen,
  IconHeadphones,
  IconBeautyCosmetics,
  IconArmchair,
  IconBall,
  IconBabyStroller,
} from '../components/ui/Icons'

const CATEGORY_ICONS = {
  all: IconGrid,
  'thoi-trang-nu': IconDress,
  'thoi-trang-nam': IconTShirt,
  'dien-thoai': IconDeviceMobile,
  'may-tinh': IconLaptopScreen,
  'phu-kien-cong-nghe': IconHeadphones,
  'sac-dep': IconBeautyCosmetics,
  'nha-cua': IconArmchair,
  'the-thao': IconBall,
  'me-be': IconBabyStroller,
}

/** Đồng hồ đếm ngược phiên Flash Sale lớn trên banner */
function LargeCountdown() {
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

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="flex flex-col items-center">
        <span className="grid h-10 w-11 sm:h-12 sm:w-14 place-items-center rounded-xl bg-[#49352D] text-lg sm:text-2xl font-black text-[#FFFCF7] shadow-md border border-white/10">
          {h}
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#F5E7D4]">Giờ</span>
      </div>
      <span className="mb-4 text-xl sm:text-2xl font-black text-[#49352D]">:</span>
      <div className="flex flex-col items-center">
        <span className="grid h-10 w-11 sm:h-12 sm:w-14 place-items-center rounded-xl bg-[#49352D] text-lg sm:text-2xl font-black text-[#FFFCF7] shadow-md border border-white/10">
          {m}
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#F5E7D4]">Phút</span>
      </div>
      <span className="mb-4 text-xl sm:text-2xl font-black text-[#49352D]">:</span>
      <div className="flex flex-col items-center">
        <span className="grid h-10 w-11 sm:h-12 sm:w-14 place-items-center rounded-xl bg-[#49352D] text-lg sm:text-2xl font-black text-[#FFFCF7] shadow-md border border-white/10">
          {s}
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#F5E7D4]">Giây</span>
      </div>
    </div>
  )
}

const CATEGORY_TABS = [
  { id: 'all', label: 'Tất cả deal', slug: 'all' },
  { id: 'thoi-trang-nu', label: 'Thời trang nữ', slug: 'thoi-trang-nu' },
  { id: 'thoi-trang-nam', label: 'Thời trang nam', slug: 'thoi-trang-nam' },
  { id: 'dien-thoai', label: 'Điện thoại & Phụ kiện', slug: 'dien-thoai' },
  { id: 'may-tinh', label: 'Máy tính & Laptop', slug: 'may-tinh' },
  { id: 'phu-kien-cong-nghe', label: 'Thiết bị điện tử', slug: 'phu-kien-cong-nghe' },
  { id: 'sac-dep', label: 'Làm đẹp & Sức khỏe', slug: 'sac-dep' },
  { id: 'nha-cua', label: 'Nhà cửa & Đời sống', slug: 'nha-cua' },
  { id: 'the-thao', label: 'Thể thao & Du lịch', slug: 'the-thao' },
  { id: 'me-be', label: 'Mẹ & Bé', slug: 'me-be' },
]

const SORT_OPTIONS = [
  { id: 'discount', label: 'Mức giảm nhiều nhất' },
  { id: 'popular', label: 'Bán chạy nhất' },
  { id: 'price-asc', label: 'Giá thấp đến cao' },
  { id: 'price-desc', label: 'Giá cao đến thấp' },
]

export default function FlashSalePage() {
  const { loadProducts } = useCatalog()
  const { pushToast } = useToast()

  const campaign = useMemo(() => getCurrentCampaign(), [])
  const sessions = useMemo(() => getFlashSessions(), [])
  const defaultSession = useMemo(() => sessions.find((s) => s.isActive) || sessions[0], [sessions])

  const [selectedSession, setSelectedSession] = useState(defaultSession)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedSort, setSelectedSort] = useState('discount')
  const [allRawProducts, setAllRawProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [remindedSlots, setRemindedSlots] = useState(() => {
    try {
      const raw = localStorage.getItem('novashop_flash_reminders')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  // Tải danh sách sản phẩm mẫu lớn từ Catalog
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setLoading(true)
    setError('')
    loadProducts({ limit: 100, offset: 0, sort: 'popular', signal: controller.signal })
      .then((res) => {
        if (current) {
          setAllRawProducts(res.products || [])
        }
      })
      .catch((err) => {
        if (current && err.name !== 'AbortError') {
          setError(err.message || 'Không thể tải danh sách sản phẩm Flash Sale.')
        }
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
      controller.abort()
    }
  }, [loadProducts])

  // Xoay tua sản phẩm theo phiên được chọn
  const sessionProducts = useMemo(() => {
    if (!allRawProducts.length) return []
    const slotHour = selectedSession?.startHour ?? new Date().getHours()
    return rotateFlashProducts(allRawProducts, 40, slotHour)
  }, [allRawProducts, selectedSession])

  // Lọc theo danh mục và sắp xếp
  const filteredProducts = useMemo(() => {
    let list = [...sessionProducts]

    if (selectedCategory !== 'all') {
      list = list.filter((p) => {
        const cat = p.categoryId || p.categorySlug || p.category || ''
        return cat === selectedCategory || cat.includes(selectedCategory)
      })
    }

    const sorters = {
      discount: (a, b) => (b.discount || 0) - (a.discount || 0),
      popular: (a, b) => (b.sold || 0) - (a.sold || 0),
      'price-asc': (a, b) => (a.price || 0) - (b.price || 0),
      'price-desc': (a, b) => (b.price || 0) - (a.price || 0),
    }

    list.sort(sorters[selectedSort] || sorters.discount)
    return list
  }, [sessionProducts, selectedCategory, selectedSort])

  const handleRemindMe = (session) => {
    const slotId = session.id
    if (remindedSlots.includes(slotId)) {
      const next = remindedSlots.filter((id) => id !== slotId)
      setRemindedSlots(next)
      try {
        localStorage.setItem('novashop_flash_reminders', JSON.stringify(next))
      } catch {}
      pushToast(`Đã hủy nhắc nhở cho khung giờ ${session.rangeLabel}.`, 'info')
    } else {
      const next = [...remindedSlots, slotId]
      setRemindedSlots(next)
      try {
        localStorage.setItem('novashop_flash_reminders', JSON.stringify(next))
      } catch {}
      pushToast(`Đã đặt nhắc nhở cho khung giờ ${session.rangeLabel}! Bạn sẽ nhận thông báo khi mở bán.`, 'success')
    }
  }

  const isCurrentActive = selectedSession?.isActive

  return (
    <div className="min-h-screen bg-[#FDF9F3] pb-16">
      {/* Breadcrumb */}
      <div className="container-shop py-3">
        <Breadcrumb
          items={[
            { label: 'Trang chủ', to: '/' },
            { label: 'Flash Sale Chớp Nhoáng' },
          ]}
        />
      </div>

      {/* Hero Banner Flash Sale với hình ảnh visual thực tế và phong cách Terracotta */}
      <section className="container-shop mb-6">
        <div className="relative overflow-hidden rounded-3xl border border-[#E6D5C2] bg-gradient-to-r from-[#80513B] via-[#BD6E49] to-[#49352D] p-6 sm:p-8 lg:p-10 text-[#FFFCF7] shadow-lg">
          {/* Họa tiết trang trí nền */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10 flex flex-col items-center justify-between gap-6 lg:flex-row lg:items-center">
            {/* Cột trái: Tiêu đề + Chiến dịch */}
            <div className="max-w-2xl text-center lg:text-left">
              <div className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-3.5 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-amber-300 text-[#49352D]">
                  <IconBolt className="h-2.5 w-2.5 fill-current" />
                </span>
                <span>{campaign.title}</span>
                <span className="rounded-full bg-[#B93832] px-2 py-0.5 text-[10px] text-white font-black">
                  {campaign.badge}
                </span>
              </div>

              <div className="flex items-center justify-center lg:justify-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-[#BD6E49] text-[#FFFCF7] shadow-lg border border-amber-300/40">
                  <IconBolt className="h-7 w-7 fill-white text-white" />
                </span>
                <h1 className="text-2xl font-black uppercase tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Flash Sale Chớp Nhoáng
                </h1>
              </div>

              <p className="mt-3 text-sm text-[#F5E7D4] sm:text-base leading-relaxed">
                {campaign.subtitle} · Giờ vàng săn deal chiết khấu hủy diệt đến 75% độc quyền tại ShopNova.
              </p>

              {/* 3 Cam kết chuyên nghiệp với SVG icons */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-xs font-semibold text-white/95 lg:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-black/25 px-3 py-1.5 border border-white/15 backdrop-blur-xs">
                  <IconFlame className="h-4 w-4 text-amber-300 fill-amber-300" />
                  Giá hủy diệt từ 9.000₫
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-black/25 px-3 py-1.5 border border-white/15 backdrop-blur-xs">
                  <IconTruck className="h-4 w-4 text-emerald-300" />
                  Freeship toàn quốc từ 0₫
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-black/25 px-3 py-1.5 border border-white/15 backdrop-blur-xs">
                  <IconShieldCheck className="h-4 w-4 text-sky-300" />
                  100% Chính hãng · Đổi trả 7 ngày
                </span>
              </div>
            </div>

            {/* Cột phải: Hộp đồng hồ đếm ngược phiên kết hợp ảnh graphic */}
            <div className="flex flex-col items-center rounded-3xl border border-white/30 bg-[#FFFCF7]/95 p-5 text-[#49352D] shadow-2xl backdrop-blur-md min-w-[280px]">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#BD6E49]">
                <IconClock className="h-4 w-4 text-[#BD6E49]" />
                <span>{isCurrentActive ? 'Phiên kết thúc trong' : 'Phiên bắt đầu sau'}</span>
              </div>

              <div className="mt-3.5">
                <LargeCountdown />
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#E6D5C2] bg-[#FDF9F3] px-3 py-1.5 text-[11.5px] font-bold text-[#80513B]">
                <IconBolt className="h-3.5 w-3.5 text-[#BD6E49] fill-[#BD6E49]" />
                <span>{selectedSession.rangeLabel} · {selectedSession.title}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Thanh chọn khung giờ Flash Sale (Session Timeline Bar) */}
      <section className="container-shop mb-6">
        <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-2.5 shadow-2xs">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {sessions.map((session) => {
              const isSelected = selectedSession.id === session.id
              const isReminded = remindedSlots.includes(session.id)

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSession(session)}
                  className={`relative flex flex-col items-center rounded-xl p-3 text-center transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#BD6E49] to-[#A95532] text-white shadow-md -translate-y-0.5'
                      : session.isActive
                      ? 'bg-[#F5E7D4]/60 text-[#49352D] hover:bg-[#F5E7D4] border border-[#BD6E49]/40'
                      : 'bg-transparent text-[#8B7566] hover:bg-[#F5E7D4]/40 hover:text-[#49352D]'
                  }`}
                >
                  <span className={`text-base sm:text-lg font-black tracking-tight ${isSelected ? 'text-white' : 'text-[#49352D]'}`}>
                    {session.timeLabel}
                  </span>

                  <span
                    className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider ${
                      isSelected
                        ? 'text-amber-200'
                        : session.isActive
                        ? 'text-[#B93832]'
                        : session.status === 'ended'
                        ? 'text-[#8B7566]'
                        : 'text-[#BD6E49]'
                    }`}
                  >
                    {session.isActive ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-ping inline-block mr-0.5" />
                        Đang diễn ra
                      </>
                    ) : session.status === 'ended' ? (
                      'Đã kết thúc'
                    ) : (
                      <>
                        {isReminded ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <IconCheck className="h-3 w-3 stroke-[2.5]" />
                            Đã đặt nhắc
                          </span>
                        ) : (
                          'Sắp diễn ra'
                        )}
                      </>
                    )}
                  </span>

                  <span className={`mt-0.5 line-clamp-1 text-[11px] ${isSelected ? 'text-white/85' : 'text-[#8B7566]'}`}>
                    {session.title}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Thông báo chế độ xem khung giờ sắp diễn ra */}
      {!isCurrentActive && (
        <section className="container-shop mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3.5 text-amber-950 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-900 shadow-xs">
                <IconBell className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs sm:text-sm font-bold">
                  Khung giờ {selectedSession.rangeLabel} ({selectedSession.statusText})
                </p>
                <p className="text-[12px] text-amber-900/80 mt-0.5">
                  {selectedSession.status === 'ended'
                    ? 'Khung giờ này đã kết thúc. Bạn có thể tham khảo deal hoặc chọn khung giờ đang diễn ra.'
                    : 'Các sản phẩm dưới đây sẽ chính thức áp dụng giá ưu đãi khi khung giờ bắt đầu. Bấm "Nhắc tôi" để nhận thông báo!'}
                </p>
              </div>
            </div>

            {selectedSession.status === 'upcoming' && (
              <button
                type="button"
                onClick={() => handleRemindMe(selectedSession)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer ${
                  remindedSlots.includes(selectedSession.id)
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-[#BD6E49] text-white hover:bg-[#A95532]'
                }`}
              >
                <IconBell className="h-4 w-4" />
                {remindedSlots.includes(selectedSession.id) ? 'Đã bật nhắc nhở' : 'Nhắc tôi khi mở bán'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Bộ lọc ngành hàng với icon danh mục chuẩn & Sắp xếp */}
      <section className="container-shop mb-6">
        <div className="flex flex-col gap-3.5 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-3.5 sm:p-4 shadow-2xs">
          {/* Tabs ngành hàng với Icon chuyên nghiệp */}
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            {CATEGORY_TABS.map((tab) => {
              const active = selectedCategory === tab.id
              const TabIcon = CATEGORY_ICONS[tab.slug] || IconGrid

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-[#BD6E49] text-white shadow-sm -translate-y-0.5'
                      : 'bg-[#F5E7D4]/60 text-[#49352D] hover:bg-[#F5E7D4] hover:text-[#BD6E49]'
                  }`}
                >
                  <span className={`grid h-6 w-6 place-items-center rounded-lg ${active ? 'bg-white/20 text-white' : 'bg-white text-[#80513B]'}`}>
                    <TabIcon className="h-3.5 w-3.5" />
                  </span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="h-px bg-[#E6D5C2]" />

          {/* Sắp xếp */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-[#8B7566]">
              Tìm thấy <strong className="text-[#49352D]">{filteredProducts.length}</strong> sản phẩm Flash Sale
            </span>

            <div className="flex items-center gap-2">
              <span className="text-[#8B7566] hidden sm:inline">Sắp xếp theo:</span>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedSort(opt.id)}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                      selectedSort === opt.id
                        ? 'bg-[#49352D] text-white'
                        : 'bg-[#F5E7D4]/60 text-[#49352D] hover:bg-[#F5E7D4]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lưới sản phẩm Flash Sale */}
      <main className="container-shop">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#8B7566]">
            <IconBolt className="h-8 w-8 animate-bounce text-[#BD6E49] fill-[#BD6E49]" />
            <p className="mt-3 text-sm font-medium">Đang tải danh sách sản phẩm Flash Sale...</p>
          </div>
        ) : error && !filteredProducts.length ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p className="font-bold">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-xl bg-[#BD6E49] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#A95532]"
            >
              Thử lại
            </button>
          </div>
        ) : !filteredProducts.length ? (
          <EmptyState
            title="Không tìm thấy deal phù hợp"
            description="Hãy thử chọn ngành hàng khác hoặc chuyển sang khung giờ tiếp theo để săn sale."
            actionText="Xem tất cả deal"
            onAction={() => {
              setSelectedCategory('all')
              setSelectedSort('discount')
            }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} variant="flash" />
            ))}
          </div>
        )}
      </main>

      {/* Cam kết mua sắm & Lưu ý săn sale với SVG Icons */}
      <section className="container-shop mt-12">
        <div className="rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 sm:p-8 shadow-2xs">
          <div className="mb-4 flex items-center gap-2 text-base font-bold text-[#49352D]">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#BD6E49]">
              <IconSparkle className="h-4 w-4" />
            </span>
            <span className="uppercase tracking-tight">Quy chuẩn & Lưu ý săn Flash Sale ShopNova</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs text-[#8B7566] leading-relaxed">
            <div className="rounded-2xl border border-[#E6D5C2] bg-[#FDF9F3] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#49352D] font-bold mb-1.5">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-[#F5E7D4] text-[#BD6E49]">
                    <IconClock className="h-3.5 w-3.5" />
                  </span>
                  <span>1. Khung giờ làm mới</span>
                </div>
                <p>Flash Sale được xoay tua đều đặn mỗi 2 tiếng. Hãy đặt thông báo nhắc nhở để luôn là người đầu tiên săn được sản phẩm giá tốt.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E6D5C2] bg-[#FDF9F3] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#49352D] font-bold mb-1.5">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-[#F5E7D4] text-[#BD6E49]">
                    <IconFlame className="h-3.5 w-3.5 fill-[#BD6E49]" />
                  </span>
                  <span>2. Số lượng có hạn</span>
                </div>
                <p>Mỗi deal có số lượng suất mua ưu đãi cố định. Khi thanh tiến độ đạt 100%, sản phẩm sẽ tự động trở về giá niêm yết ban đầu.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E6D5C2] bg-[#FDF9F3] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#49352D] font-bold mb-1.5">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-[#F5E7D4] text-[#BD6E49]">
                    <IconMedalCheck className="h-3.5 w-3.5" />
                  </span>
                  <span>3. Tích hợp voucher</span>
                </div>
                <p>Bạn hoàn toàn có thể áp dụng thêm Voucher toàn sàn và mã Freeship tại bước thanh toán để tối đa hóa số tiền tiết kiệm.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E6D5C2] bg-[#FDF9F3] p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#49352D] font-bold mb-1.5">
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-[#F5E7D4] text-[#BD6E49]">
                    <IconShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  <span>4. Đổi trả an tâm</span>
                </div>
                <p>Mọi sản phẩm Flash Sale đều được cam kết 100% hàng chính hãng từ các gian hàng uy tín và được đổi trả miễn phí trong 7 ngày.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
