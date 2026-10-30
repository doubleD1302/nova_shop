import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCatalog } from '../context/CatalogContext'
import { useOrders } from '../context/OrderContext'
import { useToast } from '../context/ToastContext'
import { formatNumber, formatVnd } from '../utils/format'
import { vietnamProvinces } from '../data/locations'
import Breadcrumb from '../components/ui/Breadcrumb'
import AvatarPicker from '../components/ui/AvatarPicker'
import { IconHeart, IconLock, IconPackage, IconStore, IconUser } from '../components/ui/Icons'
import SmartImage from '../components/ui/SmartImage'
import { isValidEmail, normalizeEmail } from '../utils/validation'

const TABS = [
  { id: 'profile', label: 'Há»“ sÆ¡', icon: <IconUser className="h-4 w-4" /> },
  { id: 'address', label: 'Äá»‹a chá»‰ nháº­n hĂ ng', icon: <IconPackage className="h-4 w-4" /> },
  { id: 'password', label: 'Đổi mật khẩu', icon: <IconLock className="h-4 w-4" /> },
  { id: 'shop', label: 'Gian hĂ ng cá»§a tĂ´i', icon: <IconStore className="h-4 w-4" /> },
]

/** TRANG TĂ€I KHOáº¢N â€” há»“ sÆ¡, Ä‘á»‹a chá»‰, thĂ´ng tin gian hĂ ng (náº¿u lĂ  ngÆ°á»i bĂ¡n) */
export default function AccountPage() {
  const { user, avatar, updateProfile, changePassword } = useAuth()
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [showPassword, setShowPassword] = useState({ current: false, next: false })
  const { getShop, loadShop, followedShopIds } = useCatalog()
  const { loadBuyerOrders, buyerOrdersSummary } = useOrders()
  const { pushToast } = useToast()
  const [tab, setTab] = useState('profile')
  const [profileDraft, setProfileDraft] = useState({ fullName: '', email: '', phone: '' })
  const [addressDraft, setAddressDraft] = useState({})
  const [emailError, setEmailError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadBuyerOrders({ limit: 0, force: true }).catch((error) => console.error('Could not load account order summary:', error))
  }, [loadBuyerOrders])

  useEffect(() => {
    if (tab === 'shop' && user?.shopId) {
      loadShop(user.shopId).catch((error) => console.error('Could not load account shop:', error))
    }
  }, [tab, user?.shopId, loadShop])

  useEffect(() => {
    if (!user) return
    setProfileDraft({ fullName: user.fullName || '', email: user.email || '', phone: user.phone || '' })
    setAddressDraft(user.address || {})
  }, [user])

  if (!user) {
    return (
      <div className="rounded-sm border border-line bg-white px-6 py-16 text-center">
        <p className="text-[15px] font-semibold text-ink">Báº¡n chÆ°a Ä‘Äƒng nháº­p</p>
        <Link
          to="/dang-nhap"
          className="mt-4 inline-block rounded-sm bg-brand px-5 py-2.5 text-[13px] font-medium text-white"
        >
          ÄÄƒng nháº­p ngay
        </Link>
      </div>
    )
  }

  const address = addressDraft
  const shop = user.shopId ? getShop(user.shopId) : null
  const spent = buyerOrdersSummary.spent
  const setAddressField = (key) => (e) => setAddressDraft((current) => ({ ...current, [key]: e.target.value }))
  const inputClass = 'w-full rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand'

  const saveProfile = async () => {
    if (!profileDraft.fullName.trim()) {
      pushToast('Vui lĂ²ng nháº­p há» vĂ  tĂªn.', 'error')
      return
    }
    if (!isValidEmail(profileDraft.email)) {
      setEmailError('Vui lĂ²ng nháº­p email Ä‘Ăºng Ä‘á»‹nh dáº¡ng.')
      return
    }
    setSaving(true)
    const result = await updateProfile({ ...profileDraft, email: normalizeEmail(profileDraft.email) })
    setSaving(false)
    if (!result.ok) {
      if (result.error?.toLowerCase().includes('email')) setEmailError(result.error)
      else pushToast(result.error || 'KhĂ´ng thá»ƒ cáº­p nháº­t há»“ sÆ¡.', 'error')
      return
    }
    setEmailError('')
    pushToast('ÄĂ£ cáº­p nháº­t há»“ sÆ¡.', 'success')
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (!passwordDraft.currentPassword) {
      pushToast('Vui lòng nhập mật khẩu hiện tại.', 'error')
      return
    }
    if (!passwordDraft.newPassword || passwordDraft.newPassword.length < 8) {
      pushToast('Mật khẩu mới phải có ít nhất 8 ký tự.', 'error')
      return
    }
    if (new TextEncoder().encode(passwordDraft.newPassword).length > 72) {
      pushToast('Mật khẩu mới không được dài quá 72 byte.', 'error')
      return
    }
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      pushToast('Mật khẩu nhập lại không khớp.', 'error')
      return
    }
    if (passwordDraft.currentPassword === passwordDraft.newPassword) {
      pushToast('Mật khẩu mới không được trùng với mật khẩu hiện tại.', 'error')
      return
    }
    setPasswordSaving(true)
    const result = await changePassword(passwordDraft.currentPassword, passwordDraft.newPassword)
    setPasswordSaving(false)
    if (!result.ok) {
      pushToast(result.error || 'Không thể đổi mật khẩu.', 'error')
      return
    }
    setPasswordDraft({ currentPassword: '', newPassword: '', confirmPassword: '' })
    pushToast(result.message || 'Đã đổi mật khẩu thành công.', 'success')
  }

  const saveAddress = async () => {
    setSaving(true)
    const result = await updateProfile({ address: addressDraft })
    setSaving(false)
    if (!result.ok) {
      pushToast(result.error || 'KhĂ´ng thá»ƒ lÆ°u Ä‘á»‹a chá»‰.', 'error')
      return
    }
    pushToast('ÄĂ£ lÆ°u Ä‘á»‹a chá»‰ nháº­n hĂ ng.', 'success')
  }

  return (
    <div>
      <Breadcrumb className="mb-2" items={[{ label: 'Trang chá»§', to: '/' }, { label: 'TĂ i khoáº£n cá»§a tĂ´i' }]} />

      <div className="flex flex-wrap items-center gap-4 rounded-sm bg-white px-4 py-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-line">
          <SmartImage src={avatar} fallback={avatar} alt="" className="h-full w-full object-cover" />
        </span>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-ink">{user.fullName}</p>
          <p className="text-[12px] text-muted">
            @{user.username} Â· {user.email} Â· {user.role === 'seller' || user.shopId ? 'Kênh Người Bán' : 'Đăng ký bán hàng'}
          </p>
          <span className="mt-1 inline-block rounded-sm bg-brand-soft px-2 py-[2px] text-[11px] text-brand">
            {user.rank}
          </span>
        </div>

        <div className="ml-auto grid grid-cols-3 gap-4 text-center">
          <span>
            <b className="block text-[16px] text-brand">{buyerOrdersSummary.orderCount}</b>
            <span className="text-[11px] text-muted">ÄÆ¡n hĂ ng</span>
          </span>
          <span>
            <b className="block text-[16px] text-brand">{formatVnd(spent)}</b>
            <span className="text-[11px] text-muted">ÄĂ£ chi tiĂªu</span>
          </span>
          <span>
            <b className="flex items-center justify-center gap-1 text-[16px] text-brand">
              <IconHeart className="h-4 w-4" />
              {followedShopIds.length}
            </b>
            <span className="text-[11px] text-muted">Shop theo dĂµi</span>
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
            to="/nguoi-ban"
            className="mt-1 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-[13px] text-ink-soft transition hover:text-brand"
          >
            <IconStore className="h-4 w-4" />
            {user.role === 'seller' ? 'KĂªnh NgÆ°á»i BĂ¡n' : 'ÄÄƒng kĂ½ bĂ¡n hĂ ng'}
          </Link>
        </aside>

        <section className="rounded-sm border border-line bg-white p-4">
          {tab === 'profile' ? (
            <div className="max-w-[720px] space-y-4">
              {/* Äá»”I áº¢NH Äáº I DIá»†N */}
              <AvatarPicker
                value={{
                  avatarUrl: user.avatarUrl,
                  emoji: user.avatarEmoji,
                  hue: user.hue,
                  name: user.fullName,
                }}
                onChange={(patch) => {
                  updateProfile(patch).then((result) => {
                    pushToast(result.ok ? 'ÄĂ£ cáº­p nháº­t áº£nh Ä‘áº¡i diá»‡n.' : result.error, result.ok ? 'success' : 'error')
                  })
                }}
                title="áº¢nh Ä‘áº¡i diá»‡n cá»§a báº¡n"
                note="Táº£i áº£nh Ä‘áº¡i diá»‡n tháº­t lĂªn mĂ¡y chá»§. áº¢nh sáº½ hiá»ƒn thá»‹ trĂªn header vĂ  Ä‘Æ¡n hĂ ng."
              />

              <div className="grid gap-3 md:grid-cols-2">
              <label className="text-[12px] text-muted">
                Há» vĂ  tĂªn
                <input
                  value={profileDraft.fullName}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, fullName: e.target.value }))}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] text-muted">
                Sá»‘ Ä‘iá»‡n thoáº¡i
                <input
                  value={profileDraft.phone}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, phone: e.target.value }))}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] text-muted md:col-span-2">
                Email
                <input
                  type="email"
                  required
                  value={profileDraft.email}
                  onChange={(e) => {
                    setProfileDraft((current) => ({ ...current, email: e.target.value }))
                    setEmailError('')
                  }}
                  onBlur={() => {
                    if (!isValidEmail(profileDraft.email)) setEmailError('Vui lĂ²ng nháº­p email Ä‘Ăºng Ä‘á»‹nh dáº¡ng.')
                  }}
                  aria-invalid={Boolean(emailError)}
                  className={`mt-1 ${inputClass} ${emailError ? 'border-rose-500' : ''}`}
                />
                {emailError ? <span className="mt-1 block text-[12px] text-rose-600">{emailError}</span> : null}
              </label>
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving}
                  className="rounded-sm bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
                >
                  {saving ? 'Äang lÆ°u...' : 'LÆ°u thay Ä‘á»•i'}
                </button>
              </div>
              </div>
            </div>
          ) : null}

          {tab === 'address' ? (
            <div className="grid max-w-[720px] gap-3 md:grid-cols-2">
              <label className="text-[12px] text-muted">
                NgÆ°á»i nháº­n
                <input
                  value={address.fullName || ''}
                  onChange={setAddressField('fullName')}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] text-muted">
                Sá»‘ Ä‘iá»‡n thoáº¡i
                <input value={address.phone || ''} onChange={setAddressField('phone')} className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-[12px] text-muted">
                Tá»‰nh / ThĂ nh phá»‘
                <select
                  value={address.province || ''}
                  onChange={setAddressField('province')}
                  className={`mt-1 ${inputClass}`}
                >
                  <option value="">Chá»n Tá»‰nh / ThĂ nh phá»‘</option>
                  {vietnamProvinces.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] text-muted">
                Quáº­n / Huyá»‡n
                <input
                  value={address.district || ''}
                  onChange={setAddressField('district')}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="text-[12px] text-muted">
                PhÆ°á»ng / XĂ£
                <input value={address.ward || ''} onChange={setAddressField('ward')} className={`mt-1 ${inputClass}`} />
              </label>
              <label className="text-[12px] text-muted">
                Äá»‹a chá»‰ chi tiáº¿t
                <input
                  value={address.detail || ''}
                  onChange={setAddressField('detail')}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={saveAddress}
                  disabled={saving}
                  className="rounded-sm bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
                >
                  LÆ°u Ä‘á»‹a chá»‰
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
                    Xem gian hĂ ng
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Sáº£n pháº©m Ä‘ang bĂ¡n', value: formatNumber(shop.productCount) },
                    { label: 'NgÆ°á»i theo dĂµi', value: formatNumber(shop.followers) },
                    { label: 'ÄĂ¡nh giĂ¡ shop', value: `${shop.rating}/5` },
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
                  VĂ o KĂªnh NgÆ°á»i BĂ¡n
                </Link>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[14px] font-medium text-ink">Báº¡n chÆ°a cĂ³ gian hĂ ng</p>
                <p className="mt-1 text-[13px] text-muted">
                  NĂ¢ng cáº¥p tĂ i khoáº£n thĂ nh ngÆ°á»i bĂ¡n Ä‘á»ƒ báº¯t Ä‘áº§u Ä‘Äƒng sáº£n pháº©m vĂ  nháº­n Ä‘Æ¡n hĂ ng.
                </p>
                <Link
                  to="/dang-ky"
                  className="mt-4 inline-block rounded-sm bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
                >
                  ÄÄƒng kĂ½ bĂ¡n hĂ ng
                </Link>
              </div>
            )
          ) : tab === 'password' ? (
            <div className="max-w-[480px]">
              <h2 className="text-[15px] font-semibold text-ink">Đổi mật khẩu tài khoản</h2>
              <p className="mt-1 text-[13px] text-muted">
                Để bảo vệ tài khoản, không chia sẻ mật khẩu cho người khác. Sau khi đổi mật khẩu, toàn bộ phiên đăng nhập trên các thiết bị khác sẽ được tự động thu hồi.
              </p>

              <form onSubmit={savePassword} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-ink-soft">
                    Mật khẩu hiện tại <span className="text-brand">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword.current ? 'text' : 'password'}
                      className={inputClass}
                      placeholder="Nhập mật khẩu hiện tại..."
                      value={passwordDraft.currentPassword}
                      onChange={(e) => setPasswordDraft((d) => ({ ...d, currentPassword: e.target.value }))}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => ({ ...s, current: !s.current }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted hover:text-brand"
                    >
                      {showPassword.current ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[13px] font-medium text-ink-soft">
                    Mật khẩu mới (tối thiểu 8 ký tự) <span className="text-brand">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword.next ? 'text' : 'password'}
                      className={inputClass}
                      placeholder="Nhập mật khẩu mới..."
                      value={passwordDraft.newPassword}
                      onChange={(e) => setPasswordDraft((d) => ({ ...d, newPassword: e.target.value }))}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => ({ ...s, next: !s.next }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted hover:text-brand"
                    >
                      {showPassword.next ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[13px] font-medium text-ink-soft">
                    Xác nhận mật khẩu mới <span className="text-brand">*</span>
                  </label>
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="Nhập lại mật khẩu mới..."
                    value={passwordDraft.confirmPassword}
                    onChange={(e) => setPasswordDraft((d) => ({ ...d, confirmPassword: e.target.value }))}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="rounded-sm bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
                >
                  {passwordSaving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </button>
              </form>
            </div>
          ) : null}
        </section>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted">ThĂ´ng tin há»“ sÆ¡ Ä‘Æ°á»£c Ä‘á»“ng bá»™ vá»›i tĂ i khoáº£n ShopNova cá»§a báº¡n.</p>
    </div>
  )
}

