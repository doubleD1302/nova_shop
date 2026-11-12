import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatVnd } from '../utils/format'
import { apiGetPublicVouchers, apiGetVoucherWallet, apiSaveVoucherToWallet } from '../utils/api'
import Breadcrumb from '../components/ui/Breadcrumb'
import EmptyState from '../components/ui/EmptyState'
import {
  IconTicketPercent,
  IconCopy,
  IconCheck,
  IconTruck,
  IconShieldCheck,
  IconSparkle,
  IconStore,
  IconBolt,
  IconSearch,
  IconHelpCircle,
  IconChevronLeft,
  IconChevronRight,
  IconWallet,
  IconMedalCheck,
  IconShoppingBag,
  IconTag,
  IconClock,
} from '../components/ui/Icons'

/** Danh mục voucher chuẩn phong cách Terracotta + Cream kèm icon chuyên nghiệp */
const VOUCHER_TABS = [
  { id: 'all', label: 'Tất cả mã', icon: IconTicketPercent },
  { id: 'platform', label: 'Toàn sàn ShopNova', icon: IconSparkle },
  { id: 'shipping', label: 'Miễn phí vận chuyển', icon: IconTruck },
  { id: 'shop', label: 'Voucher Gian Hàng', icon: IconStore },
  { id: 'new_user', label: 'Khách hàng mới', icon: IconMedalCheck },
  { id: 'wallet', label: 'Ví của tôi', icon: IconWallet },
]

/** Bộ dữ liệu voucher phong phú mẫu hỗ trợ hiển thị đẹp mắt và đầy đủ */
const DEFAULT_VOUCHER_TEMPLATES = [
  {
    id: 'tpl_nova20k',
    code: 'NOVA20K',
    name: 'Voucher Toàn Sàn Giảm 20.000₫',
    type: 'platform',
    badge: 'Toàn sàn',
    discountAmount: 20000,
    minSubtotal: 500000,
    discountDisplay: '20K',
    subtitle: 'Đơn tối thiểu 500.000₫',
    scope: 'Tất cả sản phẩm trên toàn sàn ShopNova',
    startsAt: '2026-01-01',
    endsAt: '2028-01-01',
    usedPercent: 42,
    colorType: 'terracotta',
  },
  {
    id: 'tpl_nova50k',
    code: 'NOVA50K',
    name: 'Đại Tiệc Sale Giảm 50.000₫',
    type: 'platform',
    badge: 'Toàn sàn',
    discountAmount: 50000,
    minSubtotal: 350000,
    discountDisplay: '50K',
    subtitle: 'Đơn tối thiểu 350.000₫',
    scope: 'Áp dụng cho mọi đơn hàng hợp lệ',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    usedPercent: 68,
    colorType: 'terracotta',
  },
  {
    id: 'tpl_novasale10',
    code: 'NOVASALE10',
    name: 'Siêu Hội Mua Sắm Giảm 10%',
    type: 'platform',
    badge: 'Toàn sàn',
    discountAmount: 70000,
    minSubtotal: 200000,
    discountDisplay: '10%',
    subtitle: 'Giảm tối đa 70.000₫ · Đơn từ 200k',
    scope: 'Áp dụng cho mọi ngành hàng',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    usedPercent: 78,
    colorType: 'terracotta',
  },
  {
    id: 'tpl_novavip100',
    code: 'NOVAVIP100',
    name: 'Voucher Khách Hàng Thân Thiết 100K',
    type: 'platform',
    badge: 'Độc quyền',
    discountAmount: 100000,
    minSubtotal: 600000,
    discountDisplay: '100K',
    subtitle: 'Đơn tối thiểu 600.000₫',
    scope: 'Dành cho khách hàng thân thiết ShopNova',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    usedPercent: 88,
    colorType: 'terracotta',
  },
  {
    id: 'tpl_freeship15',
    code: 'FREESHIP15',
    name: 'Freeship Xtra Giảm 15.000₫ Phí Vận Chuyển',
    type: 'shipping',
    badge: 'Freeship Xtra',
    discountAmount: 15000,
    minSubtotal: 99000,
    discountDisplay: '15K',
    subtitle: 'Giảm 15.000₫ phí ship · Đơn từ 99k',
    scope: 'Áp dụng cho đơn hàng có đơn vị vận chuyển hỗ trợ',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    usedPercent: 55,
    colorType: 'teal',
  },
  {
    id: 'tpl_freeship30',
    code: 'FREESHIP30',
    name: 'Freeship Xtra Giảm 30.000₫ Phí Vận Chuyển',
    type: 'shipping',
    badge: 'Freeship Xtra',
    discountAmount: 30000,
    minSubtotal: 199000,
    discountDisplay: '30K',
    subtitle: 'Giảm 30.000₫ phí ship · Đơn từ 199k',
    scope: 'Áp dụng toàn quốc cho mọi hình thức vận chuyển',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    usedPercent: 84,
    colorType: 'teal',
  },
  {
    id: 'tpl_freeshipmax',
    code: 'FREESHIPMAX',
    name: 'Miễn Phí Vận Chuyển 100% Tối Đa 50K',
    type: 'shipping',
    badge: 'Freeship 100%',
    discountAmount: 50000,
    minSubtotal: 300000,
    discountDisplay: '100%',
    subtitle: 'Freeship 100% tối đa 50k · Đơn từ 300k',
    scope: 'Áp dụng cho đơn liên tỉnh hoặc giao nhanh',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    usedPercent: 91,
    colorType: 'teal',
  },
  {
    id: 'tpl_mall35k',
    code: 'MALLSUPER',
    name: 'Ưu Đãi Độc Quyền Gian Hàng Nova Mall',
    type: 'shop',
    badge: 'Nova Mall',
    discountAmount: 35000,
    minSubtotal: 250000,
    discountDisplay: '35K',
    subtitle: 'Đơn từ 250k tại gian hàng chính hãng',
    scope: 'Chỉ áp dụng cho các sản phẩm gắn nhãn Mall',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    usedPercent: 62,
    colorType: 'amber',
  },
  {
    id: 'tpl_fashion20',
    code: 'FASHION20',
    name: 'Voucher Ngành Hàng Thời Trang & Phụ Kiện',
    type: 'shop',
    badge: 'Thời trang',
    discountAmount: 20000,
    minSubtotal: 150000,
    discountDisplay: '20K',
    subtitle: 'Đơn từ 150k cho Thời trang & Túi ví',
    scope: 'Áp dụng ngành Thời trang nam, Thời trang nữ',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    usedPercent: 49,
    colorType: 'amber',
  },
  {
    id: 'tpl_tech50',
    code: 'TECHNOVA',
    name: 'Ưu Đãi Phụ Kiện Công Nghệ & Điện Tử',
    type: 'shop',
    badge: 'Công nghệ',
    discountAmount: 50000,
    minSubtotal: 400000,
    discountDisplay: '50K',
    subtitle: 'Đơn từ 400k cho Phụ kiện & Điện tử',
    scope: 'Áp dụng các gian hàng công nghệ được tài trợ',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    usedPercent: 73,
    colorType: 'amber',
  },
  {
    id: 'tpl_welcome50',
    code: 'WELCOME50',
    name: 'Quà Tặng Chào Mừng Thành Viên Mới 50K',
    type: 'new_user',
    badge: 'Khách mới',
    discountAmount: 50000,
    minSubtotal: 100000,
    discountDisplay: '50K',
    subtitle: 'Đơn đầu tiên từ 100k cho thành viên mới',
    scope: 'Dành riêng cho đơn hàng đầu tiên của tài khoản',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    usedPercent: 35,
    colorType: 'crimson',
  },
  {
    id: 'tpl_chaomoi20',
    code: 'CHAOMOI20',
    name: 'Voucher Tân Thủ Giảm 20.000₫',
    type: 'new_user',
    badge: 'Khách mới',
    discountAmount: 20000,
    minSubtotal: 50000,
    discountDisplay: '20K',
    subtitle: 'Đơn từ 50k cho lần đầu mua sắm',
    scope: 'Áp dụng không giới hạn danh mục cho khách mới',
    startsAt: '2026-10-01',
    endsAt: '2026-12-31',
    usedPercent: 28,
    colorType: 'crimson',
  },
]

export default function VouchersPage() {
  const { user } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('all')
  const [inputCode, setInputCode] = useState('')
  const [submittingCode, setSubmittingCode] = useState(false)
  const [modalVoucher, setModalVoucher] = useState(null)
  const [vouchersList, setVouchersList] = useState(DEFAULT_VOUCHER_TEMPLATES)
  const [loading, setLoading] = useState(true)

  // Quản lý trượt thanh danh mục voucher mượt mà (kéo chuột, nút bấm, vuốt cảm ứng)
  const tabNavRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const dragScrollLeft = useRef(0)
  const hasDragged = useRef(false)

  const checkScroll = useCallback(() => {
    const el = tabNavRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 6)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = tabNavRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  const scrollTabs = (direction) => {
    const el = tabNavRef.current
    if (!el) return
    const amount = direction === 'left' ? -220 : 220
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  const handleMouseDown = (e) => {
    const el = tabNavRef.current
    if (!el) return
    setIsDragging(true)
    hasDragged.current = false
    dragStartX.current = e.pageX - el.offsetLeft
    dragScrollLeft.current = el.scrollLeft
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    const el = tabNavRef.current
    if (!el) return
    e.preventDefault()
    const x = e.pageX - el.offsetLeft
    const walk = (x - dragStartX.current) * 1.3
    if (Math.abs(walk) > 4) hasDragged.current = true
    el.scrollLeft = dragScrollLeft.current - walk
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleSelectTab = (tabId, e) => {
    if (hasDragged.current) return
    setActiveTab(tabId)
    e?.currentTarget?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }

  // Lưu trữ mã voucher đã lưu vào ví (đồng bộ giữa API và localStorage)
  const [savedCodes, setSavedCodes] = useState(() => {
    try {
      const raw = localStorage.getItem('novashop_saved_vouchers')
      return raw ? JSON.parse(raw) : ['NOVA20K']
    } catch {
      return ['NOVA20K']
    }
  })

  // 1. Tải danh sách voucher công khai từ backend
  useEffect(() => {
    let current = true
    const controller = new AbortController()
    setLoading(true)

    Promise.all([
      apiGetPublicVouchers({ signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      user
        ? apiGetVoucherWallet(1, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([publicRes, walletRes]) => {
        if (!current) return

        // Xử lý danh sách đã lưu trong ví từ backend nếu đã đăng nhập
        if (walletRes?.success && Array.isArray(walletRes?.data?.items)) {
          const userWalletCodes = walletRes.data.items.map((i) => i.code)
          setSavedCodes((prev) => {
            const merged = Array.from(new Set([...prev, ...userWalletCodes]))
            try {
              localStorage.setItem('novashop_saved_vouchers', JSON.stringify(merged))
            } catch {}
            return merged
          })
        }

        // Hợp nhất voucher từ DB backend và templates chuẩn
        if (publicRes?.success && Array.isArray(publicRes?.data) && publicRes.data.length > 0) {
          const apiItems = publicRes.data.map((item) => {
            const disc = Number(item.discountAmount) || 20000
            const minSub = Number(item.minSubtotal) || 0
            const display = disc >= 1000 ? `${Math.round(disc / 1000)}K` : formatVnd(disc)

            return {
              id: `api_${item.id || item.code}`,
              code: item.code,
              name: item.name || `Voucher Giảm ${display}`,
              type: item.code.includes('SHIP') ? 'shipping' : 'platform',
              badge: item.code.includes('SHIP') ? 'Freeship' : 'Toàn sàn',
              discountAmount: disc,
              minSubtotal: minSub,
              discountDisplay: display,
              subtitle: minSub > 0 ? `Đơn tối thiểu ${formatVnd(minSub)}` : 'Không giới hạn đơn tối thiểu',
              scope: 'Áp dụng cho mọi sản phẩm hợp lệ trên hệ thống',
              startsAt: item.startsAt ? item.startsAt.slice(0, 10) : '2026-01-01',
              endsAt: item.endsAt ? item.endsAt.slice(0, 10) : '2028-01-01',
              usedPercent: item.usageLimit ? Math.min(100, Math.round(((item.usedCount || 0) / item.usageLimit) * 100)) : 45,
              colorType: item.code.includes('SHIP') ? 'teal' : 'terracotta',
            }
          })

          // Merge tránh trùng lặp mã code
          const map = new Map()
          apiItems.forEach((v) => map.set(v.code, v))
          DEFAULT_VOUCHER_TEMPLATES.forEach((v) => {
            if (!map.has(v.code)) map.set(v.code, v)
          })
          setVouchersList([...map.values()])
        }
      })
      .finally(() => {
        if (current) setLoading(false)
      })

    return () => {
      current = false
      controller.abort()
    }
  }, [user])

  // Lưu mã voucher vào ví
  const handleSaveVoucher = async (code) => {
    const cleanCode = (code || '').trim().toUpperCase()
    if (!cleanCode) return

    // Cập nhật state local ngay để giao diện phản hồi tức thì
    const nextSaved = Array.from(new Set([...savedCodes, cleanCode]))
    setSavedCodes(nextSaved)
    try {
      localStorage.setItem('novashop_saved_vouchers', JSON.stringify(nextSaved))
    } catch {}

    // Gọi API backend lưu ví nếu đã đăng nhập
    if (user) {
      try {
        await apiSaveVoucherToWallet(cleanCode)
      } catch {}
    }

    pushToast(`Đã lưu mã voucher "${cleanCode}" vào ví của bạn thành công!`, 'success')
  }

  // Sao chép mã voucher
  const handleCopyCode = (code) => {
    navigator.clipboard?.writeText(code)
    pushToast(`Đã sao chép mã voucher "${code}" vào bộ nhớ tạm!`, 'info')
  }

  // Nhập mã thủ công từ ô input
  const handleApplyInputCode = async (e) => {
    e.preventDefault()
    const code = inputCode.trim().toUpperCase()
    if (!code) {
      pushToast('Vui lòng nhập mã voucher.', 'error')
      return
    }

    setSubmittingCode(true)
    try {
      await handleSaveVoucher(code)
      setInputCode('')
    } finally {
      setSubmittingCode(false)
    }
  }

  // Lọc voucher theo Tab
  const filteredVouchers = useMemo(() => {
    if (activeTab === 'wallet') {
      return vouchersList.filter((v) => savedCodes.includes(v.code))
    }
    if (activeTab === 'all') return vouchersList
    return vouchersList.filter((v) => v.type === activeTab)
  }, [activeTab, savedCodes, vouchersList])

  const walletCount = savedCodes.length

  return (
    <div className="min-h-screen bg-[#FDF9F3] pb-16">
      {/* Breadcrumb */}
      <div className="container-shop py-3">
        <Breadcrumb
          items={[
            { label: 'Trang chủ', to: '/' },
            { label: 'Kho Voucher & Mã Giảm Giá' },
          ]}
        />
      </div>

      {/* Hero Banner Kho Voucher với hình ảnh banner thực tế và phong cách Terracotta */}
      <section className="container-shop mb-6">
        <div className="relative overflow-hidden rounded-3xl border border-[#E6D5C2] bg-gradient-to-r from-[#BD6E49] via-[#80513B] to-[#49352D] p-6 sm:p-8 lg:p-10 text-[#FFFCF7] shadow-lg">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10 flex flex-col items-center justify-between gap-6 lg:flex-row lg:items-center">
            {/* Cột trái: Tiêu đề + Form nhập mã */}
            <div className="max-w-2xl text-center lg:text-left">
              <div className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-3.5 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-amber-300 text-[#49352D]">
                  <IconTicketPercent className="h-2.5 w-2.5" />
                </span>
                <span>Trung Tâm Khuyến Mãi ShopNova</span>
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white font-black">
                  ĐỘC QUYỀN
                </span>
              </div>

              <div className="flex items-center justify-center lg:justify-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-[#BD6E49] text-[#FFFCF7] shadow-lg border border-amber-300/40">
                  <IconTicketPercent className="h-7 w-7 text-white stroke-[2]" />
                </span>
                <h1 className="text-2xl font-black uppercase tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Kho Voucher & Mã Giảm Giá
                </h1>
              </div>

              <p className="mt-3 text-sm text-[#F5E7D4] sm:text-base leading-relaxed">
                Thu thập hàng ngàn mã giảm giá toàn sàn, mã miễn phí vận chuyển Freeship Xtra và ưu đãi hấp dẫn từ gian hàng.
              </p>

              {/* Ô nhập mã Voucher nhanh với icon chuyên nghiệp */}
              <form onSubmit={handleApplyInputCode} className="mt-5 flex max-w-md items-center gap-2 mx-auto lg:mx-0">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B7566]">
                    <IconTag className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="Nhập mã voucher (VD: NOVA50K, FREESHIP...)"
                    className="w-full rounded-xl border border-white/30 bg-[#FFFCF7]/95 pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold uppercase text-[#49352D] placeholder:normal-case placeholder:text-[#8B7566] focus:border-white focus:bg-white focus:outline-none shadow-inner"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingCode}
                  className="shrink-0 rounded-xl bg-amber-400 px-4 py-2.5 text-xs sm:text-sm font-bold text-[#49352D] shadow-md transition hover:bg-amber-300 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {submittingCode ? 'Đang lưu...' : 'Lưu vào ví'}
                </button>
              </form>
            </div>

            {/* Cột phải: Thẻ banner minh họa voucher thực tế kết hợp thống kê ví */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-4">
              {/* Ảnh minh họa voucher banner thực tế */}
              <div className="hidden sm:block overflow-hidden rounded-2xl border border-white/20 shadow-md w-56 h-28 shrink-0">
                <img
                  src="/images/banners/banner-voucher-thang11.jpg"
                  alt="ShopNova Voucher Campaign"
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Hộp thống kê ví */}
              <div className="flex flex-col items-center rounded-2xl border border-white/20 bg-[#FFFCF7]/95 p-4 text-center text-[#49352D] shadow-xl backdrop-blur-md w-full sm:w-56">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8B7566]">
                  <IconWallet className="h-4 w-4 text-[#BD6E49]" />
                  <span>Ví voucher của bạn</span>
                </div>
                <p className="mt-1 text-2xl sm:text-3xl font-black text-[#BD6E49]">{walletCount}</p>
                <p className="text-[11px] text-[#8B7566]">mã ưu đãi sẵn sàng áp dụng</p>

                <button
                  type="button"
                  onClick={() => setActiveTab('wallet')}
                  className="mt-2.5 w-full rounded-xl border border-[#BD6E49] bg-[#BD6E49]/10 px-3 py-1.5 text-xs font-bold text-[#BD6E49] transition hover:bg-[#BD6E49] hover:text-white cursor-pointer"
                >
                  Xem ví của tôi
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs phân loại Voucher với thanh trượt ngang chuyên nghiệp */}
      <section className="container-shop mb-6">
        <div className="relative rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-2 sm:p-2.5 shadow-2xs">
          {/* Nút cuộn trái */}
          {canScrollLeft && (
            <>
              <button
                type="button"
                onClick={() => scrollTabs('left')}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white text-[#49352D] shadow-md border border-[#E6D5C2] hover:bg-[#F5E7D4] hover:text-[#BD6E49] transition cursor-pointer"
                title="Cuộn sang trái"
                aria-label="Cuộn sang trái"
              >
                <IconChevronLeft className="h-4 w-4" />
              </button>
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#FFFCF7] via-[#FFFCF7]/80 to-transparent rounded-l-2xl z-5" />
            </>
          )}

          {/* Container trượt ngang hỗ trợ kéo chuột mượt mà */}
          <div
            ref={tabNavRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`no-scrollbar flex items-center gap-2 overflow-x-auto scroll-smooth px-1 py-0.5 select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {VOUCHER_TABS.map((tab) => {
              const active = activeTab === tab.id
              const TabIcon = tab.icon
              const count =
                tab.id === 'wallet'
                  ? walletCount
                  : tab.id === 'all'
                  ? vouchersList.length
                  : vouchersList.filter((v) => v.type === tab.id).length

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={(e) => handleSelectTab(tab.id, e)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-[#BD6E49] text-white shadow-sm -translate-y-0.5'
                      : 'bg-transparent text-[#49352D] hover:bg-[#F5E7D4]/60 hover:text-[#BD6E49]'
                  }`}
                >
                  <TabIcon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.2 text-[10.5px] font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-[#E6D5C2] text-[#49352D]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Nút cuộn phải */}
          {canScrollRight && (
            <>
              <button
                type="button"
                onClick={() => scrollTabs('right')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white text-[#49352D] shadow-md border border-[#E6D5C2] hover:bg-[#F5E7D4] hover:text-[#BD6E49] transition cursor-pointer"
                title="Cuộn sang phải"
                aria-label="Cuộn sang phải"
              >
                <IconChevronRight className="h-4 w-4" />
              </button>
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#FFFCF7] via-[#FFFCF7]/80 to-transparent rounded-r-2xl z-5" />
            </>
          )}
        </div>
      </section>

      {/* Lưới thẻ Voucher với phong cách thiết kế cuống vé cao cấp */}
      <main className="container-shop">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#8B7566]">
            <IconTicketPercent className="h-8 w-8 animate-bounce text-[#BD6E49]" />
            <p className="mt-3 text-sm font-medium">Đang tải kho mã giảm giá...</p>
          </div>
        ) : !filteredVouchers.length ? (
          <EmptyState
            title={activeTab === 'wallet' ? 'Ví voucher của bạn đang trống' : 'Chưa có voucher trong danh mục này'}
            description={
              activeTab === 'wallet'
                ? 'Hãy thu thập các mã giảm giá hấp dẫn bên dưới để nhận ưu đãi khi thanh toán đơn hàng!'
                : 'Vui lòng quay lại sau hoặc xem các danh mục voucher khác.'
            }
            actionText="Khám phá tất cả mã"
            onAction={() => setActiveTab('all')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
            {filteredVouchers.map((v) => {
              const isSaved = savedCodes.includes(v.code)

              // Cấu hình màu sắc theo nhóm
              const colorConfig = {
                terracotta: {
                  stubBg: 'bg-gradient-to-br from-[#BD6E49] to-[#80513B]',
                  badgeBg: 'bg-[#BD6E49]/10 text-[#BD6E49] border-[#BD6E49]/20',
                  accentText: 'text-[#BD6E49]',
                  progressBg: 'bg-[#BD6E49]',
                  icon: IconSparkle,
                },
                teal: {
                  stubBg: 'bg-gradient-to-br from-[#0D9488] to-[#0F766E]',
                  badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  accentText: 'text-emerald-700',
                  progressBg: 'bg-emerald-600',
                  icon: IconTruck,
                },
                amber: {
                  stubBg: 'bg-gradient-to-br from-[#EA580C] to-[#C2410C]',
                  badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
                  accentText: 'text-amber-700',
                  progressBg: 'bg-amber-600',
                  icon: IconStore,
                },
                crimson: {
                  stubBg: 'bg-gradient-to-br from-[#B93832] to-[#991B1B]',
                  badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
                  accentText: 'text-rose-700',
                  progressBg: 'bg-rose-600',
                  icon: IconMedalCheck,
                },
              }[v.colorType || 'terracotta']

              const IconComponent = colorConfig.icon

              return (
                <div
                  key={v.id}
                  className="group relative flex overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BD6E49] hover:shadow-md"
                >
                  {/* Cột trái (Stub cuống vé) */}
                  <div
                    className={`relative flex w-28 sm:w-32 shrink-0 flex-col items-center justify-center p-3 text-center text-white ${colorConfig.stubBg}`}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 backdrop-blur-xs mb-1">
                      <IconComponent className="h-4.5 w-4.5 text-white" />
                    </span>

                    <span className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none">
                      {v.discountDisplay}
                    </span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/90">
                      GIẢM GIÁ
                    </span>

                    {/* Vết cắt răng cưa vé trên & dưới */}
                    <div className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-[#FDF9F3] border border-[#E6D5C2]" />
                    <div className="absolute -right-2 -bottom-2 h-4 w-4 rounded-full bg-[#FDF9F3] border border-[#E6D5C2]" />
                  </div>

                  {/* Đường nét đứt rãnh vé */}
                  <div className="relative w-0 border-r border-dashed border-[#E6D5C2]" />

                  {/* Cột phải (Body thân vé) */}
                  <div className="flex flex-1 flex-col justify-between p-3.5 sm:p-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${colorConfig.badgeBg}`}
                        >
                          {v.badge}
                        </span>

                        <button
                          type="button"
                          onClick={() => setModalVoucher(v)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#8B7566] hover:text-[#BD6E49] cursor-pointer"
                        >
                          <IconHelpCircle className="h-3.5 w-3.5" />
                          <span>Điều kiện</span>
                        </button>
                      </div>

                      <h3 className="mt-1.5 text-xs sm:text-sm font-bold text-[#49352D] line-clamp-1">
                        {v.name}
                      </h3>

                      <p className="mt-0.5 text-[11px] sm:text-[12px] text-[#8B7566]">
                        {v.subtitle}
                      </p>

                      {/* Mã voucher & nút sao chép */}
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6D5C2] bg-[#F5E7D4]/40 px-2 py-1 font-mono text-[11px] font-bold tracking-wider text-[#49352D]">
                          <IconTag className="h-3 w-3 text-[#BD6E49]" />
                          {v.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(v.code)}
                          className="grid h-6 w-6 place-items-center rounded-md border border-[#E6D5C2] bg-[#FFFCF7] text-[#8B7566] transition hover:border-[#BD6E49] hover:text-[#BD6E49] cursor-pointer"
                          title="Sao chép mã"
                        >
                          <IconCopy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Dưới cùng: HSD, Thanh % tiến độ và nút hành động */}
                    <div className="mt-3.5 pt-2 border-t border-[#E6D5C2]/60">
                      <div className="flex items-center justify-between gap-2 mb-2 text-[10.5px] text-[#8B7566]">
                        <span className="inline-flex items-center gap-1">
                          <IconClock className="h-3 w-3" />
                          HSD: {v.endsAt}
                        </span>
                        <span>Đã dùng {v.usedPercent}%</span>
                      </div>

                      {/* Thanh phần trăm đã dùng */}
                      <div className="relative mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E6D5C2]/50">
                        <div
                          className={`h-full rounded-full ${colorConfig.progressBg} transition-all duration-300`}
                          style={{ width: `${Math.min(100, v.usedPercent)}%` }}
                        />
                      </div>

                      {/* Nút hành động Lưu mã / Dùng ngay */}
                      <div className="flex items-center justify-end gap-2">
                        {isSaved ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <IconCheck className="h-3.5 w-3.5 stroke-[2.5]" />
                              Đã lưu vào ví
                            </span>
                            <button
                              type="button"
                              onClick={() => navigate('/tim-kiem')}
                              className="inline-flex items-center gap-1 rounded-xl bg-[#BD6E49] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#A95532] cursor-pointer shadow-xs"
                            >
                              <span>Dùng ngay</span>
                              <IconChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSaveVoucher(v.code)}
                            className="inline-flex items-center gap-1 rounded-xl bg-[#BD6E49] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#A95532] active:scale-95 cursor-pointer shadow-xs"
                          >
                            <IconTicketPercent className="h-3.5 w-3.5" />
                            <span>Lưu mã</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Hướng dẫn 3 bước sử dụng Voucher với SVG Icons */}
      <section className="container-shop mt-12">
        <div className="rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 sm:p-8 shadow-2xs">
          <div className="mb-6 flex items-center gap-2 text-base font-bold text-[#49352D]">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#BD6E49]">
              <IconSparkle className="h-4 w-4" />
            </span>
            <span className="uppercase tracking-tight">3 Bước đơn giản sử dụng mã giảm giá ShopNova</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 rounded-2xl border border-[#E6D5C2] bg-[#FDF9F3] p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#BD6E49] text-white shadow-xs">
                <IconTicketPercent className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-[#49352D] text-xs sm:text-sm">1. Thu thập mã vào ví</p>
                <p className="mt-1 text-xs text-[#8B7566] leading-relaxed">
                  Nhấn nút &quot;Lưu mã&quot; trên các thẻ voucher bạn muốn dùng hoặc nhập mã quà tặng tại ô tìm kiếm phía trên.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-[#E6D5C2] bg-[#FDF9F3] p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#BD6E49] text-white shadow-xs">
                <IconShoppingBag className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-[#49352D] text-xs sm:text-sm">2. Chọn sản phẩm & Mua sắm</p>
                <p className="mt-1 text-xs text-[#8B7566] leading-relaxed">
                  Duyệt hàng và thêm các sản phẩm yêu thích đạt mức giá trị tối thiểu của voucher vào giỏ hàng.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-[#E6D5C2] bg-[#FDF9F3] p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#BD6E49] text-white shadow-xs">
                <IconShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-[#49352D] text-xs sm:text-sm">3. Áp dụng tại bước Thanh toán</p>
                <p className="mt-1 text-xs text-[#8B7566] leading-relaxed">
                  Tại màn hình Đặt hàng, chọn mã đã lưu để hệ thống tự động trừ tiền chiết khấu và phí vận chuyển.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modal Chi tiết Điều Kiện Voucher */}
      {modalVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-4">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#BD6E49] text-white">
                  <IconTicketPercent className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-[#49352D]">Chi Tiết Mã Giảm Giá</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalVoucher(null)}
                className="grid h-8 w-8 place-items-center rounded-full text-[#8B7566] hover:bg-[#F5E7D4] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs leading-relaxed text-[#49352D]">
              <div className="rounded-xl border border-[#E6D5C2] bg-[#FDF9F3] p-3.5">
                <p className="text-sm font-black text-[#BD6E49]">{modalVoucher.name}</p>
                <p className="mt-1 font-mono text-xs font-bold text-[#49352D] flex items-center gap-1.5">
                  <IconTag className="h-3.5 w-3.5 text-[#BD6E49]" />
                  Mã: {modalVoucher.code}
                </p>
              </div>

              <div className="space-y-2">
                <p>
                  <strong>• Mức giảm:</strong> {formatVnd(modalVoucher.discountAmount)} (hoặc {modalVoucher.discountDisplay})
                </p>
                <p>
                  <strong>• Đơn tối thiểu:</strong> {formatVnd(modalVoucher.minSubtotal)}
                </p>
                <p>
                  <strong>• Phạm vi áp dụng:</strong> {modalVoucher.scope}
                </p>
                <p>
                  <strong>• Thời gian áp dụng:</strong> Từ {modalVoucher.startsAt} đến {modalVoucher.endsAt}
                </p>
                <p>
                  <strong>• Giới hạn:</strong> Mỗi tài khoản được sử dụng 01 lần cho đến khi hết lượt ưu đãi.
                </p>
                <p>
                  <strong>• Thanh toán áp dụng:</strong> COD, Ví MoMo, ZaloPay, VNPay, Chuyển khoản ngân hàng.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#E6D5C2] pt-4">
              <button
                type="button"
                onClick={() => {
                  handleCopyCode(modalVoucher.code)
                  setModalVoucher(null)
                }}
                className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-4 py-2 text-xs font-bold text-[#49352D] hover:bg-[#F5E7D4] cursor-pointer"
              >
                Sao chép mã
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSaveVoucher(modalVoucher.code)
                  setModalVoucher(null)
                }}
                className="rounded-xl bg-[#BD6E49] px-4 py-2 text-xs font-bold text-white hover:bg-[#A95532] cursor-pointer shadow-xs"
              >
                Lưu vào ví ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
