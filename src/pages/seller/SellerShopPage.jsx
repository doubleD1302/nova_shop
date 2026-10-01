import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCatalog } from '../../context/CatalogContext'
import { useToast } from '../../context/ToastContext'
import { formatFollowers, formatNumber } from '../../utils/format'
import { shopAvatar } from '../../utils/image'
import { vietnamProvinces } from '../../data/locations'
import AvatarPicker from '../../components/ui/AvatarPicker'
import { IconCheck, IconEye, IconStore } from '../../components/ui/Icons'
import SmartImage from '../../components/ui/SmartImage'

/** THÔNG TIN GIAN HÀNG (người bán) — cập nhật tên, slogan, khu vực, ẢNH ĐẠI DIỆN GIAN HÀNG */
export default function SellerShopPage() {
  const { user } = useAuth()
  const { getShop, getProductsByShop, upsertProduct, updateShop } = useCatalog()
  const { pushToast } = useToast()

  const shop = getShop(user.shopId)
  const products = getProductsByShop(user.shopId)

  const [form, setForm] = useState(() => ({
    name: shop?.name || '',
    tagline: shop?.tagline || '',
    location: shop?.location || 'TP. Hồ Chí Minh',
    emoji: shop?.emoji || '🏪',
    hue: shop?.hue ?? 20,
    responseTime: shop?.responseTime || 'trong vài giờ',
    avatarUrl: shop?.avatarUrl || null,
  }))

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const inputClass = 'w-full rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand'
  const previewAvatar =
    form.avatarUrl || shopAvatar({ name: form.name || 'Shop', emoji: form.emoji, hue: Number(form.hue) || 20 })

  /** Lưu toàn bộ thông tin gian hàng (kể cả ảnh đại diện) */
  const save = () => {
    updateShop(shop.id, {
      name: form.name.trim() || shop.name,
      tagline: form.tagline,
      location: form.location,
      emoji: form.emoji,
      hue: Number(form.hue) || 20,
      responseTime: form.responseTime,
      avatarUrl: form.avatarUrl,
    })
    pushToast('Đã lưu thông tin gian hàng', 'success')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-sm bg-white px-4 py-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
          <IconStore className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-[16px] font-bold text-ink">Thông Tin Gian Hàng</h1>
          <p className="text-[12px] text-muted">Mỗi người bán sở hữu một gian hàng riêng trên ShopNova</p>
        </div>
        <Link
          to={`/shop/${shop?.id}`}
          className="ml-auto flex items-center gap-1.5 rounded-sm border border-line px-4 py-2 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
        >
          <IconEye className="h-4 w-4" />
          Xem gian hàng công khai
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <section className="rounded-sm border border-line bg-white p-4">
          <h2 className="mb-3 text-[14px] font-semibold text-ink">Ảnh đại diện gian hàng</h2>
          <AvatarPicker
            value={{ avatarUrl: form.avatarUrl, emoji: form.emoji, hue: Number(form.hue) || 20, name: form.name }}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            title="Ảnh đại diện gian hàng"
            note="Ảnh này hiển thị trên thẻ sản phẩm, trang shop và trong giỏ hàng của người mua."
          />

          <h2 className="mb-3 mt-5 text-[14px] font-semibold text-ink">Hồ sơ gian hàng</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-[12px] text-muted md:col-span-2">
              Tên gian hàng
              <input value={form.name} onChange={set('name')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-[12px] text-muted md:col-span-2">
              Slogan / giới thiệu
              <input value={form.tagline} onChange={set('tagline')} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-[12px] text-muted">
              Khu vực gửi hàng
              <select value={form.location} onChange={set('location')} className={`mt-1 ${inputClass}`}>
                {vietnamProvinces.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.region})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-muted">
              Thời gian phản hồi
              <select value={form.responseTime} onChange={set('responseTime')} className={`mt-1 ${inputClass}`}>
                {['trong vài phút', 'trong vài giờ', 'trong ngày', 'trong 2 ngày'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-muted">
              Biểu tượng gian hàng (emoji)
              <input value={form.emoji} onChange={set('emoji')} maxLength={4} className={`mt-1 ${inputClass}`} />
            </label>
            <label className="text-[12px] text-muted">
              Màu thương hiệu (0 - 360)
              <input
                type="range"
                min="0"
                max="360"
                value={form.hue}
                onChange={set('hue')}
                className="mt-3 w-full accent-[#ee4d2d]"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              className="flex items-center gap-1.5 rounded-sm bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
            >
              <IconCheck className="h-4 w-4" />
              Lưu thay đổi
            </button>
            <button
              type="button"
              onClick={() => {
                if (!products.length) {
                  pushToast('Chưa có sản phẩm nào để cập nhật', 'info')
                  return
                }
                products.forEach((p) => upsertProduct({ ...p, location: form.location }))
                pushToast(`Đã cập nhật khu vực gửi hàng cho ${products.length} sản phẩm`, 'success')
              }}
              className="rounded-sm border border-line px-4 py-2 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
            >
              Áp dụng khu vực gửi hàng cho toàn bộ sản phẩm
            </button>
          </div>

          <p className="mt-3 text-[11px] text-muted">
            Người bán: {user.fullName} · Tài khoản: @{user.username} · Mã gian hàng: {shop?.id}
          </p>
        </section>

        <aside className="h-fit space-y-3">
          <section className="rounded-sm border border-line bg-white p-4">
            <h2 className="mb-3 text-[14px] font-semibold text-ink">Xem trước</h2>
            <div className="overflow-hidden rounded-sm border border-line">
              <div
                className="h-[70px] w-full"
                style={{
                  backgroundImage: `linear-gradient(120deg, hsl(${form.hue} 80% 48%), hsl(${
                    (Number(form.hue) + 45) % 360
                  } 78% 62%))`,
                }}
              />
              <div className="-mt-7 px-3 pb-3">
                <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border-2 border-white bg-white">
                  <SmartImage
                    src={previewAvatar}
                    fallback={previewAvatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </span>
                <p className="mt-1.5 text-[14px] font-semibold text-ink">{form.name || 'Tên gian hàng'}</p>
                <p className="line-clamp-2 text-[12px] text-muted">{form.tagline || 'Slogan gian hàng'}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {form.location} · Phản hồi {form.responseTime}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-sm border border-line bg-white p-4">
            <h2 className="mb-3 text-[14px] font-semibold text-ink">Thống kê gian hàng</h2>
            <div className="space-y-2 text-[13px]">
              <p className="flex justify-between text-ink-soft">
                <span>Sản phẩm đang bán</span>
                <b className="text-ink">{formatNumber(products.length)}</b>
              </p>
              <p className="flex justify-between text-ink-soft">
                <span>Người theo dõi</span>
                <b className="text-ink">{formatFollowers(shop?.followers || 0)}</b>
              </p>
              <p className="flex justify-between text-ink-soft">
                <span>Đánh giá gian hàng</span>
                <b className="text-ink">{shop?.rating}/5</b>
              </p>
              <p className="flex justify-between text-ink-soft">
                <span>Tham gia từ</span>
                <b className="text-ink">{shop?.joined}</b>
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
