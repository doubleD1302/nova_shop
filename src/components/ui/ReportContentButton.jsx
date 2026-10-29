import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { apiCreateContentReport, apiUploadSellerImage } from '../../utils/api'
import { IconClose } from '../ui/Icons'

const REASON_OPTIONS = {
  product: [
    {
      id: 'counterfeit',
      label: 'Nghi ngờ hàng giả, hàng nhái, vi phạm thương hiệu',
      desc: 'Sản phẩm có dấu hiệu sao chép, làm giả tem nhãn, logo hoặc xuất xứ không chính hãng.',
    },
    {
      id: 'prohibited',
      label: 'Hàng cấm kinh doanh hoặc vi phạm pháp luật',
      desc: 'Hàng hóa bị pháp luật nghiêm cấm buôn bán hoặc vi phạm quy định sàn.',
    },
    {
      id: 'misleading',
      label: 'Mô tả sai lệch, hàng không đúng thực tế',
      desc: 'Thông số kỹ thuật, hình ảnh minh họa hoặc công dụng bị phóng đại, sai sự thật.',
    },
    {
      id: 'inappropriate',
      label: 'Hình ảnh hoặc nội dung phản cảm',
      desc: 'Chứa hình ảnh hoặc từ ngữ bạo lực, xúc phạm, không phù hợp thuần phong mỹ tục.',
    },
    {
      id: 'other',
      label: 'Lý do vi phạm khác',
      desc: 'Các hành vi vi phạm chính sách khác chưa được liệt kê ở trên.',
    },
  ],
  shop: [
    { id: 'counterfeit_shop', label: 'Gian hàng chuyên bán hàng giả, hàng nhái', desc: 'Có nhiều sản phẩm làm giả thương hiệu.' },
    { id: 'scam', label: 'Dấu hiệu lừa đảo khách hàng', desc: 'Giao hàng sai, từ chối hỗ trợ hoặc gian lận thanh toán.' },
    { id: 'prohibited_shop', label: 'Bán hàng cấm hoặc vi phạm pháp luật', desc: 'Kinh doanh các mặt hàng bị cấm.' },
    { id: 'other', label: 'Lý do khác', desc: 'Vi phạm các chính sách khác của sàn.' },
  ],
  review: [
    { id: 'offensive', label: 'Nội dung phản cảm, thô tục', desc: 'Chứa ngôn từ xúc phạm hoặc bôi nhọ.' },
    { id: 'spam', label: 'Spam hoặc quảng cáo không liên quan', desc: 'Đăng liên kết hoặc nội dung quảng cáo rác.' },
    { id: 'fake_review', label: 'Đánh giá ảo, sai thực tế', desc: 'Nhằm mục đích cạnh tranh không lành mạnh.' },
  ],
  user: [
    { id: 'harassment', label: 'Quấy rối hoặc hành vi đe dọa', desc: 'Nhắn tin quấy rối hoặc bôi nhọ.' },
    { id: 'fraud', label: 'Gian lận hoặc giả mạo người khác', desc: 'Mạo danh để lừa gạt cộng đồng.' },
  ],
}

/**
 * Nút và Dialog Báo Cáo Vi Phạm Sản Phẩm / Shop / Đánh Giá
 * Lưu dữ liệu thật vào bảng `abuse_reports` qua POST /api/v1/reports
 */
export default function ReportContentButton({
  targetType = 'product',
  targetId,
  targetName = '',
  product = null,
  shopName = '',
  buttonLabel = 'Báo cáo sản phẩm',
  variant = 'button', // 'button' | 'link'
  className = '',
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { pushToast } = useToast()

  const [open, setOpen] = useState(false)
  const [selectedReasonId, setSelectedReasonId] = useState('counterfeit')
  const [details, setDetails] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [busy, setBusy] = useState(false)

  const fileInputRef = useRef(null)

  const reasons = REASON_OPTIONS[targetType] || REASON_OPTIONS.product

  const handleOpen = () => {
    if (!user) {
      pushToast('Vui lòng đăng nhập để gửi báo cáo vi phạm.', 'info')
      navigate('/dang-nhap', { state: { from: `${location.pathname}${location.search}` } })
      return
    }
    setOpen(true)
  }

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i)) {
      pushToast('Vui lòng chọn ảnh định dạng PNG, JPG hoặc WebP.', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      pushToast('Kích thước ảnh tối đa là 5 MB.', 'error')
      return
    }

    setUploadingImage(true)
    try {
      const response = await apiUploadSellerImage(file)
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success || !data?.data?.url) {
        throw new Error(data?.message || 'Tải ảnh bằng chứng thất bại.')
      }
      setEvidenceUrl(data.data.url)
      pushToast('Đã đính kèm ảnh bằng chứng.', 'success')
    } catch (err) {
      pushToast(err.message || 'Không thể tải ảnh bằng chứng lên hệ thống.', 'error')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeEvidence = () => {
    setEvidenceUrl('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!user) {
      navigate('/dang-nhap', { state: { from: `${location.pathname}${location.search}` } })
      return
    }

    const trimmedDetails = details.trim()
    if (trimmedDetails.length < 10) {
      pushToast('Vui lòng nhập mô tả chi tiết bằng chứng vi phạm ít nhất 10 ký tự.', 'error')
      return
    }

    const selectedOption = reasons.find((r) => r.id === selectedReasonId)
    const reasonTitle = selectedOption?.label || 'Báo cáo vi phạm'
    const fullReason = `${reasonTitle}: ${trimmedDetails}`

    setBusy(true)
    try {
      const response = await apiCreateContentReport({
        targetType,
        targetId,
        reason: fullReason,
        details: trimmedDetails,
        evidenceUrl: evidenceUrl || null,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Không thể gửi báo cáo vi phạm.')
      }

      setOpen(false)
      setDetails('')
      setEvidenceUrl('')
      setSelectedReasonId('counterfeit')
      pushToast(
        'Đã gửi báo cáo vi phạm tới Ban Quản Trị NovaShop. Chúng tôi sẽ tiến hành kiểm tra và xác minh độc lập.',
        'success'
      )
    } catch (error) {
      pushToast(error.message || 'Có lỗi xảy ra khi gửi báo cáo.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* NÚT KÍCH HOẠT */}
      {variant === 'button' ? (
        <button
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3.5 py-2 text-[12px] font-semibold text-[#80513B] shadow-2xs transition hover:border-[#BD6E49] hover:bg-[#F5E7D4] cursor-pointer ${className}`}
        >
          <span className="text-[14px]">🚩</span>
          <span>{buttonLabel}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className={`inline-flex items-center gap-1 text-[12px] text-[#8B7566] underline hover:text-[#BD6E49] transition cursor-pointer ${className}`}
        >
          <span>🚩</span>
          <span>{buttonLabel}</span>
        </button>
      )}

      {/* DIALOG MODAL BÁO CÁO VI PHẠM */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-5 sm:p-6 shadow-2xl">
            {/* Header Dialog */}
            <div className="flex items-center justify-between border-b border-[#E6D5C2] pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#F5E7D4] text-lg text-[#BD6E49]">
                  🚩
                </span>
                <div>
                  <h3 className="text-[16px] font-bold text-[#49352D]">
                    {targetType === 'product'
                      ? 'Báo Cáo Sản Phẩm Vi Phạm'
                      : targetType === 'shop'
                        ? 'Báo Cáo Gian Hàng Vi Phạm'
                        : 'Báo Cáo Vi Phạm'}
                  </h3>
                  <p className="text-[11px] text-[#8B7566]">
                    Hồ sơ được gửi trực tiếp tới Ban Quản Trị NovaShop để thẩm định
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#8B7566] hover:bg-[#F5E7D4] hover:text-[#BD6E49] cursor-pointer"
                aria-label="Đóng"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* Thẻ tóm tắt đối tượng bị báo cáo */}
              <div className="flex items-center gap-3 rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3 text-[12px]">
                {product?.images?.[0]?.url ? (
                  <img
                    src={product.images[0].url}
                    alt={product.name}
                    className="h-12 w-12 rounded-lg object-cover border border-[#E6D5C2] bg-[#FFFCF7] shrink-0"
                  />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#FFFCF7] border border-[#E6D5C2] text-[20px] shrink-0">
                    📦
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#49352D]">
                    {product?.name || targetName || `Đối tượng #${targetId}`}
                  </p>
                  {(shopName || product?.shopName) ? (
                    <p className="text-[11px] text-[#8B7566]">
                      Gian hàng: <span className="font-medium text-[#80513B]">{shopName || product?.shopName}</span>
                    </p>
                  ) : null}
                  <span className="text-[10px] text-[#8B7566]">Mã định danh: #{targetId}</span>
                </div>
              </div>

              {/* Chọn lý do báo cáo */}
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#49352D]">
                  Lý do báo cáo vi phạm <span className="text-[#B93832]">*</span>
                </label>
                <div className="space-y-2">
                  {reasons.map((option) => {
                    const isChecked = selectedReasonId === option.id
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition ${
                          isChecked
                            ? 'border-[#BD6E49] bg-[#F5E7D4]'
                            : 'border-[#E6D5C2] bg-[#FFFCF7] hover:bg-[#FBF3E8]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="reportReason"
                          value={option.id}
                          checked={isChecked}
                          onChange={() => setSelectedReasonId(option.id)}
                          className="mt-0.5 accent-[#BD6E49]"
                        />
                        <div className="text-[12px] leading-tight">
                          <span className="font-semibold text-[#49352D] block">{option.label}</span>
                          <span className="text-[11px] text-[#8B7566]">{option.desc}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Mô tả chi tiết */}
              <div>
                <label
                  htmlFor="report-details"
                  className="mb-1.5 block text-[13px] font-semibold text-[#49352D]"
                >
                  Mô tả chi tiết bằng chứng vi phạm <span className="text-[#B93832]">*</span>
                </label>
                <textarea
                  id="report-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  minLength={10}
                  maxLength={2000}
                  required
                  placeholder="Mô tả cụ thể lý do bạn nghi ngờ sản phẩm vi phạm (ví dụ: tem mác bị sai lệch, hàng không có mã vạch chuẩn, xuất xứ mập mờ, sản phẩm thực tế khác xa mô tả...)"
                  className="w-full rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3 py-2 text-[12px] text-[#49352D] placeholder:text-[#8B7566] outline-none transition focus:border-[#BD6E49] focus:ring-2 focus:ring-[#BD6E49]/20"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-[#8B7566]">
                  <span>Tối thiểu 10 ký tự</span>
                  <span>{details.length}/2000 ký tự</span>
                </div>
              </div>

              {/* Đính kèm hình ảnh bằng chứng */}
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#49352D]">
                  Ảnh bằng chứng (tùy chọn)
                </label>

                {evidenceUrl ? (
                  <div className="relative inline-block rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] p-1">
                    <img
                      src={evidenceUrl}
                      alt="Bằng chứng"
                      className="h-24 w-24 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeEvidence}
                      className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-[#B93832] text-white shadow-md hover:bg-[#A95532] transition cursor-pointer"
                      title="Gỡ ảnh"
                    >
                      <IconClose className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageChange}
                      className="hidden"
                      id="evidence-file-input"
                    />
                    <label
                      htmlFor="evidence-file-input"
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#E6D5C2] bg-[#FBF3E8] py-3 text-[12px] font-medium text-[#80513B] hover:border-[#BD6E49] hover:bg-[#F5E7D4] transition ${
                        uploadingImage ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      <span>📷</span>
                      <span>{uploadingImage ? 'Đang tải ảnh...' : 'Tải lên ảnh chụp thực tế / bằng chứng (PNG, JPG)'}</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Cam kết & Lưu ý bảo mật */}
              <div className="rounded-xl border border-[#E6D5C2]/70 bg-[#FBF3E8] p-3 text-[11px] leading-relaxed text-[#8B7566]">
                <p>
                  ℹ️ Báo cáo của bạn được gửi trực tiếp vào hệ thống kiểm duyệt. Quản trị viên NovaShop sẽ xác minh thực tế trước khi đưa ra quyết định xử lý hoặc áp dụng chế tài với gian hàng.
                </p>
              </div>

              {/* Nút hành động */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-[#E6D5C2] px-4 py-2 text-[13px] font-medium text-[#8B7566] hover:bg-[#F5E7D4] transition disabled:opacity-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy || uploadingImage}
                  className="rounded-xl bg-[#BD6E49] hover:bg-[#A95532] px-5 py-2 text-[13px] font-semibold text-[#FFFCF7] shadow-2xs transition disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Đang gửi...' : 'Gửi Báo Cáo Vi Phạm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
