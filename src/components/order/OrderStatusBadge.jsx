import { ORDER_STATUS } from '../../data/orders'

/** Nhãn trạng thái đơn hàng (màu theo từng trạng thái) */
export default function OrderStatusBadge({ status, className = '' }) {
  const s = ORDER_STATUS[status] || ORDER_STATUS.pending
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${s.color} ${className}`}>
      <span className={`h-2 w-2 rounded-full ${s.bg} ring-2 ring-inset ring-current`} />
      {s.label}
    </span>
  )
}

/** Dải tiến trình 4 bước: Chờ xác nhận → Đã xác nhận → Đang giao → Đã giao */
export function OrderTimeline({ status }) {
  const steps = [
    { id: 'pending', label: 'Chờ xác nhận' },
    { id: 'confirmed', label: 'Đã xác nhận' },
    { id: 'shipping', label: 'Đang giao' },
    { id: 'delivered', label: 'Đã giao' },
  ]
  if (status === 'cancelled') {
    return (
      <div className="rounded-sm bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-600">
        Đơn hàng đã bị huỷ
      </div>
    )
  }
  const currentIndex = steps.findIndex((s) => s.id === status)

  return (
    <div className="flex items-center gap-2 px-1">
      {steps.map((s, i) => (
        <div key={s.id} className="flex flex-1 items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                i <= currentIndex ? 'bg-brand text-white' : 'bg-page text-muted'
              }`}
            >
              {i <= currentIndex ? '✓' : i + 1}
            </span>
            <span className={`whitespace-nowrap text-[11px] ${i <= currentIndex ? 'text-brand' : 'text-muted'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 ? (
            <span className={`h-[2px] flex-1 ${i < currentIndex ? 'bg-brand' : 'bg-line'}`} />
          ) : null}
        </div>
      ))}
    </div>
  )
}
