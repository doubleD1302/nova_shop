import { useState } from 'react'
import { useSellerQuery } from '../../hooks/useSellerQuery'
import { apiGetSellerDashboard, apiGetSellerInventoryReport } from '../../utils/api'
import { formatDateTime, formatNumber, formatVnd } from '../../utils/format'
import SalesChart from '../../components/seller/SalesChart'
import SmartImage from '../../components/ui/SmartImage'
import {
  Card,
  Empty,
  PageHeader,
  Pill,
  QueryState,
  StatCard,
  TabBar,
  useTab,
} from '../../components/seller/SellerUi'

const TABS = [
  { id: 'sales', label: 'Phân tích bán hàng' },
  { id: 'products', label: 'Hiệu quả sản phẩm' },
  { id: 'orders', label: 'Hiệu quả đơn hàng' },
]

const ORDER_STATUSES = [
  { id: 'pending', label: 'Chờ xác nhận', tone: 'warn' },
  { id: 'confirmed', label: 'Chờ lấy hàng', tone: 'info' },
  { id: 'shipping', label: 'Đang giao', tone: 'info' },
  { id: 'delivered', label: 'Đã giao', tone: 'good' },
  { id: 'completed', label: 'Hoàn tất', tone: 'good' },
  { id: 'cancelled', label: 'Đã hủy', tone: 'bad' },
  { id: 'returned', label: 'Trả hàng', tone: 'bad' },
]

const percent = (part, total) => (total > 0 ? `${((part / total) * 100).toFixed(1).replace('.', ',')}%` : '0%')

/** DỮ LIỆU - Phân tích bán hàng / Hiệu quả sản phẩm / Hiệu quả đơn hàng */
export default function SellerAnalyticsPage() {
  const [tab, setTab] = useTab(TABS)
  return (
    <div>
      <PageHeader title="Dữ liệu" description="Số liệu bán hàng tính từ đơn hàng và kho của gian hàng." />
      <TabBar tabs={TABS} current={tab} onChange={setTab} />
      {tab === 'sales' ? <SalesAnalysis /> : null}
      {tab === 'products' ? <ProductPerformance /> : null}
      {tab === 'orders' ? <OrderPerformance /> : null}
    </div>
  )
}

function SalesAnalysis() {
  const [days, setDays] = useState(7)
  const { data, loading, error, reload } = useSellerQuery(
    ({ signal }) => apiGetSellerDashboard({ days, signal }),
    [days],
  )
  const summary = data?.summary
  const chart = Array.isArray(data?.chart) ? data.chart : []
  const periodRevenue = chart.reduce((sum, d) => sum + d.revenue, 0)
  const periodOrders = chart.reduce((sum, d) => sum + d.orders, 0)

  return (
    <div className="space-y-4">
      <QueryState loading={loading} error={error} onRetry={reload} hasData={Boolean(data)} />
      {summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Đơn hôm nay" value={formatNumber(summary.todayOrders)} />
          <StatCard label="Doanh thu hôm nay" value={formatVnd(summary.todayRevenue)} tone="good" />
          <StatCard label="Tổng doanh thu" value={formatVnd(summary.totalRevenue)} tone="good" />
          <StatCard label="Đã bán" value={formatNumber(summary.totalSold)} hint={`${formatNumber(summary.totalProducts)} sản phẩm`} />
        </div>
      ) : null}
      {data ? (
        <Card
          title="Doanh thu và số đơn theo ngày"
          action={
            <div className="flex gap-1">
              {[7, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`rounded-full border px-3 py-1 text-[12px] ${days === d ? 'border-[#A95532] bg-[#F5E7D4] font-semibold text-[#A95532]' : 'border-[#E6D5C2] text-[#8B7566] hover:bg-[#FBF3E8]'}`}
                >
                  {d} ngày
                </button>
              ))}
            </div>
          }
        >
          <p className="mb-3 text-[12px] text-[#8B7566]">
            {days} ngày gần nhất: <b className="text-[#49352D]">{formatVnd(periodRevenue)}</b> doanh thu (đơn đã giao/hoàn tất), <b className="text-[#49352D]">{formatNumber(periodOrders)}</b> đơn đặt.
          </p>
          <SalesChart days={chart} loading={loading} error={error} />
        </Card>
      ) : null}
    </div>
  )
}

function ProductPerformance() {
  const dashboard = useSellerQuery(({ signal }) => apiGetSellerDashboard({ days: 7, signal }))
  const inventory = useSellerQuery(({ signal }) => apiGetSellerInventoryReport({ signal }))

  const topProducts = dashboard.data?.topProducts || []
  const items = inventory.data?.items || []
  const summary = inventory.data?.summary

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Sản phẩm" value={formatNumber(summary.totalProducts)} />
          <StatCard label="Phân loại (SKU)" value={formatNumber(summary.totalSKUs)} />
          <StatCard label="Tồn kho" value={formatNumber(summary.totalStock)} />
          <StatCard label="Sắp hết hàng (≤ 5)" value={formatNumber(summary.lowStockCount)} tone={summary.lowStockCount > 0 ? 'danger' : 'default'} />
        </div>
      ) : null}

      <Card title="Top sản phẩm bán chạy">
        <QueryState loading={dashboard.loading} error={dashboard.error} onRetry={dashboard.reload} hasData={Boolean(dashboard.data)} />
        {dashboard.data && topProducts.length === 0 ? <Empty text="Chưa có sản phẩm nào có doanh số." /> : null}
        <ul className="divide-y divide-[#E6D5C2]/70">
          {topProducts.map((p, index) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="w-5 text-center text-[13px] font-bold text-[#A95532]">{index + 1}</span>
              {p.imageUrl ? <SmartImage src={p.imageUrl} alt="" className="h-10 w-10 rounded-lg border border-[#E6D5C2] object-cover" /> : <span className="h-10 w-10 rounded-lg bg-[#F5E7D4]" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[#49352D]">{p.name}</span>
                <span className="block text-[11px] text-[#8B7566]">{formatVnd(p.price)} · tồn {formatNumber(p.totalStock)}</span>
              </span>
              <span className="text-[13px] font-semibold text-[#49352D]">{formatNumber(p.soldCount)} đã bán</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Doanh số và tồn kho theo phân loại">
        <QueryState loading={inventory.loading} error={inventory.error} onRetry={inventory.reload} hasData={Boolean(inventory.data)} />
        {inventory.data && items.length === 0 ? <Empty text="Gian hàng chưa có sản phẩm." /> : null}
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead className="text-[#8B7566]">
                <tr className="border-b border-[#E6D5C2]">
                  <th className="py-2 pr-3 font-medium">Sản phẩm</th>
                  <th className="py-2 pr-3 font-medium">Phân loại</th>
                  <th className="py-2 pr-3 text-right font-medium">Giá</th>
                  <th className="py-2 pr-3 text-right font-medium">Tồn kho</th>
                  <th className="py-2 pr-3 text-right font-medium">Đã bán</th>
                  <th className="py-2 text-right font-medium">Hoàn kho</th>
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <tr key={v.variantId} className="border-b border-[#E6D5C2]/60 text-[#49352D]">
                    <td className="py-2 pr-3 font-medium">{v.productName}</td>
                    <td className="py-2 pr-3">{v.variantName || v.sku}</td>
                    <td className="py-2 pr-3 text-right">{formatVnd(v.price)}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${v.isLowStock ? 'text-rose-600' : ''}`}>{formatNumber(v.stockQty)}</td>
                    <td className="py-2 pr-3 text-right">{formatNumber(v.totalSold)}</td>
                    <td className="py-2 text-right">{formatNumber(v.totalReturned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  )
}

function OrderPerformance() {
  const { data, loading, error, reload } = useSellerQuery(({ signal }) => apiGetSellerDashboard({ days: 30, signal }))
  const byStatus = data?.summary?.ordersByStatus
  const total = byStatus ? ORDER_STATUSES.reduce((sum, s) => sum + (byStatus[s.id] || 0), 0) : 0
  const successful = byStatus ? (byStatus.delivered || 0) + (byStatus.completed || 0) : 0
  const lost = byStatus ? (byStatus.cancelled || 0) + (byStatus.returned || 0) : 0
  const recent = data?.recentOrders || []

  return (
    <div className="space-y-4">
      <QueryState loading={loading} error={error} onRetry={reload} hasData={Boolean(data)} />
      {byStatus ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Tổng đơn" value={formatNumber(total)} />
            <StatCard label="Tỷ lệ giao thành công" value={percent(successful, total)} tone="good" />
            <StatCard label="Tỷ lệ hủy / trả hàng" value={percent(lost, total)} tone={lost > 0 ? 'danger' : 'default'} />
            <StatCard label="Đang xử lý" value={formatNumber(byStatus.processing)} hint="Chờ lấy hàng và đang giao" />
          </div>
          <Card title="Đơn hàng theo trạng thái">
            <ul className="space-y-2.5">
              {ORDER_STATUSES.map((s) => {
                const count = byStatus[s.id] || 0
                return (
                  <li key={s.id} className="flex items-center gap-3 text-[12px]">
                    <span className="w-28 shrink-0 text-[#49352D]">{s.label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#F5E7D4]">
                      <span className="block h-full rounded-full bg-[#BD6E49]" style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }} />
                    </span>
                    <span className="w-24 text-right text-[#8B7566]">{formatNumber(count)} ({percent(count, total)})</span>
                  </li>
                )
              })}
            </ul>
          </Card>
          <Card title="5 đơn gần nhất">
            {recent.length === 0 ? (
              <Empty text="Chưa có đơn hàng." />
            ) : (
              <ul className="divide-y divide-[#E6D5C2]/70">
                {recent.map((o) => {
                  const status = ORDER_STATUSES.find((s) => s.id === o.status)
                  return (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[12px] first:pt-0 last:pb-0">
                      <span>
                        <span className="font-semibold text-[#49352D]">{o.orderCode}</span>
                        <span className="ml-2 text-[#8B7566]">{o.customerName} · {formatDateTime(o.createdAt)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Pill tone={status?.tone || 'muted'}>{status?.label || o.status}</Pill>
                        <b className="text-[#49352D]">{formatVnd(o.totalAmount)}</b>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
