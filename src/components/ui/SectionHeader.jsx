import { Link } from 'react-router-dom'
import { IconChevronRight } from './Icons'

/**
 * Tiêu đề khu vực kiểu ShopNova:
 * [icon] TIÊU ĐỀ ......................... Xem tất cả ›
 */
export default function SectionHeader({ icon, title, rightLabel, rightTo, rightNode, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        {icon ? <span className="text-brand">{icon}</span> : null}
        <h2 className="text-[15px] font-bold uppercase tracking-tight text-ink md:text-[16px]">{title}</h2>
      </div>
      {rightNode}
      {!rightNode && rightLabel ? (
        rightTo ? (
          <Link to={rightTo} className="flex items-center gap-0.5 text-[13px] text-muted transition hover:text-brand">
            {rightLabel}
            <IconChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="text-[13px] text-muted">{rightLabel}</span>
        )
      ) : null}
    </div>
  )
}
