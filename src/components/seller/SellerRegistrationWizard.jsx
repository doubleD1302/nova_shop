import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { vietnamProvinces } from '../../data/locations'
import { isValidEmail, normalizeEmail } from '../../utils/validation'
import { IconCheck, IconClose, IconStore, IconTruck } from '../ui/Icons'

/**
 * QUY TRÌNH ĐĂNG KÝ NGƯỜI BÁN CHUẨN SHOPEE SELLER CENTRE
 * 1. Màn hình Chào mừng (Welcome): Ảnh minh họa + "Chào mừng đến với NovaShop!" + Nút "Bắt đầu đăng ký"
 * 2. Stepper 5 bước: Thông tin Shop -> Cài đặt vận chuyển -> Thông tin định danh -> Thông tin thuế -> Hoàn tất
 */
export default function SellerRegistrationWizard({
  user,
  openSellerShop,
  loadSellerShop,
  register,
  pushToast,
}) {
  const navigate = useNavigate()

  // currentStep: 0 = Màn hình Welcome, 1..5 = Các bước Stepper
  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Modal thêm địa chỉ lấy hàng
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [addressDraft, setAddressDraft] = useState({
    province: 'TP. Hồ Chí Minh',
    detail: '',
  })

  // Dữ liệu form xuyên suốt các bước
  const [form, setForm] = useState({
    // Bước 1: Thông tin Shop
    shopName: '',
    shopTagline: '',
    pickupAddress: '',
    province: 'TP. Hồ Chí Minh',
    email: user?.email || '',
    phone: user?.phone || '',

    // Nếu chưa đăng nhập tài khoản
    fullName: '',
    username: '',
    password: '',
    confirmPassword: '',

    // Bước 2: Cài đặt vận chuyển
    shippingNhanh: true,
    shippingTietKiem: true,
    shippingHoaToc: false,

    // Bước 3: Thông tin định danh
    businessType: 'personal', // 'personal' | 'household' | 'enterprise'
    ownerName: user?.fullName || '',
    idCard: '',

    // Bước 4: Thông tin thuế
    taxCode: '',
    invoiceEmail: user?.email || '',
    agreeTerms: false,
  })

  const setField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
    setError('')
  }

  const setCheckbox = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.checked }))
  }

  // Lưu địa chỉ từ modal
  const handleSaveAddress = () => {
    if (!addressDraft.detail.trim()) {
      pushToast('Vui lòng nhập địa chỉ chi tiết (số nhà, tên đường, phường/xã).', 'error')
      return
    }
    const fullAddress = `${addressDraft.detail.trim()}, ${addressDraft.province}`
    setForm((prev) => ({
      ...prev,
      pickupAddress: fullAddress,
      province: addressDraft.province,
    }))
    setAddressModalOpen(false)
  }

  // Chuyển bước kế tiếp với validation từng bước
  const handleNextStep = async () => {
    setError('')

    // Validate Bước 1
    if (currentStep === 1) {
      const name = form.shopName.trim()
      if (!name) {
        setError('Vui lòng nhập Tên Shop (bắt buộc).')
        return
      }
      if (name.length < 3 || name.length > 30) {
        setError('Tên Shop phải có độ dài từ 3 đến 30 ký tự.')
        return
      }
      if (!form.pickupAddress) {
        setError('Vui lòng bấm "+ Thêm" để thiết lập địa chỉ lấy hàng của Shop.')
        return
      }
      if (!form.email || !isValidEmail(form.email)) {
        setError('Vui lòng nhập email hợp lệ để nhận thông báo đơn hàng.')
        return
      }
      if (!form.phone.trim() || !/^[+()\d .-]{8,20}$/.test(form.phone.trim())) {
        setError('Vui lòng nhập số điện thoại hợp lệ.')
        return
      }

      // Nếu chưa có tài khoản, cần validate thông tin đăng ký
      if (!user) {
        if (!form.fullName.trim() || !form.username.trim() || !form.password) {
          setError('Vui lòng điền họ tên, tên đăng nhập và mật khẩu tài khoản người bán.')
          return
        }
        if (!/^[a-z0-9_]{3,50}$/i.test(form.username.trim())) {
          setError('Tên đăng nhập phải từ 3–50 ký tự (chữ cái, chữ số hoặc dấu gạch dưới).')
          return
        }
        if (form.password.length < 8) {
          setError('Mật khẩu phải có ít nhất 8 ký tự.')
          return
        }
        if (form.password !== form.confirmPassword) {
          setError('Mật khẩu nhập lại không khớp.')
          return
        }
      }
      setCurrentStep(2)
      return
    }

    // Validate Bước 2: Vận chuyển
    if (currentStep === 2) {
      if (!form.shippingNhanh && !form.shippingTietKiem && !form.shippingHoaToc) {
        setError('Vui lòng kích hoạt ít nhất 1 phương thức vận chuyển cho Shop.')
        return
      }
      setCurrentStep(3)
      return
    }

    // Validate Bước 3: Định danh
    if (currentStep === 3) {
      if (!form.ownerName.trim()) {
        setError('Vui lòng nhập họ và tên chủ sở hữu / người đại diện.')
        return
      }
      if (!form.idCard.trim()) {
        setError('Vui lòng nhập số CMND / CCCD / Hộ chiếu của chủ Shop.')
        return
      }
      if (!/^\d{9,12}$/.test(form.idCard.trim())) {
        setError('Số CMND / CCCD hợp lệ phải có từ 9 đến 12 chữ số.')
        return
      }
      setCurrentStep(4)
      return
    }

    // Validate Bước 4: Thuế & Gửi duyệt
    if (currentStep === 4) {
      if (!form.agreeTerms) {
        setError('Bạn cần đồng ý với Quy chế hoạt động sàn TMĐT NovaShop để tiếp tục.')
        return
      }

      if (form.taxCode.trim() && !/^\d{10}(?:-\d{3})?$/.test(form.taxCode.trim())) {
        setError('Mã số thuế không hợp lệ.')
        return
      }
      if (form.invoiceEmail.trim() && !isValidEmail(form.invoiceEmail.trim())) {
        setError('Email nhận hóa đơn không hợp lệ.')
        return
      }
      const sellerProfile = {
        pickupAddress: form.pickupAddress, province: form.province,
        contactEmail: normalizeEmail(form.email), contactPhone: form.phone.trim(),
        shippingMethods: [form.shippingNhanh && 'nhanh', form.shippingTietKiem && 'tietkiem', form.shippingHoaToc && 'hoatoc'].filter(Boolean),
        businessType: form.businessType, ownerName: form.ownerName.trim(), idCard: form.idCard.trim(),
        taxCode: form.taxCode.trim(), invoiceEmail: form.invoiceEmail.trim(), agreeTerms: form.agreeTerms,
      }
      setSubmitting(true)
      try {
        if (!user) {
          // Tạo tài khoản người bán mới
          const res = await register({
            fullName: form.fullName.trim() || form.ownerName.trim(),
            username: form.username.trim(),
            password: form.password,
            email: normalizeEmail(form.email),
            phone: form.phone.trim(),
            role: 'seller',
            shopName: form.shopName.trim(),
            shopTagline: form.shopTagline.trim(),
            sellerProfile,
          })
          if (!res.ok) {
            throw new Error(res.error || 'Không thể tạo tài khoản người bán.')
          }
        } else {
          // Người dùng đã đăng nhập: Mở gian hàng
          const res = await openSellerShop(form.shopName.trim(), sellerProfile, form.shopTagline.trim())
          if (!res.ok) {
            throw new Error(res.error || 'Không thể mở gian hàng.')
          }
        }

        // Tải lại thông tin gian hàng người bán
        try {
          await loadSellerShop()
        } catch {}

        pushToast('Đăng ký mở gian hàng thành công! Hồ sơ đang chờ Ban Quản Trị duyệt.', 'success')
        setCurrentStep(5) // Chuyển sang màn hình Hoàn tất
      } catch (submitErr) {
        setError(submitErr.message || 'Có lỗi xảy ra khi tạo gian hàng. Vui lòng thử lại.')
      } finally {
        setSubmitting(false)
      }
    }
  }

  // =========================================================================
  // GIAO DIỆN 1: MÀN HÌNH CHÀO MỪNG (THEO ẢNH MINH HỌA SHOPEE WELCOME)
  // =========================================================================
  if (currentStep === 0) {
    return (
      <div className="min-h-screen bg-[#FBF3E8] py-12 px-4 flex items-center justify-center">
        <div className="w-full max-w-[680px] rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-8 sm:p-12 text-center shadow-sm">
          {/* Hình minh họa phong cách Shopee Welcome */}
          <div className="mx-auto mb-6 flex h-36 w-36 items-center justify-center rounded-full bg-[#FFEFE7] shadow-inner relative">
            <div className="absolute inset-2 rounded-full border border-dashed border-[#BD6E49]/30" />
            <svg
              className="h-20 w-20 text-[#BD6E49]"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Cửa hàng & Tài liệu đăng ký */}
              <rect x="12" y="18" width="40" height="32" rx="4" fill="#FFFCF7" stroke="#BD6E49" strokeWidth="2.5" />
              <path d="M12 28H52" stroke="#BD6E49" strokeWidth="2" strokeDasharray="2 2" />
              <path d="M20 36H36" stroke="#BD6E49" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M20 42H28" stroke="#BD6E49" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="44" cy="39" r="4" fill="#FFEFE7" stroke="#BD6E49" strokeWidth="2" />
              {/* Mái vòm shop phía trên */}
              <path d="M8 18L14 8H50L56 18H8Z" fill="#BD6E49" />
              <path d="M16 18C16 20.2 14.2 22 12 22C9.8 22 8 20.2 8 18" fill="#A95532" />
              <path d="M24 18C24 20.2 22.2 22 20 22C17.8 22 16 20.2 16 18" fill="#BD6E49" />
              <path d="M32 18C32 20.2 30.2 22 28 22C25.8 22 24 20.2 24 18" fill="#A95532" />
              <path d="M40 18C40 20.2 38.2 22 36 22C33.8 22 32 20.2 32 18" fill="#BD6E49" />
              <path d="M48 18C48 20.2 46.2 22 44 22C41.8 22 40 20.2 40 18" fill="#A95532" />
              <path d="M56 18C56 20.2 54.2 22 52 22C49.8 22 48 20.2 48 18" fill="#BD6E49" />
            </svg>
          </div>

          {/* Tiêu đề & Phụ đề đúng chuẩn */}
          <h1 className="text-[22px] sm:text-[24px] font-bold text-[#49352D]">
            Chào mừng đến với Kênh Người Bán NovaShop!
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-[#8B7566] max-w-md mx-auto">
            Vui lòng cung cấp thông tin để thành lập tài khoản người bán trên NovaShop
          </p>

          {/* Nút "Bắt đầu đăng ký" màu cam đỏ nổi bật */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center justify-center rounded-xl bg-[#EE4D2D] hover:bg-[#D73211] active:scale-[0.99] px-10 py-3 text-[15px] font-bold text-white shadow-md transition-all duration-200 cursor-pointer"
            >
              Bắt đầu đăng ký
            </button>

            {!user ? (
              <p className="mt-3 text-[13px] text-[#8B7566]">
                Đã có tài khoản người bán?{' '}
                <Link
                  to="/dang-nhap"
                  state={{ from: '/nguoi-ban' }}
                  className="font-semibold text-[#BD6E49] hover:underline"
                >
                  Đăng nhập ngay
                </Link>
              </p>
            ) : null}

            <Link to="/" className="mt-4 text-[12px] text-[#8B7566] hover:text-[#BD6E49] transition">
              ← Quay lại trang chủ mua sắm
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // GIAO DIỆN 2: STEPPER WIZARD 5 BƯỚC (THEO ẢNH MINH HỌA STEPPER)
  // =========================================================================
  const steps = [
    { id: 1, title: 'Thông tin Shop' },
    { id: 2, title: 'Cài đặt vận chuyển' },
    { id: 3, title: 'Thông tin định danh' },
    { id: 4, title: 'Thông tin thuế' },
    { id: 5, title: 'Hoàn tất' },
  ]

  const inputClass =
    'w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3.5 py-2.5 text-[13px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#EE4D2D] focus:ring-2 focus:ring-[#EE4D2D]/20'

  return (
    <div className="min-h-screen bg-[#FBF3E8] py-8 sm:py-12 px-4">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] shadow-sm overflow-hidden">
        {/* ======================================================== */}
        {/* THANH STEPPER TRÊN ĐẦU (GIỐNG ẢNH 3 MINH HỌA)             */}
        {/* ======================================================== */}
        <div className="border-b border-[#E6D5C2] bg-[#FFFCF7] px-6 py-6 sm:px-12">
          <div className="relative flex items-center justify-between">
            {/* Đường kẻ ngang xám nối các bước */}
            <div className="absolute left-6 right-6 top-3 h-[2px] bg-[#E6D5C2] -z-0" />
            {/* Đường kẻ ngang màu cam tiến trình */}
            <div
              className="absolute left-6 top-3 h-[2px] bg-[#EE4D2D] transition-all duration-300 -z-0"
              style={{
                width: `${((Math.min(currentStep, 5) - 1) / (steps.length - 1)) * 100}%`,
              }}
            />

            {steps.map((st) => {
              const isCurrent = currentStep === st.id
              const isCompleted = currentStep > st.id
              return (
                <div key={st.id} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-200 ${
                      isCurrent
                        ? 'bg-[#EE4D2D] text-white ring-4 ring-[#EE4D2D]/20'
                        : isCompleted
                        ? 'bg-[#EE4D2D] text-white'
                        : 'bg-[#E6D5C2] text-[#8B7566]'
                    }`}
                  >
                    {isCompleted ? '✓' : st.id}
                  </div>
                  <span
                    className={`mt-2 text-center text-[12px] sm:text-[13px] transition ${
                      isCurrent
                        ? 'font-bold text-[#EE4D2D]'
                        : isCompleted
                        ? 'font-medium text-[#49352D]'
                        : 'text-[#8B7566]'
                    }`}
                  >
                    {st.title}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* NỘI DUNG TỪNG BƯỚC                                       */}
        {/* ======================================================== */}
        <div className="p-6 sm:p-10">
          {error ? (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[13px] text-rose-700">
              {error}
            </div>
          ) : null}

          {/* BƯỚC 1: THÔNG TIN SHOP */}
          {currentStep === 1 ? (
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Tên Shop */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <label className="sm:w-44 text-[13px] font-medium text-[#49352D] shrink-0 text-left sm:text-right">
                  <span className="text-rose-500 font-bold">* </span>Tên Shop
                </label>
                <div className="relative flex-1">
                  <input
                    value={form.shopName}
                    onChange={setField('shopName')}
                    maxLength={30}
                    placeholder="Nhập tên Shop của bạn..."
                    className={inputClass}
                  />
                  <span className="absolute right-3 top-2.5 text-[12px] text-[#8B7566]">
                    {form.shopName.length}/30
                  </span>
                </div>
              </div>

              {/* Slogan */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <label className="sm:w-44 text-[13px] font-medium text-[#49352D] shrink-0 text-left sm:text-right">
                  Slogan gian hàng
                </label>
                <div className="flex-1">
                  <input
                    value={form.shopTagline}
                    onChange={setField('shopTagline')}
                    maxLength={100}
                    placeholder="Ví dụ: Thời trang thiết kế chính hãng, Giao hàng siêu tốc..."
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Địa chỉ lấy hàng */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <label className="sm:w-44 text-[13px] font-medium text-[#49352D] shrink-0 text-left sm:text-right">
                  <span className="text-rose-500 font-bold">* </span>Địa chỉ lấy hàng
                </label>
                <div className="flex-1">
                  {form.pickupAddress ? (
                    <div className="flex items-center justify-between rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3 text-[13px] text-[#49352D]">
                      <span className="font-medium line-clamp-1">{form.pickupAddress}</span>
                      <button
                        type="button"
                        onClick={() => setAddressModalOpen(true)}
                        className="ml-3 shrink-0 text-[12px] font-semibold text-[#EE4D2D] hover:underline cursor-pointer"
                      >
                        Thay đổi
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddressModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#EE4D2D] bg-[#FFEFE7] px-4 py-2 text-[13px] font-semibold text-[#EE4D2D] hover:bg-[#FDE2D7] transition cursor-pointer"
                    >
                      <span>+</span>
                      <span>Thêm địa chỉ</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <label className="sm:w-44 text-[13px] font-medium text-[#49352D] shrink-0 text-left sm:text-right">
                  <span className="text-rose-500 font-bold">* </span>Email
                </label>
                <div className="flex-1">
                  <input
                    type="email"
                    value={form.email}
                    onChange={setField('email')}
                    disabled={Boolean(user?.email)}
                    placeholder="email@example.com"
                    className={`${inputClass} ${user?.email ? 'bg-gray-50 text-gray-600' : ''}`}
                  />
                </div>
              </div>

              {/* Số điện thoại */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <label className="sm:w-44 text-[13px] font-medium text-[#49352D] shrink-0 text-left sm:text-right">
                  <span className="text-rose-500 font-bold">* </span>Số điện thoại
                </label>
                <div className="flex flex-1 items-center">
                  <span className="grid h-[42px] place-items-center rounded-l-xl border border-r-0 border-[#E6D5C2] bg-[#FBF3E8] px-3.5 text-[13px] font-semibold text-[#49352D]">
                    +84
                  </span>
                  <input
                    value={form.phone.replace(/^\+84/, '')}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Nhập số điện thoại..."
                    className="w-full rounded-r-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3.5 py-2.5 text-[13px] text-[#49352D] outline-none transition focus:border-[#EE4D2D] focus:ring-2 focus:ring-[#EE4D2D]/20"
                  />
                </div>
              </div>

              {/* Nếu người dùng chưa đăng nhập: Yêu cầu tạo tài khoản để liên kết */}
              {!user ? (
                <div className="mt-8 rounded-2xl border border-dashed border-[#EE4D2D] bg-[#FFEFE7]/60 p-5 space-y-4">
                  <h3 className="text-[14px] font-bold text-[#49352D] flex items-center gap-2">
                    <IconStore className="h-4 w-4 text-[#EE4D2D]" />
                    <span>Thiết lập tài khoản người bán</span>
                  </h3>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="block text-[12px] font-medium text-[#49352D] mb-1">
                        Họ và tên chủ sở hữu <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={form.fullName}
                        onChange={setField('fullName')}
                        placeholder="Nguyễn Văn A"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#49352D] mb-1">
                        Tên đăng nhập <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={form.username}
                        onChange={setField('username')}
                        placeholder="seller_username"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#49352D] mb-1">
                        Mật khẩu <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={setField('password')}
                        placeholder="Tối thiểu 8 ký tự"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#49352D] mb-1">
                        Nhập lại mật khẩu <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={form.confirmPassword}
                        onChange={setField('confirmPassword')}
                        placeholder="Khớp với mật khẩu trên"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* BƯỚC 2: CÀI ĐẶT VẬN CHUYỂN */}
          {currentStep === 2 ? (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="rounded-2xl border border-[#E6D5C2] bg-[#FBF3E8] p-4 text-[13px] text-[#49352D]">
                <p className="font-bold flex items-center gap-2 text-[#49352D]">
                  <IconTruck className="h-4 w-4 text-[#EE4D2D]" />
                  <span>Cài đặt phương thức vận chuyển cho Shop</span>
                </p>
                <p className="mt-1 text-[12px] text-[#8B7566]">
                  Lựa chọn các đơn vị vận chuyển đối tác để giao sản phẩm của bạn tới khách hàng trên toàn quốc.
                </p>
              </div>

              <div className="space-y-3">
                {/* Vận chuyển Nhanh */}
                <label className="flex items-start justify-between gap-4 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 cursor-pointer hover:border-[#EE4D2D] transition">
                  <div className="flex-1">
                    <p className="font-bold text-[14px] text-[#49352D] flex items-center gap-2">
                      <span>⚡ Vận chuyển Nhanh</span>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                        Khuyên dùng
                      </span>
                    </p>
                    <p className="mt-1 text-[12px] text-[#8B7566]">
                      Giao Hàng Nhanh (GHN), Viettel Post, SPX Express. Thời gian giao 1–3 ngày làm việc.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.shippingNhanh}
                    onChange={setCheckbox('shippingNhanh')}
                    className="h-5 w-5 rounded accent-[#EE4D2D] cursor-pointer"
                  />
                </label>

                {/* Vận chuyển Tiết Kiệm */}
                <label className="flex items-start justify-between gap-4 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 cursor-pointer hover:border-[#EE4D2D] transition">
                  <div className="flex-1">
                    <p className="font-bold text-[14px] text-[#49352D]">
                      📦 Vận chuyển Tiết Kiệm
                    </p>
                    <p className="mt-1 text-[12px] text-[#8B7566]">
                      Giao Hàng Tiết Kiệm (GHTK), VNPost Bưu Điện. Tối ưu chi phí ship cho người mua.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.shippingTietKiem}
                    onChange={setCheckbox('shippingTietKiem')}
                    className="h-5 w-5 rounded accent-[#EE4D2D] cursor-pointer"
                  />
                </label>

                {/* Vận chuyển Hỏa Tốc */}
                <label className="flex items-start justify-between gap-4 rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 cursor-pointer hover:border-[#EE4D2D] transition">
                  <div className="flex-1">
                    <p className="font-bold text-[14px] text-[#49352D]">
                      🚀 Vận chuyển Hỏa Tốc
                    </p>
                    <p className="mt-1 text-[12px] text-[#8B7566]">
                      Ahamove, GrabExpress. Giao siêu tốc trong 1–2 giờ (áp dụng nội thành cùng tỉnh/thành phố).
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.shippingHoaToc}
                    onChange={setCheckbox('shippingHoaToc')}
                    className="h-5 w-5 rounded accent-[#EE4D2D] cursor-pointer"
                  />
                </label>
              </div>

              {/* Tỉnh thành kho hàng */}
              <div className="pt-2">
                <label className="block text-[13px] font-medium text-[#49352D] mb-1.5">
                  Tỉnh / Thành phố kho gửi hàng:
                </label>
                <select
                  value={form.province}
                  onChange={setField('province')}
                  className={inputClass}
                >
                  {vietnamProvinces.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} ({p.region})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {/* BƯỚC 3: THÔNG TIN ĐỊNH DANH */}
          {currentStep === 3 ? (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <label className="block text-[13px] font-bold text-[#49352D] mb-2">
                  Loại hình kinh doanh:
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'personal', label: 'Cá nhân' },
                    { id: 'household', label: 'Hộ kinh doanh' },
                    { id: 'enterprise', label: 'Doanh nghiệp' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, businessType: item.id }))}
                      className={`rounded-xl border p-3 text-center text-[13px] font-semibold transition cursor-pointer ${
                        form.businessType === item.id
                          ? 'border-[#EE4D2D] bg-[#FFEFE7] text-[#EE4D2D]'
                          : 'border-[#E6D5C2] bg-[#FFFCF7] text-[#8B7566] hover:border-[#EE4D2D]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#49352D] mb-1.5">
                  <span className="text-rose-500 font-bold">* </span>Họ và tên chủ sở hữu / Người đại diện
                </label>
                <input
                  value={form.ownerName}
                  onChange={setField('ownerName')}
                  placeholder="Họ và tên trên giấy tờ..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#49352D] mb-1.5">
                  <span className="text-rose-500 font-bold">* </span>Số CMND / CCCD / Hộ chiếu (9 - 12 chữ số)
                </label>
                <input
                  value={form.idCard}
                  onChange={setField('idCard')}
                  maxLength={12}
                  placeholder="Ví dụ: 001201012345"
                  className={inputClass}
                />
              </div>
            </div>
          ) : null}

          {/* BƯỚC 4: THÔNG TIN THUẾ */}
          {currentStep === 4 ? (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="rounded-2xl border border-[#E6D5C2] bg-[#FBF3E8] p-4 text-[13px] text-[#49352D]">
                <p className="font-bold">Khai báo mã số thuế</p>
                <p className="mt-1 text-[12px] text-[#8B7566]">
                  Theo quy định của Tổng cục Thuế đối với người bán hàng trên sàn TMĐT. Nếu bạn là cá nhân chưa có MST, có thể cập nhật sau.
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#49352D] mb-1.5">
                  Mã số thuế cá nhân / hộ kinh doanh (tùy chọn)
                </label>
                <input
                  value={form.taxCode}
                  onChange={setField('taxCode')}
                  placeholder="Ví dụ: 8012345678"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#49352D] mb-1.5">
                  Email nhận hóa đơn và thông báo thuế
                </label>
                <input
                  type="email"
                  value={form.invoiceEmail}
                  onChange={setField('invoiceEmail')}
                  placeholder="email@example.com"
                  className={inputClass}
                />
              </div>

              {/* Điều khoản */}
              <label className="flex items-start gap-3 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agreeTerms}
                  onChange={setCheckbox('agreeTerms')}
                  className="mt-0.5 h-4 w-4 rounded accent-[#EE4D2D] cursor-pointer"
                />
                <span className="text-[12px] leading-relaxed text-[#49352D]">
                  Tôi cam kết mọi thông tin khai báo trên là chính xác, không vi phạm bản quyền thương hiệu và đồng ý tuân thủ{' '}
                  <span className="font-semibold text-[#EE4D2D]">Quy chế hoạt động sàn TMĐT NovaShop</span>.
                </span>
              </label>
            </div>
          ) : null}

          {/* BƯỚC 5: HOÀN TẤT */}
          {currentStep === 5 ? (
            <div className="py-8 text-center max-w-lg mx-auto space-y-4">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600 text-3xl shadow-sm">
                <IconCheck className="h-10 w-10" />
              </div>

              <h2 className="text-[22px] font-bold text-[#49352D]">
                Đăng ký mở gian hàng thành công!
              </h2>

              <p className="text-[14px] leading-relaxed text-[#8B7566]">
                Hồ sơ gian hàng <b>"{form.shopName}"</b> của bạn đã được khởi tạo và gửi lên Ban Quản Trị NovaShop.
              </p>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900 text-left">
                <p className="font-bold flex items-center gap-1.5">
                  <span>⏳ Trạng thái:</span>
                  <span>Chờ phê duyệt (Pending)</span>
                </p>
                <p className="mt-1 text-[12px] text-amber-800 leading-relaxed">
                  Ban Quản Trị sẽ xét duyệt hồ sơ trong thời gian sớm nhất. Bạn đã có thể bắt đầu truy cập Kênh Người Bán để thiết lập sản phẩm, ảnh đại diện và hồ sơ gian hàng.
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => navigate(0)} // Reload để SellerLayout tự nạp gian hàng
                  className="rounded-xl bg-[#EE4D2D] hover:bg-[#D73211] px-8 py-3 text-[14px] font-bold text-white shadow-md transition cursor-pointer"
                >
                  Vào Kênh Người Bán Ngay
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ======================================================== */}
        {/* THANH ĐIỀU HƯỚNG DƯỚI CÙNG (LƯU / TIẾP THEO)             */}
        {/* ======================================================== */}
        {currentStep >= 1 && currentStep <= 4 ? (
          <div className="flex items-center justify-between border-t border-[#E6D5C2] bg-[#FBF3E8] px-6 py-4 sm:px-10">
            <div>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => prev - 1)}
                  disabled={submitting}
                  className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] hover:bg-[#F5E7D4] px-6 py-2.5 text-[13px] font-semibold text-[#49352D] shadow-2xs transition disabled:opacity-50 cursor-pointer"
                >
                  Quay lại
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCurrentStep(0)}
                  className="rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] hover:bg-[#F5E7D4] px-5 py-2.5 text-[13px] font-semibold text-[#8B7566] transition cursor-pointer"
                >
                  Hủy
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleNextStep}
                disabled={submitting}
                className="rounded-xl bg-[#EE4D2D] hover:bg-[#D73211] active:scale-[0.99] px-8 py-2.5 text-[13px] font-bold text-white shadow-2xs transition disabled:opacity-50 cursor-pointer"
              >
                {submitting
                  ? 'Đang gửi hồ sơ...'
                  : currentStep === 4
                  ? 'Hoàn tất & Gửi duyệt'
                  : 'Tiếp theo'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ======================================================== */}
      {/* MODAL THÊM ĐỊA CHỈ LẤY HÀNG                              */}
      {/* ======================================================== */}
      {addressModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-[#E6D5C2] bg-[#FFFCF7] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3">
              <h3 className="text-[15px] font-bold text-[#49352D]">Địa chỉ lấy hàng của Shop</h3>
              <button
                type="button"
                onClick={() => setAddressModalOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-[#8B7566] hover:bg-[#F5E7D4]"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-[13px]">
              <div>
                <label className="block text-[12px] font-medium text-[#49352D] mb-1">
                  Tỉnh / Thành phố
                </label>
                <select
                  value={addressDraft.province}
                  onChange={(e) => setAddressDraft((p) => ({ ...p, province: e.target.value }))}
                  className={inputClass}
                >
                  {vietnamProvinces.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#49352D] mb-1">
                  Địa chỉ chi tiết (Số nhà, tên đường, phường/xã)
                </label>
                <textarea
                  value={addressDraft.detail}
                  onChange={(e) => setAddressDraft((p) => ({ ...p, detail: e.target.value }))}
                  rows={3}
                  placeholder="Ví dụ: 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1..."
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-[#E6D5C2] pt-3">
              <button
                type="button"
                onClick={() => setAddressModalOpen(false)}
                className="rounded-xl border border-[#E6D5C2] px-4 py-2 text-[12px] font-semibold text-[#8B7566] hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveAddress}
                className="rounded-xl bg-[#EE4D2D] hover:bg-[#D73211] px-5 py-2 text-[12px] font-bold text-white shadow-2xs"
              >
                Lưu địa chỉ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
