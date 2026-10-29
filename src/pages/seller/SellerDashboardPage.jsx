import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCatalog } from '../../context/CatalogContext'
import { useOrders } from '../../context/OrderContext'
import { useToast } from '../../context/ToastContext'
import { formatNumber, formatVnd } from '../../utils/format'
import {
  IconBell,
  IconBolt,
  IconChart,
  IconChat,
  IconChevronRight,
  IconCopy,
  IconDotsHorizontal,
  IconMegaphone,
  IconPackage,
  IconPlus,
  IconSettings,
  IconShoppingBag,
  IconStar,
  IconStore,
  IconTicketPercent,
  IconTruck,
  IconWallet,
} from '../../components/ui/Icons'

/**
 * TRANG TỔNG QUAN KÊNH NGƯỜI BÁN - THIẾT KẾ THEO CHUẨN SHOPEE SELLER CENTRE
 */
export default function SellerDashboardPage() {
  const { user } = useAuth()
  const { pushToast } = useToast()
  const {
    getShop,
    getSellerProductsByShop,
    loadShop,
    loadSellerProducts,
    sellerCatalogLoading,
    sellerCatalogError,
  } = useCatalog()
  const {
    getOrdersByShop,
    loadSellerOrders,
    sellerOrdersLoading,
    sellerOrdersSummary,
  } = useOrders()

  const [timeRange, setTimeRange] = useState('7d')
  const [copied, setCopied] = useState(false)
  const [quickToolModal, setQuickToolModal] = useState(null)

  useEffect(() => {
    let current = true
    if (user?.shopId) {
      Promise.all([loadShop(user.shopId), loadSellerProducts(), loadSellerOrders()]).catch(
        (err) => console.error('Lỗi tải dữ liệu người bán:', err),
      )
    }
    return () => {
      current = false
    }
  }, [user?.shopId, loadShop, loadSellerProducts, loadSellerOrders])

  const shop = getShop(user?.shopId)
  const products = getSellerProductsByShop(user?.shopId)
  const orders = getOrdersByShop(user?.shopId)

  const revenue = sellerOrdersSummary.revenue || 0
  const pendingCount = sellerOrdersSummary.pending || 0
  const deliveredCount = sellerOrdersSummary.delivered || 0

  // Đơn hàng hôm nay
  const todayOrders = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    return orders.filter((o) => o.createdAt && o.createdAt.startsWith(todayStr))
  }, [orders])

  // Tổng số lượng sản phẩm đã bán
  const totalSold = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.sold || 0), 0)
  }, [products])

  // Dữ liệu 7 ngày gần đây cho biểu đồ
  const chartDays = useMemo(() => {
    const days = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      const dateKey = d.toISOString().slice(0, 10)

      // Tính tổng doanh thu và số đơn của ngày này
      const dayOrders = orders.filter((o) => o.createdAt && o.createdAt.startsWith(dateKey))
      const dayRevenue = dayOrders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + (o.totalForShop || 0), 0)

      days.push({
        label: dayStr,
        orders: dayOrders.length,
        revenue: dayRevenue,
      })
    }
    return days
  }, [orders])

  const copyShopId = () => {
    const idToCopy = shop?.id ? String(shop.id) : '12345678'
    navigator.clipboard?.writeText(idToCopy).then(() => {
      setCopied(true)
      pushToast(`Đã sao chép ID gian hàng: ${idToCopy}`, 'success')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* ROW 1: CHÀO MỪNG BANNER (TRÁI) & THÔNG TIN GIAN HÀNG (PHẢI)    */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Banner chào mừng */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E6D5C2] bg-gradient-to-r from-[#F5E7D4] to-[#FBF3E8] p-6 lg:col-span-8 shadow-2xs">
          <div>
            <span className="text-[13px] font-medium text-[#8B7566]">
              Xin chào, <b className="text-[#49352D]">{shop?.name || user?.fullName || user?.username}</b> 👋
            </span>
            <h1 className="mt-1 text-[20px] font-bold text-[#49352D]">
              Chào mừng bạn đến với Kênh Người Bán NovaShop
            </h1>
            <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-[#8B7566]">
              Quản lý gian hàng, theo dõi đơn hàng và phát triển kinh doanh của bạn ngay tại đây.
            </p>
          </div>

          {/* Minh họa Storefront & Túi hàng phong cách hồng Shopee */}
          <div className="mt-4 flex items-center justify-end">
            <svg className="h-28 w-auto text-[#BD6E49]" viewBox="0 0 320 140" fill="none">
              {/* Store building */}
              <rect x="80" y="30" width="160" height="90" rx="8" fill="#FFFFFF" stroke="#BD6E49" strokeWidth="2.5" />
              {/* Roof awning stripes */}
              <path
                d="M70 30 Q160 10 250 30 L245 48 Q160 30 75 48 Z"
                fill="#BD6E49"
              />
              <path
                d="M90 30 L85 48 M125 30 L123 48 M160 30 L160 48 M195 30 L197 48 M230 30 L235 48"
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
              {/* Door & Window */}
              <rect x="135" y="70" width="50" height="50" rx="4" fill="#F5E7D4" stroke="#BD6E49" strokeWidth="2" />
              <rect x="95" y="65" width="28" height="28" rx="3" fill="#FBF3E8" stroke="#E6D5C2" strokeWidth="1.5" />
              <rect x="197" y="65" width="28" height="28" rx="3" fill="#FBF3E8" stroke="#E6D5C2" strokeWidth="1.5" />
              {/* Shopping bag left */}
              <rect x="40" y="75" width="36" height="42" rx="5" fill="#A95532" opacity="0.9" />
              <path d="M48 75 C48 65, 68 65, 68 75" stroke="#FFFFFF" strokeWidth="2" fill="none" />
              {/* Shopping bag right */}
              <rect x="245" y="68" width="40" height="50" rx="6" fill="#BD6E49" opacity="0.9" />
              <path d="M255 68 C255 56, 275 56, 275 68" stroke="#FFFFFF" strokeWidth="2.5" fill="none" />
              {/* Little hearts / stars */}
              <circle cx="50" cy="50" r="3" fill="#A95532" opacity="0.6" />
              <circle cx="270" cy="45" r="4" fill="#BD6E49" opacity="0.7" />
              <circle cx="290" cy="55" r="2.5" fill="#A95532" opacity="0.5" />
            </svg>
          </div>
        </div>

        {/* Thẻ Thông tin gian hàng */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 lg:col-span-4 shadow-2xs">
          <div>
            <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-[#49352D]">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                  <IconStore className="h-4 w-4" />
                </span>
                Thông tin gian hàng
              </span>
              <Link to="/nguoi-ban/gian-hang" className="text-[#8B7566] transition hover:text-[#A95532]">
                <IconChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-3.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-bold text-[#49352D]">{shop?.name || user?.username}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#E6D5C2] bg-[rgba(84, 118, 83, 0.1)] px-2 py-0.5 text-[11px] font-medium text-[#547653]">
                  ✓ Đã xác minh
                </span>
              </div>
              <p className="flex items-center gap-1.5 text-[12px] text-[#8B7566]">
                <span>ID gian hàng: {shop?.id || '12345678'}</span>
                <button
                  type="button"
                  onClick={copyShopId}
                  title="Sao chép ID gian hàng"
                  className="text-[#8B7566] transition hover:text-[#A95532]"
                >
                  <IconCopy className="h-3.5 w-3.5" />
                </button>
                {copied ? <span className="text-[10px] text-emerald-600 font-medium">Đã chép</span> : null}
              </p>
            </div>
          </div>

          <Link
            to="/nguoi-ban/gian-hang"
            className="mt-4 block w-full rounded-xl border border-[#E6D5C2] py-2.5 text-center text-[13px] font-medium text-[#A95532] transition hover:border-[#BD6E49] hover:bg-[#F5E7D4]"
          >
            Chỉnh sửa thông tin
          </Link>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ROW 2: 5 THẺ THỐNG KÊ KPI CHUẨN SHOPEE SELLER CENTRE          */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Đơn hàng hôm nay */}
        <Link
          to="/nguoi-ban/don-hang"
          className="flex flex-col justify-between rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 transition shadow-2xs hover:border-[#BD6E49] hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-medium text-[#8B7566]">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                <IconShoppingBag className="h-4 w-4" />
              </span>
              Đơn hàng hôm nay
            </span>
            <IconChevronRight className="h-3.5 w-3.5 text-[#8B7566]" />
          </div>
          <div className="mt-3">
            <span className="text-[22px] font-bold text-[#49352D]">{todayOrders.length}</span>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[#8B7566]">
              <span>So với hôm qua</span>
              <span>--</span>
            </div>
          </div>
        </Link>

        {/* 2. Đơn hàng chờ xử lý */}
        <Link
          to="/nguoi-ban/don-hang?tab=pending"
          className="flex flex-col justify-between rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 transition shadow-2xs hover:border-[#BD6E49] hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-medium text-[#8B7566]">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                <IconPackage className="h-4 w-4" />
              </span>
              Đơn hàng chờ xử lý
            </span>
            <IconChevronRight className="h-3.5 w-3.5 text-[#8B7566]" />
          </div>
          <div className="mt-3">
            <span className="text-[22px] font-bold text-[#49352D]">{pendingCount}</span>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[#8B7566]">
              <span>So với hôm qua</span>
              <span>--</span>
            </div>
          </div>
        </Link>

        {/* 3. Đơn hàng đã giao */}
        <Link
          to="/nguoi-ban/don-hang?tab=delivered"
          className="flex flex-col justify-between rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 transition shadow-2xs hover:border-[#BD6E49] hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-medium text-[#8B7566]">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                <IconTruck className="h-4 w-4" />
              </span>
              Đơn hàng đã giao
            </span>
            <IconChevronRight className="h-3.5 w-3.5 text-[#8B7566]" />
          </div>
          <div className="mt-3">
            <span className="text-[22px] font-bold text-[#49352D]">{deliveredCount}</span>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[#8B7566]">
              <span>So với hôm qua</span>
              <span>--</span>
            </div>
          </div>
        </Link>

        {/* 4. Doanh thu (đã thanh toán) */}
        <Link
          to="/nguoi-ban/don-hang"
          className="flex flex-col justify-between rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 transition shadow-2xs hover:border-[#BD6E49] hover:shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-medium text-[#8B7566]">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                <IconWallet className="h-4 w-4" />
              </span>
              Doanh thu (đã thanh toán)
            </span>
            <IconChevronRight className="h-3.5 w-3.5 text-[#8B7566]" />
          </div>
          <div className="mt-3">
            <span className="text-[20px] font-bold text-[#49352D] truncate block">
              {formatVnd(revenue)}
            </span>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[#8B7566]">
              <span>So với hôm qua</span>
              <span>--</span>
            </div>
          </div>
        </Link>

        {/* 5. Đánh giá sản phẩm */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] font-medium text-[#8B7566]">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                <IconStar className="h-4 w-4" filled />
              </span>
              Đánh giá sản phẩm
            </span>
            <IconChevronRight className="h-3.5 w-3.5 text-[#8B7566]" />
          </div>
          <div className="mt-3">
            <span className="text-[22px] font-bold text-[#49352D]">5.0</span>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[#8B7566]">
              <span>So với hôm qua</span>
              <span>--</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ROW 3: BIỂU ĐỒ TÌNH HÌNH KINH DOANH (TRÁI) & CÔNG CỤ NHANH (PHẢI) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Tình hình kinh doanh */}
        <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 lg:col-span-8 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6D5C2] pb-3">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#49352D]">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                <IconChart className="h-4 w-4" />
              </span>
              Tình hình kinh doanh
            </h2>

            {/* Bộ chọn khoảng thời gian */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] px-3 py-1.5 text-[12px] font-medium text-[#49352D] outline-none transition focus:border-[#BD6E49]"
            >
              <option value="7d">7 ngày gần đây</option>
              <option value="30d">30 ngày gần đây</option>
            </select>
          </div>

          {/* Chú giải Doanh thu / Đơn hàng */}
          <div className="mt-3 flex items-center justify-end gap-4 text-[12px]">
            <span className="flex items-center gap-1.5 text-[#8B7566]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#A95532]" />
              Doanh thu
            </span>
            <span className="flex items-center gap-1.5 text-[#8B7566]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#8B7566]" />
              Đơn hàng
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12 items-center">
            {/* Khung Biểu đồ SVG */}
            <div className="md:col-span-8">
              <div className="relative h-44 w-full">
                {/* Các đường gióng ngang */}
                <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-[#8B7566]">
                  <div className="border-b border-[#E6D5C2]/50 pb-0.5">200k</div>
                  <div className="border-b border-[#E6D5C2]/50 pb-0.5">150k</div>
                  <div className="border-b border-[#E6D5C2]/50 pb-0.5">100k</div>
                  <div className="border-b border-[#E6D5C2]/50 pb-0.5">50k</div>
                  <div className="border-b border-[#E6D5C2]/50 pb-0.5">0</div>
                </div>

                {/* Đường vẽ biểu đồ SVG */}
                <svg className="absolute inset-0 h-full w-full pl-7 pt-2 pr-2 pb-5" preserveAspectRatio="none" viewBox="0 0 100 100">
                  {/* Đường Doanh thu màu hồng */}
                  <polyline
                    fill="none"
                    stroke="#A95532"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points="0,92 16.6,92 33.3,92 50,92 66.6,92 83.3,92 100,92"
                  />
                  {/* Điểm nút */}
                  <circle cx="0" cy="92" r="3" fill="#A95532" />
                  <circle cx="16.6" cy="92" r="3" fill="#A95532" />
                  <circle cx="33.3" cy="92" r="3" fill="#A95532" />
                  <circle cx="50" cy="92" r="3" fill="#A95532" />
                  <circle cx="66.6" cy="92" r="3" fill="#A95532" />
                  <circle cx="83.3" cy="92" r="3" fill="#A95532" />
                  <circle cx="100" cy="92" r="3" fill="#A95532" />
                </svg>

                {/* Nhãn trục ngày dưới chân */}
                <div className="absolute bottom-0 left-7 right-2 flex justify-between text-[10px] text-[#8B7566]">
                  {chartDays.map((d, i) => (
                    <span key={i}>{d.label}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Cột thống kê nhanh bên phải biểu đồ */}
            <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-[#E6D5C2] pl-0 md:pl-5 space-y-4 text-[12px]">
              <div>
                <span className="text-[#8B7566]">Doanh thu</span>
                <p className="mt-0.5 text-[18px] font-bold text-[#49352D]">{formatVnd(revenue)}</p>
                <span className="text-[11px] text-[#8B7566]">So với hôm qua --</span>
              </div>
              <div>
                <span className="text-[#8B7566]">Đơn hàng</span>
                <p className="mt-0.5 text-[18px] font-bold text-[#49352D]">{orders.length}</p>
                <span className="text-[11px] text-[#8B7566]">So với hôm qua --</span>
              </div>
              <div>
                <span className="text-[#8B7566]">Sản phẩm đã bán</span>
                <p className="mt-0.5 text-[18px] font-bold text-[#49352D]">{totalSold}</p>
                <span className="text-[11px] text-[#8B7566]">So với hôm qua --</span>
              </div>
            </div>
          </div>
        </div>

        {/* Công cụ nhanh */}
        <div className="flex flex-col justify-between rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 lg:col-span-4 shadow-2xs">
          <div>
            <div className="border-b border-[#E6D5C2] pb-3">
              <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#49352D]">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                  <IconBolt className="h-4 w-4" filled />
                </span>
                Công cụ nhanh
              </h2>
            </div>

            {/* Lưới 8 công cụ tròn phong cách Shopee */}
            <div className="mt-4 grid grid-cols-4 gap-y-4 gap-x-2 text-center">
              {/* 1. Thêm sản phẩm */}
              <Link to="/nguoi-ban/san-pham/them-moi" className="group flex flex-col items-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-[#A95532] transition group-hover:scale-105 group-hover:bg-[#E6D5C2]">
                  <IconPlus className="h-5 w-5" />
                </span>
                <span className="mt-1.5 text-[11px] font-medium text-[#49352D] group-hover:text-[#A95532]">
                  Thêm sản phẩm
                </span>
              </Link>

              {/* 2. Quản lý đơn hàng */}
              <Link to="/nguoi-ban/don-hang" className="group flex flex-col items-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-[#A95532] transition group-hover:scale-105 group-hover:bg-[#E6D5C2]">
                  <IconPackage className="h-5 w-5" />
                </span>
                <span className="mt-1.5 text-[11px] font-medium text-[#49352D] group-hover:text-[#A95532]">
                  Quản lý đơn hàng
                </span>
              </Link>

              {/* 3. Khuyến mãi của shop */}
              <button
                type="button"
                onClick={() =>
                  setQuickToolModal({
                    title: 'Khuyến mãi của shop',
                    desc: 'Tính năng tạo mã giảm giá (Voucher) và thiết lập chương trình ưu đãi của gian hàng.',
                  })
                }
                className="group flex flex-col items-center"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-[#A95532] transition group-hover:scale-105 group-hover:bg-[#E6D5C2]">
                  <IconTicketPercent className="h-5 w-5" />
                </span>
                <span className="mt-1.5 text-[11px] font-medium text-[#49352D] group-hover:text-[#A95532]">
                  Khuyến mãi của shop
                </span>
              </button>

              {/* 4. Marketing */}
              <button
                type="button"
                onClick={() =>
                  setQuickToolModal({
                    title: 'Marketing & Quảng cáo',
                    desc: 'Công cụ chạy quảng cáo tìm kiếm và tiếp thị liên kết cho sản phẩm của shop.',
                  })
                }
                className="group flex flex-col items-center"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-[#A95532] transition group-hover:scale-105 group-hover:bg-[#E6D5C2]">
                  <IconMegaphone className="h-5 w-5" />
                </span>
                <span className="mt-1.5 text-[11px] font-medium text-[#49352D] group-hover:text-[#A95532]">
                  Marketing
                </span>
              </button>

              {/* 5. Báo cáo doanh thu */}
              <Link to="/nguoi-ban/don-hang" className="group flex flex-col items-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-[#A95532] transition group-hover:scale-105 group-hover:bg-[#E6D5C2]">
                  <IconChart className="h-5 w-5" />
                </span>
                <span className="mt-1.5 text-[11px] font-medium text-[#49352D] group-hover:text-[#A95532]">
                  Báo cáo doanh thu
                </span>
              </Link>

              {/* 6. Chăm sóc khách hàng */}
              <button
                type="button"
                onClick={() =>
                  setQuickToolModal({
                    title: 'Chăm sóc khách hàng',
                    desc: 'Hộp thư tin nhắn trò chuyện trực tiếp và phản hồi đánh giá của người mua.',
                  })
                }
                className="group flex flex-col items-center"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-[#A95532] transition group-hover:scale-105 group-hover:bg-[#E6D5C2]">
                  <IconChat className="h-5 w-5" />
                </span>
                <span className="mt-1.5 text-[11px] font-medium text-[#49352D] group-hover:text-[#A95532]">
                  Chăm sóc khách hàng
                </span>
              </button>

              {/* 7. Thiết lập shop */}
              <Link to="/nguoi-ban/gian-hang" className="group flex flex-col items-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-[#A95532] transition group-hover:scale-105 group-hover:bg-[#E6D5C2]">
                  <IconSettings className="h-5 w-5" />
                </span>
                <span className="mt-1.5 text-[11px] font-medium text-[#49352D] group-hover:text-[#A95532]">
                  Thiết lập shop
                </span>
              </Link>

              {/* 8. Xem thêm */}
              <button
                type="button"
                onClick={() =>
                  setQuickToolModal({
                    title: 'Danh mục công cụ mở rộng',
                    desc: 'Bao gồm Quản lý kho nâng cao, Lịch sử giao dịch ví và Tải báo cáo Excel.',
                  })
                }
                className="group flex flex-col items-center"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-[#A95532] transition group-hover:scale-105 group-hover:bg-[#E6D5C2]">
                  <IconDotsHorizontal className="h-5 w-5" />
                </span>
                <span className="mt-1.5 text-[11px] font-medium text-[#49352D] group-hover:text-[#A95532]">
                  Xem thêm
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ROW 4: TIN NHẮN MỚI (TRÁI) & THÔNG BÁO (PHẢI)                 */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Tin nhắn mới */}
        <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 lg:col-span-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3">
            <h2 className="flex items-center gap-2 text-[14px] font-bold text-[#49352D]">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                <IconChat className="h-4 w-4" />
              </span>
              Tin nhắn mới
            </h2>
            <button
              type="button"
              onClick={() => pushToast('Hộp thư tin nhắn đang trống', 'info')}
              className="text-[12px] font-medium text-[#A95532] hover:underline"
            >
              Xem tất cả
            </button>
          </div>

          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F5E7D4] text-[#A95532]">
              <IconChat className="h-6 w-6" />
            </span>
            <p className="mt-2 text-[13px] text-[#8B7566]">Chưa có tin nhắn mới</p>
          </div>
        </div>

        {/* Thông báo */}
        <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 lg:col-span-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3">
            <h2 className="flex items-center gap-2 text-[14px] font-bold text-[#49352D]">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                <IconBell className="h-4 w-4" />
              </span>
              Thông báo
            </h2>
            <button
              type="button"
              onClick={() => pushToast('Đã hiển thị toàn bộ thông báo hệ thống', 'info')}
              className="text-[12px] font-medium text-[#A95532] hover:underline"
            >
              Xem tất cả
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {/* Thông báo 1: Đơn hàng mới nhất nếu có */}
            <div className="flex items-start gap-3 rounded-xl bg-[#FBF3E8] p-3 transition hover:bg-[#F5E7D4]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                <IconTruck className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#49352D]">
                  {orders[0] ? `Đơn hàng #${orders[0].code} đã được ghi nhận` : 'Đơn hàng #123456 đã được xác nhận'}
                </p>
                <p className="text-[12px] text-[#8B7566]">
                  {orders[0]
                    ? `Người mua ${orders[0].buyerName} đang chờ shop chuẩn bị hàng.`
                    : 'Đơn hàng của bạn đã được khách hàng xác nhận.'}
                </p>
              </div>
              <span className="text-[11px] text-[#8B7566] shrink-0">2 giờ trước</span>
            </div>

            {/* Thông báo 2: Cảnh báo tồn kho */}
            <div className="flex items-start gap-3 rounded-xl bg-[#FBF3E8] p-3 transition hover:bg-[#F5E7D4]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                <IconPackage className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#49352D]">Sản phẩm sắp hết hàng</p>
                <p className="text-[12px] text-[#8B7566]">
                  Sản phẩm Áo khoác nỉ đang chỉ còn 5 sản phẩm trong kho.
                </p>
              </div>
              <span className="text-[11px] text-[#8B7566] shrink-0">5 giờ trước</span>
            </div>

            {/* Thông báo 3: Chương trình ưu đãi */}
            <div className="flex items-start gap-3 rounded-xl bg-[#FBF3E8] p-3 transition hover:bg-[#F5E7D4]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F5E7D4] text-[#A95532]">
                <IconTicketPercent className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#49352D]">Chương trình khuyến mãi mới</p>
                <p className="text-[12px] text-[#8B7566]">
                  Giảm giá đến 50% cho ngành hàng Thời trang và Đời sống.
                </p>
              </div>
              <span className="text-[11px] text-[#8B7566] shrink-0">1 ngày trước</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CÔNG CỤ NHANH */}
      {quickToolModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-xl text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F5E7D4] text-[22px] text-[#A95532]">
              ⚡
            </span>
            <h3 className="mt-3 text-[16px] font-bold text-[#49352D]">{quickToolModal.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#8B7566]">{quickToolModal.desc}</p>
            <button
              type="button"
              onClick={() => setQuickToolModal(null)}
              className="mt-5 w-full rounded-xl bg-[#BD6E49] hover:bg-[#A95532] py-2.5 text-[13px] font-medium text-[#FFFCF7] transition"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
