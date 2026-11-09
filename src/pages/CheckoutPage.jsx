import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useCatalog } from '../context/CatalogContext'
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

/**
 * TRANG ĐẶT HÀNG (CHECKOUT)
 * - Tích hợp đầy đủ Backend:
 *   1. Xem trước đơn hàng: POST /api/v1/orders/preview
 *   2. Vận chuyển: mã tietkiem, nhanh, hoatoc; lấy phí từ preview; chú thích phí ước tính
 *   3. Voucher: nhập/bỏ mã, hiển thị mức giảm hoặc lỗi từ Backend
 *   4. Tạo đơn: POST /api/v1/orders, giữ cùng Idempotency-Key khi thử lại
 *   5. Trạng thái & lỗi: loading, chống race condition, xử lý hết hàng / xung đột
 *   6. Kết quả đặt hàng: điều hướng đến OrderSuccessPage hiển thị tổng từ server
 */
export default function CheckoutPage() {
  const navigate = useNavigate()
  const { user, isInitializing, updateProfile } = useAuth()
  const { selectedItems, updateQty, removeFromCart, removeSelected } = useCart()
  const { loadProducts } = useCatalog()
  const { createOrder, previewOrder } = useOrders()
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
  const [savingAddress, setSavingAddress] = useState(false)

  // Vận chuyển & Thanh toán
  const [shippingUnit, setShippingUnit] = useState('tietkiem')
  const [payment, setPayment] = useState('cod')
  const [note, setNote] = useState('')

  // Voucher
  const [voucherInput, setVoucherInput] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState('')
  const [voucherError, setVoucherError] = useState('')

  // Trạng thái Backend Preview
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const previewVersionRef = useRef(0)
  const previewAbortRef = useRef(null)

  // Trạng thái đặt hàng & Idempotency Key
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const idempotencyKeyRef = useRef(null)

  // Tự động điền địa chỉ mặc định đã lưu của tài khoản khi người dùng đăng nhập hoặc tải lại trang
  useEffect(() => {
    if (user?.address && (user.address.fullName || user.address.phone || user.address.province || user.address.detail)) {
      setAddress((current) => {
        if (!current.province && !current.detail) {
          return {
            fullName: user.address.fullName || user.fullName || '',
            phone: user.address.phone || user.phone || '',
            province: user.address.province || '',
            district: user.address.district || '',
            ward: user.address.ward || '',
            detail: user.address.detail || '',
          }
        }
        return current
      })
    }
  }, [user])

  // Reset Idempotency-Key khi thông tin giỏ hàng hoặc các lựa chọn thay đổi
  const resetIdempotencyKey = () => {
    idempotencyKeyRef.current = null
  }

  // Tải lại thông tin các sản phẩm nếu bị unavailable
  useEffect(() => {
    const ids = [...new Set(selectedItems.filter((item) => item.unavailable).map((item) => item.productId).filter(Boolean))]
    if (ids.length) {
      loadProducts({ ids: ids.slice(0, 50).join(','), limit: Math.min(ids.length, 50), offset: 0 })
        .catch((error) => console.error('Không thể làm mới sản phẩm khi thanh toán:', error))
    }
  }, [loadProducts, selectedItems])

  // GỌI API XEM TRƯỚC ĐƠN HÀNG: POST /api/v1/orders/preview
  // Tính toán lại khi người dùng thay đổi giỏ hàng, số lượng, hình thức vận chuyển hoặc voucher
  // Chống race-condition: dùng version counter và AbortController để response cũ không ghi đè lựa chọn mới
  useEffect(() => {
    if (!user || !selectedItems.length) return

    const validItems = selectedItems.filter((item) => item.variantId && Number(item.qty) >= 1)
    if (!validItems.length) return

    const version = ++previewVersionRef.current
    if (previewAbortRef.current) {
      previewAbortRef.current.abort()
    }
    const controller = new AbortController()
    previewAbortRef.current = controller

    setPreviewLoading(true)
    setPreviewError('')
    setVoucherError('')

    previewOrder({
      items: validItems,
      shippingMethod: shippingUnit,
      voucherCode: appliedVoucher,
      signal: controller.signal,
    })
      .then((data) => {
        if (previewVersionRef.current !== version) return
        setPreview(data)
        setPreviewLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError' || previewVersionRef.current !== version) return
        setPreviewLoading(false)

        if (err.code === 'VOUCHER_INVALID' || err.code === 'VOUCHER_UNAVAILABLE') {
          setVoucherError(err.message || 'Mã giảm giá không hợp lệ hoặc đã hết lượt sử dụng.')
          // Thử lại preview không voucher để người dùng vẫn xem được phí ship và tiền hàng
          previewOrder({
            items: validItems,
            shippingMethod: shippingUnit,
            voucherCode: '',
          }).then((fallbackData) => {
            if (previewVersionRef.current === version) {
              setPreview(fallbackData)
            }
          }).catch(() => {})
        } else if (err.code === 'INSUFFICIENT_STOCK') {
          setPreviewError('Một hoặc nhiều sản phẩm trong giỏ hàng đã vượt quá số lượng tồn kho.')
        } else if (err.code === 'PRODUCT_UNAVAILABLE') {
          setPreviewError('Một sản phẩm trong giỏ không còn được bán hoặc tạm ngừng kinh doanh.')
        } else {
          setPreviewError(err.message || 'Không thể xem trước đơn hàng.')
        }
      })

    return () => {
      controller.abort()
    }
  }, [user, selectedItems, shippingUnit, appliedVoucher, previewOrder])

  // Lưu địa chỉ mặc định vào profile thông qua PUT /api/v1/auth/profile
  const handleSaveAddress = async () => {
    if (!address.fullName?.trim() || !address.phone?.trim() || !address.province?.trim() || !address.detail?.trim()) {
      pushToast('Vui lòng điền đầy đủ họ tên, số điện thoại, tỉnh/thành phố và địa chỉ chi tiết.', 'error')
      return
    }
    setSavingAddress(true)
    try {
      const res = await updateProfile({ address })
      if (!res.ok) {
        pushToast(res.error || 'Không thể lưu địa chỉ mặc định.', 'error')
        return
      }
      setEditingAddress(false)
      resetIdempotencyKey()
      pushToast('Đã lưu địa chỉ nhận hàng mặc định thành công!', 'success')
    } catch {
      pushToast('Có lỗi xảy ra khi lưu địa chỉ.', 'error')
    } finally {
      setSavingAddress(false)
    }
  }

  // Nhóm sản phẩm theo shop cho phần hiển thị
  const shopGroups = useMemo(() => {
    const map = new Map()
    selectedItems.forEach((i) => {
      if (!map.has(i.shopId)) map.set(i.shopId, { shopId: i.shopId, shopName: i.shopName, shopMall: i.shopMall, items: [] })
      map.get(i.shopId).items.push(i)
    })
    return [...map.values()].map((g) => {
      const subtotal = g.items.reduce((s, i) => s + i.price * i.qty, 0)
      // Lấy phí ship từ preview.shops trả về từ Backend (nếu có)
      const shopPreview = preview?.shops?.find((s) => String(s.shopId) === String(g.shopId))
      const shippingFee = shopPreview !== undefined
        ? shopPreview.shippingFee
        : (g.items.some((i) => i.freeship) || subtotal >= 1000000 ? 0 : shippingUnits.find((u) => u.id === shippingUnit)?.fee || 0)

      return {
        ...g,
        subtotal,
        shippingFee,
      }
    })
  }, [selectedItems, preview, shippingUnit])

  // Tổng tiền: ưu tiên lấy chính xác từ Backend preview
  const totals = useMemo(() => {
    const rawSubtotal = selectedItems.reduce((s, i) => s + i.price * i.qty, 0)
    const originalSubtotal = selectedItems.reduce((s, i) => s + (i.originalPrice || i.price) * i.qty, 0)
    const count = selectedItems.reduce((s, i) => s + i.qty, 0)

    if (preview) {
      return {
        subtotal: preview.subtotal,
        originalSubtotal,
        productDiscount: originalSubtotal - preview.subtotal,
        shippingTotal: preview.shippingFee,
        voucherValue: preview.discountAmount,
        voucherCode: preview.voucherCode || appliedVoucher,
        total: preview.total,
        count,
      }
    }

    const estShipping = shopGroups.reduce((s, g) => s + g.shippingFee, 0)
    return {
      subtotal: rawSubtotal,
      originalSubtotal,
      productDiscount: originalSubtotal - rawSubtotal,
      shippingTotal: estShipping,
      voucherValue: 0,
      voucherCode: '',
      total: Math.max(0, rawSubtotal + estShipping),
      count,
    }
  }, [selectedItems, preview, shopGroups, appliedVoucher])

  const addressComplete = Boolean(address.fullName && address.phone && address.province && address.detail)

  useEffect(() => {
    if (!isInitializing && !user) {
      navigate('/dang-nhap', { replace: true, state: { from: '/dat-hang' } })
    }
  }, [isInitializing, user, navigate])

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

  // TẠO ĐƠN HÀNG VÀ XỬ LÝ THỬ LẠI (POST /api/v1/orders)
  // Khi kết quả chưa rõ hoặc lỗi xung đột cần thử lại, giữ cùng Idempotency-Key
  const placeOrder = async (isRetry = false) => {
    if (!user) {
      navigate('/dang-nhap', { state: { from: '/dat-hang' } })
      return
    }
    if (!addressComplete) {
      setEditingAddress(true)
      pushToast('Vui lòng nhập đầy đủ địa chỉ nhận hàng.', 'error')
      return
    }
    if (selectedItems.some((item) => !item.variantId || item.unavailable || item.qty > item.stock)) {
      pushToast('Giỏ hàng có sản phẩm không còn đủ tồn kho. Vui lòng kiểm tra lại.', 'error')
      return
    }

    setSubmitting(true)
    setSubmitError('')

    // Khởi tạo hoặc giữ nguyên Idempotency-Key khi thử lại
    if (!isRetry || !idempotencyKeyRef.current) {
      idempotencyKeyRef.current = window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`
    }

    try {
      const order = await createOrder({
        buyerName: user.fullName || address.fullName,
        items: selectedItems,
        address,
        paymentMethod: payment,
        shippingMethod: shippingUnit,
        voucherCode: appliedVoucher,
        note,
        idempotencyKey: idempotencyKeyRef.current,
      })

      // Tự động lưu địa chỉ nhận hàng nếu tài khoản chưa có địa chỉ mặc định
      if (user && (!user.address || !user.address.province)) {
        updateProfile({ address }).catch(() => {})
      }

      removeSelected()
      pushToast('Đặt hàng thành công!', 'success')
      navigate(`/dat-hang-thanh-cong/${order.id}`)
    } catch (error) {
      let msg = error.message || 'Không thể đặt hàng. Vui lòng thử lại.'
      if (error.code === 'INSUFFICIENT_STOCK') {
        msg = 'Sản phẩm trong giỏ hàng đã hết hoặc không còn đủ tồn kho.'
      } else if (error.code === 'PRODUCT_UNAVAILABLE') {
        msg = 'Một hoặc nhiều sản phẩm trong giỏ không còn được bán.'
      } else if (error.code === 'VOUCHER_INVALID' || error.code === 'VOUCHER_UNAVAILABLE') {
        msg = 'Mã giảm giá không hợp lệ hoặc đã hết lượt sử dụng.'
      } else if (error.code === 'CHECKOUT_CONFLICT') {
        msg = 'Hệ thống đang xử lý đơn hàng khác hoặc có xung đột tồn kho. Vui lòng bấm "Thử lại".'
      } else if (error.code === 'IDEMPOTENCY_CONFLICT') {
        msg = 'Xung đột phiên đặt hàng. Hệ thống sẽ tạo phiên mới để bạn đặt lại.'
        idempotencyKeyRef.current = null
      }
      setSubmitError(msg)
      pushToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pb-32">
      <Breadcrumb
        className="mb-2"
        items={[{ label: 'Trang chủ', to: '/' }, { label: 'Giỏ hàng', to: '/gio-hang' }, { label: 'Đặt hàng' }]}
      />

      {/* Thông báo lỗi preview hoặc đặt hàng */}
      {previewError ? (
        <div className="mb-3 rounded-sm border border-rose-300 bg-rose-50 p-3.5 text-[13px] text-rose-700">
          ⚠️ <b>Lưu ý:</b> {previewError}
        </div>
      ) : null}

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
              className="ml-auto text-[13px] text-brand underline cursor-pointer"
            >
              Thay Đổi
            </button>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              value={address.fullName}
              onChange={(e) => {
                setAddress((a) => ({ ...a, fullName: e.target.value }))
                resetIdempotencyKey()
              }}
              placeholder="Họ và tên người nhận"
              className="rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
            />
            <input
              value={address.phone}
              onChange={(e) => {
                setAddress((a) => ({ ...a, phone: e.target.value }))
                resetIdempotencyKey()
              }}
              placeholder="Số điện thoại"
              className="rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
            />
            <select
              value={address.province}
              onChange={(e) => {
                setAddress((a) => ({ ...a, province: e.target.value }))
                resetIdempotencyKey()
              }}
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
              onChange={(e) => {
                setAddress((a) => ({ ...a, district: e.target.value }))
                resetIdempotencyKey()
              }}
              placeholder="Quận / Huyện"
              className="rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
            />
            <input
              value={address.ward}
              onChange={(e) => {
                setAddress((a) => ({ ...a, ward: e.target.value }))
                resetIdempotencyKey()
              }}
              placeholder="Phường / Xã"
              className="rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
            />
            <input
              value={address.detail}
              onChange={(e) => {
                setAddress((a) => ({ ...a, detail: e.target.value }))
                resetIdempotencyKey()
              }}
              placeholder="Địa chỉ chi tiết (số nhà, đường)"
              className="rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand md:col-span-2"
            />
            <div className="flex gap-2 md:col-span-2">
              <button
                type="button"
                onClick={handleSaveAddress}
                disabled={savingAddress}
                className="rounded-sm bg-brand px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50 cursor-pointer"
              >
                {savingAddress ? 'Đang lưu...' : 'Lưu địa chỉ'}
              </button>
              <button
                type="button"
                onClick={() => setEditingAddress(false)}
                className="rounded-sm border border-line px-4 py-2 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand cursor-pointer"
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
                  <span className="text-free font-medium">Miễn phí vận chuyển</span>
                ) : (
                  <span>Phí ship: <b className="text-ink">{formatVnd(g.shippingFee)}</b></span>
                )}
              </span>
            </div>

            {g.items.map((item) => (
              <div key={item.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link to={`/san-pham/${item.slug}`} className="shrink-0">
                  <SmartImage
                    src={item.image}
                    fallback={item.imageFallback || item.image}
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
                    onChange={(v) => {
                      updateQty(item.key, v)
                      resetIdempotencyKey()
                    }}
                    max={Math.min(99, item.stock)}
                    size="sm"
                  />
                </div>

                <div className="w-[120px] shrink-0 text-right">
                  <Price value={item.price * item.qty} size="md" className="text-brand" />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    removeFromCart(item.key)
                    resetIdempotencyKey()
                  }}
                  className="text-[12px] text-muted transition hover:text-brand cursor-pointer"
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
        <div className="flex flex-wrap items-center justify-between border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <IconTruck className="h-5 w-5 text-brand" />
            Phương Thức Vận Chuyển
          </h2>
          <span className="text-[11px] text-muted italic">
            * Phí ước tính nội bộ hệ thống, không khẳng định thời gian giao thực tế
          </span>
        </div>
        <div className="divide-y divide-line">
          {shippingUnits.map((u) => {
            const isSelected = shippingUnit === u.id
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setShippingUnit(u.id)
                  resetIdempotencyKey()
                }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition cursor-pointer ${
                  isSelected ? 'bg-brand-soft/40' : 'hover:bg-page/60'
                }`}
              >
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                    isSelected ? 'border-brand' : 'border-line'
                  }`}
                >
                  {isSelected ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
                </span>
                <span className="text-[16px]">{u.emoji}</span>
                <span className="flex-1">
                  <span className="block text-[13px] font-medium text-ink">{u.name}</span>
                  <span className="block text-[12px] text-muted">{u.note}</span>
                </span>
                <span className="text-[13px] font-medium text-ink-soft">
                  {isSelected && preview ? (
                    preview.shippingFee === 0 ? (
                      <span className="text-free font-semibold">Miễn phí</span>
                    ) : (
                      formatVnd(preview.shippingFee)
                    )
                  ) : (
                    formatVnd(u.fee)
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ---------- NHẬP VÀ KIỂM TRA VOUCHER ---------- */}
      <section className="mt-3 rounded-sm bg-white p-4">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">ShopNova Voucher</h2>

        <div className="flex flex-wrap items-center gap-2 max-w-md">
          <input
            value={voucherInput}
            onChange={(e) => {
              setVoucherInput(e.target.value.toUpperCase())
              setVoucherError('')
            }}
            placeholder="Nhập mã voucher (ví dụ: NOVA20K)..."
            className="flex-1 rounded-sm border border-line px-3 py-2 text-[13px] uppercase outline-none focus:border-brand"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (voucherInput.trim()) {
                  setAppliedVoucher(voucherInput.trim().toUpperCase())
                  resetIdempotencyKey()
                }
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (voucherInput.trim()) {
                setAppliedVoucher(voucherInput.trim().toUpperCase())
                resetIdempotencyKey()
              }
            }}
            disabled={previewLoading || !voucherInput.trim()}
            className="rounded-sm bg-brand px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50 cursor-pointer"
          >
            {previewLoading ? 'Kiểm tra...' : 'Áp Dụng'}
          </button>
          {appliedVoucher ? (
            <button
              type="button"
              onClick={() => {
                setAppliedVoucher('')
                setVoucherInput('')
                setVoucherError('')
                resetIdempotencyKey()
              }}
              className="rounded-sm border border-line px-3 py-2 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand cursor-pointer"
            >
              Bỏ mã
            </button>
          ) : null}
        </div>

        {/* Thông báo lỗi voucher từ Backend */}
        {voucherError ? (
          <p className="mt-2 text-[12px] font-medium text-rose-600">
            ❌ {voucherError}
          </p>
        ) : null}

        {/* Thông báo voucher áp dụng thành công từ Backend */}
        {!voucherError && appliedVoucher && preview?.discountAmount ? (
          <p className="mt-2 text-[12px] font-medium text-emerald-600">
            ✓ Đã áp dụng mã <b>{appliedVoucher}</b>: Giảm {formatVnd(preview.discountAmount)}
          </p>
        ) : null}

        {/* Mã gợi ý để bấm nhanh */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-muted">Gợi ý mã:</span>
          {['NOVA20K', 'NOVA50K'].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setVoucherInput(code)
                setAppliedVoucher(code)
                setVoucherError('')
                resetIdempotencyKey()
              }}
              className={`rounded-sm border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                appliedVoucher === code
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-line text-ink-soft hover:border-brand hover:text-brand'
              }`}
            >
              🎟️ {code}
            </button>
          ))}
        </div>
      </section>

      {/* ---------- PHƯƠNG THỨC THANH TOÁN + GHI CHÚ ---------- */}
      <section className="mt-3 rounded-sm bg-white">
        <h2 className="border-b border-line px-4 py-3 text-[15px] font-semibold text-ink">Phương Thức Thanh Toán</h2>
        <div className="divide-y divide-line">
          {checkoutPayments.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPayment(p.id)
                resetIdempotencyKey()
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-page/60 cursor-pointer"
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
            onChange={(e) => {
              setNote(e.target.value)
              resetIdempotencyKey()
            }}
            rows={2}
            placeholder="Ví dụ: giao giờ hành chính, gọi trước khi giao..."
            className="w-full resize-none rounded-sm border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
        </div>
      </section>

      {/* Khung báo lỗi và nút thử lại khi tạo đơn gặp lỗi */}
      {submitError ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-rose-300 bg-rose-50 p-4 text-[13px] text-rose-700">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{submitError}</span>
          </div>
          <button
            type="button"
            onClick={() => placeOrder(true)}
            disabled={submitting}
            className="rounded-sm bg-rose-600 px-4 py-1.5 text-[12px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
          >
            Thử Lại Ngay
          </button>
        </div>
      ) : null}

      {/* ---------- THANH ĐẶT HÀNG (STICKY FOOTER) ---------- */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="container-shop flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-soft">
            <span>
              Tổng tiền hàng: <Price value={totals.subtotal} size="sm" className="text-ink" />
            </span>
            <span>
              Phí vận chuyển:{' '}
              {totals.shippingTotal === 0 ? (
                <span className="text-free font-medium">Miễn phí</span>
              ) : (
                <Price value={totals.shippingTotal} size="sm" className="text-ink" />
              )}
            </span>
            {totals.voucherValue ? (
              <span className="text-free font-medium">
                Voucher {totals.voucherCode}: -<Price value={totals.voucherValue} size="sm" className="text-free" />
              </span>
            ) : null}
            {previewLoading ? (
              <span className="text-[12px] font-medium text-brand animate-pulse">
                (Đang tính toán...)
              </span>
            ) : null}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-4">
            <span className="text-[13px] text-ink-soft">
              Tổng thanh toán:
              <Price value={totals.total} size="lg" className="ml-1 text-brand font-bold" />
            </span>
            <button
              type="button"
              onClick={() => placeOrder(false)}
              disabled={submitting || previewLoading || Boolean(previewError)}
              className="rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-10 py-2.5 text-[14px] font-semibold text-[#FFFCF7] transition cursor-pointer shadow-xs disabled:opacity-60"
            >
              {submitting ? 'Đang đặt hàng...' : previewLoading ? 'Đang tính...' : 'Đặt Hàng'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
