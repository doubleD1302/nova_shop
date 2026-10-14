import { Link } from 'react-router-dom'
import { IconChevronRight } from './Icons'

/** Đường dẫn điều hướng: Trang chủ / Danh mục / Tên sản phẩm */
export default function Breadcrumb({ items = [], className = '' }) {
  return (
    <nav className={`flex flex-wrap items-center gap-1 text-[13px] text-muted ${className}`} aria-label="breadcrumb">
      {items.map((item, index) => {
        const last = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {item.to && !last ? (
              <Link to={item.to} className="transition hover:text-brand">
                {item.label}
              </Link>
            ) : (
              <span className={last ? 'font-medium text-ink' : ''}>{item.label}</span>
            )}
            {!last ? <IconChevronRight className="h-3.5 w-3.5" /> : null}
          </span>
        )
      })}
    </nav>
  )
}
