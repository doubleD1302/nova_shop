import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCatalog } from '../context/CatalogContext'
import { useToast } from '../context/ToastContext'
import { formatDateTime, formatNumber, formatVnd } from '../utils/format'
import {
  apiGetAdminEmailStatus,
  apiGetAdminResource,
  apiGetShopViolations,
  apiRetryViolationEmail,
  apiUpdateAdminProductApproval,
  apiUpdateAdminProductFlashSale,
  apiUpdateAdminResource,
} from '../utils/api'
import { productPlaceholder, resolveImageUrl } from '../utils/image'

// Danh sách các mục menu theo yêu cầu
const MENU_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', icon: 'grid' },
  { id: 'shops', label: 'Quản lý shop', icon: 'store' },
  { id: 'users', label: 'Quản lý người dùng', icon: 'users' },
  { id: 'products', label: 'Quản lý sản phẩm', icon: 'package' },
  { id: 'orders', label: 'Quản lý đơn hàng', icon: 'truck' },
  { id: 'revenue', label: 'Doanh thu', icon: 'wallet' },
  { id: 'reports', label: 'Báo cáo vi phạm', icon: 'flag' },
  { id: 'settings', label: 'Cài đặt', icon: 'settings' },
]

const STATUS_OPTIONS = {
  users: ['active', 'blocked'],
  shops: ['active', 'suspended', 'closed'],
  products: ['draft', 'active', 'hidden', 'archived'],
  reviews: ['visible', 'hidden'],
  reports: ['open', 'investigating', 'confirmed_violation', 'dismissed'],
}

const LABELS = {
  open: 'Chờ xử lý',
  investigating: 'Đang xác minh',
  confirmed_violation: 'Đã xác nhận vi phạm',
  dismissed: 'Không phát hiện vi phạm',
  resolved: 'Đã xử lý',
  active: 'Đang hoạt động',
  blocked: 'Đã khóa',
  suspended: 'Đã tạm khóa',
  closed: 'Đã đóng',
  draft: 'Bản nháp',
  hidden: 'Đã ẩn',
  archived: 'Đã lưu trữ',
  visible: 'Đang hiển thị',
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao hàng',
  cancelled: 'Đã hủy',
}

const STATUS_BADGE_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  visible: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-sky-50 text-sky-700 border-sky-200',
  shipping: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  open: 'bg-amber-50 text-amber-700 border-amber-200',
  investigating: 'bg-sky-50 text-sky-700 border-sky-200',
  confirmed_violation: 'bg-rose-50 text-rose-700 border-rose-200',
  draft: 'bg-slate-50 text-slate-600 border-slate-200',
  hidden: 'bg-slate-50 text-slate-600 border-slate-200',
  suspended: 'bg-rose-50 text-rose-700 border-rose-200',
  blocked: 'bg-rose-50 text-rose-700 border-rose-200',
  closed: 'bg-slate-50 text-slate-600 border-slate-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  dismissed: 'bg-slate-50 text-slate-600 border-slate-200',
}

const APPROVAL_LABELS = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
}

const APPROVAL_BADGE_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
}

function MenuIcon({ name, className = 'h-5 w-5' }) {
  switch (name) {
    case 'grid':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
        </svg>
      )
    case 'store':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    case 'users':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75" />
        </svg>
      )
    case 'package':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path d="M16.5 9.4L7.55 4.24a1.78 1.78 0 00-1.8 0l-3 1.73A1.78 1.78 0 002 7.51v8.98a1.78 1.78 0 00.75 1.46l3 1.73a1.78 1.78 0 001.8 0l8.95-5.16a1.78 1.78 0 00.75-1.46V9.4z" />
          <polyline points="3.29 7 12 12.01 20.71 7" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )
    case 'truck':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <rect x="1" y="3" width="15" height="13" rx="1" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      )
    case 'wallet':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
          <path d="M16 3H4a2 2 0 00-2 2v2" />
          <circle cx="16" cy="14" r="1.5" />
        </svg>
      )
    case 'flag':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      )
    case 'settings':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      )
    default:
      return null
  }
}

/**
 * TRANG BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN (ADMIN DASHBOARD) CHO NOVA SHOP
 * Thiết kế theo phong cách hiện đại pastel pink, trắng sạch sẽ, responsive.
 */
export default function AdminPage() {
  const { user, isInitializing, logout } = useAuth()
  const { refreshPublicCatalog } = useCatalog()
  const { pushToast } = useToast()
  const navigate = useNavigate()

  // Tab đang chọn
  const [activeTab, setActiveTab] = useState('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [keyword, setKeyword] = useState('')

  // Dữ liệu quản trị
  const [dashboardData, setDashboardData] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')

  const [resourceItems, setResourceItems] = useState([])
  const [resourceLoading, setResourceLoading] = useState(false)
  const [resourceError, setResourceError] = useState('')
  const [savingId, setSavingId] = useState('')

  // Quản lý kiểm duyệt sản phẩm
  const [productFilterTab, setProductFilterTab] = useState('all')
  const [previewProduct, setPreviewProduct] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  // Quản lý khóa / mở shop
  const [shopFilterTab, setShopFilterTab] = useState('all')
  const [lockShopTarget, setLockShopTarget] = useState(null)
  const [lockShopReason, setLockShopReason] = useState('')
  const [unlockShopTarget, setUnlockShopTarget] = useState(null)
  const [viewingViolationsShop, setViewingViolationsShop] = useState(null)
  const [shopViolationsLoading, setShopViolationsLoading] = useState(false)
  const [shopViolationsList, setShopViolationsList] = useState([])

  // Quản lý báo cáo vi phạm
  const [reportFilterTab, setReportFilterTab] = useState('all')
  const [selectedReport, setSelectedReport] = useState(null)
  const [evidenceZoomUrl, setEvidenceZoomUrl] = useState(null)
  const [systemEmailConfig, setSystemEmailConfig] = useState(null)

  // Tải dữ liệu Dashboard tổng quan
  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true)
    setDashboardError('')
    try {
      const res = await apiGetAdminResource('stats')
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Không thể tải thống kê bảng điều khiển.')
      }
      setDashboardData(payload.data)
    } catch (err) {
      setDashboardError(err.message || 'Lỗi khi kết nối dịch vụ dữ liệu quản trị.')
    } finally {
      setDashboardLoading(false)
    }
  }, [])

  // Tải dữ liệu chi tiết từng tab
  const loadResource = useCallback(async (tabKey) => {
    if (tabKey === 'dashboard' || tabKey === 'settings') return
    const resourceMap = {
      shops: 'shops',
      users: 'users',
      products: 'products',
      orders: 'orders',
      reports: 'reports',
      revenue: 'stats',
    }
    const targetResource = resourceMap[tabKey]
    if (!targetResource) return

    setResourceLoading(true)
    setResourceError('')
    try {
      const res = await apiGetAdminResource(targetResource)
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || `Không thể tải dữ liệu danh mục ${tabKey}.`)
      }
      const data = payload.data
      const keyName = {
        shops: 'shops',
        users: 'users',
        products: 'products',
        orders: 'orders',
        reports: 'reports',
        revenue: 'stats',
      }[tabKey]

      setResourceItems(Array.isArray(data?.[keyName]) ? data[keyName] : data || [])
    } catch (err) {
      setResourceError(err.message || 'Lỗi khi tải dữ liệu từ máy chủ.')
      setResourceItems([])
    } finally {
      setResourceLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'admin') {
      loadDashboard()
      if (activeTab !== 'dashboard') {
        loadResource(activeTab)
      }
      if (activeTab === 'settings' || activeTab === 'reports') {
        apiGetAdminEmailStatus()
          .then((r) => r.json())
          .then((d) => {
            if (d?.success) setSystemEmailConfig(d.data)
          })
          .catch(() => null)
      }
    }
  }, [user?.role, activeTab, loadDashboard, loadResource])

  // Đếm số lượng theo tab con cho Quản lý Shop
  const shopTabCounts = useMemo(() => {
    if (activeTab !== 'shops' || !Array.isArray(resourceItems)) {
      return { all: 0, active: 0, suspended: 0, closed: 0 }
    }
    return {
      all: resourceItems.length,
      active: resourceItems.filter((s) => s.status === 'active').length,
      suspended: resourceItems.filter((s) => s.status === 'suspended').length,
      closed: resourceItems.filter((s) => s.status === 'closed').length,
    }
  }, [activeTab, resourceItems])

  // Đếm số lượng theo tab con cho Báo Cáo Vi Phạm
  const reportTabCounts = useMemo(() => {
    if (activeTab !== 'reports' || !Array.isArray(resourceItems)) {
      return { all: 0, open: 0, investigating: 0, confirmed_violation: 0, dismissed: 0 }
    }
    return {
      all: resourceItems.length,
      open: resourceItems.filter((r) => r.status === 'open').length,
      investigating: resourceItems.filter((r) => r.status === 'investigating').length,
      confirmed_violation: resourceItems.filter((r) => r.status === 'confirmed_violation').length,
      dismissed: resourceItems.filter((r) => r.status === 'dismissed').length,
    }
  }, [activeTab, resourceItems])

  // Lọc dữ liệu theo từ khóa tìm kiếm và tab con
  const filteredItems = useMemo(() => {
    if (!Array.isArray(resourceItems)) return []
    let list = resourceItems

    if (activeTab === 'shops' && shopFilterTab !== 'all') {
      list = list.filter((s) => s.status === shopFilterTab)
    }
    if (activeTab === 'reports' && reportFilterTab !== 'all') {
      list = list.filter((r) => r.status === reportFilterTab)
    }

    const q = keyword.trim().toLowerCase()
    if (!q) return list

    return list.filter((item) => {
      const text = `${item.id || ''} ${item.name || ''} ${item.fullName || ''} ${item.username || ''} ${item.ownerName || ''} ${item.ownerUsername || ''} ${item.email || ''} ${item.shopName || ''} ${item.targetName || ''} ${item.code || ''} ${item.recipientName || ''} ${item.reason || ''} ${item.details || ''} ${item.suspensionReason || ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [resourceItems, keyword, activeTab, shopFilterTab, reportFilterTab])

  // Cập nhật trạng thái item (user, shop, product, report)
  const handleUpdateStatus = async (item, newStatus) => {
    const resourceKey = {
      shops: 'shops',
      users: 'users',
      products: 'products',
      reports: 'reports',
    }[activeTab]
    if (!resourceKey) return

    setSavingId(item.id)
    try {
      const res = await apiUpdateAdminResource(resourceKey, item.id, newStatus)
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Không thể cập nhật trạng thái.')
      }
      if (resourceKey !== 'reports') refreshPublicCatalog()
      pushToast('Đã cập nhật trạng thái thành công.', 'success')
      loadResource(activeTab)
    } catch (err) {
      pushToast(err.message || 'Có lỗi khi cập nhật trạng thái.', 'error')
    } finally {
      setSavingId('')
    }
  }

  // Khóa gian hàng vi phạm
  const handleConfirmLockShop = async () => {
    if (!lockShopTarget) return
    const reason = lockShopReason.trim()
    if (reason.length < 3) {
      pushToast('Vui lòng nhập lý do khóa gian hàng (ít nhất 3 ký tự).', 'error')
      return
    }
    setSavingId(`lock:${lockShopTarget.id}`)
    try {
      const res = await apiUpdateAdminResource('shops', lockShopTarget.id, 'suspended', { reason })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Không thể khóa gian hàng.')
      }
      refreshPublicCatalog()
      pushToast(`Đã khóa gian hàng "${lockShopTarget.name}" thành công. Sản phẩm của shop đã bị ẩn.`, 'success')
      setLockShopTarget(null)
      setLockShopReason('')
      if (selectedReport && String(selectedReport.shopId) === String(lockShopTarget.id)) {
        setSelectedReport((prev) => (prev ? { ...prev, shopStatus: 'suspended' } : null))
      }
      loadResource(activeTab)
    } catch (err) {
      pushToast(err.message || 'Lỗi khi khóa gian hàng.', 'error')
    } finally {
      setSavingId('')
    }
  }

  // Mở khóa gian hàng
  const handleConfirmUnlockShop = async () => {
    if (!unlockShopTarget) return
    setSavingId(`unlock:${unlockShopTarget.id}`)
    try {
      const res = await apiUpdateAdminResource('shops', unlockShopTarget.id, 'active')
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Không thể mở khóa gian hàng.')
      }
      refreshPublicCatalog()
      pushToast(`Đã mở khóa gian hàng "${unlockShopTarget.name}". Các sản phẩm đã hiển thị lại.`, 'success')
      setUnlockShopTarget(null)
      if (selectedReport && String(selectedReport.shopId) === String(unlockShopTarget.id)) {
        setSelectedReport((prev) => (prev ? { ...prev, shopStatus: 'active' } : null))
      }
      loadResource(activeTab)
    } catch (err) {
      pushToast(err.message || 'Lỗi khi mở khóa gian hàng.', 'error')
    } finally {
      setSavingId('')
    }
  }

  // Cập nhật trạng thái báo cáo vi phạm và tự động áp dụng chế tài
  const handleUpdateReportStatus = async (reportId, newStatus) => {
    setSavingId(`report:${reportId}`)
    try {
      const res = await apiUpdateAdminResource('reports', reportId, newStatus)
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Không thể cập nhật trạng thái báo cáo.')
      }

      if (newStatus === 'confirmed_violation') {
        const vNum = payload?.data?.violationNumber || 1
        const actionText = payload?.data?.actionTaken === 'shop_suspended' ? 'ĐÃ KHÓA GIAN HÀNG' : 'GỬI EMAIL CẢNH CÁO'
        const mailText = payload?.data?.emailStatus === 'sent'
          ? `Đã gửi email cảnh cáo tới ${payload.data.ownerEmail || 'chủ shop'}.`
          : payload?.data?.emailStatus === 'failed'
            ? `Gửi email thất bại: ${payload.data.emailError}. Bạn có thể bấm gửi lại.`
            : 'Chưa cấu hình dịch vụ email SMTP trên máy chủ.'
        pushToast(`Đã xác nhận vi phạm lần ${vNum} (${actionText})! ${mailText}`, 'success')
      } else {
        pushToast(`Đã cập nhật báo cáo thành: "${LABELS[newStatus] || newStatus}".`, 'success')
      }

      if (selectedReport && String(selectedReport.id) === String(reportId)) {
        setSelectedReport((prev) => (prev ? {
          ...prev,
          status: newStatus,
          shopStatus: payload?.data?.shopStatus || prev.shopStatus,
          violationNumber: payload?.data?.violationNumber || prev.violationNumber,
          violationAction: payload?.data?.actionTaken || prev.violationAction,
          violationId: payload?.data?.violationId || prev.violationId,
          violationEmailStatus: payload?.data?.emailStatus || prev.violationEmailStatus,
          violationEmailError: payload?.data?.emailError || prev.violationEmailError,
          violationEmailSentTo: payload?.data?.ownerEmail || prev.violationEmailSentTo,
          violationEmailSentAt: payload?.data?.emailSentAt || prev.violationEmailSentAt,
        } : null))
      }
      loadResource(activeTab)
    } catch (err) {
      pushToast(err.message || 'Lỗi khi cập nhật báo cáo.', 'error')
    } finally {
      setSavingId('')
    }
  }

  // Thử gửi lại email cảnh cáo nếu chưa thành công
  const handleRetryEmail = async (violationId) => {
    if (!violationId) return
    setSavingId(`email:${violationId}`)
    try {
      const res = await apiRetryViolationEmail(violationId)
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.data?.emailError || 'Thử gửi lại email thất bại.')
      }
      const isSent = data?.data?.emailStatus === 'sent'
      const recipient = data?.data?.emailSentTo || data?.data?.ownerEmail || 'chủ shop'
      if (isSent) {
        pushToast(`Đã gửi lại email thành công tới ${recipient}!`, 'success')
      } else if (data?.data?.emailStatus === 'not_configured') {
        pushToast('Dịch vụ SMTP chưa được cấu hình biến môi trường trên máy chủ.', 'info')
      } else {
        pushToast(`Gửi email thất bại: ${data?.data?.emailError || 'Lỗi kết nối máy chủ mail.'}`, 'error')
      }
      loadResource(activeTab)
      if (selectedReport) {
        setSelectedReport((prev) => (prev ? {
          ...prev,
          violationEmailStatus: data?.data?.emailStatus,
          violationEmailError: data?.data?.emailError,
          violationEmailSentTo: recipient,
          violationEmailSentAt: data?.data?.emailSentAt || prev.violationEmailSentAt,
        } : null))
      }
      if (viewingViolationsShop) {
        handleOpenShopViolations(viewingViolationsShop)
      }
    } catch (err) {
      pushToast(err.message || 'Lỗi khi gửi lại email.', 'error')
    } finally {
      setSavingId('')
    }
  }

  // Xem lịch sử vi phạm chi tiết của shop
  const handleOpenShopViolations = async (shop) => {
    setViewingViolationsShop(shop)
    setShopViolationsLoading(true)
    setShopViolationsList([])
    try {
      const res = await apiGetShopViolations(shop.id)
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        setShopViolationsList(data.data.violations || [])
      }
    } catch (err) {
      console.error('Lỗi khi tải lịch sử vi phạm gian hàng:', err)
    } finally {
      setShopViolationsLoading(false)
    }
  }

  // Mở modal Khóa Shop từ modal Báo Cáo
  const handleOpenLockFromReport = (rep) => {
    if (!rep.shopId) return
    setLockShopTarget({
      id: rep.shopId,
      name: rep.shopName || `Gian hàng #${rep.shopId}`,
      ownerName: '—',
      productCount: 0,
    })
    setLockShopReason(`Khóa do vi phạm: Báo cáo #${rep.id} (${rep.reason.slice(0, 150)})`)
  }

  // Duyệt sản phẩm
  const handleApproveProduct = async (product) => {
    setSavingId(`approve:${product.id}`)
    try {
      const res = await apiUpdateAdminProductApproval(product.id, { approvalStatus: 'approved' })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Không thể duyệt sản phẩm.')
      }
      pushToast(`Đã duyệt sản phẩm "${product.name}".`, 'success')
      refreshPublicCatalog()
      loadResource('products')
      if (previewProduct?.id === product.id) {
        setPreviewProduct((prev) => prev ? { ...prev, approvalStatus: 'approved', status: payload.data?.status || 'active', rejectionReason: null } : null)
      }
    } catch (err) {
      pushToast(err.message || 'Lỗi khi duyệt sản phẩm.', 'error')
    } finally {
      setSavingId('')
    }
  }

  // Mở modal từ chối
  const handleOpenReject = (product) => {
    setRejectTarget(product)
    setRejectReason(product.rejectionReason || '')
  }

  // Xác nhận từ chối sản phẩm
  const handleConfirmReject = async () => {
    if (!rejectTarget) return
    const reason = rejectReason.trim()
    if (!reason || reason.length < 3) {
      pushToast('Vui lòng nhập lý do từ chối cụ thể (tối thiểu 3 ký tự).', 'error')
      return
    }
    setSavingId(`reject:${rejectTarget.id}`)
    try {
      const res = await apiUpdateAdminProductApproval(rejectTarget.id, {
        approvalStatus: 'rejected',
        rejectionReason: reason,
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Không thể từ chối sản phẩm.')
      }
      pushToast(`Đã từ chối duyệt sản phẩm "${rejectTarget.name}".`, 'success')
      refreshPublicCatalog()
      loadResource('products')
      if (previewProduct?.id === rejectTarget.id) {
        setPreviewProduct((prev) => prev ? { ...prev, approvalStatus: 'rejected', rejectionReason: reason } : null)
      }
      setRejectTarget(null)
      setRejectReason('')
    } catch (err) {
      pushToast(err.message || 'Lỗi khi từ chối sản phẩm.', 'error')
    } finally {
      setSavingId('')
    }
  }

  // Đếm số lượng theo tab duyệt sản phẩm
  const productTabCounts = useMemo(() => {
    if (activeTab !== 'products' || !Array.isArray(resourceItems)) return { all: 0, pending: 0, approved: 0, rejected: 0, draft_hidden: 0 }
    return {
      all: resourceItems.length,
      pending: resourceItems.filter((p) => (p.approvalStatus || 'pending') === 'pending').length,
      approved: resourceItems.filter((p) => p.approvalStatus === 'approved').length,
      rejected: resourceItems.filter((p) => p.approvalStatus === 'rejected').length,
      draft_hidden: resourceItems.filter((p) => p.status === 'draft' || p.status === 'hidden').length,
    }
  }, [activeTab, resourceItems])

  // Lọc sản phẩm theo tab duyệt và từ khóa
  const displayedProducts = useMemo(() => {
    if (activeTab !== 'products') return filteredItems
    return filteredItems.filter((p) => {
      const app = p.approvalStatus || 'pending'
      if (productFilterTab === 'pending') return app === 'pending'
      if (productFilterTab === 'approved') return app === 'approved'
      if (productFilterTab === 'rejected') return app === 'rejected'
      if (productFilterTab === 'draft_hidden') return p.status === 'draft' || p.status === 'hidden'
      return true
    })
  }, [activeTab, filteredItems, productFilterTab])

  // Bật/tắt Flash Sale sản phẩm
  const handleToggleFlashSale = async (product, enabled) => {
    const savingKey = `flash:${product.id}`
    setSavingId(savingKey)
    try {
      const res = await apiUpdateAdminProductFlashSale(product.id, enabled)
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Không thể cập nhật Flash Sale.')
      }
      refreshPublicCatalog()
      pushToast(enabled ? 'Đã bật Flash Sale.' : 'Đã tắt Flash Sale.', 'success')
      loadResource('products')
    } catch (err) {
      pushToast(err.message || 'Có lỗi khi cập nhật Flash Sale.', 'error')
    } finally {
      setSavingId('')
    }
  }

  // Kiểm tra phiên đăng nhập & phân quyền
  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF3E8] p-8 text-center text-[14px] text-[#8B7566]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#BD6E49] border-t-transparent" />
          <span>Đang kiểm tra quyền quản trị hệ thống...</span>
        </div>
      </div>
    )
  }

  // Nếu chưa đăng nhập hoặc không phải admin: hiển thị form đăng nhập riêng của Admin Portal
  if (!user || user.role !== 'admin') {
    return (
      <AdminLoginForm
        currentUser={user}
        onLoginSuccess={() => {
          loadDashboard()
        }}
      />
    )
  }

  const stats = dashboardData?.stats || {
    totalShops: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0,
  }
  const recentOrders = dashboardData?.recentOrders || []
  const orderStatusCounts = dashboardData?.orderStatusCounts || {}

  return (
    <div className="flex min-h-screen bg-[#FBF3E8] text-[#49352D] antialiased">
      {/* ============================================================ */}
      {/* 1. SIDEBAR DỌC BÊN TRÁI - CHIỀU CAO TOÀN MÀN HÌNH              */}
      {/* ============================================================ */}
      {/* Mobile Backdrop */}
      {mobileMenuOpen ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setMobileMenuOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between border-r border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-sm transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Logo & Brand Header */}
          <div className="flex items-center justify-between px-2 pt-1">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/images/logo.png"
                alt="NovaShop Logo"
                className="h-10 w-10 object-contain rounded-full shadow-2xs transition-transform duration-200 hover:scale-105"
              />
              <div>
                <span className="text-[17px] font-black tracking-tight text-[#49352D] block leading-none">
                  NOVA SHOP
                </span>
                <span className="text-[11px] font-semibold text-[#A95532] tracking-wider uppercase mt-1 block">
                  Admin Portal
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-[#8B7566] hover:bg-[#F5E7D4] lg:hidden"
            >
              ✕
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1">
            {MENU_ITEMS.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id)
                    setKeyword('')
                    setMobileMenuOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition ${
                    isActive
                      ? 'bg-[#F5E7D4] text-[#A95532] font-semibold shadow-2xs border border-[#E6D5C2]'
                      : 'text-[#8B7566] hover:bg-[#FBF3E8] hover:text-[#49352D]'
                  }`}
                >
                  <span className={isActive ? 'text-[#A95532]' : 'text-[#8B7566]'}>
                    <MenuIcon name={item.icon} className="h-4.5 w-4.5" />
                  </span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Admin Profile & Actions */}
        <div className="space-y-3 pt-4 border-t border-[#E6D5C2]">
          {/* Quick Info Card */}
          <div className="rounded-xl bg-[#FBF3E8] p-3 border border-[#E6D5C2]">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#A95532] text-xs font-bold text-[#FFFCF7] shadow-2xs">
                {user.fullName?.charAt(0) || 'A'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-[#49352D]">
                  {user.fullName || user.username}
                </p>
                <span className="inline-block rounded-full bg-[rgba(84, 118, 83, 0.1)] px-1.5 py-0.2 text-[10px] font-medium text-[#547653]">
                  Quản trị viên
                </span>
              </div>
            </div>
          </div>

          {/* Back to Store & Logout */}
          <div className="flex gap-2 text-[12px]">
            <Link
              to="/"
              className="flex-1 rounded-xl border border-[#E6D5C2] py-2 text-center font-medium text-[#8B7566] transition hover:border-[#BD6E49] hover:text-[#A95532] hover:bg-[#F5E7D4]"
            >
              Về cửa hàng
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex-1 rounded-xl bg-[#F5E7D4] py-2 font-medium text-[#A95532] transition hover:bg-[#E6D5C2]"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. KHU VỰC NỘI DUNG CHÍNH (MAIN CONTENT AREA)                  */}
      {/* ============================================================ */}
      <div className="flex flex-1 flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#E6D5C2] bg-[#FFFCF7]/95 px-5 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#E6D5C2] text-[#8B7566] hover:bg-[#F5E7D4] lg:hidden"
            >
              <MenuIcon name="grid" className="h-5 w-5" />
            </button>

            <div>
              <h1 className="text-[17px] font-bold text-[#49352D] leading-none">
                {MENU_ITEMS.find((m) => m.id === activeTab)?.label || 'Bảng điều khiển'}
              </h1>
              <span className="text-[11px] text-[#8B7566] mt-0.5 block">
                Hệ thống quản lý thương mại điện tử NovaShop
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Box */}
            <div className="relative hidden sm:block w-64">
              <span className="absolute left-3 top-2.5 text-[#8B7566]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm kiếm nhanh..."
                className="w-full rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] pl-9 pr-3.5 py-1.5 text-[12px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#BD6E49] focus:bg-[#FFFCF7]"
              />
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                loadDashboard()
                if (activeTab !== 'dashboard') loadResource(activeTab)
                pushToast('Đang làm mới dữ liệu...', 'info')
              }}
              title="Làm mới dữ liệu"
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#E6D5C2] text-[#8B7566] transition hover:border-[#BD6E49] hover:text-[#A95532] hover:bg-[#F5E7D4]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Quick Visit Shop Button */}
            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3 py-1.5 text-[12px] font-medium text-[#8B7566] transition hover:border-[#BD6E49] hover:text-[#A95532] hover:bg-[#F5E7D4]"
            >
              <span>Xem sàn</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </Link>
          </div>
        </header>

        {/* Main Body Content */}
        <main className="p-4 sm:p-6 space-y-6">
          {/* ============================================================ */}
          {/* TAB 1: TỔNG QUAN (DASHBOARD)                                   */}
          {/* ============================================================ */}
          {activeTab === 'dashboard' ? (
            <div className="space-y-6">
              {dashboardError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-700">
                  {dashboardError}
                </div>
              ) : null}

              {/* HÀNG 1: 5 THẺ THỐNG KÊ KPI CHÍNH */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {/* 1. Tổng số Shop */}
                <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F5E7D4] text-[#A95532]">
                      <MenuIcon name="store" className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-[rgba(84, 118, 83, 0.1)] px-2 py-0.5 text-[11px] font-medium text-[#547653]">
                      Gian hàng
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[22px] font-extrabold text-[#49352D]">
                      {dashboardLoading ? '...' : formatNumber(stats.totalShops)}
                    </span>
                    <p className="mt-0.5 text-[12px] text-[#8B7566]">Tổng số gian hàng</p>
                  </div>
                </div>

                {/* 2. Tổng sản phẩm */}
                <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E0F2FE] text-[#0284C7]">
                      <MenuIcon name="package" className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-[#E0F2FE] px-2 py-0.5 text-[11px] font-medium text-[#0284C7]">
                      Đang bán
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[22px] font-extrabold text-[#49352D]">
                      {dashboardLoading ? '...' : formatNumber(stats.totalProducts)}
                    </span>
                    <p className="mt-0.5 text-[12px] text-[#8B7566]">Tổng số sản phẩm</p>
                  </div>
                </div>

                {/* 3. Tổng đơn hàng */}
                <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F3E8FF] text-[#7E22CE]">
                      <MenuIcon name="truck" className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-[#F3E8FF] px-2 py-0.5 text-[11px] font-medium text-[#7E22CE]">
                      Toàn sàn
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[22px] font-extrabold text-[#49352D]">
                      {dashboardLoading ? '...' : formatNumber(stats.totalOrders)}
                    </span>
                    <p className="mt-0.5 text-[12px] text-[#8B7566]">Tổng đơn hàng</p>
                  </div>
                </div>

                {/* 4. Tổng khách hàng */}
                <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF7ED] text-[#EA580C]">
                      <MenuIcon name="users" className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[11px] font-medium text-[#EA580C]">
                      Người mua
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[22px] font-extrabold text-[#49352D]">
                      {dashboardLoading ? '...' : formatNumber(stats.totalCustomers)}
                    </span>
                    <p className="mt-0.5 text-[12px] text-[#8B7566]">Khách hàng đăng ký</p>
                  </div>
                </div>

                {/* 5. Doanh thu toàn sàn */}
                <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(84, 118, 83, 0.1)] text-[#547653]">
                      <MenuIcon name="wallet" className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-[rgba(84, 118, 83, 0.1)] px-2 py-0.5 text-[11px] font-medium text-[#547653]">
                      Thực nhận
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[20px] font-extrabold text-[#49352D] truncate block">
                      {dashboardLoading ? '...' : formatVnd(stats.totalRevenue)}
                    </span>
                    <p className="mt-0.5 text-[12px] text-[#8B7566]">Doanh thu đã giao</p>
                  </div>
                </div>
              </div>

              {/* HÀNG 2: BIỂU ĐỒ DOANH THU & PHÂN BỔ THỐNG KÊ (GRID 12 CỘT) */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Cột trái (8 cột): Biểu đồ Sales Reports */}
                <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs lg:col-span-8">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D5C2] pb-3">
                    <div>
                      <h2 className="text-[15px] font-bold text-[#49352D]">Tình Hình Doanh Thu Toàn Sàn</h2>
                      <p className="text-[11px] text-[#8B7566] mt-0.5">
                        Biểu đồ diễn biến doanh số và lượt đặt hàng theo thời gian
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-[12px]">
                      <span className="flex items-center gap-1.5 text-[#8B7566]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#A95532]" /> Doanh thu
                      </span>
                      <span className="flex items-center gap-1.5 text-[#8B7566]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7]" /> Đơn hàng
                      </span>
                    </div>
                  </div>

                  {/* SVG Line Chart Canvas */}
                  <div className="mt-5 relative h-52 w-full">
                    <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-[#8B7566]">
                      <div className="border-b border-[#E6D5C2]/50 pb-0.5">500.000₫</div>
                      <div className="border-b border-[#E6D5C2]/50 pb-0.5">375.000₫</div>
                      <div className="border-b border-[#E6D5C2]/50 pb-0.5">250.000₫</div>
                      <div className="border-b border-[#E6D5C2]/50 pb-0.5">125.000₫</div>
                      <div className="border-b border-[#E6D5C2]/50 pb-0.5">0₫</div>
                    </div>

                    <svg className="absolute inset-0 h-full w-full pl-12 pr-4 pt-2 pb-6" preserveAspectRatio="none" viewBox="0 0 100 100">
                      {/* Đường sóng doanh thu màu hồng */}
                      <path
                        d="M0,90 Q15,70 30,75 T60,60 T85,45 T100,50"
                        fill="none"
                        stroke="#A95532"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      {/* Điểm nút */}
                      <circle cx="0" cy="90" r="3" fill="#A95532" />
                      <circle cx="30" cy="75" r="3" fill="#A95532" />
                      <circle cx="60" cy="60" r="3" fill="#A95532" />
                      <circle cx="85" cy="45" r="3" fill="#A95532" />
                      <circle cx="100" cy="50" r="3" fill="#A95532" />

                      {/* Đường sóng đơn hàng màu xanh */}
                      <path
                        d="M0,95 Q20,85 40,88 T70,80 T100,75"
                        fill="none"
                        stroke="#0284C7"
                        strokeWidth="2"
                        strokeDasharray="3 3"
                      />
                    </svg>

                    {/* Trục ngày dưới chân */}
                    <div className="absolute bottom-0 left-12 right-4 flex justify-between text-[11px] text-[#8B7566]">
                      <span>T2</span>
                      <span>T3</span>
                      <span>T4</span>
                      <span>T5</span>
                      <span>T6</span>
                      <span>T7</span>
                      <span>CN</span>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-[#8B7566] italic text-center">
                    {stats.totalOrders > 0
                      ? 'Dữ liệu được cập nhật tự động thời gian thực từ hệ thống đơn hàng.'
                      : 'Hệ thống hiện tại chưa ghi nhận đơn hàng thực tế mới trong tuần này.'}
                  </p>
                </div>

                {/* Cột phải (4 cột): Phân bổ đơn hàng (Donut) & Analytics */}
                <div className="space-y-6 lg:col-span-4">
                  {/* Thẻ Donut tỷ lệ trạng thái đơn */}
                  <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3">
                      <h3 className="text-[14px] font-bold text-[#49352D]">Phân Bổ Đơn Hàng</h3>
                      <span className="text-[11px] text-[#8B7566]">Tỷ lệ xử lý</span>
                    </div>

                    <div className="mt-4 flex items-center justify-center">
                      <div className="relative flex items-center justify-center">
                        <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F5E7D4" strokeWidth="3.5" />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.915"
                            fill="none"
                            stroke="#A95532"
                            strokeWidth="3.5"
                            strokeDasharray="75 25"
                            strokeDashoffset="0"
                            strokeLinecap="round"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.915"
                            fill="none"
                            stroke="#0284C7"
                            strokeWidth="3.5"
                            strokeDasharray="15 85"
                            strokeDashoffset="-75"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute text-center">
                          <span className="text-[18px] font-black text-[#49352D]">
                            {stats.totalOrders}
                          </span>
                          <span className="block text-[10px] text-[#8B7566]">Đơn hàng</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-[#8B7566]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#A95532]" />
                        <span>Đã giao: <b>{orderStatusCounts.delivered || 0}</b></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#8B7566]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7]" />
                        <span>Đang giao: <b>{orderStatusCounts.shipping || 0}</b></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#8B7566]">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                        <span>Chờ duyệt: <b>{orderStatusCounts.pending || 0}</b></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#8B7566]">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                        <span>Đã hủy: <b>{orderStatusCounts.cancelled || 0}</b></span>
                      </div>
                    </div>
                  </div>

                  {/* Thẻ Analytics hiệu suất ngày */}
                  <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
                    <h3 className="text-[14px] font-bold text-[#49352D] border-b border-[#E6D5C2] pb-3">
                      Lưu Lượng Hoạt Động Tuần
                    </h3>
                    <div className="mt-4 flex items-end justify-between h-20 pt-2 px-2">
                      {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, idx) => {
                        const heights = ['h-8', 'h-14', 'h-10', 'h-16', 'h-12', 'h-6', 'h-10']
                        return (
                          <div key={day} className="flex flex-col items-center gap-1.5">
                            <div className={`w-3.5 rounded-t-lg bg-gradient-to-t from-[#E6D5C2] to-[#A95532] ${heights[idx]}`} />
                            <span className="text-[10px] text-[#8B7566]">{day}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* HÀNG 3: ĐƠN HÀNG GẦN ĐÂY / HOẠT ĐỘNG TOÀN SÀN */}
              <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-[#49352D]">Đơn Hàng Gần Đây</h2>
                    <p className="text-[11px] text-[#8B7566] mt-0.5">Danh sách các giao dịch phát sinh mới nhất trên hệ thống</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] px-3 py-1.5 text-[12px] font-medium text-[#A95532] transition hover:border-[#BD6E49] hover:bg-[#F5E7D4]"
                  >
                    Xem tất cả đơn hàng →
                  </button>
                </div>

                <div className="mt-4 overflow-x-auto">
                  {recentOrders.length === 0 ? (
                    <div className="py-10 text-center">
                      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-xl text-[#A95532]">
                        📦
                      </span>
                      <p className="mt-2 text-[13px] font-medium text-[#49352D]">Chưa có đơn hàng nào</p>
                      <p className="text-[11px] text-[#8B7566] mt-0.5">
                        Khi có người mua đặt hàng, các giao dịch sẽ tự động hiển thị tại đây.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-[#E6D5C2] text-[11px] font-semibold text-[#8B7566] uppercase">
                          <th className="pb-3">Mã đơn</th>
                          <th className="pb-3">Khách hàng</th>
                          <th className="pb-3">Gian hàng</th>
                          <th className="pb-3">Trạng thái</th>
                          <th className="pb-3 text-right">Tổng tiền</th>
                          <th className="pb-3 text-right">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E6D5C2]/60">
                        {recentOrders.map((order) => (
                          <tr key={order.shopOrderId || order.orderId} className="hover:bg-[#FBF3E8]/50 transition">
                            <td className="py-3 font-semibold text-[#49352D]">#{order.code}</td>
                            <td className="py-3 text-[#8B7566]">{order.recipientName}</td>
                            <td className="py-3 font-medium text-[#A95532]">{order.shopName}</td>
                            <td className="py-3">
                              <span
                                className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                  STATUS_BADGE_STYLES[order.status] || 'bg-gray-50 text-gray-700'
                                }`}
                              >
                                {LABELS[order.status] || order.status}
                              </span>
                            </td>
                            <td className="py-3 text-right font-bold text-[#49352D]">{formatVnd(order.total)}</td>
                            <td className="py-3 text-right text-[11px] text-[#8B7566]">
                              {formatDateTime(order.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* ============================================================ */}
          {/* TAB 2: QUẢN LÝ SHOP                                          */}
          {/* ============================================================ */}
          {activeTab === 'shops' ? (
            <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D5C2] pb-3">
                <div>
                  <h2 className="text-[16px] font-bold text-[#49352D]">Danh Sách Gian Hàng Toàn Sàn</h2>
                  <p className="text-[12px] text-[#8B7566]">
                    Quản lý hoạt động, khóa gian hàng vi phạm chính sách hoặc mở khóa khôi phục
                  </p>
                </div>
                <span className="text-[12px] text-[#8B7566]">
                  Hiển thị: <b>{filteredItems.length}</b> / {resourceItems.length} gian hàng
                </span>
              </div>

              {/* 4 TABS BỘ LỌC TRẠNG THÁI GIAN HÀNG */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[#E6D5C2] pb-3">
                {[
                  { id: 'all', label: 'Tất cả', count: shopTabCounts.all },
                  { id: 'active', label: 'Đang hoạt động', count: shopTabCounts.active, badge: 'bg-emerald-600 text-[#FFFCF7]' },
                  { id: 'suspended', label: 'Đang tạm khóa', count: shopTabCounts.suspended, badge: 'bg-rose-500 text-[#FFFCF7]' },
                  { id: 'closed', label: 'Đã đóng', count: shopTabCounts.closed },
                ].map((tab) => {
                  const active = shopFilterTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setShopFilterTab(tab.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition ${
                        active
                          ? 'bg-[#BD6E49] text-[#FFFCF7] shadow-2xs font-semibold'
                          : 'bg-[#FBF3E8] text-[#8B7566] hover:bg-[#F5E7D4] hover:text-[#A95532] border border-[#E6D5C2]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          active
                            ? 'bg-[#FFFCF7]/20 text-[#FFFCF7]'
                            : tab.badge || 'bg-[#E6D5C2] text-[#49352D]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {resourceLoading ? (
                <p className="py-8 text-center text-[13px] text-[#8B7566]">Đang tải danh sách gian hàng...</p>
              ) : resourceError ? (
                <p className="rounded-xl bg-rose-50 p-4 text-[13px] text-rose-700">{resourceError}</p>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-xl text-[#A95532]">
                    🏪
                  </span>
                  <p className="mt-2 text-[14px] font-semibold text-[#49352D]">Không có gian hàng nào trong mục này</p>
                  <p className="text-[12px] text-[#8B7566] mt-0.5">Thử chọn tab lọc khác hoặc tìm kiếm với từ khóa khác.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#E6D5C2] text-[11px] font-semibold text-[#8B7566] uppercase">
                        <th className="pb-3">Mã #ID</th>
                        <th className="pb-3">Tên gian hàng</th>
                        <th className="pb-3">Chủ sở hữu & Email</th>
                        <th className="pb-3">Khu vực</th>
                        <th className="pb-3">Sản phẩm & Vi phạm</th>
                        <th className="pb-3">Trạng thái & Ghi chú</th>
                        <th className="pb-3 text-right">Khóa / Mở Khóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6D5C2]/60">
                      {filteredItems.map((shop) => (
                        <tr key={shop.id} className="hover:bg-[#FBF3E8]/50 transition">
                          <td className="py-3 text-[12px] text-[#8B7566]">#{shop.id}</td>
                          <td className="py-3">
                            <span className="font-bold text-[#49352D] block">{shop.name}</span>
                            <span className="text-[11px] text-[#8B7566]">{shop.slug}</span>
                            {shop.tagline ? (
                              <span className="text-[11px] text-[#8B7566] line-clamp-1 italic">{shop.tagline}</span>
                            ) : null}
                          </td>
                          <td className="py-3">
                            <span className="text-[#49352D] font-medium block">{shop.ownerName}</span>
                            <span className="text-[11px] text-[#8B7566] block">@{shop.ownerUsername}</span>
                            {shop.ownerEmail ? (
                              <span className="text-[11px] text-[#8B7566] block mt-0.5 font-mono" title={shop.ownerEmail}>
                                ✉ {shop.ownerEmail}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-700 font-bold block bg-amber-50 rounded px-1.5 py-0.5 mt-0.5 w-fit border border-amber-200">
                                ⚠ Chưa có email liên hệ
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-[#8B7566]">{shop.location || 'Chưa cập nhật'}</td>
                          <td className="py-3">
                            <span className="font-semibold text-[#A95532]">{shop.productCount || 0}</span>
                            <span className="text-[11px] text-[#8B7566] block">
                              / {shop.totalProductCount ?? shop.productCount ?? 0} tổng SKU
                            </span>
                            {shop.violationCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleOpenShopViolations(shop)}
                                className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 transition cursor-pointer"
                              >
                                <span>⚠️</span>
                                <span>{shop.violationCount} vi phạm (Xem lịch sử)</span>
                              </button>
                            ) : (
                              <span className="mt-1 inline-block text-[10px] text-[#547653] font-medium">
                                ✓ 0 vi phạm
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                                STATUS_BADGE_STYLES[shop.status] || 'bg-gray-50 text-gray-700'
                              }`}
                            >
                              {LABELS[shop.status] || shop.status}
                            </span>
                            {shop.status === 'suspended' ? (
                              <div className="mt-1.5 max-w-[260px] rounded-lg border border-rose-200 bg-rose-50/80 p-2 text-[11px] text-rose-800">
                                <p className="font-bold text-rose-900">Lý do khóa:</p>
                                <p className="mt-0.5 line-clamp-2">{shop.suspensionReason || 'Vi phạm chính sách sàn'}</p>
                                {shop.suspendedAt ? (
                                  <span className="mt-1 block text-[10px] text-rose-600">
                                    {formatDateTime(shop.suspendedAt)}
                                    {shop.suspendedByUsername ? ` · @${shop.suspendedByUsername}` : ''}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 text-right">
                            {shop.status === 'active' ? (
                              <button
                                type="button"
                                disabled={savingId === `lock:${shop.id}`}
                                onClick={() => {
                                  setLockShopTarget(shop)
                                  setLockShopReason('')
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50"
                              >
                                <span>🔒</span>
                                <span>Khóa shop</span>
                              </button>
                            ) : shop.status === 'suspended' ? (
                              <button
                                type="button"
                                disabled={savingId === `unlock:${shop.id}`}
                                onClick={() => setUnlockShopTarget(shop)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50"
                              >
                                <span>🔓</span>
                                <span>Mở khóa</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={savingId === `unlock:${shop.id}`}
                                onClick={() => setUnlockShopTarget(shop)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] hover:bg-[#F5E7D4] text-[#8B7566] px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-50"
                              >
                                <span>Mở lại</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {/* ============================================================ */}
          {/* TAB 3: QUẢN LÝ NGƯỜI DÙNG                                    */}
          {/* ============================================================ */}
          {activeTab === 'users' ? (
            <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D5C2] pb-3">
                <div>
                  <h2 className="text-[16px] font-bold text-[#49352D]">Danh Sách Tài Khoản Người Dùng</h2>
                  <p className="text-[12px] text-[#8B7566]">Quản lý phân quyền và trạng thái hoạt động của tài khoản</p>
                </div>
                <span className="text-[12px] text-[#8B7566]">
                  Tổng cộng: <b>{filteredItems.length}</b> tài khoản
                </span>
              </div>

              {resourceLoading ? (
                <p className="py-8 text-center text-[13px] text-[#8B7566]">Đang tải danh sách tài khoản...</p>
              ) : resourceError ? (
                <p className="rounded-xl bg-rose-50 p-4 text-[13px] text-rose-700">{resourceError}</p>
              ) : filteredItems.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-[#8B7566]">Không tìm thấy tài khoản nào.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#E6D5C2] text-[11px] font-semibold text-[#8B7566] uppercase">
                        <th className="pb-3">Mã #ID</th>
                        <th className="pb-3">Họ và tên</th>
                        <th className="pb-3">Tên đăng nhập</th>
                        <th className="pb-3">Email & SĐT</th>
                        <th className="pb-3">Vai trò</th>
                        <th className="pb-3">Trạng thái</th>
                        <th className="pb-3 text-right">Khóa / Mở</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6D5C2]/60">
                      {filteredItems.map((u) => (
                        <tr key={u.id} className="hover:bg-[#FBF3E8]/50 transition">
                          <td className="py-3 text-[12px] text-[#8B7566]">#{u.id}</td>
                          <td className="py-3 font-bold text-[#49352D]">{u.fullName || '—'}</td>
                          <td className="py-3 text-[#8B7566]">@{u.username}</td>
                          <td className="py-3 text-[12px]">
                            <span className="text-[#49352D] block">{u.email || '—'}</span>
                            <span className="text-[#8B7566]">{u.phone || ''}</span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                u.role === 'admin'
                                  ? 'bg-[#F5E7D4] text-[#A95532]'
                                  : u.role === 'seller'
                                    ? 'bg-[#E0F2FE] text-[#0284C7]'
                                    : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {u.role === 'admin' ? 'Quản trị viên' : u.role === 'seller' ? 'Người bán' : 'Khách mua'}
                            </span>
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                STATUS_BADGE_STYLES[u.status] || 'bg-gray-50 text-gray-700'
                              }`}
                            >
                              {LABELS[u.status] || u.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {u.role === 'admin' ? (
                              <span className="text-[11px] text-[#8B7566] italic">Tài khoản Admin</span>
                            ) : (
                              <select
                                value={u.status}
                                disabled={savingId === u.id}
                                onChange={(e) => handleUpdateStatus(u, e.target.value)}
                                className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-2.5 py-1 text-[12px] text-[#49352D] outline-none transition focus:border-[#BD6E49]"
                              >
                                {STATUS_OPTIONS.users.map((st) => (
                                  <option key={st} value={st}>
                                    {LABELS[st] || st}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {/* ============================================================ */}
          {/* TAB 4: QUẢN LÝ SẢN PHẨM                                      */}
          {/* ============================================================ */}
          {/* TAB 4: QUẢN LÝ SẢN PHẨM & QUY TRÌNH DUYỆT CỦA ADMIN          */}
          {/* ============================================================ */}
          {activeTab === 'products' ? (
            <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D5C2] pb-3">
                <div>
                  <h2 className="text-[16px] font-bold text-[#49352D]">Danh Sách Sản Phẩm & Quy Trình Duyệt</h2>
                  <p className="text-[12px] text-[#8B7566]">Kiểm duyệt chất lượng sản phẩm Người Bán, phân biệt trạng thái duyệt và trạng thái hiển thị</p>
                </div>
                <span className="text-[12px] text-[#8B7566]">
                  Hiển thị: <b>{displayedProducts.length}</b> / {resourceItems.length} sản phẩm
                </span>
              </div>

              {/* 5 TABS BỘ LỌC THEO YÊU CẦU */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[#E6D5C2] pb-3">
                {[
                  { id: 'all', label: 'Tất cả', count: productTabCounts.all },
                  { id: 'pending', label: 'Chờ duyệt', count: productTabCounts.pending, badge: 'bg-amber-500 text-[#FFFCF7]' },
                  { id: 'approved', label: 'Đã duyệt', count: productTabCounts.approved, badge: 'bg-emerald-600 text-[#FFFCF7]' },
                  { id: 'rejected', label: 'Từ chối', count: productTabCounts.rejected, badge: 'bg-rose-500 text-[#FFFCF7]' },
                  { id: 'draft_hidden', label: 'Bản nháp / Đã ẩn', count: productTabCounts.draft_hidden },
                ].map((tab) => {
                  const active = productFilterTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setProductFilterTab(tab.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition ${
                        active
                          ? 'bg-[#BD6E49] text-[#FFFCF7] shadow-2xs font-semibold'
                          : 'bg-[#FBF3E8] text-[#8B7566] hover:bg-[#F5E7D4] hover:text-[#A95532] border border-[#E6D5C2]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          active
                            ? 'bg-[#FFFCF7]/20 text-[#FFFCF7]'
                            : tab.badge || 'bg-[#E6D5C2] text-[#49352D]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {resourceLoading ? (
                <p className="py-8 text-center text-[13px] text-[#8B7566]">Đang tải danh sách sản phẩm...</p>
              ) : resourceError ? (
                <p className="rounded-xl bg-rose-50 p-4 text-[13px] text-rose-700">{resourceError}</p>
              ) : displayedProducts.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-xl text-[#A95532]">
                    📦
                  </span>
                  <p className="mt-2 text-[14px] font-semibold text-[#49352D]">Không có sản phẩm nào trong mục này</p>
                  <p className="text-[12px] text-[#8B7566] mt-0.5">Thử chọn tab lọc khác hoặc làm mới dữ liệu.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#E6D5C2] text-[11px] font-semibold text-[#8B7566] uppercase">
                        <th className="pb-3">Mã #ID</th>
                        <th className="pb-3">Sản phẩm</th>
                        <th className="pb-3">Gian hàng</th>
                        <th className="pb-3 text-right">Giá bán</th>
                        <th className="pb-3 text-center">Tồn kho</th>
                        <th className="pb-3 text-center">Flash Sale</th>
                        <th className="pb-3">Kiểm duyệt</th>
                        <th className="pb-3">Hiển thị</th>
                        <th className="pb-3 text-right">Hành động Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6D5C2]/60">
                      {displayedProducts.map((prod) => {
                        const appStatus = prod.approvalStatus || 'pending'
                        const isAppSaving = savingId === `approve:${prod.id}` || savingId === `reject:${prod.id}`
                        return (
                          <tr key={prod.id} className="hover:bg-[#FBF3E8]/50 transition">
                            <td className="py-3 text-[12px] text-[#8B7566]">#{prod.id}</td>
                            <td className="py-3 max-w-[240px]">
                              <div className="flex items-center gap-2.5">
                                {prod.images?.[0]?.url ? (
                                  <img
                                    src={prod.images[0].url.startsWith('/') ? `http://localhost:3000${prod.images[0].url}` : prod.images[0].url}
                                    alt=""
                                    className="h-10 w-10 shrink-0 rounded-lg border border-[#E6D5C2] object-cover"
                                  />
                                ) : (
                                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F5E7D4] text-xs text-[#A95532]">
                                    Ảnh
                                  </span>
                                )}
                                <div className="truncate">
                                  <span className="font-bold text-[#49352D] block truncate" title={prod.name}>
                                    {prod.name}
                                  </span>
                                  <span className="text-[11px] text-[#8B7566] block">
                                    {prod.categoryName || 'Sản phẩm'} · Bộ {prod.imageCount || prod.images?.length || 0} ảnh
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3">
                              <span className="text-[#49352D] font-medium block">{prod.shopName}</span>
                              <span className="text-[11px] text-[#8B7566]">{LABELS[prod.shopStatus] || prod.shopStatus}</span>
                            </td>
                            <td className="py-3 text-right font-bold text-[#A95532]">
                              {formatVnd(prod.price || 0)}
                            </td>
                            <td className="py-3 text-center font-medium text-[#49352D]">
                              {formatNumber(prod.stock || 0)}
                            </td>
                            <td className="py-3 text-center">
                              <label className="inline-flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(prod.flash)}
                                  disabled={savingId === `flash:${prod.id}` || prod.status !== 'active' || appStatus !== 'approved'}
                                  onChange={(e) => handleToggleFlashSale(prod, e.target.checked)}
                                  className="accent-[#A95532] h-4 w-4 rounded-sm"
                                />
                                <span className="text-[11px] text-[#8B7566]">{prod.flash ? 'Bật' : 'Tắt'}</span>
                              </label>
                            </td>

                            {/* CỘT 1: TRẠNG THÁI KIỂM DUYỆT */}
                            <td className="py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                  APPROVAL_BADGE_STYLES[appStatus] || 'bg-gray-50 text-gray-700'
                                }`}
                              >
                                {appStatus === 'pending' ? '⏳ ' : appStatus === 'approved' ? '✓ ' : '✕ '}
                                {APPROVAL_LABELS[appStatus] || appStatus}
                              </span>
                              {appStatus === 'rejected' && prod.rejectionReason ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReject(prod)}
                                  className="mt-1 block text-[10px] text-rose-600 underline hover:text-rose-800"
                                  title="Xem lý do từ chối"
                                >
                                  Lý do: {prod.rejectionReason.slice(0, 20)}...
                                </button>
                              ) : null}
                            </td>

                            {/* CỘT 2: TRẠNG THÁI HIỂN THỊ */}
                            <td className="py-3">
                              <span
                                className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                  STATUS_BADGE_STYLES[prod.status] || 'bg-gray-50 text-gray-700'
                                }`}
                              >
                                {LABELS[prod.status] || prod.status}
                              </span>
                            </td>

                            {/* CỘT 3: HÀNH ĐỘNG DUYỆT & THAO TÁC */}
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Nút xem chi tiết (4 ảnh, mô tả, shop) */}
                                <button
                                  type="button"
                                  onClick={() => setPreviewProduct(prod)}
                                  className="rounded-lg border border-[#E6D5C2] bg-[#FFFCF7] px-2.5 py-1 text-[12px] font-medium text-[#49352D] transition hover:border-[#BD6E49] hover:bg-[#F5E7D4] hover:text-[#A95532]"
                                  title="Xem đầy đủ chi tiết sản phẩm và bộ 4 ảnh"
                                >
                                  Chi tiết
                                </button>

                                {/* Nút Duyệt: hiển thị nếu chờ duyệt hoặc từ chối */}
                                {appStatus !== 'approved' ? (
                                  <button
                                    type="button"
                                    disabled={isAppSaving}
                                    onClick={() => handleApproveProduct(prod)}
                                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[#FFFCF7] px-2.5 py-1 text-[12px] font-semibold transition disabled:opacity-50"
                                  >
                                    {isAppSaving ? '...' : 'Duyệt'}
                                  </button>
                                ) : null}

                                {/* Nút Từ chối: hiển thị nếu chờ duyệt hoặc đã duyệt */}
                                {appStatus !== 'rejected' ? (
                                  <button
                                    type="button"
                                    disabled={isAppSaving}
                                    onClick={() => handleOpenReject(prod)}
                                    className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 px-2.5 py-1 text-[12px] font-medium transition disabled:opacity-50"
                                  >
                                    Từ chối
                                  </button>
                                ) : null}

                                {/* Dropdown đổi trạng thái hiển thị (draft, active, hidden, archived) */}
                                <select
                                  value={prod.status}
                                  disabled={savingId === prod.id || appStatus !== 'approved'}
                                  onChange={(e) => handleUpdateStatus(prod, e.target.value)}
                                  title={appStatus !== 'approved' ? 'Chỉ có thể thay đổi trạng thái hiển thị sau khi sản phẩm đã được Admin duyệt' : 'Thay đổi trạng thái hiển thị'}
                                  className="rounded-lg border border-[#E6D5C2] bg-[#FFFCF7] px-2 py-1 text-[11px] text-[#49352D] outline-none transition focus:border-[#BD6E49] disabled:opacity-50 disabled:bg-gray-100"
                                >
                                  {STATUS_OPTIONS.products.map((st) => (
                                    <option key={st} value={st}>
                                      {LABELS[st] || st}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {/* ============================================================ */}
          {/* TAB 5: QUẢN LÝ ĐƠN HÀNG                                      */}
          {/* ============================================================ */}
          {activeTab === 'orders' ? (
            <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D5C2] pb-3">
                <div>
                  <h2 className="text-[16px] font-bold text-[#49352D]">Danh Sách Đơn Hàng Toàn Sàn</h2>
                  <p className="text-[12px] text-[#8B7566]">Giám sát các đơn hàng và trạng thái giao hàng trên mọi gian hàng</p>
                </div>
                <span className="text-[12px] text-[#8B7566]">
                  Tổng cộng: <b>{filteredItems.length}</b> đơn hàng
                </span>
              </div>

              {resourceLoading ? (
                <p className="py-8 text-center text-[13px] text-[#8B7566]">Đang tải danh sách đơn hàng...</p>
              ) : resourceError ? (
                <p className="rounded-xl bg-rose-50 p-4 text-[13px] text-rose-700">{resourceError}</p>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-xl text-[#A95532]">
                    📦
                  </span>
                  <p className="mt-2 text-[14px] font-semibold text-[#49352D]">Chưa có đơn hàng nào</p>
                  <p className="text-[12px] text-[#8B7566] mt-0.5">
                    Hệ thống chưa ghi nhận đơn hàng phát sinh từ người mua.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#E6D5C2] text-[11px] font-semibold text-[#8B7566] uppercase">
                        <th className="pb-3">Mã đơn</th>
                        <th className="pb-3">Người nhận</th>
                        <th className="pb-3">Điện thoại</th>
                        <th className="pb-3">Gian hàng</th>
                        <th className="pb-3">Thanh toán</th>
                        <th className="pb-3">Trạng thái</th>
                        <th className="pb-3 text-right">Tổng thanh toán</th>
                        <th className="pb-3 text-right">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6D5C2]/60">
                      {filteredItems.map((o) => (
                        <tr key={o.shopOrderId || o.orderId} className="hover:bg-[#FBF3E8]/50 transition">
                          <td className="py-3 font-bold text-[#49352D]">#{o.code}</td>
                          <td className="py-3 text-[#49352D]">{o.recipientName}</td>
                          <td className="py-3 text-[#8B7566] text-[12px]">{o.recipientPhone || '—'}</td>
                          <td className="py-3 font-medium text-[#A95532]">{o.shopName}</td>
                          <td className="py-3 text-[12px] uppercase text-[#8B7566]">{o.payment || 'COD'}</td>
                          <td className="py-3">
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                STATUS_BADGE_STYLES[o.status] || 'bg-gray-50 text-gray-700'
                              }`}
                            >
                              {LABELS[o.status] || o.status}
                            </span>
                          </td>
                          <td className="py-3 text-right font-bold text-[#49352D]">{formatVnd(o.total)}</td>
                          <td className="py-3 text-right text-[11px] text-[#8B7566]">
                            {formatDateTime(o.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {/* ============================================================ */}
          {/* TAB 6: DOANH THU                                             */}
          {/* ============================================================ */}
          {activeTab === 'revenue' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
                  <span className="text-[12px] text-[#8B7566]">Tổng Doanh Thu Đã Nhận</span>
                  <p className="mt-1 text-[24px] font-extrabold text-[#A95532]">{formatVnd(stats.totalRevenue)}</p>
                  <p className="mt-1 text-[11px] text-[#8B7566]">Từ các đơn hàng có trạng thái Đã Giao</p>
                </div>

                <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
                  <span className="text-[12px] text-[#8B7566]">Tổng Đơn Hàng Thành Công</span>
                  <p className="mt-1 text-[24px] font-extrabold text-[#0284C7]">{orderStatusCounts.delivered || 0}</p>
                  <p className="mt-1 text-[11px] text-[#8B7566]">Đơn hoàn tất quy trình giao vận</p>
                </div>

                <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
                  <span className="text-[12px] text-[#8B7566]">Giá Trị Trung Bình / Đơn</span>
                  <p className="mt-1 text-[24px] font-extrabold text-[#547653]">
                    {orderStatusCounts.delivered > 0
                      ? formatVnd(Math.round(stats.totalRevenue / orderStatusCounts.delivered))
                      : '0₫'}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8B7566]">AOV (Average Order Value)</p>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
                <h3 className="text-[15px] font-bold text-[#49352D] border-b border-[#E6D5C2] pb-3">
                  Báo Cáo Chi Tiết Doanh Thu Theo Gian Hàng
                </h3>
                <div className="py-8 text-center text-[13px] text-[#8B7566]">
                  {stats.totalRevenue > 0 ? (
                    <p>Dữ liệu doanh thu đã được tổng hợp chính xác từ cơ sở dữ liệu MySQL.</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-semibold text-[#49352D]">Chưa có phát sinh doanh thu từ đơn hoàn tất</p>
                      <p className="text-[11px]">Khi các gian hàng giao thành công đơn hàng, phân tích đối soát sẽ hiển thị chi tiết tại đây.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* ============================================================ */}
          {/* TAB 7: BÁO CÁO VI PHẠM                                       */}
          {/* ============================================================ */}
          {activeTab === 'reports' ? (
            <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D5C2] pb-3">
                <div>
                  <h2 className="text-[16px] font-bold text-[#49352D]">Danh Sách Báo Cáo Vi Phạm</h2>
                  <p className="text-[12px] text-[#8B7566]">
                    Tiếp nhận, xác minh khiếu nại hàng giả/vi phạm và xử lý chế tài với gian hàng vi phạm
                  </p>
                </div>
                <span className="text-[12px] text-[#8B7566]">
                  Hiển thị: <b>{filteredItems.length}</b> / {resourceItems.length} báo cáo
                </span>
              </div>

              {/* 5 TABS BỘ LỌC TRẠNG THÁI BÁO CÁO */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[#E6D5C2] pb-3">
                {[
                  { id: 'all', label: 'Tất cả', count: reportTabCounts.all },
                  { id: 'open', label: 'Chờ xử lý', count: reportTabCounts.open, badge: 'bg-amber-500 text-[#FFFCF7]' },
                  { id: 'investigating', label: 'Đang xác minh', count: reportTabCounts.investigating, badge: 'bg-sky-500 text-[#FFFCF7]' },
                  { id: 'confirmed_violation', label: 'Đã xác nhận vi phạm', count: reportTabCounts.confirmed_violation, badge: 'bg-rose-500 text-[#FFFCF7]' },
                  { id: 'dismissed', label: 'Không phát hiện vi phạm', count: reportTabCounts.dismissed },
                ].map((tab) => {
                  const active = reportFilterTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setReportFilterTab(tab.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition ${
                        active
                          ? 'bg-[#BD6E49] text-[#FFFCF7] shadow-2xs font-semibold'
                          : 'bg-[#FBF3E8] text-[#8B7566] hover:bg-[#F5E7D4] hover:text-[#A95532] border border-[#E6D5C2]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          active
                            ? 'bg-[#FFFCF7]/20 text-[#FFFCF7]'
                            : tab.badge || 'bg-[#E6D5C2] text-[#49352D]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {resourceLoading ? (
                <p className="py-8 text-center text-[13px] text-[#8B7566]">Đang tải danh sách báo cáo...</p>
              ) : resourceError ? (
                <p className="rounded-xl bg-rose-50 p-4 text-[13px] text-rose-700">{resourceError}</p>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(84, 118, 83, 0.1)] text-xl text-[#547653]">
                    ✓
                  </span>
                  <p className="mt-2 text-[14px] font-semibold text-[#49352D]">Không có báo cáo nào trong mục này</p>
                  <p className="text-[12px] text-[#8B7566] mt-0.5">Hệ thống ghi nhận trạng thái bình thường.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#E6D5C2] text-[11px] font-semibold text-[#8B7566] uppercase">
                        <th className="pb-3">Mã #ID</th>
                        <th className="pb-3">Sản phẩm / Đối tượng</th>
                        <th className="pb-3">Gian hàng</th>
                        <th className="pb-3">Người báo cáo</th>
                        <th className="pb-3">Lý do & Bằng chứng</th>
                        <th className="pb-3">Thời gian</th>
                        <th className="pb-3">Trạng thái</th>
                        <th className="pb-3 text-right">Chi tiết & Xử lý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6D5C2]/60">
                      {filteredItems.map((rep) => {
                        const resolvedProductImg = resolveImageUrl(rep.productImage)
                        const defaultPlaceholder = productPlaceholder({
                          name: rep.targetName,
                          emoji: rep.targetType === 'product' ? '📦' : rep.targetType === 'shop' ? '🏪' : '💬'
                        })
                        const resolvedEvidenceImg = resolveImageUrl(rep.evidenceUrl)

                        return (
                          <tr key={rep.id} className="hover:bg-[#FBF3E8]/50 transition">
                            <td className="py-3 text-[12px] font-semibold text-[#8B7566]">#{rep.id}</td>
                            <td className="py-3">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={resolvedProductImg || defaultPlaceholder}
                                  alt=""
                                  className="h-10 w-10 rounded-lg object-cover border border-[#E6D5C2] bg-[#FBF3E8] shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null
                                    e.currentTarget.src = defaultPlaceholder
                                  }}
                                />
                                <div className="min-w-0">
                                  <span className="font-bold text-[#49352D] block line-clamp-1 max-w-[200px]" title={rep.targetName}>
                                    {rep.targetName}
                                  </span>
                                  <span className="text-[11px] text-[#8B7566]">
                                    {rep.targetType === 'product' ? 'Sản phẩm' : rep.targetType === 'shop' ? 'Shop' : rep.targetType} #{rep.targetId}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3">
                              {rep.shopName ? (
                                <div>
                                  <span className="font-medium text-[#49352D] block">{rep.shopName}</span>
                                  {rep.shopOwnerEmail ? (
                                    <span className="text-[10px] text-[#8B7566] block font-mono line-clamp-1" title={rep.shopOwnerEmail}>
                                      ✉ {rep.shopOwnerEmail}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-700 block font-semibold">⚠ Chưa có email</span>
                                  )}
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                    {rep.shopStatus ? (
                                      <span
                                        className={`inline-block rounded-full border px-2 py-0.2 text-[10px] font-medium ${
                                          STATUS_BADGE_STYLES[rep.shopStatus] || 'bg-gray-50 text-gray-700'
                                        }`}
                                      >
                                        {LABELS[rep.shopStatus] || rep.shopStatus}
                                      </span>
                                    ) : null}
                                    {rep.shopViolationCount > 0 ? (
                                      <span className="inline-block rounded-full border border-rose-300 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">
                                        {rep.shopViolationCount} vi phạm
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[12px] text-[#8B7566]">—</span>
                              )}
                            </td>
                            <td className="py-3">
                              <span className="text-[#49352D] block font-medium">{rep.reporterFullName || rep.reporterUsername}</span>
                              <span className="text-[11px] text-[#8B7566]">@{rep.reporterUsername}</span>
                            </td>
                            <td className="py-3 max-w-[240px]">
                              <p className="line-clamp-2 text-[12px] text-[#49352D] leading-tight" title={rep.reason}>
                                {rep.reason}
                              </p>
                              {resolvedEvidenceImg ? (
                                <button
                                  type="button"
                                  onClick={() => setEvidenceZoomUrl(resolvedEvidenceImg)}
                                  className="mt-1 inline-flex items-center gap-1 rounded-md border border-[#E6D5C2] bg-[#F5E7D4] px-1.5 py-0.5 text-[10px] font-medium text-[#A95532] hover:bg-[#E6D5C2] transition cursor-pointer"
                                >
                                  <span>📷</span>
                                  <span>Ảnh bằng chứng (Xem lớn)</span>
                                </button>
                              ) : (
                                <span className="mt-1 block text-[10px] text-[#8B7566] italic">Không có ảnh bằng chứng</span>
                              )}
                            </td>
                            <td className="py-3 text-[11px] text-[#8B7566]">
                              {formatDateTime(rep.createdAt)}
                            </td>
                            <td className="py-3">
                              <span
                                className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                                  STATUS_BADGE_STYLES[rep.status] || 'bg-gray-50 text-gray-700'
                                }`}
                              >
                                {LABELS[rep.status] || rep.status}
                              </span>
                              {rep.violationNumber ? (
                                <span className="mt-1 block text-[10px] font-bold text-rose-700">
                                  Vi phạm lần {rep.violationNumber} ({rep.violationAction === 'shop_suspended' ? 'Tạm khóa' : 'Cảnh cáo'})
                                </span>
                              ) : null}
                              {rep.violationEmailStatus ? (
                                <span className="text-[10px] block mt-0.5">
                                  {rep.violationEmailStatus === 'sent' ? (
                                    <span className="text-emerald-700 font-semibold">✓ Đã gửi email</span>
                                  ) : rep.violationEmailStatus === 'failed' ? (
                                    <span className="text-rose-700 font-semibold">⚠ Gửi email thất bại</span>
                                  ) : rep.violationEmailStatus === 'sending' ? (
                                    <span className="text-sky-700 font-semibold">✉ Đang gửi email...</span>
                                  ) : (
                                    <span className="text-amber-700 font-semibold">✉ Chưa cấu hình email</span>
                                  )}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedReport(rep)}
                                className="inline-flex items-center gap-1 rounded-xl bg-[#F5E7D4] hover:bg-[#E6D5C2] border border-[#E6D5C2] px-3 py-1.5 text-[12px] font-semibold text-[#A95532] transition"
                              >
                                <span>🔍</span>
                                <span>Xem & Xử lý</span>
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {/* ============================================================ */}
          {/* TAB 8: CÀI ĐẶT & THÔNG TIN HỆ THỐNG                          */}
          {/* ============================================================ */}
          {activeTab === 'settings' ? (
            <div className="space-y-6">
              {/* Thẻ Trạng thái hệ thống */}
              <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
                <h3 className="text-[15px] font-bold text-[#49352D] border-b border-[#E6D5C2] pb-3">
                  Trạng Thái Dịch Vụ Hạ Tầng
                </h3>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 text-[13px]">
                  <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3.5">
                    <span className="text-[11px] text-[#8B7566] block">Cơ Sở Dữ Liệu</span>
                    <span className="font-bold text-emerald-600 mt-1 block">MySQL (shopnova_dev)</span>
                    <span className="text-[10px] text-[#8B7566] mt-0.5 block">Cổng 3306 · Đã kết nối</span>
                  </div>

                  <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3.5">
                    <span className="text-[11px] text-[#8B7566] block">Data API Nội Bộ</span>
                    <span className="font-bold text-emerald-600 mt-1 block">Express HTTP Service</span>
                    <span className="text-[10px] text-[#8B7566] mt-0.5 block">Cổng 3001 · Bảo mật Service Key</span>
                  </div>

                  <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3.5">
                    <span className="text-[11px] text-[#8B7566] block">Backend Gateway</span>
                    <span className="font-bold text-emerald-600 mt-1 block">Express REST Gateway</span>
                    <span className="text-[10px] text-[#8B7566] mt-0.5 block">Cổng 3000 · JWT HS256 Token</span>
                  </div>

                  <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3.5">
                    <span className="text-[11px] text-[#8B7566] block">Firebase Authentication</span>
                    <span className="font-bold text-[#A95532] mt-1 block">Google OAuth Popup</span>
                    <span className="text-[10px] text-[#8B7566] mt-0.5 block">Dự án: nova-shop-35e86</span>
                  </div>

                  <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3.5">
                    <span className="text-[11px] text-[#8B7566] block">Dịch Vụ Email SMTP</span>
                    <span className={`font-bold mt-1 block ${systemEmailConfig?.isConfigured ? 'text-emerald-600' : 'text-amber-700'}`}>
                      {systemEmailConfig?.isConfigured ? `${systemEmailConfig.host}` : 'Chưa cấu hình SMTP'}
                    </span>
                    <span className="text-[10px] text-[#8B7566] mt-0.5 block">
                      {systemEmailConfig?.isConfigured ? `Người gửi: ${systemEmailConfig.from}` : 'backend/.env chưa cấu hình'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Thẻ Cấu hình dịch vụ Email SMTP */}
              <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-[#E6D5C2] pb-3">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                    ✉️
                  </span>
                  <h3 className="text-[15px] font-bold text-[#49352D]">
                    Cấu Hình Dịch Vụ Gửi Email Thật (SMTP Nodemailer)
                  </h3>
                </div>

                <div className="mt-4 space-y-3 text-[13px] leading-relaxed text-[#8B7566]">
                  <p>
                    Hệ thống gửi cảnh báo vi phạm và thông báo tạm khóa gian hàng trực tiếp tới email chủ shop qua giao thức SMTP (Gmail, Brevo, SendGrid, Amazon SES,...).
                  </p>

                  <div className="rounded-xl bg-[#FBF3E8] p-4 border border-[#E6D5C2] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#49352D]">Trạng thái cấu hình hiện tại:</span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        systemEmailConfig?.isConfigured
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {systemEmailConfig?.isConfigured ? '✓ ĐÃ CẤU HÌNH SẴN SÀNG' : 'CHƯA CẤU HÌNH (backend/.env)'}
                      </span>
                    </div>

                    <p className="text-[12px] text-[#49352D] pt-1">
                      Để kích hoạt gửi email thật, khai báo các biến sau trong file <code className="text-[#A95532] font-mono font-bold">backend/.env</code>:
                    </p>
                    <pre className="rounded-lg bg-[#49352D] p-3 text-xs font-mono text-[#F5E7D4] overflow-x-auto select-all leading-relaxed">
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM="NOVA SHOP - Ban Quản Trị" <your_email@gmail.com>`}
                    </pre>
                    <p className="text-[11px] text-[#8B7566]">
                      * Đối với Gmail: <code>SMTP_PASS</code> là <b>Mật khẩu ứng dụng 16 ký tự (Google App Password)</b>, không phải mật khẩu đăng nhập tài khoản Google.
                    </p>
                  </div>
                </div>
              </div>

              {/* Hướng dẫn an toàn cấp quyền Admin */}
              <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-[#E6D5C2] pb-3">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                    🛡️
                  </span>
                  <h3 className="text-[15px] font-bold text-[#49352D]">
                    Hướng Dẫn Cấp Quyền Quản Trị Viên (Admin) An Toàn
                  </h3>
                </div>

                <div className="mt-4 space-y-3 text-[13px] leading-relaxed text-[#8B7566]">
                  <p>
                    Để bảo đảm an toàn tuyệt đối cho website, NOVA SHOP <b>không cho phép người dùng tự cấp quyền Admin qua giao diện người dùng</b>. Quyền Admin được thẩm định chặt chẽ ở tầng Backend dựa trên bản ghi thực tế trong cơ sở dữ liệu.
                  </p>

                  <div className="rounded-xl bg-[#FBF3E8] p-4 border border-[#E6D5C2]">
                    <p className="font-bold text-[#49352D] mb-2">Cách cấp quyền Admin cho tài khoản của bạn:</p>
                    <p className="mb-2">Mở cửa sổ dòng lệnh Terminal tại máy chủ và thực thi lệnh sau:</p>
                    <code className="block rounded-lg bg-[#49352D] px-3.5 py-2 text-xs font-mono text-[#BD6E49] select-all">
                      node data-api/scripts/grant-admin.mjs &lt;tên_đăng_nhập_hoặc_email&gt;
                    </code>
                    <p className="mt-2 text-[11px] text-[#8B7566]">
                      Ví dụ: <code className="text-[#49352D]">node data-api/scripts/grant-admin.mjs voducbinh</code>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        {/* ============================================================ */}
        {/* MODAL 1: XEM CHI TIẾT SẢN PHẨM & BỘ 4 ẢNH CỦA ADMIN          */}
        {/* ============================================================ */}
        {previewProduct ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xl flex flex-col">
              {/* Header Modal */}
              <div className="flex items-center justify-between border-b border-[#E6D5C2] px-6 py-4 bg-[#FBF3E8]">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#F5E7D4] text-sm text-[#A95532]">
                    📦
                  </span>
                  <div>
                    <h3 className="text-[16px] font-bold text-[#49352D]">Chi Tiết Sản Phẩm & Kiểm Duyệt</h3>
                    <p className="text-[11px] text-[#8B7566]">Mã ID #{previewProduct.id} · Gian hàng: {previewProduct.shopName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewProduct(null)}
                  className="grid h-8 w-8 place-items-center rounded-full text-[#8B7566] transition hover:bg-[#F5E7D4] hover:text-[#A95532]"
                >
                  ✕
                </button>
              </div>

              {/* Body Modal (Scrollable) */}
              <div className="overflow-y-auto p-6 space-y-5">
                {/* 1. Trạng thái kiểm duyệt banner */}
                {previewProduct.approvalStatus === 'rejected' ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-center gap-2 text-rose-700 font-bold text-[13px]">
                      <span>✕ Sản phẩm đang bị từ chối</span>
                    </div>
                    <p className="mt-1 text-[13px] text-rose-800">
                      <b>Lý do từ chối:</b> {previewProduct.rejectionReason || 'Không có lý do chi tiết.'}
                    </p>
                    {previewProduct.reviewedAt ? (
                      <p className="mt-1 text-[11px] text-rose-600">Thời điểm: {formatDateTime(previewProduct.reviewedAt)}</p>
                    ) : null}
                  </div>
                ) : previewProduct.approvalStatus === 'approved' ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-[13px]">
                      <span>✓ Sản phẩm đã được phê duyệt</span>
                    </div>
                    <p className="mt-1 text-[12px] text-emerald-800">
                      Sản phẩm được phép xuất hiện công khai trên sàn khi trạng thái hiển thị là "Đang hoạt động".
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-amber-700 font-bold text-[13px]">
                      <span>⏳ Sản phẩm đang chờ Admin kiểm duyệt</span>
                    </div>
                    <p className="mt-1 text-[12px] text-amber-800">
                      Sản phẩm chưa được hiển thị công khai. Vui lòng kiểm tra kỹ nội dung và bộ 4 ảnh trước khi duyệt.
                    </p>
                  </div>
                )}

                {/* 2. Bộ tối đa 4 ảnh thực tế */}
                <div>
                  <h4 className="text-[13px] font-bold text-[#49352D] mb-2.5">
                    Bộ {previewProduct.images?.length || previewProduct.imageCount || 0} ảnh thực tế của sản phẩm:
                  </h4>
                  {previewProduct.images && previewProduct.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {previewProduct.images.slice(0, 4).map((img, idx) => {
                        const fullUrl = img.url?.startsWith('/') ? `http://localhost:3000${img.url}` : img.url
                        return (
                          <div key={idx} className="group relative overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FBF3E8]">
                            <img
                              src={fullUrl}
                              alt={img.altText || `Ảnh ${idx + 1}`}
                              className="aspect-square w-full object-cover transition group-hover:scale-105"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-center">
                              <span className="text-[10px] font-semibold text-[#FFFCF7]">
                                {idx === 0 ? '1. Ảnh chính (Mặt trước)' : idx === 1 ? '2. Mặt bên / sau' : idx === 2 ? '3. Chi tiết cận cảnh' : '4. Bối cảnh thực tế'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#8B7566] italic">Sản phẩm chưa có bộ ảnh.</p>
                  )}
                </div>

                {/* 3. Bảng thông tin giá, danh mục, tồn kho */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3">
                    <span className="text-[11px] text-[#8B7566] block">Giá bán chính thức</span>
                    <span className="text-[16px] font-extrabold text-[#A95532]">{formatVnd(previewProduct.price || 0)}</span>
                  </div>
                  <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3">
                    <span className="text-[11px] text-[#8B7566] block">Giá niêm yết (gốc)</span>
                    <span className="text-[15px] font-medium text-[#8B7566] line-through">
                      {previewProduct.originalPrice ? formatVnd(previewProduct.originalPrice) : 'Không có'}
                    </span>
                  </div>
                  <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3">
                    <span className="text-[11px] text-[#8B7566] block">Tồn kho hiện có</span>
                    <span className="text-[16px] font-bold text-[#49352D]">{formatNumber(previewProduct.stock || 0)}</span>
                  </div>
                  <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3">
                    <span className="text-[11px] text-[#8B7566] block">Ngành hàng</span>
                    <span className="text-[13px] font-semibold text-[#49352D] truncate block">{previewProduct.categoryName || 'Mặc định'}</span>
                  </div>
                </div>

                {/* 4. Mô tả sản phẩm */}
                <div>
                  <h4 className="text-[13px] font-bold text-[#49352D] mb-1.5">Mô tả sản phẩm từ Người Bán:</h4>
                  <div className="rounded-2xl border border-[#E6D5C2] bg-[#FBF3E8]/50 p-4 text-[13px] text-[#49352D] max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {previewProduct.description || 'Chưa có mô tả chi tiết cho sản phẩm này.'}
                  </div>
                </div>
              </div>

              {/* Footer Modal: Nút Duyệt / Từ chối */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6D5C2] px-6 py-4 bg-[#FBF3E8]">
                <button
                  type="button"
                  onClick={() => setPreviewProduct(null)}
                  className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-4 py-2 text-[13px] font-medium text-[#8B7566] hover:bg-gray-50"
                >
                  Đóng
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenReject(previewProduct)}
                    className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 px-4 py-2 text-[13px] font-semibold transition"
                  >
                    ✕ Từ chối duyệt...
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveProduct(previewProduct)}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[#FFFCF7] px-5 py-2 text-[13px] font-semibold transition shadow-2xs"
                  >
                    ✓ Duyệt sản phẩm này
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* MODAL 2: TỪ CHỐI DUYỆT SẢN PHẨM & NHẬP LÝ DO                 */}
        {/* ============================================================ */}
        {rejectTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-sm text-rose-600">
                    ✕
                  </span>
                  <h3 className="text-[16px] font-bold text-[#49352D]">Từ Chối Sản Phẩm</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="grid h-7 w-7 place-items-center rounded-full text-[#8B7566] hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <div>
                <p className="text-[13px] text-[#49352D]">
                  Sản phẩm: <b className="text-[#A95532]">{rejectTarget.name}</b>
                </p>
                <p className="text-[11px] text-[#8B7566]">
                  Gian hàng: {rejectTarget.shopName} · Mã ID #{rejectTarget.id}
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#49352D] mb-1.5">
                  Lý do từ chối kiểm duyệt * (Người bán sẽ đọc lý do này):
                </label>
                <textarea
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ví dụ: Hình ảnh mờ chưa rõ nét, mô tả chưa đủ quy cách chất liệu, hoặc giá bán niêm yết không phù hợp..."
                  className="w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] p-3 text-[13px] text-[#49352D] outline-none transition focus:border-[#BD6E49] focus:ring-2 focus:ring-[#BD6E49]/20"
                />

                {/* Gợi ý lý do nhanh */}
                <div className="mt-2 space-y-1">
                  <span className="text-[11px] text-[#8B7566]">Gợi ý lý do nhanh:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Hình ảnh mờ hoặc sai quy cách 4 góc',
                      'Mô tả sản phẩm sơ sài hoặc chưa rõ nguồn gốc',
                      'Giá bán không đúng quy định sàn',
                      'Tên sản phẩm chứa từ khóa vi phạm',
                    ].map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => setRejectReason(sample)}
                        className="rounded-lg border border-[#E6D5C2] bg-[#FBF3E8] px-2 py-0.5 text-[10px] text-[#8B7566] hover:border-[#BD6E49] hover:text-[#A95532]"
                      >
                        + {sample}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E6D5C2] pt-3">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-4 py-2 text-[12px] font-medium text-[#8B7566] hover:bg-gray-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={savingId === `reject:${rejectTarget.id}`}
                  onClick={handleConfirmReject}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-[#FFFCF7] px-4 py-2 text-[12px] font-bold transition disabled:opacity-50"
                >
                  {savingId === `reject:${rejectTarget.id}` ? 'Đang gửi...' : 'Xác nhận từ chối'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* MODAL 3: KHÓA GIAN HÀNG VI PHẠM                             */}
        {/* ============================================================ */}
        {lockShopTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-100 text-sm text-rose-600">
                    🔒
                  </span>
                  <div>
                    <h3 className="text-[16px] font-bold text-[#49352D]">Khóa Gian Hàng Vi Phạm</h3>
                    <p className="text-[11px] text-[#8B7566]">Mã gian hàng #{lockShopTarget.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLockShopTarget(null)}
                  className="grid h-7 w-7 place-items-center rounded-full text-[#8B7566] hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              {/* Thông tin shop */}
              <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3.5 text-[12px] space-y-1">
                <p className="font-bold text-[#49352D] text-[14px]">{lockShopTarget.name}</p>
                <p className="text-[#8B7566]">
                  Chủ shop: <span className="text-[#49352D] font-medium">{lockShopTarget.ownerName}</span>
                  {lockShopTarget.ownerUsername ? ` (@${lockShopTarget.ownerUsername})` : ''}
                </p>
                <p className="text-[#8B7566]">
                  Khu vực: {lockShopTarget.location || 'Chưa cập nhật'} · Sản phẩm: {lockShopTarget.productCount || 0} đang bán
                </p>
              </div>

              {/* Hộp thông báo chế tài an toàn */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-[12px] leading-relaxed text-rose-800 space-y-1.5">
                <p className="font-bold text-rose-900 flex items-center gap-1.5">
                  <span>⚠️</span> Chế tài áp dụng khi khóa gian hàng:
                </p>
                <ul className="list-disc list-inside space-y-1 text-rose-700 text-[11px]">
                  <li>Toàn bộ sản phẩm của gian hàng sẽ tạm thời bị ẩn khỏi sàn thương mại, khách hàng không thể tìm kiếm hoặc đặt mua.</li>
                  <li>Người bán không thể đăng bán sản phẩm mới hoặc sửa sản phẩm cũ.</li>
                  <li>Hệ thống lưu trữ người khóa, thời điểm khóa và hiển thị lý do này cho người bán.</li>
                  <li>Dữ liệu sản phẩm, đơn hàng cũ và lịch sử gian hàng luôn được bảo toàn an toàn khi mở khóa.</li>
                </ul>
              </div>

              {/* Nhập lý do khóa */}
              <div>
                <label className="block text-[12px] font-bold text-[#49352D] mb-1.5">
                  Lý do khóa gian hàng * (Bắt buộc, người bán sẽ xem lý do này):
                </label>
                <textarea
                  rows={3}
                  value={lockShopReason}
                  onChange={(e) => setLockShopReason(e.target.value)}
                  placeholder="Ví dụ: Bán sản phẩm nghi ngờ hàng giả/nhái, vi phạm nhãn hiệu theo hồ sơ khiếu nại đã xác minh..."
                  className="w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] p-3 text-[13px] text-[#49352D] outline-none transition focus:border-[#BD6E49] focus:ring-2 focus:ring-[#BD6E49]/20"
                />

                {/* Gợi ý lý do khóa nhanh */}
                <div className="mt-2 space-y-1">
                  <span className="text-[11px] text-[#8B7566]">Gợi ý lý do khóa nhanh:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Bán hàng giả, hàng nhái, vi phạm quyền sở hữu trí tuệ',
                      'Kinh doanh hàng cấm hoặc vi phạm quy định pháp luật',
                      'Mô tả sai sự thật gây thiệt hại nghiêm trọng cho người mua',
                      'Gian lận đơn hàng hoặc có hành vi lừa đảo',
                    ].map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => setLockShopReason(sample)}
                        className="rounded-lg border border-[#E6D5C2] bg-[#FBF3E8] px-2 py-0.5 text-[10px] text-[#8B7566] hover:border-[#BD6E49] hover:text-[#A95532]"
                      >
                        + {sample}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Nút hành động */}
              <div className="flex items-center justify-end gap-2 border-t border-[#E6D5C2] pt-3">
                <button
                  type="button"
                  onClick={() => setLockShopTarget(null)}
                  className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-4 py-2 text-[12px] font-medium text-[#8B7566] hover:bg-gray-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={savingId === `lock:${lockShopTarget.id}` || lockShopReason.trim().length < 3}
                  onClick={handleConfirmLockShop}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-[#FFFCF7] px-5 py-2 text-[12px] font-bold shadow-2xs transition disabled:opacity-50"
                >
                  {savingId === `lock:${lockShopTarget.id}` ? 'Đang khóa...' : 'Xác nhận khóa shop'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* MODAL 4: MỞ KHÓA GIAN HÀNG                                   */}
        {/* ============================================================ */}
        {unlockShopTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-sm text-emerald-600">
                    🔓
                  </span>
                  <div>
                    <h3 className="text-[16px] font-bold text-[#49352D]">Mở Khóa Gian Hàng</h3>
                    <p className="text-[11px] text-[#8B7566]">Mã ID #{unlockShopTarget.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUnlockShopTarget(null)}
                  className="grid h-7 w-7 place-items-center rounded-full text-[#8B7566] hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <div>
                <p className="text-[13px] text-[#49352D]">
                  Bạn có chắc chắn muốn mở khóa gian hàng <b className="text-emerald-700">{unlockShopTarget.name}</b>?
                </p>
                {unlockShopTarget.suspensionReason ? (
                  <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-800">
                    <span className="font-semibold">Lý do khóa trước đây:</span> "{unlockShopTarget.suspensionReason}"
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-800">
                <p className="font-bold text-emerald-900">Hiệu lực sau khi mở khóa:</p>
                <p className="mt-1 leading-relaxed text-[11px]">
                  Gian hàng sẽ trở lại trạng thái <b>Đang hoạt động</b>, toàn bộ sản phẩm hợp lệ của shop sẽ hiển thị lại trên sàn thương mại và người bán có thể tiếp tục kinh doanh bình thường.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E6D5C2] pt-3">
                <button
                  type="button"
                  onClick={() => setUnlockShopTarget(null)}
                  className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-4 py-2 text-[12px] font-medium text-[#8B7566] hover:bg-gray-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={savingId === `unlock:${unlockShopTarget.id}`}
                  onClick={handleConfirmUnlockShop}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[#FFFCF7] px-5 py-2 text-[12px] font-bold shadow-2xs transition disabled:opacity-50"
                >
                  {savingId === `unlock:${unlockShopTarget.id}` ? 'Đang mở khóa...' : 'Xác nhận mở khóa'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* MODAL 5: CHI TIẾT & XỬ LÝ BÁO CÁO VI PHẠM                     */}
        {/* ============================================================ */}
        {selectedReport ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xl flex flex-col">
              {/* Header Modal */}
              <div className="flex items-center justify-between border-b border-[#E6D5C2] px-6 py-4 bg-[#FBF3E8]">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#F5E7D4] text-sm text-[#A95532]">
                    🚩
                  </span>
                  <div>
                    <h3 className="text-[16px] font-bold text-[#49352D]">
                      Hồ Sơ Báo Cáo Vi Phạm #{selectedReport.id}
                    </h3>
                    <p className="text-[11px] text-[#8B7566]">
                      Thời gian gửi: {formatDateTime(selectedReport.createdAt)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="grid h-8 w-8 place-items-center rounded-full text-[#8B7566] hover:bg-[#F5E7D4] hover:text-[#A95532]"
                >
                  ✕
                </button>
              </div>

              {/* Body Modal (Scrollable) */}
              <div className="overflow-y-auto p-6 space-y-4 text-[13px]">
                {/* 1. Trạng thái hiện tại banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E6D5C2] bg-[#FBF3E8] p-3.5">
                  <div>
                    <span className="text-[11px] text-[#8B7566] block">Trạng thái hồ sơ:</span>
                    <span
                      className={`inline-block mt-0.5 rounded-full border px-3 py-0.5 text-[12px] font-bold ${
                        STATUS_BADGE_STYLES[selectedReport.status] || 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {LABELS[selectedReport.status] || selectedReport.status}
                    </span>
                  </div>
                  {selectedReport.resolverUsername ? (
                    <div className="text-right text-[11px] text-[#8B7566]">
                      <span>Xử lý bởi: <b>@{selectedReport.resolverUsername}</b></span>
                      {selectedReport.resolvedAt ? (
                        <span className="block text-[10px] text-[#8B7566]">
                          {formatDateTime(selectedReport.resolvedAt)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* 2. Đối tượng bị báo cáo & Shop */}
                <div className="rounded-2xl border border-[#E6D5C2] p-4 space-y-3">
                  <h4 className="text-[12px] font-bold text-[#49352D] uppercase tracking-wide">
                    Đối tượng bị tố cáo
                  </h4>
                  <div className="flex items-center gap-3">
                    <img
                      src={resolveImageUrl(selectedReport.productImage) || productPlaceholder({ name: selectedReport.targetName })}
                      alt=""
                      className="h-14 w-14 rounded-xl object-cover border border-[#E6D5C2] bg-[#FBF3E8] shrink-0"
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = productPlaceholder({ name: selectedReport.targetName })
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#49352D] text-[14px]">
                        {selectedReport.targetName}
                      </p>
                      <p className="text-[12px] text-[#8B7566]">
                        Loại đối tượng: <span className="font-medium text-[#49352D]">{selectedReport.targetType}</span> · Mã #{selectedReport.targetId}
                      </p>
                      {selectedReport.shopName ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-[12px] text-[#8B7566]">Gian hàng:</span>
                          <span className="font-bold text-[#A95532]">{selectedReport.shopName}</span>
                          {selectedReport.shopOwnerEmail ? (
                            <span className="text-[11px] text-[#8B7566] font-mono">
                              ({selectedReport.shopOwnerEmail})
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              ⚠ Chưa có email
                            </span>
                          )}
                          {selectedReport.shopStatus ? (
                            <span
                              className={`rounded-full border px-2 py-0.2 text-[10px] font-medium ${
                                STATUS_BADGE_STYLES[selectedReport.shopStatus] || 'bg-gray-50 text-gray-700'
                              }`}
                            >
                              {LABELS[selectedReport.shopStatus] || selectedReport.shopStatus}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* 3. Thông tin người gửi báo cáo */}
                <div className="rounded-2xl border border-[#E6D5C2] p-4 space-y-1">
                  <h4 className="text-[12px] font-bold text-[#49352D] uppercase tracking-wide">
                    Người gửi khiếu nại
                  </h4>
                  <p className="text-[#49352D]">
                    Họ và tên: <b>{selectedReport.reporterFullName || selectedReport.reporterUsername}</b> · Tài khoản: @{selectedReport.reporterUsername}
                  </p>
                  <p className="text-[11px] text-[#8B7566]">
                    Mã người dùng: #{selectedReport.reporterId}
                  </p>
                </div>

                {/* 4. Nội dung báo cáo & bằng chứng */}
                <div className="rounded-2xl border border-[#E6D5C2] p-4 space-y-2">
                  <h4 className="text-[12px] font-bold text-[#49352D] uppercase tracking-wide">
                    Nội dung tố cáo vi phạm
                  </h4>
                  <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3">
                    <p className="font-bold text-[#49352D] text-[13px]">{selectedReport.reason}</p>
                    {selectedReport.details ? (
                      <p className="mt-2 text-[12px] text-[#49352D] whitespace-pre-wrap leading-relaxed">
                        {selectedReport.details}
                      </p>
                    ) : null}
                  </div>

                  {selectedReport.evidenceUrl ? (
                    <div className="mt-3">
                      <span className="block text-[12px] font-bold text-[#49352D] mb-1.5">
                        Hình ảnh bằng chứng do người dùng đính kèm:
                      </span>
                      <div className="flex items-center gap-3">
                        <img
                          src={resolveImageUrl(selectedReport.evidenceUrl)}
                          alt="Bằng chứng vi phạm"
                          className="h-28 w-28 rounded-xl object-cover border border-[#E6D5C2] cursor-pointer hover:opacity-90 transition shadow-2xs"
                          onError={(e) => {
                            e.currentTarget.onerror = null
                            e.currentTarget.src = productPlaceholder({ name: 'Ảnh bằng chứng', emoji: '⚠️' })
                          }}
                          onClick={() => setEvidenceZoomUrl(resolveImageUrl(selectedReport.evidenceUrl))}
                        />
                        <button
                          type="button"
                          onClick={() => setEvidenceZoomUrl(resolveImageUrl(selectedReport.evidenceUrl))}
                          className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] hover:bg-[#F5E7D4] px-3 py-1.5 text-[11px] font-medium text-[#A95532] transition cursor-pointer"
                        >
                          🔍 Xem ảnh kích thước đầy đủ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#8B7566] italic mt-2 p-2 bg-[#FBF3E8] rounded-lg border border-[#E6D5C2]">
                      Không có ảnh bằng chứng
                    </p>
                  )}
                </div>

                {/* 5. Thông tin chế tài và email cảnh cáo (Nếu đã xác nhận vi phạm) */}
                {selectedReport.status === 'confirmed_violation' || selectedReport.violationNumber ? (
                  <div className="rounded-2xl border border-rose-300 bg-rose-50/80 p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-rose-900 uppercase">
                          Hồ Sơ Chế Tài {selectedReport.violationNumber ? `(Vi phạm lần ${selectedReport.violationNumber})` : ''}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-200">
                          {selectedReport.violationAction === 'shop_suspended' ? 'TẠM KHÓA GIAN HÀNG' : 'CẢNH CÁO VI PHẠM'}
                        </span>
                      </div>

                      {/* Badge trạng thái email: CHƯA CẤU HÌNH EMAIL / ĐANG GỬI EMAIL / ĐÃ GỬI EMAIL / GỬI EMAIL THẤT BẠI */}
                      {(() => {
                        const isSending = savingId === `email:${selectedReport.violationId}`
                        if (isSending) {
                          return (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-600 animate-pulse" />
                              ĐANG GỬI EMAIL
                            </span>
                          )
                        }
                        if (selectedReport.violationEmailStatus === 'sent') {
                          return (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ ĐÃ GỬI EMAIL
                            </span>
                          )
                        }
                        if (selectedReport.violationEmailStatus === 'failed') {
                          return (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                              ⚠ GỬI EMAIL THẤT BẠI
                            </span>
                          )
                        }
                        return (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            ✉ CHƯA CẤU HÌNH EMAIL
                          </span>
                        )
                      })()}
                    </div>

                    <div className="text-[12px] text-[#49352D] space-y-1.5 mt-2">
                      <p>
                        Email nhận cảnh báo: <b className="font-mono">{selectedReport.violationEmailSentTo || selectedReport.shopOwnerEmail || 'Chưa cập nhật email'}</b>
                      </p>
                      {selectedReport.violationEmailSentAt ? (
                        <p className="text-[11px] text-[#8B7566]">
                          Thời điểm gửi: {formatDateTime(selectedReport.violationEmailSentAt)}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span>Trạng thái dịch vụ:</span>
                        <span className={`font-bold ${
                          savingId === `email:${selectedReport.violationId}`
                            ? 'text-sky-700'
                            : selectedReport.violationEmailStatus === 'sent'
                              ? 'text-emerald-700'
                              : selectedReport.violationEmailStatus === 'failed'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                        }`}>
                          {savingId === `email:${selectedReport.violationId}`
                            ? 'Đang gửi email qua SMTP...'
                            : selectedReport.violationEmailStatus === 'sent'
                              ? 'Email đã được máy chủ SMTP chấp nhận gửi đi'
                              : selectedReport.violationEmailStatus === 'failed'
                                ? 'Gửi email thất bại'
                                : 'Dịch vụ SMTP chưa được cấu hình biến môi trường'}
                        </span>
                        {selectedReport.violationId && selectedReport.violationEmailStatus !== 'sent' ? (
                          <button
                            type="button"
                            disabled={savingId === `email:${selectedReport.violationId}`}
                            onClick={() => handleRetryEmail(selectedReport.violationId)}
                            className="rounded-lg bg-[#BD6E49] hover:bg-[#A95532] text-white px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 cursor-pointer shadow-2xs"
                          >
                            {savingId === `email:${selectedReport.violationId}` ? 'Đang gửi...' : 'Thử gửi lại email'}
                          </button>
                        ) : null}
                      </div>
                      {selectedReport.violationEmailError ? (
                        <p className="text-[11px] text-rose-700 bg-rose-100 p-2 rounded-lg mt-1 font-mono">
                          Chi tiết lỗi: {selectedReport.violationEmailError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* 5. Khu vực thao tác cập nhật trạng thái báo cáo */}
                <div className="rounded-2xl border border-[#E6D5C2] bg-[#FBF3E8] p-4 space-y-3">
                  <h4 className="text-[12px] font-bold text-[#49352D] uppercase tracking-wide">
                    Cập nhật tiến độ xử lý báo cáo
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={savingId === `report:${selectedReport.id}` || selectedReport.status === 'open'}
                      onClick={() => handleUpdateReportStatus(selectedReport.id, 'open')}
                      className={`rounded-xl border px-3 py-1.5 text-[12px] font-medium transition ${
                        selectedReport.status === 'open'
                          ? 'border-amber-400 bg-amber-100 text-amber-800 font-bold'
                          : 'border-[#E6D5C2] bg-[#FFFCF7] text-[#8B7566] hover:bg-[#F5E7D4]'
                      }`}
                    >
                      ⏳ Chờ xử lý
                    </button>
                    <button
                      type="button"
                      disabled={savingId === `report:${selectedReport.id}` || selectedReport.status === 'investigating'}
                      onClick={() => handleUpdateReportStatus(selectedReport.id, 'investigating')}
                      className={`rounded-xl border px-3 py-1.5 text-[12px] font-medium transition ${
                        selectedReport.status === 'investigating'
                          ? 'border-sky-400 bg-sky-100 text-sky-800 font-bold'
                          : 'border-[#E6D5C2] bg-[#FFFCF7] text-[#8B7566] hover:bg-[#F5E7D4]'
                      }`}
                    >
                      🔍 Đang xác minh
                    </button>
                    <button
                      type="button"
                      disabled={savingId === `report:${selectedReport.id}` || selectedReport.status === 'confirmed_violation'}
                      onClick={() => handleUpdateReportStatus(selectedReport.id, 'confirmed_violation')}
                      className={`rounded-xl border px-3 py-1.5 text-[12px] font-medium transition ${
                        selectedReport.status === 'confirmed_violation'
                          ? 'border-rose-400 bg-rose-100 text-rose-800 font-bold'
                          : 'border-[#E6D5C2] bg-[#FFFCF7] text-[#8B7566] hover:bg-[#F5E7D4]'
                      }`}
                    >
                      ✓ Đã xác nhận vi phạm
                    </button>
                    <button
                      type="button"
                      disabled={savingId === `report:${selectedReport.id}` || selectedReport.status === 'dismissed'}
                      onClick={() => handleUpdateReportStatus(selectedReport.id, 'dismissed')}
                      className={`rounded-xl border px-3 py-1.5 text-[12px] font-medium transition ${
                        selectedReport.status === 'dismissed'
                          ? 'border-gray-400 bg-gray-200 text-gray-800 font-bold'
                          : 'border-[#E6D5C2] bg-[#FFFCF7] text-[#8B7566] hover:bg-[#F5E7D4]'
                      }`}
                    >
                      ✕ Không phát hiện vi phạm
                    </button>
                  </div>
                </div>

                {/* 6. Chế tài với gian hàng vi phạm */}
                {selectedReport.shopId ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 space-y-2">
                    <h4 className="text-[12px] font-bold text-rose-900 uppercase tracking-wide flex items-center gap-1.5">
                      <span>🛡️</span> Chế tài với gian hàng ({selectedReport.shopName})
                    </h4>
                    {selectedReport.shopStatus === 'suspended' ? (
                      <div className="flex items-center justify-between gap-3 text-[12px] text-rose-800">
                        <span>Gian hàng này hiện đang bị <b>TẠM KHÓA</b>. Toàn bộ sản phẩm đã bị ẩn.</span>
                        <button
                          type="button"
                          onClick={() => setUnlockShopTarget({
                            id: selectedReport.shopId,
                            name: selectedReport.shopName,
                            suspensionReason: 'Đang tạm khóa',
                          })}
                          className="rounded-xl border border-emerald-300 bg-[#FFFCF7] hover:bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 transition shrink-0"
                        >
                          🔓 Mở khóa gian hàng
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-[11px] text-rose-700">
                          Chỉ khóa gian hàng sau khi Ban Quản Trị đã xác minh có căn cứ hàng giả hoặc vi phạm nghiêm trọng.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOpenLockFromReport(selectedReport)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-[#FFFCF7] px-4 py-2 text-[12px] font-bold shadow-2xs transition shrink-0"
                        >
                          <span>🔒</span>
                          <span>Khóa gian hàng vi phạm này</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Footer Modal */}
              <div className="flex items-center justify-end border-t border-[#E6D5C2] px-6 py-3 bg-[#FBF3E8]">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-5 py-2 text-[13px] font-semibold text-[#49352D] hover:bg-gray-50 shadow-2xs transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* MODAL 6: PHÓNG TO ẢNH BẰNG CHỨNG                             */}
        {/* ============================================================ */}
        {evidenceZoomUrl ? (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setEvidenceZoomUrl(null)}
          >
            <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
              <img
                src={evidenceZoomUrl}
                alt="Ảnh bằng chứng kích thước đầy đủ"
                className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-[#FFFCF7]/20"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = productPlaceholder({ name: 'Không thể tải ảnh bằng chứng', emoji: '⚠️' })
                }}
              />
              <button
                type="button"
                onClick={() => setEvidenceZoomUrl(null)}
                className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-[#FFFCF7] hover:bg-black transition cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* MODAL 7: LỊCH SỬ VI PHẠM & CẢNH CÁO GIAN HÀNG                 */}
        {/* ============================================================ */}
        {viewingViolationsShop ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xl flex flex-col">
              <div className="flex items-center justify-between border-b border-[#E6D5C2] px-6 py-4 bg-[#FBF3E8]">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#F5E7D4] text-sm text-[#A95532]">
                    ⚠️
                  </span>
                  <div>
                    <h3 className="text-[16px] font-bold text-[#49352D]">
                      Lịch Sử Vi Phạm: {viewingViolationsShop.name}
                    </h3>
                    <p className="text-[11px] text-[#8B7566]">
                      Mã Shop #{viewingViolationsShop.id} · Chủ gian hàng: @{viewingViolationsShop.ownerUsername} {viewingViolationsShop.ownerEmail ? `(${viewingViolationsShop.ownerEmail})` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingViolationsShop(null)}
                  className="grid h-8 w-8 place-items-center rounded-full text-[#8B7566] hover:bg-[#F5E7D4] hover:text-[#A95532] cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto p-6 space-y-4 text-[13px]">
                {shopViolationsLoading ? (
                  <p className="py-8 text-center text-[#8B7566]">Đang tải lịch sử vi phạm...</p>
                ) : shopViolationsList.length === 0 ? (
                  <div className="py-8 text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(84, 118, 83, 0.1)] text-xl text-[#547653]">
                      ✓
                    </span>
                    <p className="mt-2 text-[14px] font-semibold text-[#49352D]">Gian hàng chưa có vi phạm nào được xác minh</p>
                    <p className="text-[12px] text-[#8B7566] mt-0.5">Hồ sơ gian hàng tuân thủ quy chế sàn.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shopViolationsList.map((v) => (
                      <div key={v.id} className="rounded-2xl border border-[#E6D5C2] bg-[#FBF3E8] p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-[#B93832] text-[13px]">
                            LẦN VI PHẠM #{v.violationNumber}: {v.actionTaken === 'shop_suspended' ? 'TẠM KHÓA GIAN HÀNG' : 'CẢNH CÁO VI PHẠM'}
                          </span>
                          <span className="text-[11px] text-[#8B7566]">
                            {formatDateTime(v.createdAt)}
                          </span>
                        </div>
                        <p className="text-[12px] text-[#49352D] leading-relaxed">
                          <b>Lý do xác minh:</b> {v.reason}
                        </p>
                        <p className="text-[11px] text-[#8B7566]">
                          Hồ sơ liên quan: {v.reportId ? `Báo cáo vi phạm #${v.reportId}` : 'Khóa trực tiếp'} · Quản trị viên xử lý: @{v.adminUsername}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E6D5C2]/70 text-[11px]">
                          <div>
                            <span>Email nhận cảnh báo: <b className="font-mono">{v.emailSentTo || 'Chưa cập nhật email'}</b></span>
                            {v.emailSentAt ? (
                              <span className="ml-2 text-[#8B7566]">({formatDateTime(v.emailSentAt)})</span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const isSending = savingId === `email:${v.id}`
                              if (isSending) {
                                return (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-300">
                                    ĐANG GỬI EMAIL
                                  </span>
                                )
                              }
                              if (v.emailStatus === 'sent') {
                                return (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    ✓ ĐÃ GỬI EMAIL
                                  </span>
                                )
                              }
                              if (v.emailStatus === 'failed') {
                                return (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                                    ⚠ GỬI EMAIL THẤT BẠI
                                  </span>
                                )
                              }
                              return (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                                  ✉ CHƯA CẤU HÌNH EMAIL
                                </span>
                              )
                            })()}
                            {v.emailStatus !== 'sent' ? (
                              <button
                                type="button"
                                disabled={savingId === `email:${v.id}`}
                                onClick={() => handleRetryEmail(v.id)}
                                className="rounded-lg bg-[#BD6E49] hover:bg-[#A95532] text-white px-2 py-0.5 text-[10px] font-bold transition disabled:opacity-50 cursor-pointer shadow-2xs"
                              >
                                {savingId === `email:${v.id}` ? 'Đang gửi...' : 'Thử gửi lại email'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {v.emailError ? (
                          <p className="text-[10px] text-rose-700 bg-rose-100/80 p-2 rounded-lg mt-1 font-mono">
                            Chi tiết lỗi: {v.emailError}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end border-t border-[#E6D5C2] px-6 py-3 bg-[#FBF3E8]">
                <button
                  type="button"
                  onClick={() => setViewingViolationsShop(null)}
                  className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-5 py-2 text-[13px] font-semibold text-[#49352D] hover:bg-gray-50 shadow-2xs transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        ) : null}
        </main>
      </div>
    </div>
  )
}

/**
 * TRANG ĐĂNG NHẬP RIÊNG BIỆT DÀNH CHO QUẢN TRỊ VIÊN (ADMIN PORTAL LOGIN)
 * - Xác thực Backend thực tế qua API POST /api/v1/auth/login.
 * - Không hardcode mật khẩu trong Frontend.
 * - Chỉ cho phép tài khoản có role === 'admin' đăng nhập thành công.
 * - Giao diện hồng pastel nhạt, trắng sạch sẽ, bảo mật và tinh tế.
 */
function AdminLoginForm({ currentUser, onLoginSuccess }) {
  const { login, logout } = useAuth()
  const { pushToast } = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const u = username.trim()
    const p = password
    if (!u || !p) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu Quản Trị.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await login(u, p)
      if (!res.ok) {
        setError(res.error || 'Tên đăng nhập hoặc mật khẩu không chính xác.')
        return
      }

      if (res.user.role !== 'admin') {
        await logout()
        setError('Tài khoản này không có quyền Quản Trị Viên. Vui lòng đăng nhập đúng tài khoản Admin duy nhất được cấp phép.')
        return
      }

      pushToast(`Xin chào ${res.user.fullName || res.user.username}! Đăng nhập Quản Trị thành công.`, 'success')
      if (onLoginSuccess) onLoginSuccess()
    } catch {
      setError('Không thể kết nối đến máy chủ xác thực Backend.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF3E8] p-4 text-[#49352D] antialiased">
      <div className="w-full max-w-md rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-7 sm:p-9 shadow-sm">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <img
            src="/images/logo.png"
            alt="NovaShop Logo"
            className="h-16 w-16 object-contain rounded-full shadow-xs transition-transform duration-200 hover:scale-105"
          />

          <span className="mt-3.5 inline-block rounded-full bg-[#F5E7D4] border border-[#E6D5C2] px-3 py-0.5 text-[10px] font-bold tracking-widest text-[#A95532] uppercase">
            CỔNG QUẢN TRỊ VIÊN
          </span>

          <h1 className="mt-2.5 text-[22px] font-black tracking-tight text-[#49352D]">
            Đăng Nhập Quản Trị
          </h1>

          <p className="mt-1 text-[13px] text-[#8B7566]">
            Hệ thống quản lý trung tâm sàn thương mại điện tử NOVA SHOP
          </p>
        </div>

        {/* Cảnh báo nếu đang đăng nhập tài khoản khác */}
        {currentUser && currentUser.role !== 'admin' ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[12px] text-amber-800 leading-relaxed">
            <p>
              Tài khoản hiện tại <b>@{currentUser.username}</b> (vai trò: {currentUser.role}) không có quyền quản trị. Hãy đăng nhập tài khoản Admin duy nhất bên dưới:
            </p>
          </div>
        ) : null}

        {/* Thông báo lỗi */}
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-[12px] text-rose-700 leading-relaxed">
            {error}
          </div>
        ) : null}

        {/* Form đăng nhập */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-bold text-[#49352D]">
              Tên đăng nhập Admin
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập admin..."
              autoFocus
              required
              className="w-full rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] px-3.5 py-2.5 text-[13px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#BD6E49] focus:bg-[#FFFCF7]"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[12px] font-bold text-[#49352D]">
                Mật khẩu
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] font-medium text-[#A95532] hover:underline"
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu quản trị..."
              required
              className="w-full rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] px-3.5 py-2.5 text-[13px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#BD6E49] focus:bg-[#FFFCF7]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-[#BD6E49] hover:bg-[#A95532] py-2.5 text-[13px] font-bold text-[#FFFCF7] shadow-2xs transition active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? 'Đang xác thực...' : 'Đăng Nhập Quản Trị Hệ Thống'}
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-6 border-t border-[#E6D5C2] pt-4 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#8B7566] transition hover:text-[#A95532]"
          >
            ← Quay lại Trang Chủ Mua Sắm
          </Link>
        </div>
      </div>
    </div>
  )
}
