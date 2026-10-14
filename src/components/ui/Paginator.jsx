import { IconChevronLeft, IconChevronRight } from './Icons'

/** Phân trang đơn giản */
export default function Paginator({ page, totalPages, onChange, className = '' }) {
  if (totalPages <= 1) return null
  const pages = []
  const from = Math.max(1, page - 2)
  const to = Math.min(totalPages, from + 4)
  for (let i = from; i <= to; i += 1) pages.push(i)

  return (
    <div className={`flex items-center justify-center gap-2 py-6 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="grid h-8 w-8 place-items-center rounded-sm border border-line bg-white text-muted transition hover:text-brand disabled:opacity-40"
        aria-label="Trang trước"
      >
        <IconChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`h-8 min-w-8 rounded-sm border px-2 text-[13px] transition ${
            p === page
              ? 'border-brand bg-brand text-white'
              : 'border-line bg-white text-ink hover:border-brand hover:text-brand'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="grid h-8 w-8 place-items-center rounded-sm border border-line bg-white text-muted transition hover:text-brand disabled:opacity-40"
        aria-label="Trang sau"
      >
        <IconChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
