import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCatalog } from '../../context/CatalogContext'
import { useToast } from '../../context/ToastContext'
import { discountPercent, formatVnd } from '../../utils/format'
import { IconArrowLeft } from '../../components/ui/Icons'
import { ShipBadge } from '../../components/ui/Badge'
import { API_BASE_URL, apiSearchSellerImages, apiUploadSellerImage } from '../../utils/api'

const EMPTY = {
  name: '', categoryId: '', price: '', originalPrice: '', stock: '0',
  description: '', status: 'draft', freeShipping: false,
}
const IMAGE_ROLES = [
  '1. Ảnh chính (Mặt trước - Đại diện)',
  '2. Góc bên cạnh / Phía sau',
  '3. Cận cảnh chi tiết sản phẩm',
  '4. Góc khác / Bối cảnh thực tế'
]

function toForm(product) {
  return {
    name: product.name,
    categoryId: product.categoryId,
    price: String(product.price),
    originalPrice: String(product.originalPrice || ''),
    stock: String(product.variants?.[0]?.stock ?? product.stock ?? 0),
    description: product.description || '',
    status: ['draft', 'active', 'hidden'].includes(product.status) ? product.status : 'draft',
    freeShipping: Boolean(product.freeship),
  }
}

/** TRANG ĐĂNG / SỬA SẢN PHẨM của người bán. */
export default function SellerProductFormPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getProductById, getShop, upsertProduct, categories, loadCategories, loadSellerProducts, sellerCatalogLoading, catalogError, sellerCatalogError } = useCatalog()
  const { pushToast } = useToast()
  const fileRef = useRef(null)
  const editing = productId ? getProductById(productId) : null
  const shop = getShop(user?.shopId)
  const isShopSuspended = shop?.status === 'suspended'

  const [form, setForm] = useState(() => editing ? toForm(editing) : { ...EMPTY })
  const [images, setImages] = useState(() => (editing?.images || []).filter((image) => image?.url).map((image) => ({ ...image })))
  const [imageStatus, setImageStatus] = useState({})
  const [searchResults, setSearchResults] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCategories().catch((error) => console.error('Could not load categories:', error))
    if (productId) loadSellerProducts({ productId, limit: 1, force: true }).catch((error) => console.error('Could not load seller product:', error))
  }, [productId, loadCategories, loadSellerProducts])

  useEffect(() => {
    if (!editing) return
    setForm(toForm(editing))
    setImages((editing.images || []).filter((image) => image?.url).map((image) => ({ ...image })))
    setImageStatus({})
  }, [editing?.id])

  useEffect(() => {
    if (!productId && !form.categoryId && categories.length) {
      setForm((current) => ({ ...current, categoryId: categories[0].id }))
    }
  }, [productId, form.categoryId, categories])

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const imageSrc = (url) => url?.startsWith('/') ? `${API_BASE_URL}${url}` : url
  const categoryName = categories.find((category) => category.id === form.categoryId || category.slug === form.categoryId)?.name || ''
  const preview = {
    name: form.name || 'Tên sản phẩm của bạn',
    price: Number(form.price) || 0,
    originalPrice: Number(form.originalPrice) || 0,
    freeship: form.freeShipping,
  }

  const setImageLoaded = (key, loaded) => setImageStatus((current) => ({ ...current, [key]: loaded }))

  const addUploads = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    const remaining = 4 - images.length
    if (files.length > remaining) {
      setError(`Sản phẩm chỉ cần đúng 4 ảnh. Hiện còn ${remaining} vị trí.`)
      return
    }
    try {
      const newItems = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
          reject(new Error('Chỉ nhận ảnh PNG, JPG hoặc WebP, tối đa 5 MB mỗi ảnh.'))
          return
        }
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'))
        reader.onload = () => resolve({ url: '', dataUrl: reader.result, file, altText: form.name.trim() })
        reader.readAsDataURL(file)
      })))
      setImages((current) => [...current, ...newItems])
      setError('')
    } catch (uploadError) {
      setError(uploadError.message)
    }
  }

  const searchImages = async (event) => {
    event?.preventDefault()
    const query = searchQuery.trim() || [form.name.trim(), categoryName].filter(Boolean).join(' ')
    if (query.length < 3) {
      setError('Nhập tên sản phẩm hoặc cụm từ tìm kiếm tối thiểu 3 ký tự.')
      return
    }
    setSearching(true)
    setError('')
    setSearchResults([])
    try {
      const response = await apiSearchSellerImages(query)
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success || !Array.isArray(payload?.data?.images)) {
        throw new Error(payload?.message || `Không thể tìm ảnh (HTTP ${response.status}).`)
      }
      setSearchResults(payload.data.images)
      if (!payload.data.images.length) setError('Không tìm được ảnh có giấy phép phù hợp. Hãy đổi từ khóa hoặc tải ảnh bạn có quyền sử dụng lên.')
    } catch (searchError) {
      setError(searchError.message || 'Không thể kết nối nguồn ảnh.')
    } finally {
      setSearching(false)
    }
  }

  const selectCommonsImage = (result) => {
    if (images.length >= 4) return setError('Đã đủ 4 ảnh. Xóa một ảnh trước khi thay thế.')
    if (images.some((image) => image.url === result.url || image.sourcePageUrl === result.sourcePageUrl)) {
      return setError('Ảnh này đã được chọn rồi.')
    }
    if (imageStatus[result.url] !== true) return setError('Ảnh chưa tải xem trước được nên chưa thể chọn.')
    setImages((current) => [...current, {
      url: result.url,
      sourcePageUrl: result.sourcePageUrl,
      author: result.author,
      licenseName: result.licenseName,
      licenseUrl: result.licenseUrl,
      altText: form.name.trim() || result.title,
      title: result.title,
    }])
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (isShopSuspended) {
      pushToast(`Gian hàng đang bị tạm khóa: ${shop?.suspensionReason || 'Vi phạm chính sách'}. Không thể lưu sản phẩm.`, 'error')
      setError(`Gian hàng đang bị tạm khóa: ${shop?.suspensionReason || 'Vi phạm chính sách'}. Không thể đăng hoặc lưu sản phẩm.`)
      return
    }
    if (!form.name.trim()) return setError('Vui lòng nhập tên sản phẩm.')
    if (!form.categoryId) return setError('Vui lòng chọn ngành hàng.')
    if (!form.description.trim()) return setError('Vui lòng nhập mô tả sản phẩm.')
    if (!Number.isSafeInteger(Number(form.price)) || Number(form.price) < 1) return setError('Giá bán phải là số nguyên lớn hơn 0.')
    if (form.originalPrice && (!Number.isSafeInteger(Number(form.originalPrice)) || Number(form.originalPrice) < Number(form.price))) {
      return setError('Giá gốc phải là số nguyên bằng hoặc cao hơn giá bán.')
    }
    if (!Number.isSafeInteger(Number(form.stock)) || Number(form.stock) < 0) return setError('Tồn kho phải là số nguyên từ 0 trở lên.')
    if (images.length !== 4) return setError(`Cần đủ đúng 4 ảnh khác nhau trước khi lưu. Hiện có ${images.length}/4.`)
    if (images.some((image) => imageStatus[image.dataUrl || image.url] !== true)) {
      return setError('Có ảnh chưa tải được hoặc URL ảnh đã lỗi. Hãy xóa ảnh đó rồi chọn ảnh khác.')
    }

    setSaving(true)
    setError('')
    try {
      const savedImages = []
      for (const image of images) {
        if (!image.file) {
          savedImages.push(image)
          continue
        }
        const response = await apiUploadSellerImage(image.dataUrl)
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success || !payload?.data?.url) {
          throw new Error(payload?.message || `Không thể tải ảnh lên (HTTP ${response.status}).`)
        }
        savedImages.push({ url: payload.data.url, altText: form.name.trim() })
      }

      await upsertProduct({
        id: editing?.id,
        name: form.name.trim(),
        categoryId: form.categoryId,
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        stock: Number(form.stock),
        description: form.description.trim(),
        status: form.status,
        images: savedImages,
        freeShipping: form.freeShipping,
      })
      pushToast(editing ? 'Đã cập nhật sản phẩm' : 'Đã đăng sản phẩm', 'success')
      navigate('/nguoi-ban/san-pham')
    } catch (saveError) {
      setError(saveError.message || 'Không thể lưu sản phẩm.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3.5 py-2.5 text-[13px] text-[#49352D] outline-none transition focus:border-[#BD6E49] focus:ring-2 focus:ring-[#BD6E49]/20'
  if (productId && sellerCatalogLoading && !editing) {
    return (
      <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 text-[13px] text-[#8B7566]">
        Đang tải sản phẩm...
      </div>
    )
  }
  if (productId && !editing && !sellerCatalogLoading) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-[13px] text-rose-700">
        {catalogError || 'Không tìm thấy sản phẩm thuộc gian hàng của bạn.'}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {isShopSuspended ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-800">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <span>⚠️ Gian hàng của bạn hiện đang bị tạm khóa</span>
          </div>
          <p className="mt-1">
            <b>Lý do:</b> {shop?.suspensionReason || 'Vi phạm tiêu chuẩn cộng đồng hoặc chính sách sàn.'}
          </p>
          <p className="mt-1 text-[12px] text-rose-700">
            Tính năng đăng và cập nhật sản phẩm tạm thời bị hạn chế. Vui lòng liên hệ Quản trị viên để được hỗ trợ mở khóa.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] px-5 py-4 shadow-2xs">
        <Link
          to="/nguoi-ban/san-pham"
          className="flex items-center gap-1.5 text-[13px] font-medium text-[#8B7566] transition hover:text-[#A95532]"
        >
          <IconArrowLeft className="h-4 w-4" /> Quay lại danh sách
        </Link>
        <h1 className="text-[18px] font-bold text-[#49352D]">
          {editing ? 'Chỉnh Sửa Sản Phẩm' : 'Đăng Sản Phẩm Mới'}
        </h1>
        <button
          type="submit"
          disabled={saving || isShopSuspended}
          title={isShopSuspended ? 'Gian hàng đang bị tạm khóa' : undefined}
          className="ml-auto rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-5 py-2.5 text-[13px] font-semibold text-[#FFFCF7] shadow-2xs transition disabled:opacity-60"
        >
          {saving ? 'Đang lưu...' : isShopSuspended ? 'Gian hàng bị khóa' : editing ? 'Lưu thay đổi' : 'Đăng sản phẩm'}
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-[#E6D5C2] bg-[#F5E7D4] px-4 py-2.5 text-[13px] text-[#A95532]">
          {error}
        </p>
      ) : null}

      {editing?.approvalStatus === 'rejected' ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-[14px]">
            <span>✕ Sản phẩm này đã bị Ban Quản Trị từ chối kiểm duyệt</span>
          </div>
          <p className="mt-1.5 text-[13px] text-rose-800">
            <b>Lý do từ chối:</b> {editing.rejectionReason || 'Vui lòng cập nhật lại thông tin/hình ảnh phù hợp chính sách sàn.'}
          </p>
          <p className="mt-1.5 text-[11px] text-rose-600">
            💡 <i>Ghi chú: Khi bạn thực hiện chỉnh sửa và nhấn "Lưu thay đổi", hệ thống sẽ tự động chuyển sản phẩm về trạng thái "Chờ duyệt" và gửi lại cho Admin kiểm tra.</i>
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="space-y-4 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
            <h2 className="text-[15px] font-bold text-[#49352D]">Thông tin cơ bản sản phẩm</h2>
            <label className="block text-[12px] font-medium text-[#8B7566]">
              Tên sản phẩm *
              <input
                value={form.name}
                onChange={set('name')}
                maxLength={200}
                placeholder="Ví dụ: Áo sơ mi cotton nam phong cách Hàn Quốc"
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
            <label className="block text-[12px] font-medium text-[#8B7566]">
              Ngành hàng *
              <select value={form.categoryId} onChange={set('categoryId')} className={`mt-1.5 ${inputClass}`}>
                <option value="">Chọn ngành hàng</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3.5 md:grid-cols-2">
              <label className="text-[12px] font-medium text-[#8B7566]">
                Giá bán (₫) *
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.price}
                  onChange={set('price')}
                  className={`mt-1.5 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] font-medium text-[#8B7566]">
                Giá gốc niêm yết (₫)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.originalPrice}
                  onChange={set('originalPrice')}
                  className={`mt-1.5 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] font-medium text-[#8B7566]">
                Tồn kho *
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={set('stock')}
                  className={`mt-1.5 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] font-medium text-[#8B7566]">
                Trạng thái hiển thị
                <select value={form.status} onChange={set('status')} className={`mt-1.5 ${inputClass}`}>
                  {editing?.status === 'active' ? <option value="active">Đang bán</option> : null}
                  <option value="draft">Bản nháp</option>
                  <option value="hidden">Ẩn khỏi trang mua sắm</option>
                </select>
                {!editing || editing.status !== 'active' ? (
                  <span className="mt-1 block text-[11px] font-normal text-muted">
                    Sản phẩm mới cần quản trị viên duyệt trước khi được hiển thị.
                  </span>
                ) : null}
              </label>
            </div>
            <label className="block text-[12px] font-medium text-[#8B7566]">
              Mô tả chi tiết sản phẩm *
              <textarea
                value={form.description}
                onChange={set('description')}
                rows={5}
                maxLength={10000}
                placeholder="Mô tả chất liệu, kích thước, bảo hành và thông tin quan trọng khác..."
                className={`mt-1.5 resize-y ${inputClass}`}
              />
            </label>
            <label className="flex items-center gap-2 text-[13px] text-[#49352D]">
              <input
                type="checkbox"
                checked={form.freeShipping}
                onChange={(event) =>
                  setForm((current) => ({ ...current, freeShipping: event.target.checked }))
                }
                className="h-4 w-4 rounded border-[#E6D5C2] text-[#A95532] focus:ring-[#BD6E49]"
              />
              Miễn phí vận chuyển (Freeship)
            </label>
          </section>

          <section className="space-y-4 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
            <div>
              <h2 className="text-[15px] font-bold text-[#49352D]">
                Hình ảnh sản phẩm ({images.length}/4)
              </h2>
              <div className="mt-2 rounded-xl bg-[#F5E7D4] border border-[#E6D5C2] p-3 text-[12px] leading-relaxed text-[#49352D]">
                <p className="font-semibold text-[#A95532]">Quy định chuẩn 4 góc chụp thật:</p>
                <ul className="mt-1 list-disc list-inside space-y-0.5 text-[#8B7566]">
                  <li>Mỗi sản phẩm phải có <b>đúng 4 ảnh của chính sản phẩm đó</b> (cùng thương hiệu, model, màu sắc).</li>
                  <li>Vị trí 1: Ảnh đại diện góc chính. Vị trí 2: Góc nghiêng / sau. Vị trí 3: Cận cảnh. Vị trí 4: Thực tế.</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((image, index) => {
                const key = image.dataUrl || image.url
                const src = image.dataUrl || imageSrc(image.url)
                return (
                  <div key={`${key}-${index}`} className="overflow-hidden rounded-xl border border-[#E6D5C2]">
                    <div className="relative aspect-square bg-[#FBF3E8]">
                      {imageStatus[key] === false ? (
                        <div className="grid h-full place-items-center px-2 text-center text-[11px] text-rose-600">
                          Không tải được ảnh
                        </div>
                      ) : null}
                      <img
                        src={src}
                        alt={image.altText || form.name}
                        onLoad={() => setImageLoaded(key, true)}
                        onError={() => setImageLoaded(key, false)}
                        className={`h-full w-full object-cover ${imageStatus[key] === false ? 'hidden' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))
                        }
                        className="absolute right-1.5 top-1.5 rounded-lg bg-[#FFFCF7]/90 px-2 py-0.5 text-[11px] font-medium text-rose-600 shadow-xs"
                      >
                        Xóa
                      </button>
                    </div>
                    <p className="truncate border-t border-[#E6D5C2] bg-[#FBF3E8] px-2 py-1 text-center text-[10px] font-medium text-[#8B7566]">
                      {IMAGE_ROLES[index]}
                    </p>
                  </div>
                )
              })}
              {images.length < 4 ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-[#BD6E49]/60 bg-[#F5E7D4]/50 px-2 text-center text-[12px] font-medium text-[#A95532] transition hover:bg-[#F5E7D4]"
                >
                  + Tải ảnh lên
                </button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={addUploads}
              className="hidden"
            />

            <div className="flex flex-col gap-2 sm:flex-row pt-2">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={form.name || 'Tìm ảnh trên Wikimedia Commons...'}
                className={`flex-1 ${inputClass}`}
              />
              <button
                type="button"
                onClick={() => searchImages()}
                disabled={searching || images.length >= 4}
                className="rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-4 py-2 text-[12px] font-medium text-[#FFFCF7] transition disabled:opacity-50 shadow-2xs shrink-0"
              >
                {searching ? 'Đang tìm...' : 'Tìm ảnh Commons'}
              </button>
            </div>

            {searchResults.length ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 pt-2">
                {searchResults.map((result) => {
                  const selected = images.some((image) => image.sourcePageUrl === result.sourcePageUrl)
                  const loaded = imageStatus[result.url] === true
                  return (
                    <article key={result.sourcePageUrl} className="overflow-hidden rounded-xl border border-[#E6D5C2]">
                      <div className="aspect-[4/3] bg-[#FBF3E8]">
                        {imageStatus[result.url] === false ? (
                          <div className="grid h-full place-items-center p-3 text-center text-[11px] text-[#8B7566]">
                            Ảnh lỗi
                          </div>
                        ) : null}
                        <img
                          src={result.url}
                          alt={result.title}
                          loading="lazy"
                          onLoad={() => setImageLoaded(result.url, true)}
                          onError={() => setImageLoaded(result.url, false)}
                          className={`h-full w-full object-contain ${imageStatus[result.url] === false ? 'hidden' : ''}`}
                        />
                      </div>
                      <div className="space-y-1 p-2">
                        <p className="line-clamp-2 text-[11px] font-medium text-[#49352D]">{result.title}</p>
                        <button
                          type="button"
                          disabled={!loaded || selected || images.length >= 4}
                          onClick={() => selectCommonsImage(result)}
                          className="w-full rounded-lg border border-[#E6D5C2] py-1 text-[11px] font-medium text-[#A95532] hover:bg-[#F5E7D4] disabled:text-[#8B7566]"
                        >
                          {selected ? 'Đã chọn' : loaded ? 'Chọn ảnh' : 'Đang tải...'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="h-fit space-y-4">
          <section className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
            <h2 className="mb-3 text-[14px] font-bold text-[#49352D]">Xem trước trên sàn</h2>
            <div className="overflow-hidden rounded-xl border border-[#E6D5C2]">
              {images[0] ? (
                <img
                  src={images[0].dataUrl || imageSrc(images[0].url)}
                  alt={preview.name}
                  className="h-44 w-full bg-[#FBF3E8] object-cover"
                />
              ) : (
                <div className="grid h-44 place-items-center bg-[#FBF3E8] text-[12px] text-[#8B7566]">
                  Chưa có ảnh
                </div>
              )}
              <div className="p-3">
                <p className="line-clamp-2 text-[13px] font-medium text-[#49352D]">{preview.name || 'Tên sản phẩm'}</p>
                <p className="mt-1.5 text-[15px] font-bold text-[#A95532]">
                  {formatVnd(preview.price)}
                  {preview.originalPrice > preview.price ? (
                    <span className="ml-2 text-[12px] text-[#8B7566] line-through">
                      {formatVnd(preview.originalPrice)}
                    </span>
                  ) : null}
                </p>
                {preview.originalPrice > preview.price ? (
                  <p className="mt-1 text-[11px] font-semibold text-[#A95532]">
                    Giảm {discountPercent(preview.price, preview.originalPrice)}%
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-[#8B7566]">
              Trạng thái “Đang bán” sẽ hiển thị sản phẩm trên toàn bộ sàn NovaShop ngay sau khi lưu.
            </p>
          </section>
        </aside>
      </div>
    </form>
  )
}
