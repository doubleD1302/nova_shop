import { formatNumber, formatVnd } from '../../utils/format'

const GRID_STEPS = 4

// Làm tròn lên một mốc "đẹp" chia hết cho 4 khoảng gióng để trục tung dễ đọc
function niceCeil(value) {
  if (value <= 0) return 100000
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const ratio = value / magnitude
  const step = [1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find((candidate) => ratio <= candidate)
  return step * magnitude
}

function formatAxis(value) {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(2))}tr`
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`
  return String(value)
}

/**
 * Biểu đồ đường 2 chuỗi: doanh thu (trục tung bên trái) và số đơn (thang riêng, tối đa là đỉnh của số đơn).
 * days: [{ label, orders, revenue }]
 */
export default function SalesChart({ days, loading = false, error = '' }) {
  const count = days.length
  const maxRevenue = niceCeil(Math.max(0, ...days.map((d) => d.revenue)))
  const maxOrders = Math.max(4, Math.ceil(Math.max(0, ...days.map((d) => d.orders)) / GRID_STEPS) * GRID_STEPS)
  const hasData = days.some((d) => d.revenue > 0 || d.orders > 0)

  const x = (index) => (count <= 1 ? 50 : (index / (count - 1)) * 100)
  const revenueY = (value) => (1 - value / maxRevenue) * 100
  const ordersY = (value) => (1 - value / maxOrders) * 100
  const toPoints = (yOf, key) => days.map((d, i) => `${x(i)},${yOf(d[key])}`).join(' ')

  // Nhãn ngày thưa dần khi có nhiều ngày; luôn gồm ngày cuối
  const labelEvery = count > 14 ? 5 : 1

  return (
    <div className="relative h-44 w-full" aria-busy={loading}>
      {/* Đường gióng ngang và nhãn trục tung */}
      <div className="absolute bottom-6 left-0 right-0 top-2">
        {Array.from({ length: GRID_STEPS + 1 }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-b border-[#E6D5C2]/50"
            style={{ top: `${(1 - i / GRID_STEPS) * 100}%` }}
          >
            <span className="absolute left-0 -translate-y-1/2 bg-[#FFFCF7] pr-1 text-[10px] text-[#8B7566]">
              {formatAxis((maxRevenue * i) / GRID_STEPS)}
            </span>
          </div>
        ))}
      </div>

      {/* Vùng vẽ: đường dùng non-scaling-stroke để không bị méo, điểm là phần tử HTML tròn */}
      <div className={`absolute bottom-6 left-11 right-3 top-2 transition-opacity ${loading ? 'opacity-40' : ''}`}>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Biểu đồ doanh thu và số đơn theo ngày">
          <polyline fill="none" stroke="#8B7566" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" points={toPoints(ordersY, 'orders')} />
          <polyline fill="none" stroke="#A95532" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" points={toPoints(revenueY, 'revenue')} />
        </svg>

        {days.map((d, i) => (
          <span
            key={d.date || d.label}
            className="absolute block h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#FFFCF7] bg-[#A95532]"
            style={{ left: `${x(i)}%`, top: `${revenueY(d.revenue)}%` }}
            title={`${d.label}: ${formatVnd(d.revenue)}, ${formatNumber(d.orders)} đơn`}
          />
        ))}
        {days.map((d, i) => (
          <span
            key={`o-${d.date || d.label}`}
            className="absolute block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8B7566]"
            style={{ left: `${x(i)}%`, top: `${ordersY(d.orders)}%` }}
            title={`${d.label}: ${formatNumber(d.orders)} đơn`}
          />
        ))}

        {!loading && !error && !hasData && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[12px] text-[#8B7566]">
            Chưa có đơn hàng trong khoảng thời gian này
          </p>
        )}
        {error && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[12px] text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Nhãn ngày dưới chân */}
      <div className="absolute bottom-0 left-11 right-3 h-4">
        {days.map((d, i) =>
          (count - 1 - i) % labelEvery === 0 ? (
            <span
              key={d.date || d.label}
              className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-[#8B7566]"
              style={{ left: `${x(i)}%` }}
            >
              {d.label}
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}
