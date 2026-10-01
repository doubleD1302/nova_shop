import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCatalog } from '../context/CatalogContext'
import { useOrders } from '../context/OrderContext'
import { useToast } from '../context/ToastContext'
import { formatNumber, formatVnd } from '../utils/format'
import { vietnamProvinces } from '../data/locations'
import Breadcrumb from '../components/ui/Breadcrumb'
import AvatarPicker from '../components/ui/AvatarPicker'
import { IconHeart, IconPackage, IconStore, IconUser } from '../components/ui/Icons'
import SmartImage from '../components/ui/SmartImage'

const TABS = [
  { id: 'profile', label: 'Hồ sơ', icon: <IconUser className="h-4 w-4" /> },
  { id: 'address', label: 'Địa chỉ nhận hàng', icon: <IconPackage className="h-4 w-4" /> },
  { id: 'shop', label: 'Gian hàng của tôi', icon: <IconStore className="h-4 w-4" /> },
]

/** TRANG TÀI KHOẢN — hồ sơ, địa chỉ, thông tin gian hàng (nếu là người bán) */
export default function AccountPage() {
  const { user, avatar, updateProfile, allUsers } = useAuth()
  const { getShop, getProductsByShop, followedShopIds } = useCatalog()
  const { getOrdersByBuyer } = useOrders()
  const { pushToast } = useToast()
  const [tab, setTab] = useState('profile')

  if (!user) {
    return (
      <div className="rounded-sm border border-line bg-white px-6 py-16 text-center">
        <p className="text-[15px] font-semibold text-ink">Bạn chưa đăng nhập</p>
        <Link
          to="/dang-nhap"
          className="mt-4 inline-block rounded-sm bg-brand px-5 py-2.5 text-[13px] font-medium text-white"
        >
          Đăng nhập ngay
        </Link>
      </div>
    )
  }

  const address = user.address || {}
  const shop = user.shopId ? getShop(user.shopId) : null
  const shopProducts = user.shopId ? getProductsByShop(user.shopId) : []
  const orders = getOrdersByBuyer(user.id)
  const spent = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)
  const setAddressField = (key) => (e) => updateProfile({ address: { ...address, [key]: e.target.value } })
  const inputClass = 'w-full rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand'

  return (
    <div>
      <Breadcrumb className="mb-2" items={[{ label: 'Trang chủ', to: '/' }, { label: 'Tài khoản của tôi' }]} />

      <div className="flex flex-wrap items-center gap-4 rounded-sm bg-white px-4 py-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-line">
          <SmartImage src={avatar} fallback={avatar} alt="" className="h-full w-full object-cover" />
        </span>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-ink">{user.fullName}</p>
          <p className="text-[12px] text-muted">
            @{user.username} · {user.email} · {user.role === 'seller' ? 'Người bán' : 'Người mua'}
          </p>
          <span className="mt-1 inline-block rounded-sm bg-brand-soft px-2 py-[2px] text-[11px] text-brand">
            {user.rank}
          </span>
        </div>

        <div className="ml-auto grid grid-cols-3 gap-4 text-center">
          <span>
            <b className="block text-[16px] text-brand">{orders.length}</b>
            <span className="text-[11px] text-muted">Đơn hàng</span>
          </span>
          <span>
            <b className="block text-[16px] text-brand">{formatVnd(spent)}</b>
            <span className="text-[11px] text-muted">Đã chi tiêu</span>
          </span>
          <span>
            <b className="flex items-center justify-center gap-1 text-[16px] text-brand">
              <IconHeart className="h-4 w-4" />
              {followedShopIds.length}
            </b>
            <span className="text-[11px] text-muted">Shop theo dõi</span>
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[200px_1fr]">
        <aside className="h-fit rounded-sm border border-line bg-white p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-[13px] transition ${
                tab === t.id ? 'bg-brand-soft font-medium text-brand' : 'text-ink-soft hover:text-brand'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          <Link
            to={user.role === 'seller' ? '/nguoi-ban' : '/dang-ky'}
            className="mt-1 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-ink-soft transition hover:text-brand"
          >
            <IconStore className="h-4 w-4" />
            {user.role === 'seller' ? 'Kênh Người Bán' : 'Đăng ký bán hàng'}
          </Link>
        </aside>

        <section className="rounded-sm border border-line bg-white p-4">
          {tab === 'profile' ? (
            <div className="max-w-[720px] space-y-4">
              {/* ĐỔI ẢNH ĐẠI DIỆN */}
              <AvatarPicker
                value={{
                  avatarUrl: user.avatarUrl,
                  emoji: user.avatarEmoji,
                  hue: user.hue,
                  name: user.fullName,
                }}
                onChange={(patch) => {
                  updateProfile(patch)
                  pushToast('Đã cập nhật ảnh đại diện', 'success')
                }}
                title="Ảnh đại diện của bạn"
                note="Tải ảnh từ máy tính, hoặc chọn biểu tượng và màu nền. Ảnh đổi ngay trên header và đơn hàng."
              />

              <div className="grid gap-3 md:grid-cols-2">
              <label className="text-[12px] text-muted">
                Họ và tên
                <input
                  value={user.fullName}
                  onChange={(e) => updateProfile({ fullName: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] text-muted">
                Số điện thoại
                <input
                  value={user.phone || ''}
                  onChange={(e) => updateProfile({ phone: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] text-muted md:col-span-2">
                Email
                <input
                  value={user.email || ''}
                  onChange={(e) => updateProfile({ email: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] text-muted md:col-span-2">
                Danh xưng hiển thị
                <input
                  value={user.rank || ''}
                  onChange={(e) => updateProfile({ rank: e.target.value })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => pushToast('Đã lưu thông tin hồ sơ', 'success')}
                  className="rounded-sm bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
                >
                  Lưu thay đổi
                </button>
              </div>
              </div>
            </div>
          ) : null}

          {tab === 'address' ? (
            <div className="grid max-w-[720px] gap-3 md:grid-cols-2">
              <label className="text-[12px] text-muted">
                Người nhận
                <input
                  value={address.fullName || ''}
                  onChange={setAddressField('fullName')}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] text-muted">
                Số điện thoại
                <input value={address.phone || ''} onChange={setAddressField('phone')} className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-[12px] text-muted">
                Tỉnh / Thành phố
                <select
                  value={address.province || ''}
                  onChange={setAddressField('province')}
                  className={`mt-1 ${inputClass}`}
                >
                  <option value="">Chọn Tỉnh / Thành phố</option>
                  {vietnamProvinces.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] text-muted">
                Quận / Huyện
                <input
                  value={address.district || ''}
                  onChange={setAddressField('district')}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] text-muted">
                Phường / Xã
                <input value={address.ward || ''} onChange={setAddressField('ward')} className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-[12px] text-muted">
                Địa chỉ chi tiết
                <input
                  value={address.detail || ''}
                  onChange={setAddressField('detail')}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => pushToast('Đã lưu địa chỉ nhận hàng', 'success')}
                  className="rounded-sm bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
                >
                  Lưu địa chỉ
                </button>
              </div>
            </div>
          ) : null}

          {tab === 'shop' ? (
            shop ? (
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-line">
                    <SmartImage src={shop.avatar} fallback={shop.avatar} alt="" className="h-full w-full object-cover" />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-ink">{shop.name}</p>
                    <p className="text-[12px] text-muted">{shop.tagline}</p>
                  </div>
                  <Link
                    to={`/shop/${shop.id}`}
                    className="ml-auto rounded-sm border border-line px-3 py-1.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
                  >
                    Xem gian hàng
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Sản phẩm đang bán', value: formatNumber(shopProducts.length) },
                    { label: 'Người theo dõi', value: formatNumber(shop.followers) },
                    { label: 'Đánh giá shop', value: `${shop.rating}/5` },
                  ].map((s) => (
                    <div key={s.label} className="rounded-sm border border-line bg-page/60 px-3 py-2">
                      <p className="text-[16px] font-semibold text-brand">{s.value}</p>
                      <p className="text-[11px] text-muted">{s.label}</p>
                    </div>
                  ))}
                </div>
                <Link
                  to="/nguoi-ban"
                  className="mt-4 inline-block rounded-sm bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
                >
                  Vào Kênh Người Bán
                </Link>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[14px] font-medium text-ink">Bạn chưa có gian hàng</p>
                <p className="mt-1 text-[13px] text-muted">
                  Nâng cấp tài khoản thành người bán để bắt đầu đăng sản phẩm và nhận đơn hàng.
                </p>
                <Link
                  to="/dang-ky"
                  className="mt-4 inline-block rounded-sm bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
                >
                  Đăng ký bán hàng
                </Link>
              </div>
            )
          ) : null}
        </section>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted">
        Tổng {allUsers.length} tài khoản trong hệ thống demo (người mua + người bán).
      </p>
    </div>
  )
}

