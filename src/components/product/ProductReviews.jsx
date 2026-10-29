import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiCreateProductReview, apiGetEligibleReviewItems, apiGetProductReviews } from '../../utils/api'
import { IconStar } from '../ui/Icons'
import { StarPicker } from '../ui/Rating'
import ReportContentButton from '../ui/ReportContentButton'

function Avatar({ name }) {
  const hue = [...String(name || 'U')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white"
      style={{ backgroundImage: `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 40) % 360} 80% 48%))` }}
    >
      {String(name || 'U').trim()[0]?.toUpperCase()}
    </span>
  )
}

const dateLabel = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN')
}

export default function ProductReviews({ product, onSummaryChange }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [reviews, setReviews] = useState([])
  const [eligibleItems, setEligibleItems] = useState([])
  const [selectedOrderItem, setSelectedOrderItem] = useState('')
  const [starFilter, setStarFilter] = useState(0)
  const [draft, setDraft] = useState({ rating: 5, comment: '' })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const loadReviews = useCallback(async () => {
    const response = await apiGetProductReviews(product.id)
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success || !Array.isArray(payload?.data?.reviews)) {
      throw new Error(payload?.message || 'Không thể tải đánh giá sản phẩm.')
    }
    setReviews(payload.data.reviews)
    onSummaryChange?.({
      rating: Number(payload.data.rating) || 0,
      ratingCount: Number(payload.data.ratingCount) || 0,
    })
  }, [product.id, onSummaryChange])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    apiGetProductReviews(product.id)
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success || !Array.isArray(payload?.data?.reviews)) {
          throw new Error(payload?.message || 'Không thể tải đánh giá sản phẩm.')
        }
        if (!active) return
        setReviews(payload.data.reviews)
        onSummaryChange?.({
          rating: Number(payload.data.rating) || 0,
          ratingCount: Number(payload.data.ratingCount) || 0,
        })
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Không thể tải đánh giá sản phẩm.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [product.id, onSummaryChange])

  useEffect(() => {
    let active = true
    if (!user) {
      setEligibleItems([])
      setSelectedOrderItem('')
      return () => {
        active = false
      }
    }
    apiGetEligibleReviewItems(product.id)
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'Không thể kiểm tra quyền đánh giá.')
        }
        if (active) {
          const items = payload?.data?.items || []
          setEligibleItems(items)
          setSelectedOrderItem((current) => items.some((item) => item.orderItemId === current)
            ? current
            : items[0]?.orderItemId || '')
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Không thể kiểm tra quyền đánh giá.')
      })
    return () => {
      active = false
    }
  }, [product.id, user])

  const rating = reviews.length
    ? Number((reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length).toFixed(2))
    : 0
  const breakdown = useMemo(() => [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((review) => Number(review.rating) === star).length
    return { star, count, percent: reviews.length ? Math.round((count / reviews.length) * 100) : 0 }
  }), [reviews])
  const filtered = starFilter ? reviews.filter((review) => Number(review.rating) === starFilter) : reviews

  const submit = async () => {
    if (!user) {
      const from = `${location.pathname}${location.search}#danh-gia`
      navigate('/dang-nhap', { state: { from } })
      return
    }
    if (!selectedOrderItem) {
      setError('Chỉ người mua đã nhận sản phẩm mới được đánh giá.')
      return
    }
    const comment = draft.comment.trim()
    if (!comment) {
      setError('Vui lòng nhập nội dung đánh giá.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await apiCreateProductReview(product.id, {
        orderItemId: selectedOrderItem,
        rating: draft.rating,
        comment,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success || !payload?.data?.review) {
        throw new Error(payload?.message || 'Không thể gửi đánh giá.')
      }
      const created = payload.data.review
      const updated = [created, ...reviews]
      setReviews(updated)
      setEligibleItems((items) => items.filter((item) => item.orderItemId !== selectedOrderItem))
      setSelectedOrderItem('')
      setDraft({ rating: 5, comment: '' })
      onSummaryChange?.({
        rating: Number((updated.reduce((sum, review) => sum + Number(review.rating), 0) / updated.length).toFixed(2)),
        ratingCount: updated.length,
      })
    } catch (submitError) {
      setError(submitError.message || 'Không thể gửi đánh giá.')
      try {
        await loadReviews()
      } catch (refreshError) {
        setError(`${submitError.message || 'Không thể gửi đánh giá.'} ${refreshError.message}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="danh-gia" className="mt-3 rounded-sm border border-line bg-white">
      <h2 className="border-b border-line px-4 py-3 text-[16px] font-bold text-ink">Đánh Giá Sản Phẩm</h2>

      <div className="flex flex-col gap-5 border-b border-line px-4 py-5 lg:flex-row">
        <div className="flex w-full shrink-0 flex-col items-center justify-center gap-1 lg:w-[220px]">
          <span className="text-[30px] font-bold text-brand">
            {rating}
            <span className="text-[16px] text-muted">/5</span>
          </span>
          <span className="flex text-[#ffce3d]">
            {[0, 1, 2, 3, 4].map((index) => (
              <IconStar key={index} className="h-5 w-5" filled={index < Math.round(rating)} />
            ))}
          </span>
          <span className="text-center text-[13px] text-muted">
            {reviews.length} đánh giá đã lưu
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <button
            type="button"
            onClick={() => setStarFilter(0)}
            className={`text-left text-[13px] ${starFilter === 0 ? 'font-semibold text-brand' : 'text-ink-soft'}`}
          >
            Tất cả ({reviews.length})
          </button>
          {breakdown.map((item) => (
            <button
              key={item.star}
              type="button"
              onClick={() => setStarFilter(item.star)}
              className="flex items-center gap-3 text-left"
            >
              <span className="flex w-[70px] shrink-0 items-center gap-1 text-[13px] text-ink-soft">
                {item.star}
                <IconStar className="h-3.5 w-3.5 text-[#ffce3d]" filled />
                <span className="text-muted">({item.count})</span>
              </span>
              <span className="h-[14px] flex-1 overflow-hidden rounded-sm bg-page">
                <span
                  className={`block h-full ${starFilter === item.star ? 'bg-brand' : 'bg-[#ffb400]'}`}
                  style={{ width: `${item.percent}%` }}
                />
              </span>
              <span className="w-[42px] shrink-0 text-right text-[12px] text-muted">{item.percent}%</span>
            </button>
          ))}
        </div>

        <div className="w-full shrink-0 rounded-sm border border-line p-3 lg:w-[320px]">
          <p className="mb-2 text-[13px] font-semibold text-ink">Viết đánh giá của bạn</p>
          <StarPicker value={draft.rating} onChange={(value) => setDraft((current) => ({ ...current, rating: value }))} size="h-5 w-5" />
          {user && eligibleItems.length > 1 ? (
            <label className="mt-2 block text-[12px] text-muted">
              Đơn hàng đã nhận
              <select
                value={selectedOrderItem}
                onChange={(event) => setSelectedOrderItem(event.target.value)}
                className="mt-1 w-full rounded-sm border border-line px-2 py-1.5 text-ink"
              >
                {eligibleItems.map((item) => (
                  <option key={item.orderItemId} value={item.orderItemId}>
                    {item.variant} · {dateLabel(item.purchasedAt)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <textarea
            value={draft.comment}
            onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))}
            rows={3}
            placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm và người bán..."
            className="mt-2 w-full resize-none rounded-sm border border-line px-2.5 py-2 text-[13px] outline-none focus:border-brand"
          />
          {user && !eligibleItems.length ? (
            <p className="mt-1 text-[12px] text-muted">Chỉ người mua đã nhận sản phẩm mới được đánh giá.</p>
          ) : null}
          {error ? <p className="mt-2 text-[12px] text-rose-600">{error}</p> : null}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || (Boolean(user) && !eligibleItems.length)}
            className="mt-2 w-full rounded-sm bg-brand py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
          >
            {submitting ? 'Đang gửi...' : user ? 'Gửi đánh giá' : 'Đăng nhập để đánh giá'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-line">
        {loading ? <p className="px-4 py-5 text-[13px] text-muted">Đang tải đánh giá...</p> : null}
        {!loading && !filtered.length ? (
          <p className="px-4 py-5 text-[13px] text-muted">Chưa có đánh giá phù hợp.</p>
        ) : null}
        {filtered.map((review) => (
          <article key={review.id} className="flex gap-3 px-4 py-4">
            <Avatar name={review.user} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">{review.user}</p>
              <span className="mt-0.5 flex text-[#ffce3d]">
                {[0, 1, 2, 3, 4].map((index) => (
                  <IconStar key={index} className="h-3.5 w-3.5" filled={index < Number(review.rating)} />
                ))}
              </span>
              <p className="mt-0.5 text-[11px] text-muted">
                Phân loại: {review.variant} · {dateLabel(review.createdAt)}
              </p>
              <p className="mt-2 whitespace-pre-line text-[13px] leading-[20px] text-ink-soft">{review.comment}</p>
              {review.sellerReply ? (
                <div className="mt-2 rounded-sm bg-page px-3 py-2 text-[12px] text-ink-soft">
                  <span className="font-semibold text-brand">Phản hồi người bán: </span>
                  {review.sellerReply}
                </div>
              ) : null}
              <ReportContentButton targetType="review" targetId={review.id} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
