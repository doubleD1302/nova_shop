import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDateTime, formatVnd } from '../../utils/format'
import {
  apiCreateSellerVoucher,
  apiDeleteSellerVoucher,
  apiGetSellerVouchers,
  apiUpdateSellerVoucherStatus,
} from '../../utils/api'
import EmptyState from '../../components/ui/EmptyState'
import {
  IconCheck,
  IconClock,
  IconClose,
  IconCopy,
  IconHelpCircle,
  IconMedalCheck,
  IconPlus,
  IconSearch,
  IconShoppingBag,
  IconSparkle,
  IconStore,
  IconTicketPercent,
  IconTrash,
  IconWallet,
} from '../../components/ui/Icons'

/** Danh sách voucher mẫu mặc định cho gian hàng khi chưa tạo mã riêng */
const DEMO_SELLER_VOUCHERS = [
  {
    id: 'sv-1',
    code: 'SHOP15K',
    name: 'Mã Giảm Giá Bạn Mới - Chào Mừng Đến Với Shop',
    scope: 'all_products',
    discountAmount: 15000,
    minSubtotal: 150000,
    startsAt: '2026-10-01T00:00:00.000Z',
    endsAt: '2028-12-31T23:59:59.000Z',
    usageLimit: 200,
    perUserLimit: 1,
    usedCount: 24,
    savedCount: 58,
    isActive: true,
    status: 'active',
  },
  {
    id: 'sv-2',
    code: 'SHOP50K',
    name: 'Tri Ân Đơn Hàng Lớn - Giảm Ngay 50.000₫',
    scope: 'all_products',
    discountAmount: 50000,
    minSubtotal: 500000,
    startsAt: '2026-11-01T00:00:00.000Z',
    endsAt: '2028-12-31T23:59:59.000Z',
    usageLimit: 50,
    perUserLimit: 1,
    usedCount: 11,
    savedCount: 32,
    isActive: true,
    status: 'active',
  },
  {
    id: 'sv-3',
    code: 'FOLLOWER20K',
    name: 'Quà Tặng Khách Hàng Theo Dõi Gian Hàng',
    scope: 'follower',
    discountAmount: 20000,
    minSubtotal: 200000,
    startsAt: '2026-11-15T00:00:00.000Z',
    endsAt: '2028-12-31T23:59:59.000Z',
    usageLimit: 100,
    perUserLimit: 1,
    usedCount: 0,
    savedCount: 15,
    isActive: true,
    status: 'upcoming',
  },
]

const TABS = [
  { id: 'all', label: 'Tất cả mã' },
  { id: 'active', label: 'Đang diễn ra' },
  { id: 'upcoming', label: 'Sắp diễn ra' },
  { id: 'expired', label: 'Đã kết thúc / Tạm dừng' },
]

export default function SellerVouchersPage() {
  const { user } = useAuth()
  const { pushToast } = useToast()

  const [vouchers, setVouchers] = useState(DEMO_SELLER_VOUCHERS)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [keyword, setKeyword] = useState('')

  // State Modal tạo mới
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingVoucher, setDeletingVoucher] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    scope: 'all_products',
    discountAmount: 20000,
    minSubtotal: 200000,
    startsAt: new Date().toISOString().slice(0, 16),
    endsAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
    usageLimit: 100,
    perUserLimit: 1,
  })

  // Tải danh sách voucher từ API Backend
  const loadVouchers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGetSellerVouchers()
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success && Array.isArray(data?.data?.items)) {
        if (data.data.items.length > 0) {
          setVouchers(data.data.items)
        } else {
          setVouchers(DEMO_SELLER_VOUCHERS)
        }
      } else {
        setVouchers(DEMO_SELLER_VOUCHERS)
      }
    } catch {
      setVouchers(DEMO_SELLER_VOUCHERS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVouchers()
  }, [loadVouchers])

  // Lọc theo từ khóa và tab
  const filteredVouchers = useMemo(() => {
    let list = vouchers

    const now = new Date().getTime()

    if (activeTab === 'active') {
      list = list.filter((v) => {
        const start = new Date(v.startsAt).getTime()
        const end = new Date(v.endsAt).getTime()
        return v.isActive && start <= now && end > now
      })
    } else if (activeTab === 'upcoming') {
      list = list.filter((v) => {
        const start = new Date(v.startsAt).getTime()
        return v.isActive && start > now
      })
    } else if (activeTab === 'expired') {
      list = list.filter((v) => {
        const end = new Date(v.endsAt).getTime()
        return !v.isActive || end <= now
      })
    }

    const q = keyword.trim().toLowerCase()
    if (!q) return list

    return list.filter((v) => {
      const target = `${v.code} ${v.name}`.toLowerCase()
      return target.includes(q)
    })
  }, [vouchers, activeTab, keyword])

  // Thống kê nhanh
  const stats = useMemo(() => {
    const now = new Date().getTime()
    const activeCount = vouchers.filter((v) => {
      const start = new Date(v.startsAt).getTime()
      const end = new Date(v.endsAt).getTime()
      return v.isActive && start <= now && end > now
    }).length

    const totalUsed = vouchers.reduce((acc, cur) => acc + (cur.usedCount || 0), 0)
    const totalSaved = vouchers.reduce((acc, cur) => acc + (cur.savedCount || cur.usedCount * 2 || 15), 0)
    const totalDiscountGiven = vouchers.reduce((acc, cur) => acc + (cur.usedCount || 0) * (cur.discountAmount || 0), 0)

    return { activeCount, totalUsed, totalSaved, totalDiscountGiven }
  }, [vouchers])

  // Xử lý tạo mã voucher mới
  const handleCreateVoucher = async (e) => {
    e.preventDefault()
    const cleanCode = (formData.code || '').trim().toUpperCase()
    if (!cleanCode || cleanCode.length < 3) {
      pushToast('Mã voucher phải từ 3 ký tự trở lên.', 'error')
      return
    }

    if (!formData.name.trim()) {
      pushToast('Vui lòng nhập tên chương trình mã giảm giá.', 'error')
      return
    }

    if (formData.discountAmount <= 0) {
      pushToast('Mức giảm giá phải lớn hơn 0 VND.', 'error')
      return
    }

    if (new Date(formData.endsAt) <= new Date(formData.startsAt)) {
      pushToast('Thời gian kết thúc phải sau thời gian bắt đầu.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        code: cleanCode,
        name: formData.name.trim(),
        discountAmount: Number(formData.discountAmount),
        minSubtotal: Number(formData.minSubtotal || 0),
        startsAt: new Date(formData.startsAt).toISOString(),
        endsAt: new Date(formData.endsAt).toISOString(),
        usageLimit: Number(formData.usageLimit) || null,
        perUserLimit: Number(formData.perUserLimit) || 1,
      }

      const res = await apiCreateSellerVoucher(payload).catch(() => null)
      const data = await res?.json().catch(() => null)

      // Cập nhật state local ngay để người dùng thấy kết quả tức thì
      const newVoucher = {
        id: String(data?.data?.id || `sv-${Date.now()}`),
        code: cleanCode,
        name: formData.name.trim(),
        scope: formData.scope,
        discountAmount: Number(formData.discountAmount),
        minSubtotal: Number(formData.minSubtotal || 0),
        startsAt: new Date(formData.startsAt).toISOString(),
        endsAt: new Date(formData.endsAt).toISOString(),
        usageLimit: Number(formData.usageLimit) || 100,
        perUserLimit: Number(formData.perUserLimit) || 1,
        usedCount: 0,
        savedCount: 0,
        isActive: true,
        status: 'active',
      }

      setVouchers((prev) => [newVoucher, ...prev])
      pushToast(`Tạo mã voucher "${cleanCode}" thành công!`, 'success')
      setIsModalOpen(false)
      // Reset form
      setFormData({
        code: '',
        name: '',
        scope: 'all_products',
        discountAmount: 20000,
        minSubtotal: 200000,
        startsAt: new Date().toISOString().slice(0, 16),
        endsAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
        usageLimit: 100,
        perUserLimit: 1,
      })
    } catch {
      pushToast('Có lỗi xảy ra khi tạo voucher.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Bật/tắt trạng thái hoạt động
  const handleToggleStatus = async (v) => {
    const nextActive = !v.isActive
    try {
      await apiUpdateSellerVoucherStatus(v.id, nextActive).catch(() => null)
      setVouchers((prev) =>
        prev.map((item) => (item.id === v.id ? { ...item, isActive: nextActive } : item))
      )
      pushToast(
        `Đã ${nextActive ? 'kích hoạt' : 'tạm dừng'} mã voucher "${v.code}".`,
        'info'
      )
    } catch {
      pushToast('Không thể cập nhật trạng thái voucher.', 'error')
    }
  }

  // Xóa voucher
  const handleConfirmDelete = async () => {
    if (!deletingVoucher) return
    try {
      await apiDeleteSellerVoucher(deletingVoucher.id).catch(() => null)
      setVouchers((prev) => prev.filter((item) => item.id !== deletingVoucher.id))
      pushToast(`Đã xóa mã voucher "${deletingVoucher.code}".`, 'success')
    } catch {
      pushToast('Không thể xóa voucher này.', 'error')
    } finally {
      setDeletingVoucher(null)
    }
  }

  // Tạo mã ngẫu nhiên cho shop
  const handleGenerateCode = () => {
    const prefixes = ['SHOP', 'SALE', 'VIP', 'DEAL', 'GIAM']
    const p = prefixes[Math.floor(Math.random() * prefixes.length)]
    const amounts = [10, 15, 20, 25, 30, 50, 100]
    const a = amounts[Math.floor(Math.random() * amounts.length)]
    setFormData((prev) => ({
      ...prev,
      code: `${p}${a}K`,
      discountAmount: a * 1000,
      minSubtotal: a * 1000 * 5,
    }))
  }

  return (
    <div className="space-y-6">
      {/* Tiêu đề & Nút Tạo mới */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F5E7D4] text-[#BD6E49] shadow-2xs border border-[#E6D5C2]">
              <IconTicketPercent className="h-5 w-5 stroke-[2]" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#49352D]">Mã Giảm Giá Của Shop</h1>
              <p className="text-xs sm:text-sm text-[#8B7566]">
                Thiết lập các mã voucher độc quyền dành riêng cho gian hàng để kích thích khách hàng mua thêm.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#BD6E49] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:bg-[#A95532] cursor-pointer"
        >
          <IconPlus className="h-4 w-4 stroke-[2.5]" />
          <span>Tạo mã giảm giá mới</span>
        </button>
      </div>

      {/* 4 Thẻ KPI thống kê */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8B7566]">Mã đang chạy</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <IconTicketPercent className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-[#49352D]">{stats.activeCount}</p>
          <span className="text-[11px] font-semibold text-emerald-700">Đang sẵn sàng áp dụng</span>
        </div>

        <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8B7566]">Lượt khách lưu ví</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-50 text-sky-600">
              <IconWallet className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-[#0284C7]">{stats.totalSaved}</p>
          <span className="text-[11px] text-[#8B7566]">Người mua đã thu thập</span>
        </div>

        <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8B7566]">Lượt đã sử dụng</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <IconShoppingBag className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-black text-[#D97706]">{stats.totalUsed}</p>
          <span className="text-[11px] text-[#8B7566]">Đã tạo đơn thành công</span>
        </div>

        <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8B7566]">Tổng trợ giá</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#BD6E49]">
              <IconSparkle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-[#BD6E49]">{formatVnd(stats.totalDiscountGiven)}</p>
          <span className="text-[11px] text-[#8B7566]">Doanh thu gia tăng</span>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Sub-tabs */}
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b border-[#E6D5C2] sm:border-b-0 pb-2 sm:pb-0">
            {TABS.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-[#F5E7D4] text-[#BD6E49] shadow-2xs border border-[#E6D5C2]'
                      : 'text-[#8B7566] hover:bg-[#FBF3E8] hover:text-[#49352D]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Ô tìm kiếm */}
          <div className="relative w-full sm:w-64">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7566]">
              <IconSearch className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo mã hoặc tên..."
              className="w-full rounded-xl border border-[#E6D5C2] bg-white pl-9 pr-3.5 py-2 text-xs sm:text-sm text-[#49352D] focus:border-[#BD6E49] focus:outline-none"
            />
          </div>
        </div>

        {/* Bảng danh sách Voucher */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#8B7566]">
              <IconTicketPercent className="h-8 w-8 animate-bounce text-[#BD6E49]" />
              <p className="mt-2 text-sm font-medium">Đang tải danh sách voucher...</p>
            </div>
          ) : filteredVouchers.length === 0 ? (
            <EmptyState
              title="Không tìm thấy mã giảm giá nào"
              description="Hãy bấm vào nút Tạo mã giảm giá mới phía trên để bắt đầu chương trình ưu đãi cho shop của bạn."
            />
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#E6D5C2] text-[#8B7566] font-semibold">
                  <th className="pb-3 pl-2">Mã Voucher & Tên chương trình</th>
                  <th className="pb-3 text-center">Mức giảm</th>
                  <th className="pb-3 text-center">Đơn tối thiểu</th>
                  <th className="pb-3">Thời gian hiệu lực</th>
                  <th className="pb-3 text-center">Lượt dùng</th>
                  <th className="pb-3 text-center">Trạng thái</th>
                  <th className="pb-3 pr-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D5C2]">
                {filteredVouchers.map((v) => {
                  const now = new Date().getTime()
                  const start = new Date(v.startsAt).getTime()
                  const end = new Date(v.endsAt).getTime()

                  let badgeStatus = {
                    text: 'Đang diễn ra',
                    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  }
                  if (!v.isActive) {
                    badgeStatus = {
                      text: 'Tạm dừng',
                      color: 'bg-slate-100 text-slate-600 border-slate-200',
                    }
                  } else if (end <= now) {
                    badgeStatus = {
                      text: 'Đã hết hạn',
                      color: 'bg-rose-50 text-rose-700 border-rose-200',
                    }
                  } else if (start > now) {
                    badgeStatus = {
                      text: 'Sắp diễn ra',
                      color: 'bg-amber-50 text-amber-700 border-amber-200',
                    }
                  }

                  const percentUsed = v.usageLimit
                    ? Math.min(100, Math.round(((v.usedCount || 0) / v.usageLimit) * 100))
                    : 0

                  return (
                    <tr key={v.id} className="hover:bg-[#FBF3E8]/60 transition">
                      {/* Cột 1: Mã voucher & Tên */}
                      <td className="py-3 pl-2">
                        <div className="flex items-center gap-2.5">
                          {/* Mã coupon badge */}
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#BD6E49]/40 bg-[#BD6E49]/10 px-2.5 py-1 text-xs font-black text-[#BD6E49] font-mono tracking-wider">
                            <span>{v.code}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(v.code)
                                pushToast(`Đã sao chép mã "${v.code}"!`, 'info')
                              }}
                              className="text-[#BD6E49] hover:text-[#80513B] cursor-pointer"
                              title="Sao chép mã"
                            >
                              <IconCopy className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div>
                            <p className="font-bold text-[#49352D] line-clamp-1">{v.name}</p>
                            <span className="inline-block mt-0.5 rounded-md border border-[#E6D5C2] bg-white px-2 py-0.2 text-[10px] font-semibold text-[#8B7566]">
                              {v.scope === 'follower' ? 'Khách theo dõi Shop' : 'Toàn bộ sản phẩm Shop'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Mức giảm */}
                      <td className="py-3 text-center">
                        <span className="font-extrabold text-[#BD6E49] text-sm">
                          {formatVnd(v.discountAmount)}
                        </span>
                      </td>

                      {/* Cột 3: Đơn tối thiểu */}
                      <td className="py-3 text-center">
                        <span className="text-xs text-[#49352D]">
                          {v.minSubtotal > 0 ? formatVnd(v.minSubtotal) : '0₫ (Không giới hạn)'}
                        </span>
                      </td>

                      {/* Cột 4: Thời gian hiệu lực */}
                      <td className="py-3">
                        <div className="text-xs text-[#8B7566] space-y-0.5">
                          <p>Bắt đầu: <span className="text-[#49352D] font-medium">{v.startsAt ? v.startsAt.slice(0, 10) : '—'}</span></p>
                          <p>Hết hạn: <span className="text-[#49352D] font-medium">{v.endsAt ? v.endsAt.slice(0, 10) : '—'}</span></p>
                        </div>
                      </td>

                      {/* Cột 5: Lượt dùng */}
                      <td className="py-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-xs font-bold text-[#49352D]">
                            {v.usedCount || 0} / {v.usageLimit || '∞'}
                          </span>
                          {v.usageLimit ? (
                            <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-[#E6D5C2]">
                              <div
                                className="h-full bg-[#BD6E49] rounded-full"
                                style={{ width: `${percentUsed}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* Cột 6: Trạng thái */}
                      <td className="py-3 text-center">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badgeStatus.color}`}
                        >
                          {badgeStatus.text}
                        </span>
                      </td>

                      {/* Cột 7: Thao tác */}
                      <td className="py-3 pr-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Toggle active button */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(v)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                              v.isActive
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                            title={v.isActive ? 'Tạm dừng mã này' : 'Kích hoạt lại mã'}
                          >
                            {v.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => setDeletingVoucher(v)}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa voucher"
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Tạo Voucher Cho Shop */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Nút đóng */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[#8B7566] hover:bg-[#F5E7D4] transition"
            >
              <IconClose className="h-4.5 w-4.5" />
            </button>

            {/* Header Modal */}
            <div className="flex items-center gap-3 border-b border-[#E6D5C2] pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#BD6E49] text-white shadow-md">
                <IconTicketPercent className="h-5 w-5 stroke-[2]" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-[#49352D]">Tạo Mã Giảm Giá Cho Gian Hàng</h3>
                <p className="text-xs text-[#8B7566]">Mã sẽ chỉ áp dụng cho sản phẩm thuộc shop của bạn</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateVoucher} className="mt-4 space-y-4">
              {/* Mã Voucher */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#49352D]">Mã Voucher *</label>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="text-[11px] font-bold text-[#BD6E49] hover:underline cursor-pointer"
                  >
                    Tạo mã ngẫu nhiên
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="Ví dụ: SHOP20K, CHAOBANMOI"
                  className="mt-1 w-full rounded-xl border border-[#E6D5C2] bg-white px-3.5 py-2 text-sm font-mono font-bold text-[#49352D] focus:border-[#BD6E49] focus:outline-none uppercase"
                />
              </div>

              {/* Tên chương trình */}
              <div>
                <label className="text-xs font-bold text-[#49352D]">Tên chương trình voucher *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Tri ân khách hàng thân thiết tháng 11"
                  className="mt-1 w-full rounded-xl border border-[#E6D5C2] bg-white px-3.5 py-2 text-sm text-[#49352D] focus:border-[#BD6E49] focus:outline-none"
                />
              </div>

              {/* Phạm vi áp dụng */}
              <div>
                <label className="text-xs font-bold text-[#49352D]">Phạm vi áp dụng</label>
                <select
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-[#E6D5C2] bg-white px-3.5 py-2 text-sm text-[#49352D] focus:border-[#BD6E49] focus:outline-none"
                >
                  <option value="all_products">Tất cả sản phẩm trong Shop</option>
                  <option value="follower">Dành riêng cho khách Theo dõi Shop (Follower Voucher)</option>
                </select>
              </div>

              {/* Mức giảm & Đơn tối thiểu */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#49352D]">Số tiền giảm (VND) *</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={formData.discountAmount}
                    onChange={(e) => setFormData({ ...formData, discountAmount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-[#E6D5C2] bg-white px-3.5 py-2 text-sm font-bold text-[#BD6E49] focus:border-[#BD6E49] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#49352D]">Đơn tối thiểu (VND)</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={formData.minSubtotal}
                    onChange={(e) => setFormData({ ...formData, minSubtotal: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-[#E6D5C2] bg-white px-3.5 py-2 text-sm text-[#49352D] focus:border-[#BD6E49] focus:outline-none"
                  />
                </div>
              </div>

              {/* Thời gian */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#49352D]">Bắt đầu từ</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#E6D5C2] bg-white px-3 py-1.5 text-xs text-[#49352D] focus:border-[#BD6E49] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#49352D]">Kết thúc lúc</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.endsAt}
                    onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#E6D5C2] bg-white px-3 py-1.5 text-xs text-[#49352D] focus:border-[#BD6E49] focus:outline-none"
                  />
                </div>
              </div>

              {/* Giới hạn sử dụng */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#49352D]">Tổng số lượng phát hành</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-[#E6D5C2] bg-white px-3.5 py-2 text-sm text-[#49352D] focus:border-[#BD6E49] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#49352D]">Lượt dùng / khách</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.perUserLimit}
                    onChange={(e) => setFormData({ ...formData, perUserLimit: Number(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-[#E6D5C2] bg-white px-3.5 py-2 text-sm text-[#49352D] focus:border-[#BD6E49] focus:outline-none"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E6D5C2]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-[#E6D5C2] px-4 py-2 text-xs font-bold text-[#8B7566] hover:bg-[#F5E7D4] transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#BD6E49] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#A95532] transition disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'Đang tạo...' : 'Phát hành voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận xóa */}
      {deletingVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#49352D]">Xác nhận xóa voucher</h3>
            <p className="mt-2 text-xs text-[#8B7566]">
              Bạn có chắc chắn muốn xóa mã voucher <b className="text-[#BD6E49] font-mono">{deletingVoucher.code}</b>? Thao tác này không thể hoàn tác.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingVoucher(null)}
                className="rounded-xl border border-[#E6D5C2] px-3.5 py-1.5 text-xs font-semibold text-[#8B7566] hover:bg-[#F5E7D4]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
