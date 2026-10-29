import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCatalog } from '../../context/CatalogContext'
import { useToast } from '../../context/ToastContext'
import { formatFollowers, formatNumber } from '../../utils/format'
import { vietnamProvinces } from '../../data/locations'
import AvatarPicker from '../../components/ui/AvatarPicker'
import { IconCheck, IconEye, IconStore } from '../../components/ui/Icons'
import SmartImage from '../../components/ui/SmartImage'
import { API_BASE_URL, apiUploadSellerImage } from '../../utils/api'

/**
 * THÔNG TIN GIAN HÀNG (NGƯỜI BÁN) - PHONG CÁCH SHOPEE SELLER CENTRE HỒNG PASTEL
 */
export default function SellerShopPage() {
  const { user } = useAuth()
  const { getShop, loadShop, updateShop } = useCatalog()
  const { pushToast } = useToast()
  const shop = getShop(user?.shopId)
  const [shopError, setShopError] = useState('')
  const bannerFileRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [bannerBusy, setBannerBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(() => ({
    name: shop?.name || '',
    tagline: shop?.tagline || '',
    description: shop?.description || '',
    address: shop?.address || '',
    location: shop?.location || 'TP. Hồ Chí Minh',
    avatarUrl: shop?.logoUrl || null,
    bannerUrl: shop?.bannerUrl || null,
  }))

  useEffect(() => {
    if (user?.shopId) {
      loadShop(user.shopId)
        .then(() => setShopError(''))
        .catch((err) => setShopError(err.message || 'Không thể tải gian hàng.'))
    }
  }, [loadShop, user?.shopId])

  useEffect(() => {
    if (!shop) return
    setForm({
      name: shop.name || '',
      tagline: shop.tagline || '',
      description: shop.description || '',
      address: shop.address || '',
      location: shop.location || 'TP. Hồ Chí Minh',
      avatarUrl: shop.logoUrl || null,
      bannerUrl: shop.bannerUrl || null,
    })
  }, [shop?.id])

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const inputClass =
    'w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3.5 py-2.5 text-[13px] text-[#49352D] outline-none transition focus:border-[#BD6E49] focus:ring-2 focus:ring-[#BD6E49]/20'
  const imageSrc = (url) => (url?.startsWith('/') ? `${API_BASE_URL}${url}` : url)

  const uploadBanner = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setError('Chọn ảnh PNG, JPG hoặc WebP có dung lượng tối đa 5 MB.')
      return
    }
    setBannerBusy(true)
    setError('')
    try {
      const response = await apiUploadSellerImage(file)
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success || !result?.data?.url) {
        throw new Error(result?.message || `Không thể tải ảnh bìa lên (HTTP ${response.status}).`)
      }
      setForm((current) => ({ ...current, bannerUrl: result.data.url }))
      pushToast('Đã tải ảnh bìa lên thành công', 'success')
    } catch (uploadError) {
      setError(uploadError.message || 'Không thể tải ảnh bìa lên.')
    } finally {
      setBannerBusy(false)
    }
  }

  const save = async () => {
    if (!shop) return
    setSaving(true)
    setError('')
    try {
      await updateShop(shop.id, {
        name: form.name.trim(),
        tagline: form.tagline,
        description: form.description,
        address: form.address,
        location: form.location,
        logoUrl: form.avatarUrl,
        bannerUrl: form.bannerUrl,
      })
      pushToast('Đã lưu thông tin gian hàng thành công', 'success')
    } catch (saveError) {
      setError(saveError.message || 'Không thể cập nhật gian hàng.')
    } finally {
      setSaving(false)
    }
  }

  if (!shop) {
    return (
      <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 text-[13px] text-[#8B7566]">
        {shopError || 'Đang tải thông tin gian hàng từ hệ thống...'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header trang */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] px-5 py-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F5E7D4] text-[#A95532]">
            <IconStore className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[18px] font-bold text-[#49352D]">Thông Tin Gian Hàng</h1>
            <p className="mt-0.5 text-[12px] text-[#8B7566]">
              Hồ sơ này hiển thị công khai tới người mua trên sàn NovaShop.
            </p>
          </div>
        </div>

        <Link
          to={`/shop/${shop.id}`}
          className="flex items-center gap-1.5 rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-4 py-2 text-[13px] font-medium text-[#8B7566] transition hover:border-[#BD6E49] hover:text-[#A95532] hover:bg-[#FBF3E8]"
        >
          <IconEye className="h-4 w-4" />
          <span>Xem gian hàng công khai</span>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Form chỉnh sửa chính */}
        <section className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
          <h2 className="mb-3 text-[15px] font-bold text-[#49352D]">Ảnh đại diện gian hàng (Logo)</h2>
          <AvatarPicker
            value={{ avatarUrl: imageSrc(form.avatarUrl) }}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            title="Ảnh đại diện gian hàng"
            note="Tải ảnh logo vuông hoặc tròn, tỷ lệ 1:1, tối đa 5 MB."
          />

          {/* Ảnh bìa gian hàng */}
          <div className="mt-5 rounded-2xl border border-[#E6D5C2] bg-[#FBF3E8] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold text-[#49352D]">Ảnh bìa gian hàng (Banner)</h3>
                <p className="mt-0.5 text-[11px] text-[#8B7566]">Khuyến nghị kích thước 1200 x 300 px (tối đa 5 MB)</p>
              </div>
              <div className="flex gap-2">
                {form.bannerUrl ? (
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, bannerUrl: null }))}
                    className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3 py-1.5 text-[12px] text-[#8B7566] hover:text-rose-600"
                  >
                    Xóa
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={bannerBusy}
                  className="rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-3.5 py-1.5 text-[12px] font-medium text-[#FFFCF7] transition disabled:opacity-60 shadow-2xs"
                >
                  {bannerBusy ? 'Đang tải...' : 'Tải ảnh bìa'}
                </button>
              </div>
              <input
                ref={bannerFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={uploadBanner}
                className="hidden"
              />
            </div>
            <SmartImage
              src={imageSrc(form.bannerUrl)}
              alt="Ảnh bìa gian hàng"
              className="h-32 w-full rounded-xl object-cover border border-[#E6D5C2]"
            />
          </div>

          <h2 className="mb-3 mt-6 text-[15px] font-bold text-[#49352D]">Hồ sơ gian hàng</h2>
          <div className="grid gap-3.5 md:grid-cols-2">
            <label className="text-[12px] font-medium text-[#8B7566] md:col-span-2">
              Tên gian hàng
              <input value={form.name} onChange={set('name')} maxLength={160} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-[12px] font-medium text-[#8B7566] md:col-span-2">
              Slogan / Lời giới thiệu ngắn
              <input value={form.tagline} onChange={set('tagline')} maxLength={255} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-[12px] font-medium text-[#8B7566] md:col-span-2">
              Mô tả chi tiết gian hàng
              <textarea
                value={form.description}
                onChange={set('description')}
                maxLength={5000}
                rows={4}
                className={`mt-1 ${inputClass} resize-y`}
              />
            </label>
            <label className="text-[12px] font-medium text-[#8B7566] md:col-span-2">
              Địa chỉ kho / liên hệ
              <input value={form.address} onChange={set('address')} maxLength={255} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-[12px] font-medium text-[#8B7566] md:col-span-2">
              Tỉnh / Thành phố gửi hàng
              <select value={form.location} onChange={set('location')} className={`mt-1 ${inputClass}`}>
                {vietnamProvinces.map((province) => (
                  <option key={province.name} value={province.name}>
                    {province.name} ({province.region})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-5 py-2.5 text-[13px] font-semibold text-[#FFFCF7] shadow-2xs transition disabled:opacity-60"
            >
              <IconCheck className="h-4 w-4" />
              {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </button>
          </div>

          {error ? (
            <p className="mt-3 rounded-xl border border-[#E6D5C2] bg-[#F5E7D4] px-3.5 py-2 text-[12px] text-[#A95532]">
              {error}
            </p>
          ) : null}

          <p className="mt-4 text-[11px] text-[#8B7566]">
            Chủ sở hữu: {user.fullName} · Tài khoản: @{user.username} · ID: #{shop.id}
          </p>
        </section>

        {/* Cột Xem trước & Thống kê */}
        <aside className="h-fit space-y-4">
          <section className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
            <h2 className="mb-3 text-[14px] font-bold text-[#49352D]">Xem trước giao diện Shop</h2>
            <div className="overflow-hidden rounded-xl border border-[#E6D5C2]">
              <SmartImage
                src={imageSrc(form.bannerUrl)}
                alt="Ảnh bìa gian hàng"
                className="h-20 w-full object-cover"
              />
              <div className="-mt-7 px-3 pb-3">
                <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border-2 border-[#FFFCF7] bg-[#FFFCF7] shadow-xs">
                  <SmartImage
                    src={imageSrc(form.avatarUrl)}
                    alt="Ảnh đại diện gian hàng"
                    className="h-full w-full object-cover"
                  />
                </span>
                <p className="mt-2 text-[14px] font-bold text-[#49352D]">{form.name || 'Tên gian hàng'}</p>
                <p className="line-clamp-2 text-[12px] text-[#8B7566]">{form.tagline || 'Chưa có giới thiệu'}</p>
                <p className="mt-1 text-[11px] text-[#A95532] font-medium">{form.location}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 shadow-2xs">
            <h2 className="mb-3 text-[14px] font-bold text-[#49352D]">Thống kê gian hàng</h2>
            <div className="space-y-2.5 text-[13px]">
              <p className="flex justify-between text-[#8B7566]">
                <span>Sản phẩm đang bán</span>
                <b className="text-[#49352D]">{formatNumber(shop.productCount || 0)}</b>
              </p>
              <p className="flex justify-between text-[#8B7566]">
                <span>Người theo dõi</span>
                <b className="text-[#49352D]">{formatFollowers(shop.followers || 0)}</b>
              </p>
              <p className="flex justify-between text-[#8B7566]">
                <span>Đánh giá gian hàng</span>
                <b className="text-[#49352D]">
                  {Number(shop.rating || 0).toFixed(1)} / 5 ({formatNumber(shop.ratingCount || 0)})
                </b>
              </p>
              <p className="flex justify-between text-[#8B7566]">
                <span>Tham gia từ</span>
                <b className="text-[#49352D]">{shop.joined || '—'}</b>
              </p>
              <p className="flex justify-between text-[#8B7566]">
                <span>Đã bán</span>
                <b className="text-[#49352D]">{formatNumber(shop.totalSold || 0)}</b>
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
