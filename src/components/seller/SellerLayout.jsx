import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCatalog } from '../../context/CatalogContext'
import { formatNumber } from '../../utils/format'
import {
  IconBell,
  IconChart,
  IconChat,
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconHeadphones,
  IconHelpCircle,
  IconHome,
  IconLogout,
  IconMegaphone,
  IconMenu,
  IconPackage,
  IconPlus,
  IconSettings,
  IconStore,
  IconTicketPercent,
  IconTruck,
  IconUser,
  IconWallet,
  IconWarehouse,
} from '../ui/Icons'
import SmartImage from '../ui/SmartImage'

/**
 * MENU KÊNH NGƯỜI BÁN THEO CHUẨN SHOPEE SELLER CENTRE
 */
const MENU_GROUPS = [
  {
    id: 'products',
    label: 'Sản phẩm',
    icon: IconPackage,
    items: [
      { to: '/nguoi-ban/san-pham', label: 'Tất cả sản phẩm', end: true },
      { to: '/nguoi-ban/san-pham/them-moi', label: 'Thêm sản phẩm mới' },
      { to: '/nguoi-ban/san-pham?tab=active', label: 'Sản phẩm đang bán' },
      { to: '/nguoi-ban/san-pham?tab=pending', label: 'Sản phẩm chờ duyệt' },
      { to: '/nguoi-ban/san-pham?tab=out_of_stock', label: 'Đã ẩn hoặc hết hàng' },
    ],
  },
  {
    id: 'orders',
    label: 'Đơn hàng',
    icon: IconTruck,
    items: [
      { to: '/nguoi-ban/don-hang', label: 'Tất cả đơn hàng', end: true },
      { to: '/nguoi-ban/don-hang?tab=pending', label: 'Chờ xác nhận' },
      { to: '/nguoi-ban/don-hang?tab=confirmed', label: 'Chờ lấy hàng' },
      { to: '/nguoi-ban/don-hang?tab=shipping', label: 'Đang giao' },
      { to: '/nguoi-ban/don-hang?tab=delivered', label: 'Đã giao' },
      { to: '/nguoi-ban/don-hang?tab=cancelled', label: 'Đã hủy' },
    ],
  },
  {
    id: 'inventory',
    label: 'Quản lý kho',
    icon: IconWarehouse,
    items: [
      { to: '/nguoi-ban/san-pham?tab=inventory', label: 'Danh sách tồn kho' },
      { to: '/nguoi-ban/san-pham?tab=update_stock', label: 'Cập nhật số lượng' },
      { to: '/nguoi-ban/san-pham?tab=low_stock', label: 'Sản phẩm sắp hết hàng' },
    ],
  },
  {
    id: 'promotions',
    label: 'Khuyến mãi',
    icon: IconTicketPercent,
    items: [
      { action: 'promotions', label: 'Chương trình khuyến mãi' },
      { action: 'vouchers', label: 'Mã giảm giá của shop' },
      { action: 'flash_sale', label: 'Flash Sale của shop' },
    ],
  },
  {
    id: 'finance',
    label: 'Tài chính',
    icon: IconWallet,
    items: [
      { action: 'finance_overview', label: 'Tổng quan doanh thu' },
      { action: 'transactions', label: 'Lịch sử giao dịch' },
      { action: 'payouts', label: 'Số dư và thanh toán' },
    ],
  },
  {
    id: 'marketing',
    label: 'Quảng cáo',
    icon: IconMegaphone,
    items: [
      { action: 'marketing_tools', label: 'Công cụ quảng bá' },
      { action: 'marketing_programs', label: 'Chương trình tiếp thị' },
      { action: 'marketing_analytics', label: 'Theo dõi hiệu quả' },
    ],
  },
  {
    id: 'customer_care',
    label: 'Chăm sóc khách hàng',
    icon: IconChat,
    items: [
      { action: 'chat', label: 'Tin nhắn' },
      { action: 'reviews', label: 'Đánh giá sản phẩm' },
      { action: 'inquiries', label: 'Hỗ trợ và khiếu nại' },
    ],
  },
  {
    id: 'analytics',
    label: 'Dữ liệu',
    icon: IconChart,
    items: [
      { action: 'sales_analysis', label: 'Phân tích bán hàng' },
      { action: 'product_performance', label: 'Hiệu quả sản phẩm' },
      { action: 'order_performance', label: 'Hiệu quả đơn hàng' },
    ],
  },
  {
    id: 'shop_settings',
    label: 'Shop của tôi',
    icon: IconStore,
    items: [
      { to: '/nguoi-ban/gian-hang', label: 'Thông tin gian hàng' },
      { action: 'seller_profile', label: 'Hồ sơ người bán' },
      { action: 'shipping_settings', label: 'Cài đặt vận chuyển' },
      { action: 'shop_addresses', label: 'Địa chỉ lấy hàng' },
    ],
  },
]

/**
 * KHU VỰC NGƯỜI BÁN (Kênh Người Bán) - GIAO DIỆN SHOPEE SELLER CENTRE HỒNG PASTEL
 */
export default function SellerLayout() {
  const { user, openSellerShop, logout } = useAuth()
  const { getShop, loadShop } = useCatalog()
  const location = useLocation()
  const navigate = useNavigate()

  const [shopName, setShopName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Trạng thái mở menu accordion bên trái
  const [openGroups, setOpenGroups] = useState({
    products: true,
    orders: false,
    inventory: false,
    promotions: false,
    finance: false,
    marketing: false,
    customer_care: false,
    analytics: false,
    shop_settings: false,
  })

  // Trạng thái drawer trên mobile & menu tài khoản
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [featureModal, setFeatureModal] = useState(null)

  const accountRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    if ((user?.role === 'seller' || user?.shopId) && user?.shopId) {
      loadShop(user.shopId).catch((loadError) => console.error('Không thể tải gian hàng:', loadError))
    }
  }, [user?.id, user?.role, user?.shopId, loadShop])

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Đóng mobile sidebar khi chuyển trang
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname, location.search])

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  // Mở modal thông tin cho các tính năng chưa có API backend
  const handleActionClick = (actionName, label) => {
    setFeatureModal({
      title: label,
      description: `Tính năng "${label}" hiện đang trong giai đoạn hoàn thiện tích hợp Backend của Kênh Người Bán NovaShop.`,
      features: [
        'Dữ liệu hiện được bảo đảm an toàn và phân quyền chính xác cho gian hàng của bạn.',
        'Các nghiệp vụ Quản lý sản phẩm, Đăng sản phẩm mới 4 ảnh, Quản lý đơn hàng, Doanh thu và Thiết lập gian hàng đang hoạt động đầy đủ.',
      ],
    })
  }

  // NẾU CHƯA CÓ GIAN HÀNG -> GIAO DIỆN ĐĂNG KÝ GIAN HÀNG HỒNG PASTEL
  const hasShop = Boolean(user?.shopId || user?.role === 'seller')
  if (!user || !hasShop) {
    const openShop = async (event) => {
      event.preventDefault()
      if (submitting) return
      setSubmitting(true)
      setError('')
      const result = await openSellerShop(shopName)
      if (!result.ok) setError(result.error)
      setSubmitting(false)
    }

    return (
      <div className="min-h-screen bg-[#FBF3E8] py-12 px-4">
        <div className="mx-auto max-w-[620px] rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-8 text-center shadow-xs">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#F5E7D4] text-[32px] text-[#A95532]">
            🏪
          </div>
          <h1 className="mt-4 text-[22px] font-bold text-[#49352D]">Kênh Người Bán NovaShop</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#8B7566]">
            {user
              ? 'Tạo gian hàng để trở thành Người Bán chính thức trên sàn thương mại điện tử NovaShop. Bạn vẫn sử dụng cùng tài khoản này để mua sắm bình thường.'
              : 'Đăng nhập tài khoản người bán hoặc tạo tài khoản mới để bắt đầu kinh doanh trực tuyến cùng NovaShop.'}
          </p>

          {user ? (
            <form onSubmit={openShop} className="mx-auto mt-6 max-w-md space-y-4 text-left">
              <div>
                <label htmlFor="seller-shop-name" className="mb-1.5 block text-[13px] font-medium text-[#49352D]">
                  Tên gian hàng / Thương hiệu của bạn
                </label>
                <input
                  id="seller-shop-name"
                  value={shopName}
                  onChange={(event) => setShopName(event.target.value)}
                  maxLength={160}
                  required
                  placeholder="Ví dụ: Nova Fashion, Starfly Store, Tiệm Hoa Xinh..."
                  className="w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-4 py-3 text-[14px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#BD6E49] focus:ring-2 focus:ring-[#BD6E49]/20"
                />
              </div>

              {error ? (
                <p className="rounded-xl border border-[#E6D5C2] bg-[#F5E7D4] px-3.5 py-2.5 text-[13px] text-[#A95532]">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#BD6E49] hover:bg-[#A95532] py-3 text-[14px] font-semibold text-[#FFFCF7] shadow-2xs transition-all disabled:opacity-60"
              >
                {submitting ? 'Đang kích hoạt gian hàng...' : 'Mở Gian Hàng Với Tài Khoản Này'}
              </button>
            </form>
          ) : (
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-[13px]">
              <Link
                to="/dang-nhap"
                state={{ from: '/nguoi-ban' }}
                className="rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-5 py-2.5 font-medium text-[#FFFCF7] transition shadow-2xs"
              >
                Đăng nhập người bán
              </Link>
              <Link
                to="/dang-ky?role=seller"
                className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] hover:bg-[#FBF3E8] hover:border-[#BD6E49] px-5 py-2.5 font-medium text-[#A95532] transition"
              >
                Đăng ký tài khoản người bán
              </Link>
              <Link to="/" className="w-full py-2 text-[#8B7566] transition hover:text-[#A95532]">
                ← Về trang mua sắm
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  const shop = getShop(user.shopId)
  const isHomeActive = location.pathname === '/nguoi-ban' || location.pathname === '/nguoi-ban/'

  return (
    <div className="min-h-screen bg-[#FBF3E8] text-[#49352D]">
      {/* ============================================================ */}
      {/* 1. HEADER KÊNH NGƯỜI BÁN THEO HÌNH THAM KHẢO                 */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 border-b border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          {/* Trái: Toggle mobile menu + Logo NovaShop + Kênh Người Bán */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-lg text-[#8B7566] hover:bg-[#F5E7D4] hover:text-[#A95532] lg:hidden"
              aria-label="Mở menu"
            >
              <IconMenu className="h-5 w-5" />
            </button>

            <Link to="/nguoi-ban" className="group flex items-center gap-2.5">
              <img
                src="/images/logo.png"
                alt="NovaShop"
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain rounded-full shadow-2xs transition-transform duration-200 group-hover:scale-105"
              />
              <span className="text-[20px] font-extrabold tracking-tight text-[#49352D]">
                Nova<span className="text-[#BD6E49]">Shop</span>
              </span>
            </Link>

            <span className="hidden h-5 w-px bg-[#E6D5C2] sm:block" />
            <span className="hidden text-[15px] font-medium text-[#8B7566] sm:inline">
              Kênh Người Bán
            </span>
          </div>

          {/* Phải: Chuông thông báo + Menu tài khoản + Nút Về trang mua sắm */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Chuông thông báo */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => !v)}
                className="relative grid h-9 w-9 place-items-center rounded-xl text-[#8B7566] transition hover:bg-[#F5E7D4] hover:text-[#A95532]"
                aria-label="Thông báo người bán"
              >
                <IconBell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#A95532] text-[10px] font-bold text-[#FFFCF7] shadow-2xs">
                  3
                </span>
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-3 shadow-lg">
                  <div className="mb-2 flex items-center justify-between border-b border-[#E6D5C2] pb-2">
                    <span className="text-[13px] font-bold text-[#49352D]">Thông báo gian hàng</span>
                    <span className="text-[11px] text-[#A95532]">Đánh dấu đã đọc</span>
                  </div>
                  <div className="space-y-2 text-[12px]">
                    <div className="rounded-xl bg-[#FBF3E8] p-2.5 transition hover:bg-[#F5E7D4]">
                      <p className="font-semibold text-[#49352D]">Đơn hàng mới cần xác nhận</p>
                      <p className="mt-0.5 text-[#8B7566]">Đơn hàng vừa được khách đặt và đang chờ bạn xác nhận giao hàng.</p>
                      <span className="mt-1 block text-[10px] text-[#8B7566]">2 giờ trước</span>
                    </div>
                    <div className="rounded-xl bg-[#FBF3E8] p-2.5 transition hover:bg-[#F5E7D4]">
                      <p className="font-semibold text-[#49352D]">Cảnh báo tồn kho</p>
                      <p className="mt-0.5 text-[#8B7566]">Có sản phẩm sắp hết hàng, vui lòng kiểm tra kho để nhập thêm.</p>
                      <span className="mt-1 block text-[10px] text-[#8B7566]">5 giờ trước</span>
                    </div>
                    <div className="rounded-xl bg-[#FBF3E8] p-2.5 transition hover:bg-[#F5E7D4]">
                      <p className="font-semibold text-[#49352D]">Chương trình ưu đãi tháng này</p>
                      <p className="mt-0.5 text-[#8B7566]">Tham gia Flash Sale của NovaShop để tăng trưởng doanh số.</p>
                      <span className="mt-1 block text-[10px] text-[#8B7566]">1 ngày trước</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Menu tài khoản người bán */}
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl py-1 px-2 text-left transition hover:bg-[#F5E7D4]"
              >
                <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-[#E6D5C2] bg-[#F5E7D4] text-[13px] font-bold text-[#A95532]">
                  {user.avatarUrl ? (
                    <SmartImage src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    user.fullName?.charAt(0) || user.username?.charAt(0) || 'S'
                  )}
                </span>
                <span className="hidden text-[13px] font-medium text-[#49352D] md:inline">
                  {shop?.name || user.fullName || user.username}
                </span>
                <IconChevronDown className="h-3.5 w-3.5 text-[#8B7566]" />
              </button>

              {accountMenuOpen ? (
                <div className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] py-1.5 shadow-lg">
                  <div className="border-b border-[#E6D5C2] px-4 py-2.5">
                    <p className="truncate text-[13px] font-bold text-[#49352D]">{shop?.name || user.fullName}</p>
                    <p className="truncate text-[11px] text-[#8B7566]">@{user.username}</p>
                  </div>
                  <Link
                    to="/nguoi-ban/gian-hang"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-[13px] text-[#49352D] hover:bg-[#FBF3E8] hover:text-[#A95532]"
                  >
                    <IconStore className="h-4 w-4" />
                    Hồ sơ gian hàng
                  </Link>
                  <Link
                    to="/tai-khoan"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-[13px] text-[#49352D] hover:bg-[#FBF3E8] hover:text-[#A95532]"
                  >
                    <IconUser className="h-4 w-4" />
                    Tài khoản cá nhân
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      logout()
                      navigate('/')
                    }}
                    className="flex w-full items-center gap-2 border-t border-[#E6D5C2] px-4 py-2 text-left text-[13px] text-rose-600 hover:bg-[#F5E7D4]"
                  >
                    <IconLogout className="h-4 w-4" />
                    Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>

            {/* Nút Về trang mua sắm */}
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3.5 py-1.5 text-[13px] font-medium text-[#A95532] shadow-2xs transition hover:bg-[#F5E7D4] hover:border-[#BD6E49]"
            >
              <IconStore className="h-4 w-4" />
              <span className="hidden sm:inline">Về trang mua sắm</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. BODY GỒM SIDEBAR BÊN TRÁI + NỘI DUNG CHÍNH                */}
      {/* ============================================================ */}
      <div className="flex">
        {/* Lớp phủ mờ backdrop trên màn hình nhỏ */}
        {sidebarOpen ? (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs lg:hidden"
          />
        ) : null}

        {/* SIDEBAR BÊN TRÁI - PHONG CÁCH SHOPEE SELLER CENTRE */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-[#E6D5C2] bg-[#FFFCF7] transition-transform duration-200 lg:static lg:z-auto lg:h-[calc(100vh-64px)] lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Tiêu đề mobile header nếu cần đóng */}
          <div className="flex h-16 items-center justify-between border-b border-[#E6D5C2] px-4 lg:hidden">
            <span className="font-bold text-[#A95532]">Kênh Người Bán</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-[#8B7566] hover:bg-[#F5E7D4]"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>

          {/* Vùng danh sách menu cuộn */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {/* 1. Trang chủ (Tổng quan) */}
            <NavLink
              to="/nguoi-ban"
              end
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition ${
                  isActive
                    ? 'bg-[#F5E7D4] font-semibold text-[#A95532] shadow-2xs'
                    : 'text-[#49352D] hover:bg-[#FBF3E8] hover:text-[#A95532]'
                }`
              }
            >
              <IconHome className="h-4 w-4" />
              <span>Trang chủ</span>
            </NavLink>

            {/* Các nhóm chức năng có menu xổ xuống (Accordion) */}
            {MENU_GROUPS.map((group) => {
              const GroupIcon = group.icon
              const isOpen = openGroups[group.id]
              const hasActiveChild = group.items.some((item) =>
                item.to ? location.pathname === item.to : false,
              )

              return (
                <div key={group.id} className="pt-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
                      hasActiveChild
                        ? 'text-[#A95532] font-semibold'
                        : 'text-[#49352D] hover:bg-[#FBF3E8] hover:text-[#A95532]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <GroupIcon className="h-4 w-4" />
                      <span>{group.label}</span>
                    </span>
                    <IconChevronDown
                      className={`h-3.5 w-3.5 text-[#8B7566] transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#A95532]' : ''
                      }`}
                    />
                  </button>

                  {/* Danh sách mục con */}
                  {isOpen ? (
                    <div className="ml-5 mt-1 space-y-1 border-l-2 border-[#E6D5C2] pl-2.5">
                      {group.items.map((item, idx) => {
                        if (item.to) {
                          return (
                            <NavLink
                              key={idx}
                              to={item.to}
                              end={item.end}
                              className={({ isActive }) =>
                                `block rounded-lg px-2.5 py-1.5 text-[12px] transition ${
                                  isActive
                                    ? 'bg-[#F5E7D4] font-semibold text-[#A95532]'
                                    : 'text-[#8B7566] hover:bg-[#FBF3E8] hover:text-[#A95532]'
                                }`
                              }
                            >
                              {item.label}
                            </NavLink>
                          )
                        }

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleActionClick(item.action, item.label)}
                            className="block w-full text-left rounded-lg px-2.5 py-1.5 text-[12px] text-[#8B7566] hover:bg-[#FBF3E8] hover:text-[#A95532] transition"
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          {/* Dưới cùng: Trợ giúp & Liên hệ */}
          <div className="border-t border-[#E6D5C2] p-3 space-y-1 bg-[#FFFCF7]">
            <button
              type="button"
              onClick={() => handleActionClick('help_center', 'Trung tâm trợ giúp')}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] text-[#8B7566] hover:bg-[#FBF3E8] hover:text-[#A95532] transition"
            >
              <IconHelpCircle className="h-4 w-4" />
              <span>Trung tâm trợ giúp</span>
            </button>
            <button
              type="button"
              onClick={() => handleActionClick('contact_support', 'Liên hệ hỗ trợ')}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] text-[#8B7566] hover:bg-[#FBF3E8] hover:text-[#A95532] transition"
            >
              <IconHeadphones className="h-4 w-4" />
              <span>Liên hệ hỗ trợ</span>
            </button>
          </div>
        </aside>

        {/* NỘI DUNG CHÍNH (MAIN OUTLET) */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {/* BANNER CẢNH BÁO KHI GIAN HÀNG BỊ TẠM KHÓA */}
          {shop?.status === 'suspended' ? (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/95 p-4 sm:p-5 shadow-xs">
              <div className="flex items-start gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-xl text-rose-600">
                  ⚠️
                </span>
                <div className="flex-1 text-[13px]">
                  <h3 className="text-[15px] font-bold text-rose-900">
                    Gian hàng của bạn hiện đang bị tạm khóa
                  </h3>
                  <div className="mt-2 rounded-xl border border-rose-200/80 bg-[#FFFCF7]/80 p-3 text-rose-800">
                    <p className="font-semibold text-rose-900">
                      Lý do tạm khóa từ Quản trị viên:
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap font-medium text-rose-700">
                      "{shop.suspensionReason || 'Vi phạm chính sách tiêu chuẩn cộng đồng hoặc bán hàng trên sàn NovaShop.'}"
                    </p>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-rose-700">
                    Trong thời gian gian hàng bị tạm khóa: toàn bộ sản phẩm của gian hàng tạm thời bị ẩn khỏi sàn thương mại và tính năng đăng bán sản phẩm mới bị hạn chế. Mọi lịch sử đơn hàng, dữ liệu sản phẩm của bạn đều được bảo toàn an toàn. Nếu bạn có bằng chứng giải trình hoặc muốn mở khóa gian hàng, vui lòng liên hệ Ban Quản Trị NovaShop.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <Outlet />
        </main>
      </div>

      {/* MODAL THÔNG BÁO TÍNH NĂNG MỞ RỘNG (GHI NHẬN RÕ RÀNG THEO YÊU CẦU) */}
      {featureModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3">
              <h3 className="text-[16px] font-bold text-[#49352D]">{featureModal.title}</h3>
              <button
                type="button"
                onClick={() => setFeatureModal(null)}
                className="grid h-7 w-7 place-items-center rounded-lg text-[#8B7566] hover:bg-[#F5E7D4] hover:text-[#A95532]"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <div className="py-4 space-y-3 text-[13px] leading-relaxed text-[#8B7566]">
              <p>{featureModal.description}</p>
              <div className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3 space-y-1.5 text-[12px]">
                {featureModal.features.map((f, i) => (
                  <p key={i} className="flex items-start gap-1.5">
                    <span className="text-[#A95532]">✓</span>
                    <span>{f}</span>
                  </p>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setFeatureModal(null)}
                className="rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-4 py-2 text-[13px] font-medium text-[#FFFCF7] shadow-2xs transition"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
