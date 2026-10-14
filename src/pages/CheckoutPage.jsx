import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useOrders } from '../context/OrderContext'
import { useToast } from '../context/ToastContext'
import { checkoutPayments, shippingUnits } from '../data/homeContent'
import { vietnamProvinces } from '../data/locations'
import { formatVnd } from '../utils/format'
import Breadcrumb from '../components/ui/Breadcrumb'
import QuantityStepper from '../components/ui/QuantityStepper'
import { IconCheck, IconLocation, IconTruck } from '../components/ui/Icons'
import Price from '../components/ui/Price'
import SmartImage from '../components/ui/SmartImage'

const VOUCHERS = [
  { id: 'v20', code: 'NOVA20K', label: 'Giảm 20.000₫', min: 500000, value: 20000 },
  { id: 'v50', code: 'NOVA50K', label: 'Giảm 50.000₫', min: 1500000, value: 50000 },
  { id: 'v0', code: 'KHONG_DUNG', label: 'Không dùng voucher', min: 0, value: 0 },
]

/** TRANG ĐẶT HÀNG — nhiều shop trong 1 đơn, chọn địa chỉ / vận chuyển / thanh toán */
export default function CheckoutPage() {
  const navigate = useNavigate()
  const { user, updateProfile } = useAuth()
  const { selectedItems, updateQty, removeFromCart, removeSelected } = useCart()
  const { createOrder } = useOrders()
  const { pushToast } = useToast()

  const [address, setAddress] = useState(() => user?.address || {
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    province: '',
    district: '',
    ward: '',
    detail: '',
  })
  const [editingAddress, setEditingAddress] = useState(false)
  const [payment, setPayment] = useState('cod')
  const [shippingUnit, setShippingUnit] = useState('tietkiem')
  const [voucherId, setVoucherId] = useState('v20')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /** Nhóm theo shop cho phần hiển thị */
  const shopGroups = useMemo(() => {
    const map = new Map()
    selectedItems.forEach((i) => {
      if (!map.has(i.shopId)) map.set(i.shopId, { shopId: i.shopId, shopName: i.shopName, shopMall: i.shopMall, items: [] })
      map.get(i.shopId).items.push(i)
    })
    return [...map.values()].map((g) => {
      const subtotal = g.items.reduce((s, i) => s + i.price * i.qty, 0)
      const hasFreeship = g.items.some((i) => i.freeship)
      return {
        ...g,
        subtotal,
        shippingFee: hasFreeship || subtotal >= 1000000 ? 0 : 16500,
      }
    })
  }, [selectedItems])

  const totals = useMemo(() => {
    const subtotal = selectedItems.reduce((s, i) => s + i.price * i.qty, 0)
    const originalSubtotal = selectedItems.reduce((s, i) => s + (i.originalPrice || i.price) * i.qty, 0)
    const shippingTotal = shopGroups.reduce((s, g) => s + g.shippingFee, 0)
    const voucher = VOUCHERS.find((v) => v.id === voucherId)
    const voucherValue = voucher && subtotal >= voucher.min ? voucher.value : 0
    return {
      subtotal,
      originalSubtotal,
      productDiscount: originalSubtotal - subtotal,
      shippingTotal,
      voucherValue,
      voucherCode: voucherValue ? voucher.code : '',
      total: Math.max(0, subtotal + shippingTotal - voucherValue),
      count: selectedItems.reduce((s, i) => s + i.qty, 0),
    }
  }, [selectedItems, shopGroups, voucherId])

  const addressComplete = Boolean(address.fullName && address.phone && address.province && address.detail)

  if (!selectedItems.length) {
    return (
      <div className="rounded-sm border border-line bg-white px-6 py-16 text-center">
        <p className="text-[15px] font-semibold text-ink">Chưa có sản phẩm nào được chọn để đặt hàng</p>
        <Link
          to="/gio-hang"
          className="mt-4 inline-block rounded-sm bg-brand px-5 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
        >
          Quay lại giỏ hàng
        </Link>
      </div>
    )
  }

  const placeOrder = () => {
    if (!addressComplete) {
      setEditingAddress(true)
      pushToast('Vui lòng nhập đầy đủ địa chỉ nhận hàng', 'error')
      return
    }
    setSubmitting(true)
    const order = createOrder({
      buyerId: user?.id || 'guest',
      buyerName: user?.fullName || address.fullName,
      items: selectedItems,
      address,
      payment,
      shippingUnit: shippingUnits.find((s) => s.id === shippingUnit)?.name,
      shippingFee: totals.shippingTotal,
      voucher: totals.voucherValue,
      note,
    })
    updateProfile({ address })
    removeSelected()
    pushToast('Đặt hàng thành công!', 'success')
    navigate(`/dat-hang-thanh-cong/${order.id}`)
  }

  return (
    <div className="pb-24">
      <Breadcrumb
        className="mb-2"
        items={[{ label: 'Trang chủ', to: '/' }, { label: 'Giỏ hàng', to: '/gio-hang' }, { label: 'Đặt hàng' }]}
      />

      {/* ---------- ĐỊA CHỈ NHẬN HÀNG ---------- */}
      <section className="rounded-sm bg-white p-4">
        <div className="flex items-center gap-2 text-brand">
          <IconLocation className="h-5 w-5" />
          <h2 className="text-[15px] font-semibold text-ink">Địa Chỉ Nhận Hàng</h2>
        </div>

        {!editingAddress ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span className="font-semibold text-ink">{address.fullName || user?.fullName}</span>
            <span className="text-ink-soft">{address.phone}</span>
            {address.province ? (
              <span className="text-ink-soft">
                {[address.detail, address.ward, address.district, address.province].filter(Boolean).join(', ')}
              </span>
            ) : (
              <span className="text-brand">Chưa có địa chỉ — hãy thêm địa chỉ giao hàng</span>
            )}
            <button
              type="button"
              onClick={() => setEditingAddress(true)}
              className="ml-auto text-[13px] text-brand underline"
            >
              Thay Đổi
            </button>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              value={address.fullName}
              onChange={(e) => setAddress((a) => ({ ...a, fullName: e.target.value }))}
              placeholder="Họ và tên người nhận"
              className="rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
            />
            <input
              value={address.phone}
              onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))}
              placeholder="Số điện thoại"
              className="rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
            />
            <select
              value={address.province}
              onChange={(e) => setAddress((a) => ({ ...a, province: e.target.value }))}
              className="rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
            >
              <option value="">Chọn Tỉnh / Thành phố</option>
              {vietnamProvinces.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              value={address.district}
              onChange={(e) => setAddress((a) => ({ ...a, district: e.target.value }))}
              placeholder="Quận / Huyện"
              className="rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
            />
            <input
              value={address.ward}
              onChange={(e) => setAddress((a) => ({ ...a, ward: e.target.value }))}
              placeholder="Phường / Xã"
              className="rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
            />
            <input
              value={address.detail}
              onChange={(e) => setAddress((a) => ({ ...a, detail: e.target.value }))}
              placeholder="Địa chỉ chi tiết (số nhà, đường)"
              className="rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand md:col-span-2"
            />
            <div className="flex gap-2 md:col-span-2">
              <button
                type="button"
                onClick={() => setEditingAddress(false)}
                className="rounded-sm bg-brand px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105"
              >
                Lưu địa chỉ
              </button>
              <button
                type="button"
                onClick={() => setEditingAddress(false)}
                className="rounded-sm border border-line px-4 py-2 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand"
              >
                Huỷ
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---------- DANH SÁCH SẢN PHẨM THEO SHOP ---------- */}
      <section className="mt-3 rounded-sm bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 text-[13px] text-muted">
          <span className="min-w-[240px] flex-1">Sản Phẩm ({totals.count})</span>
          <span className="hidden w-[120px] text-center md:block">Đơn Giá</span>
          <span className="hidden w-[124px] text-center md:block">Số Lượng</span>
          <span className="hidden w-[120px] text-right md:block">Thành Tiền</span>
        </div>

        {shopGroups.map((g) => (
          <div key={g.shopId} className="border-b border-line last:border-b-0">
            <div className="flex items-center gap-2 bg-page/60 px-4 py-2 text-[13px]">
              <span className="rounded-[2px] bg-brand px-1 text-[10px] font-bold uppercase text-white">Shop</span>
              <Link to={`/shop/${g.shopId}`} className="font-medium text-ink hover:text-brand">
                {g.shopName}
              </Link>
              <span className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
                <IconTruck className="h-3.5 w-3.5" />
                {g.shippingFee === 0 ? (
                  <span className="text-free">Miễn phí vận chuyển</span>
                ) : (
                  <span>Phí vận chuyển: {formatVnd(g.shippingFee)}</span>
                )}
              </span>
            </div>

            {g.items.map((item) => (
              <div key={item.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link to={`/san-pham/${item.slug}`} className="shrink-0">
                  <SmartImage
                    src={item.image}
                    fallback={item.image}
                    alt={item.name}
                    className="h-[70px] w-[70px] rounded-sm border border-line object-cover"
                  />
                </Link>
                <div className="min-w-[200px] flex-1">
                  <Link to={`/san-pham/${item.slug}`} className="line-clamp-2 text-[13px] leading-[18px] text-ink hover:text-brand">
                    {item.name}
                  </Link>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-sm bg-page px-1.5 py-[2px] text-[11px] text-muted">
                    Phân loại: {item.variant || 'Mặc định'}
                  </span>
                </div>

                <div className="w-[120px] shrink-0 text-center text-[13px]">
                  {item.originalPrice > item.price ? (
                    <span className="block text-[12px] text-muted line-through">{formatVnd(item.originalPrice)}</span>
                  ) : null}
                  <Price value={item.price} size="sm" className="text-ink-soft" />
                </div>

                <div className="shrink-0">
                  <QuantityStepper
                    value={item.qty}
                    onChange={(v) => updateQty(item.key, v)}
                    max={Math.min(99, item.stock)}
                    size="sm"
                  />
                </div>

                <div className="w-[120px] shrink-0 text-right">
                  <Price value={item.price * item.qty} size="md" className="text-brand" />
                </div>

                <button
                  type="button"
                  onClick={() => removeFromCart(item.key)}
                  className="text-[12px] text-muted transition hover:text-brand"
                >
                  Xoá
                </button>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* ---------- PHƯƠNG THỨC VẬN CHUYỂN ---------- */}
      <section className="mt-3 rounded-sm bg-white">
        <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-[15px] font-semibold text-ink">
          <IconTruck className="h-5 w-5 text-brand" />
          Phương Thức Vận Chuyển
        </h2>
        <div className="divide-y divide-line">
          {shippingUnits.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setShippingUnit(u.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-page/60"
            >
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  shippingUnit === u.id ? 'border-brand' : 'border-line'
                }`}
              >
                {shippingUnit === u.id ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
              </span>
              <span className="text-[16px]">{u.emoji}</span>
              <span className="flex-1">
                <span className="block text-[13px] font-medium text-ink">{u.name}</span>
                <span className="block text-[12px] text-muted">{u.note}</span>
              </span>
              <span className="text-[13px] text-ink-soft">{formatVnd(u.fee)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ---------- VOUCHER ---------- */}
      <section className="mt-3 rounded-sm bg-white">
        <h2 className="border-b border-line px-4 py-3 text-[15px] font-semibold text-ink">ShopNova Voucher</h2>
        <div className="grid gap-2 p-3 md:grid-cols-3">
          {VOUCHERS.map((v) => {
            const usable = totals.subtotal >= v.min || v.value === 0
            return (
              <button
                key={v.id}
                type="button"
                disabled={!usable}
                onClick={() => setVoucherId(v.id)}
                className={`flex items-center gap-2 rounded-sm border p-2.5 text-left transition ${
                  voucherId === v.id ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:border-brand-light'
                } ${usable ? '' : 'cursor-not-allowed opacity-50'}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 text-[15px]">🎟️</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-brand">{v.label}</span>
                  <span className="block text-[11px] text-muted">
                    Mã {v.code} {v.min ? `· Đơn tối thiểu ${formatVnd(v.min)}` : ''}
                  </span>
                </span>
                {voucherId === v.id ? <IconCheck className="h-4 w-4 shrink-0 text-brand" /> : null}
              </button>
            )
          })}
        </div>
      </section>

      {/* ---------- THANH TOÁN + GHI CHÚ ---------- */}
      <section className="mt-3 rounded-sm bg-white">
        <h2 className="border-b border-line px-4 py-3 text-[15px] font-semibold text-ink">Phương Thức Thanh Toán</h2>
        <div className="divide-y divide-line">
          {checkoutPayments.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPayment(p.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-page/60"
            >
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  payment === p.id ? 'border-brand' : 'border-line'
                }`}
              >
                {payment === p.id ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
              </span>
              <span className="text-[16px]">{p.emoji}</span>
              <span className="flex-1 text-[13px] text-ink">{p.name}</span>
              {payment === p.id ? <IconCheck className="h-4 w-4 text-brand" /> : null}
            </button>
          ))}
        </div>

        <div className="border-t border-line px-4 py-3">
          <label className="mb-1.5 block text-[13px] text-ink-soft">Lời nhắn cho người bán</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ví dụ: giao giờ hành chính, gọi trước khi giao..."
            className="w-full resize-none rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
        </div>
      </section>

      {/* ---------- THANH ĐẶT HÀNG ---------- */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="container-shop flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-soft">
            <span>
              Tổng tiền hàng: <Price value={totals.subtotal} size="sm" className="text-ink" />
            </span>
            <span>
              Phí vận chuyển:{' '}
              {totals.shippingTotal === 0 ? (
                <span className="text-free">Miễn phí</span>
              ) : (
                <Price value={totals.shippingTotal} size="sm" className="text-ink" />
              )}
            </span>
            {totals.voucherValue ? (
              <span className="text-free">
                Voucher {totals.voucherCode}: -<Price value={totals.voucherValue} size="sm" className="text-free" />
              </span>
            ) : null}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-4">
            <span className="text-[13px] text-ink-soft">
              Tổng thanh toán:
              <Price value={totals.total} size="lg" className="ml-1 text-brand" />
            </span>
            <button
              type="button"
              onClick={placeOrder}
              disabled={submitting}
              className="rounded-sm bg-gradient-to-b from-[#f86a4b] to-[#ee4d2d] px-10 py-2.5 text-[14px] font-medium text-white transition hover:brightness-105 disabled:opacity-60"
            >
              {submitting ? 'Đang xử lý...' : 'Đặt Hàng'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
