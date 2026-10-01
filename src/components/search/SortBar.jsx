import { useState } from 'react'
import { IconFilter } from '../ui/Icons'

/** Thanh sắp xếp + chip bộ lọc đang áp dụng */
export default function SortBar({ query, setParam, sortOptions, total, activeFilters, onClearFilter, onOpenFilters }) {
  const [showAll, setShowAll] = useState(false)

  return (
    <div className="rounded-sm bg-white px-3 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-muted">Sắp xếp theo</span>
        <div className="flex flex-wrap gap-2">
          {sortOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setParam('sort', o.id)}
              className={`rounded-sm px-3.5 py-1.5 text-[13px] transition ${
                query.sort === o.id ? 'bg-brand text-white' : 'bg-page text-ink-soft hover:bg-brand-soft hover:text-brand'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenFilters}
          className="ml-auto flex items-center gap-1.5 rounded-sm border border-line px-3 py-1.5 text-[13px] text-ink-soft transition hover:border-brand hover:text-brand lg:hidden"
        >
          <IconFilter className="h-4 w-4" />
          Bộ lọc
        </button>

        <div className="ml-auto hidden text-[13px] text-ink-soft lg:block">
          <b className="text-brand">{total}</b> sản phẩm
        </div>
      </div>

      {activeFilters.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-[13px] text-muted">Lọc theo:</span>
          {(showAll ? activeFilters : activeFilters.slice(0, 5)).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onClearFilter(f.key)}
              className="flex items-center gap-1.5 rounded-sm border border-brand bg-brand-soft px-2 py-1 text-[12px] text-brand"
            >
              <span className="max-w-[220px] truncate">{f.label}</span>
              <span className="text-[13px] leading-none">✕</span>
            </button>
          ))}
          {activeFilters.length > 5 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-[12px] text-brand underline"
            >
              {showAll ? 'Thu gọn' : `Thêm ${activeFilters.length - 5}`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
