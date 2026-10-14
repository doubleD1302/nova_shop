import { IconCheck, IconStar } from '../ui/Icons'

/** 1 dòng checkbox trong bộ lọc */
export function FilterCheckbox({ checked, onChange, label, count, radio = false }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-[13px] text-ink-soft transition hover:text-brand">
      <span
        className={`grid h-[15px] w-[15px] shrink-0 place-items-center border transition ${
          radio ? 'rounded-full' : 'rounded-[2px]'
        } ${checked ? 'border-brand bg-brand text-white' : 'border-line bg-white'}`}
      >
        {checked ? (radio ? <span className="h-[7px] w-[7px] rounded-full bg-white" /> : <IconCheck className="h-3 w-3" />) : null}
      </span>
      <input type={radio ? 'radio' : 'checkbox'} checked={checked} onChange={onChange} className="hidden" />
      <span className="flex-1">{label}</span>
      {count != null ? <span className="text-[11px] text-muted">({count})</span> : null}
    </label>
  )
}

/** Nhóm bộ lọc có tiêu đề */
export function FilterBlock({ title, children }) {
  return (
    <div className="border-b border-line px-3 py-3">
      <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-ink">{title}</h3>
      {children}
    </div>
  )
}

/** Bộ lọc đánh giá theo số sao */
export function RatingFilter({ value, onChange }) {
  return [5, 4, 3].map((star) => (
    <FilterCheckbox
      key={star}
      radio
      label={
        <span className="flex items-center gap-1">
          {Array.from({ length: star }).map((_, i) => (
            <IconStar key={i} className="h-3.5 w-3.5 text-[#ffce3d]" filled />
          ))}
          {star < 5 ? <span className="text-[12px]">trở lên</span> : null}
        </span>
      }
      checked={value === star}
      onChange={() => onChange(value === star ? 0 : star)}
    />
  ))
}
