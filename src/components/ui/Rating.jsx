import { IconStar } from './Icons'
import { formatRating, formatSold } from '../../utils/format'

/** Dải 5 sao, hỗ trợ giá trị thập phân (dùng mask để hiển thị nửa sao) */
export function Stars({ value = 5, size = 'h-3.5 w-3.5', className = '' }) {
  const percent = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span className={`relative inline-block leading-none ${className}`} aria-label={`${value} trên 5 sao`}>
      <span className="flex gap-[1px] text-[#d5d5d5]">
        {[0, 1, 2, 3, 4].map((i) => (
          <IconStar key={i} className={size} filled />
        ))}
      </span>
      <span
        className="absolute inset-0 flex gap-[1px] overflow-hidden text-[#ffce3d]"
        style={{ width: `${percent}%` }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <IconStar key={i} className={`${size} shrink-0`} filled />
        ))}
      </span>
    </span>
  )
}

/** Dòng "★ 4.9   Đã bán 18,2k" trên thẻ sản phẩm */
export function RatingRow({ rating, sold, className = '' }) {
  return (
    <div className={`flex items-center gap-2 text-[11px] leading-none ${className}`}>
      <span className="flex items-center gap-[3px] text-[#ffce3d]">
        <IconStar className="h-3 w-3" filled />
        <span className="text-ink/80">{formatRating(rating)}</span>
      </span>
      <span className="text-muted">Đã bán {formatSold(sold)}</span>
    </div>
  )
}

/** Dòng đánh giá có số sao chi tiết (dùng cho khu bình luận) */
export function StarPicker({ value, onChange, size = 'h-6 w-6' }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} sao`}>
          <IconStar
            className={`${size} transition ${i <= value ? 'text-[#ffce3d]' : 'text-[#d5d5d5]'}`}
            filled
          />
        </button>
      ))}
    </div>
  )
}

export default Stars
