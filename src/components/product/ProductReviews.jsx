import { useState } from 'react'
import { getProductReviews, getRatingBreakdown } from '../../data/reviews'
import { IconStar } from '../ui/Icons'
import { StarPicker } from '../ui/Rating'

/** Avatar chữ cái đầu dùng cho người đánh giá */
function Avatar({ name, hue }) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white"
      style={{ backgroundImage: `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 40) % 360} 80% 48%))` }}
    >
      {name.trim()[0]?.toUpperCase()}
    </span>
  )
}

/** Khu đánh giá sản phẩm: điểm trung bình + bộ lọc sao + danh sách bình luận */
export default function ProductReviews({ product }) {
  const reviews = getProductReviews(product.id)
  const breakdown = getRatingBreakdown(product.id, product.rating)
  const [starFilter, setStarFilter] = useState(0)
  const [draft, setDraft] = useState({ rating: 5, comment: '' })
  const [posted, setPosted] = useState([])

  const allReviews = [...posted, ...reviews]
  const filtered = starFilter ? allReviews.filter((r) => r.rating === starFilter) : allReviews

  const submit = () => {
    if (!draft.comment.trim()) return
    setPosted((list) => [
      {
        id: `local-${Date.now()}`,
        user: 'Bạn',
        emoji: '🧑',
        hue: 12,
        rating: draft.rating,
        variant: product.variantGroups?.[0]?.options?.[0] || 'Mặc định',
        comment: draft.comment.trim(),
        likes: 0,
        images: 0,
        sellerReplied: false,
      },
      ...list,
    ])
    setDraft({ rating: 5, comment: '' })
  }

  return (
    <section id="danh-gia" className="mt-3 rounded-sm border border-line bg-white">
      <h2 className="border-b border-line px-4 py-3 text-[16px] font-bold text-ink">Đánh Giá Sản Phẩm</h2>

      <div className="flex flex-col gap-5 border-b border-line px-4 py-5 lg:flex-row">
        <div className="flex w-full shrink-0 flex-col items-center justify-center gap-1 lg:w-[220px]">
          <span className="text-[30px] font-bold text-brand">
            {product.rating}
            <span className="text-[16px] text-muted">/5</span>
          </span>
          <span className="flex text-[#ffce3d]">
            {[0, 1, 2, 3, 4].map((i) => (
              <IconStar key={i} className="h-5 w-5" filled={i < Math.round(product.rating)} />
            ))}
          </span>
          <span className="text-center text-[13px] text-muted">
            {allReviews.length} đánh giá từ người mua đã xác nhận
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <button
            type="button"
            onClick={() => setStarFilter(0)}
            className={`text-left text-[13px] ${starFilter === 0 ? 'font-semibold text-brand' : 'text-ink-soft'}`}
          >
            Tất cả ({allReviews.length})
          </button>
          {breakdown.map((b) => (
            <button
              key={b.star}
              type="button"
              onClick={() => setStarFilter(b.star)}
              className="flex items-center gap-3 text-left"
            >
              <span className="flex w-[70px] shrink-0 items-center gap-1 text-[13px] text-ink-soft">
                {b.star}
                <IconStar className="h-3.5 w-3.5 text-[#ffce3d]" filled />
              </span>
              <span className="h-[14px] flex-1 overflow-hidden rounded-sm bg-page">
                <span
                  className={`block h-full ${starFilter === b.star ? 'bg-brand' : 'bg-[#ffb400]'}`}
                  style={{ width: `${b.percent}%` }}
                />
              </span>
              <span className="w-[42px] shrink-0 text-right text-[12px] text-muted">{b.percent}%</span>
            </button>
          ))}
        </div>

        <div className="w-full shrink-0 rounded-sm border border-line p-3 lg:w-[320px]">
          <p className="mb-2 text-[13px] font-semibold text-ink">Viết đánh giá của bạn</p>
          <StarPicker value={draft.rating} onChange={(v) => setDraft((d) => ({ ...d, rating: v }))} size="h-5 w-5" />
          <textarea
            value={draft.comment}
            onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
            rows={3}
            placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm và người bán..."
            className="mt-2 w-full resize-none rounded-sm border border-line px-2.5 py-2 text-[13px] outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.comment.trim()}
            className="mt-2 w-full rounded-sm bg-brand py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
          >
            Gửi đánh giá
          </button>
        </div>
      </div>

      <div className="divide-y divide-line">
        {filtered.map((r) => (
          <article key={r.id} className="flex gap-3 px-4 py-4">
            <Avatar name={r.user} hue={r.hue} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">{r.user}</p>
              <span className="mt-0.5 flex text-[#ffce3d]">
                {[0, 1, 2, 3, 4].map((i) => (
                  <IconStar key={i} className="h-3.5 w-3.5" filled={i < r.rating} />
                ))}
              </span>
              <p className="mt-1 text-[11px] text-muted">Phân loại: {r.variant} · Người mua đã nhận hàng</p>
              <p className="mt-2 whitespace-pre-line text-[13px] leading-[20px] text-ink-soft">{r.comment}</p>

              {r.images ? (
                <div className="mt-2 flex gap-2">
                  {Array.from({ length: r.images }).map((_, i) => (
                    <span
                      key={i}
                      className="grid h-16 w-16 place-items-center rounded-sm border border-line bg-page text-[22px]"
                    >
                      {product.emoji}
                    </span>
                  ))}
                </div>
              ) : null}

              {r.sellerReplied ? (
                <div className="mt-2 rounded-sm bg-page px-3 py-2 text-[12px] text-ink-soft">
                  <span className="font-semibold text-brand">Phản hồi người bán: </span>
                  {r.reply}
                </div>
              ) : null}

              <div className="mt-2 flex items-center gap-4 text-[12px] text-muted">
                <button type="button" className="transition hover:text-brand">
                  👍 Hữu ích ({r.likes})
                </button>
                <button type="button" className="transition hover:text-brand">
                  💬 Bình luận
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
