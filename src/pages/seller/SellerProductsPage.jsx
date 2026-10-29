import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCatalog } from '../../context/CatalogContext'
import { useToast } from '../../context/ToastContext'
import { formatDateTime, formatNumber, formatSold, formatVnd } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Paginator from '../../components/ui/Paginator'
import { IconEdit, IconEye, IconPlus, IconSearch, IconTrash } from '../../components/ui/Icons'
import SmartImage from '../../components/ui/SmartImage'

const PAGE_SIZE = 10

const TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Đang bán' },
  { id: 'pending', label: 'Chờ duyệt' },
  { id: 'rejected', label: 'Bị từ chối' },
  { id: 'out_of_stock', label: 'Đã ẩn hoặc hết hàng' },
]

/**
 * QUẢN LÝ SẢN PHẨM (NGƯỜI BÁN) - PHONG CÁCH SHOPEE SELLER CENTRE HỒNG PASTEL
 */
export default function SellerProductsPage() {
  const { user } = useAuth()
  const {
    getSellerProductsByShop,
    deleteProduct,
    upsertProduct,
    categories,
    loadSellerProducts,
    loadCategories,
    sellerProductsTotal,
    catalogError,
    sellerCatalogError,
    sellerCatalogLoading,
  } = useCatalog()
  const { pushToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentTab = searchParams.get('tab') || 'all'
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [viewingReasonProduct, setViewingReasonProduct] = useState(null)

  useEffect(() => {
    loadCategories().catch((error) => console.error('Could not load categories:', error))
    loadSellerProducts().catch((error) => console.error('Could not load seller products:', error))
  }, [loadCategories, loadSellerProducts])

  const all = getSellerProductsByShop(user?.shopId)

  // Đếm theo từng tab
  const tabCounts = useMemo(() => {
    return {
      all: all.length,
      active: all.filter((p) => (p.approvalStatus === 'approved') && p.status === 'active' && p.stock > 0).length,
      pending: all.filter((p) => (p.approvalStatus || 'pending') === 'pending').length,
      rejected: all.filter((p) => p.approvalStatus === 'rejected').length,
      out_of_stock: all.filter((p) => p.status === 'hidden' || p.stock === 0).length,
    }
  }, [all])

  // Lọc sản phẩm
  const list = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    const filtered = all
      .filter((p) => {
        const app = p.approvalStatus || 'pending'
        if (currentTab === 'active') return app === 'approved' && p.status === 'active' && p.stock > 0
        if (currentTab === 'pending') return app === 'pending'
        if (currentTab === 'rejected') return app === 'rejected'
        if (currentTab === 'out_of_stock') return p.status === 'hidden' || p.stock === 0
        if (currentTab === 'low_stock') return p.stock > 0 && p.stock <= 10
        return true
      })
      .filter((p) => (categoryId ? p.categoryId === categoryId : true))
      .filter((p) =>
        k
          ? p.name.toLowerCase().includes(k) ||
            String(p.id).toLowerCase().includes(k) ||
            (p.slug && p.slug.toLowerCase().includes(k))
          : true,
      )

    const sorters = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      'stock-asc': (a, b) => a.stock - b.stock,
      sold: (a, b) => b.sold - a.sold,
    }
    return [...filtered].sort(sorters[sort] || sorters.newest)
  }, [all, currentTab, keyword, categoryId, sort])

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleTabChange = (tabId) => {
    if (tabId === 'all') {
      searchParams.delete('tab')
    } else {
      searchParams.set('tab', tabId)
    }
    setSearchParams(searchParams)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Tiêu đề & Nút Thêm sản phẩm */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] px-5 py-4 shadow-2xs">
        <div>
          <h1 className="text-[18px] font-bold text-[#49352D]">Quản Lý Sản Phẩm</h1>
          <p className="mt-0.5 text-[12px] text-[#8B7566]">
            {all.length} sản phẩm của gian hàng (hiển thị {list.length} theo bộ lọc)
          </p>
        </div>

        <Link
          to="/nguoi-ban/san-pham/them-moi"
          className="flex items-center gap-1.5 rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-4 py-2.5 text-[13px] font-semibold text-[#FFFCF7] shadow-2xs transition active:scale-[0.99]"
        >
          <IconPlus className="h-4 w-4" />
          <span>Thêm 1 sản phẩm mới</span>
        </Link>
      </div>

      {sellerCatalogError || catalogError ? (
        <p className="rounded-xl border border-[#E6D5C2] bg-[#F5E7D4] px-4 py-2.5 text-[13px] text-[#A95532]">
          {sellerCatalogError || catalogError}
        </p>
      ) : null}

      {/* Tabs theo phong cách Shopee */}
      <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs">
        <div className="no-scrollbar flex items-center overflow-x-auto border-b border-[#E6D5C2] px-4">
          {TABS.map((t) => {
            const count = tabCounts[t.id] ?? 0
            const active = currentTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTabChange(t.id)}
                className={`whitespace-nowrap border-b-2 py-3.5 px-4 text-[13px] transition ${
                  active
                    ? 'border-[#A95532] font-bold text-[#A95532]'
                    : 'border-transparent font-medium text-[#8B7566] hover:text-[#A95532]'
                }`}
              >
                {t.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Thanh tìm kiếm & bộ lọc */}
        <div className="flex flex-wrap items-center gap-3 p-4">
          {/* Ô tìm kiếm */}
          <div className="relative flex flex-1 min-w-[220px] items-center">
            <span className="absolute left-3 text-[#8B7566]">
              <IconSearch className="h-4 w-4" />
            </span>
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm theo tên hoặc mã sản phẩm..."
              className="w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] pl-9 pr-3.5 py-2 text-[13px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#BD6E49]"
            />
          </div>

          {/* Lọc danh mục */}
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setPage(1)
            }}
            className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3 py-2 text-[13px] text-[#49352D] outline-none transition focus:border-[#BD6E49]"
          >
            <option value="">Tất cả ngành hàng</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Sắp xếp */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3 py-2 text-[13px] text-[#49352D] outline-none transition focus:border-[#BD6E49]"
          >
            <option value="newest">Mới nhất</option>
            <option value="sold">Bán chạy nhất</option>
            <option value="price-asc">Giá thấp đến cao</option>
            <option value="price-desc">Giá cao đến thấp</option>
            <option value="stock-asc">Tồn kho ít nhất</option>
          </select>
        </div>
      </div>

      {sellerCatalogLoading ? (
        <p className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 text-center text-[13px] text-[#8B7566]">
          Đang tải dữ liệu sản phẩm của gian hàng...
        </p>
      ) : null}

      {/* Bảng danh sách sản phẩm */}
      <div className="overflow-hidden rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-2xs">
        {/* Tiêu đề bảng */}
        <div className="hidden items-center gap-3 border-b border-[#E6D5C2] bg-[#FBF3E8] px-4 py-3 text-[12px] font-semibold text-[#8B7566] uppercase lg:flex">
          <span className="flex-1">Tên sản phẩm</span>
          <span className="w-[120px] text-center">Giá bán</span>
          <span className="w-[100px] text-center">Tồn kho</span>
          <span className="w-[90px] text-center">Đã bán</span>
          <span className="w-[140px] text-center">Thao tác</span>
        </div>

        {/* Hàng sản phẩm */}
        {pageItems.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-3 border-b border-[#E6D5C2] px-4 py-3.5 transition hover:bg-[#FBF3E8] last:border-b-0"
          >
            {/* Ảnh sản phẩm */}
            <SmartImage
              src={p.image}
              fallback={p.gallery?.[1] || p.image}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl border border-[#E6D5C2] object-cover"
            />

            {/* Thông tin tên & phân loại */}
            <div className="min-w-[200px] flex-1">
              <Link
                to={`/san-pham/${p.slug}`}
                className="line-clamp-2 text-[13px] font-medium text-[#49352D] transition hover:text-[#A95532]"
              >
                {p.name}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#8B7566]">
                <span>
                  {categories.find((c) => c.id === p.categoryId)?.name || 'Danh mục'} · {p.location || 'Toàn quốc'}
                </span>
                {p.mall ? (
                  <span className="rounded-sm bg-[#A95532] px-1 py-0.2 text-[9px] font-bold text-[#FFFCF7]">
                    MALL
                  </span>
                ) : null}
                <span className="text-[#8B7566]">Mã: #{p.id}</span>
              </div>
            </div>

            {/* Giá bán & Trạng thái duyệt */}
            <div className="w-[130px] shrink-0 text-center space-y-1">
              <span className="text-[14px] font-bold text-[#A95532] block">{formatVnd(p.price)}</span>
              {/* Badge Kiểm Duyệt */}
              {p.approvalStatus === 'pending' || !p.approvalStatus ? (
                <span className="inline-block rounded-full bg-amber-50 border border-amber-200 px-2 py-0.2 text-[10px] font-semibold text-amber-700">
                  ⏳ Chờ duyệt
                </span>
              ) : p.approvalStatus === 'rejected' ? (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="inline-block rounded-full bg-rose-50 border border-rose-200 px-2 py-0.2 text-[10px] font-semibold text-rose-700">
                    ✕ Bị từ chối
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewingReasonProduct(p)}
                    className="text-[11px] font-medium text-rose-600 underline hover:text-rose-800"
                  >
                    Xem lý do
                  </button>
                </div>
              ) : (
                <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.2 text-[10px] font-semibold text-emerald-700">
                  ✓ Đã duyệt
                </span>
              )}

              {/* Badge Ẩn/Hiện */}
              {p.status === 'hidden' ? (
                <span className="block text-[10px] text-gray-500 font-medium">
                  (Đã ẩn)
                </span>
              ) : p.status === 'draft' ? (
                <span className="block text-[10px] text-gray-500 font-medium">
                  (Bản nháp)
                </span>
              ) : null}
            </div>

            {/* Tồn kho (Cập nhật nhanh) */}
            <div className="w-[100px] shrink-0 text-center">
              <input
                type="number"
                min="0"
                defaultValue={p.stock ?? 0}
                onBlur={async (e) => {
                  const newStock = Number(e.target.value)
                  if (!Number.isSafeInteger(newStock) || newStock < 0 || newStock === (p.stock ?? 0)) return
                  try {
                    await upsertProduct({ ...p, stock: newStock })
                    pushToast(`Đã cập nhật tồn kho "${p.name}": ${newStock}`, 'success')
                  } catch (err) {
                    pushToast(err.message || 'Không thể cập nhật tồn kho.', 'error')
                  }
                }}
                className="w-16 rounded-lg border border-[#E6D5C2] py-1 text-center text-[13px] text-[#49352D] outline-none transition focus:border-[#BD6E49]"
                aria-label="Cập nhật kho"
              />
            </div>

            {/* Đã bán */}
            <div className="w-[90px] shrink-0 text-center text-[13px] text-[#8B7566]">
              {formatSold(p.sold || 0)}
            </div>

            {/* Các nút thao tác */}
            <div className="flex w-[140px] shrink-0 items-center justify-center gap-1.5">
              <Link
                to={`/san-pham/${p.slug}`}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[#E6D5C2] text-[#8B7566] transition hover:border-[#BD6E49] hover:bg-[#F5E7D4] hover:text-[#A95532]"
                title="Xem sản phẩm trên sàn"
              >
                <IconEye className="h-4 w-4" />
              </Link>
              <Link
                to={`/nguoi-ban/san-pham/${p.id}`}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[#E6D5C2] text-[#8B7566] transition hover:border-[#BD6E49] hover:bg-[#F5E7D4] hover:text-[#A95532]"
                title="Chỉnh sửa sản phẩm"
              >
                <IconEdit className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${p.name}"?`)) {
                    deleteProduct(p.id)
                      .then(() => pushToast('Đã xóa sản phẩm khỏi gian hàng', 'success'))
                      .catch((err) => pushToast(err.message || 'Không thể xóa sản phẩm.', 'error'))
                  }
                }}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[#E6D5C2] text-[#8B7566] transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                title="Xóa sản phẩm"
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {!pageItems.length ? (
          <EmptyState
            emoji="📦"
            title="Chưa có sản phẩm phù hợp"
            description="Thử đổi bộ lọc hoặc đăng sản phẩm mới cho gian hàng của bạn."
            action={
              <Link
                to="/nguoi-ban/san-pham/them-moi"
                className="rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-4 py-2.5 text-[13px] font-medium text-[#FFFCF7] transition shadow-2xs"
              >
                + Đăng sản phẩm mới
              </Link>
            }
          />
        ) : null}
      </div>

      {/* Phân trang */}
      <Paginator page={currentPage} totalPages={totalPages} onChange={setPage} />

      <p className="text-center text-[12px] text-[#8B7566]">
        Tổng giá trị hàng tồn kho: <b className="text-[#49352D]">{formatNumber(all.reduce((s, p) => s + (p.price || 0) * (p.stock || 0), 0))}₫</b>
      </p>
      {/* Modal xem lý do từ chối dành cho Người Bán */}
      {viewingReasonProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-sm text-rose-600 font-bold">
                  ✕
                </span>
                <h3 className="text-[16px] font-bold text-[#49352D]">Lý Do Từ Chối Duyệt</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingReasonProduct(null)}
                className="grid h-7 w-7 place-items-center rounded-full text-[#8B7566] hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div>
              <p className="text-[13px] text-[#49352D]">
                Sản phẩm: <b className="text-[#49352D]">{viewingReasonProduct.name}</b>
              </p>
              <p className="text-[11px] text-[#8B7566] mt-0.5">
                Mã sản phẩm: #{viewingReasonProduct.id}
              </p>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block mb-1">
                Ghi chú từ Ban Quản Trị:
              </span>
              <p className="text-[13px] text-rose-800 leading-relaxed whitespace-pre-wrap">
                {viewingReasonProduct.rejectionReason || 'Chưa có thông tin lý do cụ thể.'}
              </p>
              {viewingReasonProduct.reviewedAt ? (
                <p className="text-[10px] text-rose-500 mt-2">
                  Thời gian phản hồi: {formatDateTime(viewingReasonProduct.reviewedAt)}
                </p>
              ) : null}
            </div>

            <p className="text-[12px] text-[#8B7566]">
              💡 <b>Hướng dẫn:</b> Bạn hãy bấm <b>"Chỉnh sửa sản phẩm"</b> để cập nhật lại thông tin hoặc hình ảnh theo đúng yêu cầu. Khi bạn nhấn <b>Lưu</b>, sản phẩm sẽ tự động được gửi lại để Admin duyệt.
            </p>

            <div className="flex items-center justify-end gap-2 border-t border-[#E6D5C2] pt-3">
              <button
                type="button"
                onClick={() => setViewingReasonProduct(null)}
                className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-4 py-2 text-[12px] font-medium text-[#8B7566] hover:bg-gray-50"
              >
                Đóng
              </button>
              <Link
                to={`/nguoi-ban/san-pham/${viewingReasonProduct.id}`}
                className="rounded-xl bg-[#BD6E49] hover:bg-[#A95532] text-[#FFFCF7] px-4 py-2 text-[12px] font-bold transition shadow-2xs"
              >
                Chỉnh sửa sản phẩm này →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
