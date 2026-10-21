import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCatalog } from '../../context/CatalogContext'
import { useToast } from '../../context/ToastContext'
import { discountPercent, formatVnd } from '../../utils/format'
import { vietnamProvinces } from '../../data/locations'
import { IconArrowLeft } from '../../components/ui/Icons'
import { MallBadge, ShipBadge } from '../../components/ui/Badge'
import SmartImage from '../../components/ui/SmartImage'
import {
  apiCreateSellerProduct,
  apiUpdateSellerProduct,
  apiRegisterSellerShop,
} from '../../utils/api'

const EMPTY = {
  name: '',
  categoryId: 'nha-cua',
  price: '',
  originalPrice: '',
  stock: '100',
  sold: '0',
  emoji: '🛍️',
  description: '',
  variants: 'Mặc định',
  tags: ['freeship'],
}

const TAG_OPTIONS = [
  { id: 'mall', label: 'Nova Mall' },
  { id: 'favorites', label: 'Sản phẩm Yêu thích+' },
  { id: 'freeship', label: 'Miễn phí vận chuyển' },
  { id: 'extra', label: 'Freeship Extra' },
]

/**
 * TRANG ĐĂNG / SỬA SẢN PHẨM của người bán — Kết nối trực tiếp Backend API.
 * - /nguoi-ban/san-pham/them-moi   => thêm mới
 * - /nguoi-ban/san-pham/:productId => chỉnh sửa
 */
export default function SellerProductFormPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { user, token, applyShopRegistration } = useAuth()
  const { getProductById, upsertProduct, categories } = useCatalog()
  const { pushToast } = useToast()

  const editing = productId ? getProductById(productId) : null

  const [form, setForm] = useState(() =>
    editing
      ? {
          name: editing.name,
          categoryId: editing.categoryId,
          price: String(editing.price),
          originalPrice: String(editing.originalPrice || ''),
          stock: String(editing.stock),
          sold: String(editing.sold || 0),
          emoji: editing.emoji,
          description: editing.description || '',
          variants: (editing.variantGroups?.[0]?.options || ['Mặc định']).join(', '),
          tags: editing.tags || [],
          location: editing.location || 'TP. Hồ Chí Minh',
        }
      : { ...EMPTY, location: 'TP. Hồ Chí Minh' },
  )
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const toggleTag = (id) =>
    setForm((f) => ({ ...f, tags: f.tags.includes(id) ? f.tags.filter((t) => t !== id) : [...f.tags, id] }))

  const preview = {
    name: form.name || 'Tên sản phẩm của bạn',
    emoji: form.emoji || '🛍️',
    price: Number(form.price) || 0,
    originalPrice: Number(form.originalPrice) || 0,
    mall: form.tags.includes('mall'),
    freeship: form.tags.includes('freeship'),
    extraShip: form.tags.includes('extra'),
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Vui lòng nhập tên sản phẩm.')
    if (!Number(form.price)) return setError('Giá bán phải lớn hơn 0.')

    setError('')
    setIsSubmitting(true)

    try {
      const variantsList = form.variants
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)

      const variantsPayload =
        variantsList.length > 0
          ? variantsList.map((name, idx) => ({
              name,
              price: Number(form.price),
              originalPrice: Number(form.originalPrice) || Number(form.price),
              stock: Number(form.stock) || 0,
              sku: `SKU-${Date.now()}-${idx + 1}`,
            }))
          : [
              {
                name: 'Mặc định',
                price: Number(form.price),
                originalPrice: Number(form.originalPrice) || Number(form.price),
                stock: Number(form.stock) || 0,
                sku: `SKU-${Date.now()}-1`,
              },
            ]

      const payload = {
        name: form.name.trim(),
        categoryId: form.categoryId || 'nha-cua',
        description: form.description || '',
        freeShipping: form.tags.includes('freeship') || form.tags.includes('extra'),
        isFeatured: form.tags.includes('favorites'),
        isMall: form.tags.includes('mall'),
        variants: variantsPayload,
      }

      let activeToken = token
      // Tự động nâng cấp quyền seller và tạo shop nếu user là buyer mở kênh người bán
      if (activeToken && (!user?.shopId || user?.role !== 'seller')) {
        try {
          const regRes = await apiRegisterSellerShop(activeToken, {
            shopName: user?.shopName || user?.fullName || `Gian hàng của ${user?.username || 'tôi'}`,
            province: form.location || 'TP. Hồ Chí Minh',
          })
          const regData = await regRes.json().catch(() => null)
          if (regRes.ok && regData?.success && regData?.data?.token) {
            activeToken = regData.data.token
            applyShopRegistration?.({ token: activeToken, user: regData.data.user })
          }
        } catch (regErr) {
          console.warn('Tự động mở gian hàng thất bại:', regErr)
        }
      }

      let createdProduct = null

      if (activeToken) {
        if (editing?.id && /^\d+$/.test(String(editing.id))) {
          const res = await apiUpdateSellerProduct(activeToken, editing.id, payload)
          const data = await res.json().catch(() => null)
          if (!res.ok || !data?.success) {
            throw new Error(data?.message || 'Không thể cập nhật sản phẩm lên máy chủ.')
          }
        } else {
          const res = await apiCreateSellerProduct(activeToken, payload)
          const data = await res.json().catch(() => null)
          if (res.ok && data?.success) {
            createdProduct = data.data
          } else {
            throw new Error(data?.message || 'Không thể đăng sản phẩm lên máy chủ.')
          }
        }
      }

      // Luôn đồng bộ dữ liệu vào catalog context
      upsertProduct({
        id: createdProduct?.id ? String(createdProduct.id) : editing?.id,
        name: form.name.trim(),
        categoryId: form.categoryId,
        price: Number(form.price),
        originalPrice: Number(form.originalPrice) || Number(form.price),
        stock: Number(form.stock) || 0,
        sold: Number(form.sold) || 0,
        location: form.location,
        emoji: form.emoji || '🛍️',
        description: form.description,
        tags: form.tags,
        shopId: user?.shopId || (createdProduct?.shopId ? String(createdProduct.shopId) : '1'),
        variantGroups: variantsList.length ? [{ name: 'Phân loại', options: variantsList }] : [],
        specs: editing?.specs,
      })

      pushToast(editing ? 'Đã cập nhật sản phẩm thành công' : 'Đã đăng sản phẩm mới lên gian hàng thành công', 'success')
      navigate('/nguoi-ban/san-pham')
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi lưu sản phẩm.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = 'w-full rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand'

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-sm bg-white px-4 py-3">
        <Link to="/nguoi-ban/san-pham" className="flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-brand">
          <IconArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </Link>
        <h1 className="text-[16px] font-bold text-ink">{editing ? 'Chỉnh Sửa Sản Phẩm' : 'Đăng Sản Phẩm Mới'}</h1>
        <button
          type="submit"
          disabled={isSubmitting}
          className="ml-auto rounded-sm bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
        >
          {isSubmitting ? 'Đang xử lý...' : editing ? 'Lưu thay đổi' : 'Đăng sản phẩm'}
        </button>
      </div>

      {error ? <p className="rounded-sm bg-rose-50 px-4 py-2 text-[13px] text-rose-600">{error}</p> : null}

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <section className="rounded-sm border border-line bg-white p-4">
            <h2 className="mb-3 text-[14px] font-semibold text-ink">Thông tin cơ bản</h2>
            <div className="grid gap-3">
              <label className="text-[12px] text-muted">
                Tên sản phẩm *
                <input
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Ví dụ: Tai nghe Bluetooth chống ồn"
                  className={`mt-1 ${inputClass}`}
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-[12px] text-muted">
                  Ngành hàng
                  <select value={form.categoryId} onChange={set('categoryId')} className={`mt-1 ${inputClass}`}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[12px] text-muted">
                  Biểu tượng sản phẩm (emoji)
                  <input value={form.emoji} onChange={set('emoji')} className={`mt-1 ${inputClass}`} maxLength={4} />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-[12px] text-muted">
                  Giá bán (₫) *
                  <input
                    value={form.price}
                    onChange={set('price')}
                    inputMode="numeric"
                    placeholder="199000"
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="text-[12px] text-muted">
                  Giá gốc (₫)
                  <input
                    value={form.originalPrice}
                    onChange={set('originalPrice')}
                    inputMode="numeric"
                    placeholder="299000"
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-[12px] text-muted">
                  Số lượng trong kho
                  <input
                    value={form.stock}
                    onChange={set('stock')}
                    inputMode="numeric"
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
                <label className="text-[12px] text-muted">
                  Số lượng đã bán
                  <input value={form.sold} onChange={set('sold')} inputMode="numeric" className={`mt-1 ${inputClass}`} />
                </label>
                <label className="text-[12px] text-muted">
                  Gửi từ (Nơi bán)
                  <select value={form.location} onChange={set('location')} className={`mt-1 ${inputClass}`}>
                    {vietnamProvinces.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.region})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-sm border border-line bg-white p-4">
            <h2 className="mb-3 text-[14px] font-semibold text-ink">Mô tả &amp; phân loại</h2>
            <div className="grid gap-3">
              <label className="text-[12px] text-muted">
                Phân loại (cách nhau bằng dấu phẩy)
                <input
                  value={form.variants}
                  onChange={set('variants')}
                  placeholder="Size M, Size L, Màu Đen"
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] text-muted">
                Mô tả sản phẩm
                <textarea
                  value={form.description}
                  onChange={set('description')}
                  rows={6}
                  placeholder="Mô tả chi tiết về chất liệu, kích thước, bảo hành..."
                  className={`mt-1 resize-none ${inputClass}`}
                />
              </label>

              <div>
                <p className="text-[12px] text-muted">Nhãn hiển thị trên sàn</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {TAG_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={`rounded-full border px-3 py-1 text-[12px] transition ${
                        form.tags.includes(t.id)
                          ? 'border-brand bg-brand-soft font-medium text-brand'
                          : 'border-line text-ink-soft hover:border-brand'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Xem trước */}
        <aside className="h-fit space-y-3">
          <section className="rounded-sm border border-line bg-white p-4">
            <h2 className="mb-3 text-[14px] font-semibold text-ink">Xem trước trên sàn</h2>
            <div className="overflow-hidden rounded-sm border border-line">
              {editing?.image ? (
                <SmartImage src={editing.image} fallback={editing.image} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="grid h-40 w-full place-items-center bg-page text-[56px]">{preview.emoji}</div>
              )}
              <div className="p-2">
                <p className="line-clamp-2 text-[13px] text-ink">{preview.name}</p>
                <p className="mt-1 text-[15px] font-medium text-brand">
                  {formatVnd(preview.price)}
                  {preview.originalPrice > preview.price ? (
                    <span className="ml-2 text-[12px] text-muted line-through">{formatVnd(preview.originalPrice)}</span>
                  ) : null}
                </p>
                {preview.originalPrice > preview.price ? (
                  <p className="mt-1 text-[11px] font-semibold text-brand">
                    Giảm {discountPercent(preview.price, preview.originalPrice)}%
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {preview.mall ? <MallBadge /> : null}
                  {preview.freeship ? <ShipBadge type="freeship" /> : null}
                  {preview.extraShip ? <ShipBadge type="extra" /> : null}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-muted">
              Sản phẩm sẽ xuất hiện trong gian hàng của bạn và trong kết quả tìm kiếm của người mua ngay sau khi đăng.
            </p>
          </section>
        </aside>
      </div>
    </form>
  )
}
