import { useSearchParams } from 'react-router-dom'

/** Các khối giao diện nhỏ dùng chung cho các trang Kênh Người Bán (màu theo SellerLayout). */

export function PageHeader({ title, description }) {
  return (
    <div className="mb-5">
      <h1 className="text-[20px] font-bold text-[#49352D]">{title}</h1>
      {description ? <p className="mt-1 text-[13px] text-[#8B7566]">{description}</p> : null}
    </div>
  )
}

/** Thanh tab đồng bộ với query ?tab=; tab đầu tiên là mặc định. */
export function useTab(tabs) {
  const [searchParams, setSearchParams] = useSearchParams()
  const current = tabs.find((t) => t.id === searchParams.get('tab'))?.id || tabs[0].id
  const setTab = (id) => setSearchParams(id === tabs[0].id ? {} : { tab: id })
  return [current, setTab]
}

export function TabBar({ tabs, current, onChange }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 border-b border-[#E6D5C2]">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] transition ${
            current === t.id
              ? 'border-[#A95532] font-semibold text-[#A95532]'
              : 'border-transparent text-[#8B7566] hover:text-[#A95532]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 sm:p-5 shadow-2xs ${className}`}>
      {title || action ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-[15px] font-bold text-[#49352D]">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function StatCard({ label, value, hint, tone = 'default' }) {
  const color = tone === 'danger' ? 'text-rose-600' : tone === 'good' ? 'text-emerald-700' : 'text-[#A95532]'
  return (
    <div className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-4 shadow-2xs">
      <p className="text-[12px] text-[#8B7566]">{label}</p>
      <p className={`mt-1 text-[20px] font-bold ${color}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-[#8B7566]">{hint}</p> : null}
    </div>
  )
}

/** Hiển thị trạng thái tải / lỗi; trả null khi dữ liệu đã sẵn sàng để trang tự vẽ nội dung. */
export function QueryState({ loading, error, onRetry, hasData }) {
  if (loading && !hasData) {
    return <p className="rounded-2xl border border-[#E6D5C2] bg-[#FFFCF7] p-8 text-center text-[13px] text-[#8B7566]">Đang tải dữ liệu...</p>
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center text-[13px] text-rose-700">
        <p>{error}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-3 rounded-xl bg-rose-600 px-4 py-1.5 font-semibold text-white hover:bg-rose-700">
            Thử lại
          </button>
        ) : null}
      </div>
    )
  }
  return null
}

export function Empty({ text }) {
  return <p className="py-8 text-center text-[13px] text-[#8B7566]">{text}</p>
}

const PILL_TONES = {
  good: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-800',
  bad: 'bg-rose-100 text-rose-800',
  info: 'bg-sky-100 text-sky-800',
  muted: 'bg-[#F5E7D4] text-[#8B7566]',
}

export function Pill({ tone = 'muted', children }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PILL_TONES[tone]}`}>{children}</span>
}

export function DateRange({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#8B7566]">
      <label className="flex items-center gap-1.5">
        Từ
        <input type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} className="rounded-lg border border-[#E6D5C2] bg-white px-2 py-1 text-[#49352D]" />
      </label>
      <label className="flex items-center gap-1.5">
        Đến
        <input type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} className="rounded-lg border border-[#E6D5C2] bg-white px-2 py-1 text-[#49352D]" />
      </label>
    </div>
  )
}

/** Giờ địa phương: ngày yyyy-mm-dd -> tham số API (đầu ngày / cuối ngày theo múi giờ trình duyệt, dạng ISO UTC). */
export function rangeToParams({ from, to }) {
  return {
    startDate: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    endDate: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  }
}

export function lastDays(days) {
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const end = new Date()
  const start = new Date(Date.now() - (days - 1) * 86400000)
  return { from: fmt(start), to: fmt(end) }
}

export function Pager({ total, limit, offset, onChange }) {
  if (total <= limit) return null
  const page = Math.floor(offset / limit) + 1
  const pages = Math.ceil(total / limit)
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-[12px] text-[#8B7566]">
      <button type="button" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))} className="rounded-lg border border-[#E6D5C2] px-3 py-1 disabled:opacity-40 hover:bg-[#F5E7D4]">Trước</button>
      <span>Trang {page}/{pages}</span>
      <button type="button" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)} className="rounded-lg border border-[#E6D5C2] px-3 py-1 disabled:opacity-40 hover:bg-[#F5E7D4]">Sau</button>
    </div>
  )
}

export const inputClass = 'w-full rounded-xl border border-[#E6D5C2] bg-white px-3 py-2 text-[13px] text-[#49352D] outline-none focus:border-[#BD6E49]'
export const primaryButton = 'rounded-xl bg-[#BD6E49] px-4 py-2 text-[13px] font-medium text-[#FFFCF7] shadow-2xs transition hover:bg-[#A95532] disabled:opacity-50'
export const ghostButton = 'rounded-xl border border-[#E6D5C2] bg-[#FFFCF7] px-3 py-1.5 text-[12px] font-medium text-[#A95532] transition hover:bg-[#F5E7D4] disabled:opacity-50'
