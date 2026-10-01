import { IconMinus, IconPlus } from './Icons'

/**
 * Bộ chọn số lượng: [-] [ 1 ] [+]
 */
export default function QuantityStepper({ value, onChange, min = 1, max = 99, size = 'md' }) {
  const h = size === 'sm' ? 'h-7' : 'h-8'
  const w = size === 'sm' ? 'w-8' : 'w-9'
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))

  return (
    <div className={`inline-flex items-center overflow-hidden rounded-sm border border-line bg-white ${h}`}>
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        className={`${w} grid h-full place-items-center text-muted transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-40`}
        aria-label="Giảm số lượng"
      >
        <IconMinus className="h-3.5 w-3.5" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''))
          onChange(Number.isNaN(n) || n < min ? min : Math.min(n, max))
        }}
        className="h-full w-11 border-x border-line text-center text-[13px] outline-none"
      />
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        className={`${w} grid h-full place-items-center text-muted transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-40`}
        aria-label="Tăng số lượng"
      >
        <IconPlus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
