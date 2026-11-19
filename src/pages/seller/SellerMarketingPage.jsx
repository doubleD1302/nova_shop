import { useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { readApi, useSellerQuery } from '../../hooks/useSellerQuery'
import {
  apiBuySellerBoost,
  apiGetSellerBoosts,
  apiGetSellerCampaignRegistrations,
  apiGetSellerCampaigns,
  apiGetSellerMarketingAnalytics,
  apiGetSellerProducts,
  apiRegisterSellerCampaign,
} from '../../utils/api'
import { formatDate, formatDateTime, formatVnd } from '../../utils/format'
import {
  Card,
  DateRange,
  Empty,
  PageHeader,
  Pill,
  QueryState,
  StatCard,
  TabBar,
  inputClass,
  lastDays,
  primaryButton,
  rangeToParams,
  useTab,
} from '../../components/seller/SellerUi'

const TABS = [
  { id: 'tools', label: 'Công cụ quảng bá' },
  { id: 'programs', label: 'Chương trình tiếp thị' },
  { id: 'analytics', label: 'Theo dõi hiệu quả' },
]

// Giá và thời hạn gói đẩy phải khớp với BOOST_PACKAGES của Data API
const BOOST_PACKAGES = [
  { id: 'basic_1d', name: 'Gói Đẩy Cơ Bản 24h', cost: 50000 },
  { id: 'standard_3d', name: 'Gói Đẩy Tiêu Chuẩn 3 Ngày', cost: 120000 },
  { id: 'premium_7d', name: 'Gói Đẩy Nổi Bật 7 Ngày', cost: 250000 },
]

const BOOST_STATUS = { active: ['good', 'Đang chạy'], expired: ['muted', 'Đã hết hạn'], cancelled: ['bad', 'Đã hủy'] }
const REG_STATUS = { pending: ['warn', 'Chờ duyệt'], approved: ['good', 'Đã duyệt'], rejected: ['bad', 'Bị từ chối'] }

function StatusPill({ map, status }) {
  const [tone, label] = map[status] || ['muted', status]
  return <Pill tone={tone}>{label}</Pill>
}

/** Sản phẩm của shop đã được duyệt và đang bán, dùng cho cả hai biểu mẫu */
function useEligibleProducts() {
  const query = useSellerQuery(({ signal }) => apiGetSellerProducts({ limit: 100, signal }))
  const products = (query.data?.products || []).filter(
    (p) => p.status === 'active' && (!p.approvalStatus || p.approvalStatus === 'approved'),
  )
  return { ...query, products }
}

/** QUẢNG CÁO - Công cụ quảng bá / Chương trình tiếp thị / Theo dõi hiệu quả */
export default function SellerMarketingPage() {
  const [tab, setTab] = useTab(TABS)
  return (
    <div>
      <PageHeader title="Quảng cáo" description="Đẩy sản phẩm, đăng ký chương trình của sàn và xem hiệu quả." />
      <TabBar tabs={TABS} current={tab} onChange={setTab} />
      {tab === 'tools' ? <BoostTools /> : null}
      {tab === 'programs' ? <Programs /> : null}
      {tab === 'analytics' ? <Analytics /> : null}
    </div>
  )
}

function BoostTools() {
  const { pushToast } = useToast()
  const { products, loading: productsLoading, error: productsError } = useEligibleProducts()
  const boosts = useSellerQuery(({ signal }) => apiGetSellerBoosts({ signal }))
  const [productId, setProductId] = useState('')
  const [packageType, setPackageType] = useState(BOOST_PACKAGES[0].id)
  const [submitting, setSubmitting] = useState(false)

  const items = boosts.data?.items || []

  const handleBuy = async (e) => {
    e.preventDefault()
    if (!productId) {
      pushToast('Vui lòng chọn sản phẩm cần đẩy.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await readApi(await apiBuySellerBoost(productId, packageType), 'Không thể mua gói đẩy.')
      pushToast('Đã kích hoạt gói đẩy sản phẩm.', 'success')
      setProductId('')
      boosts.reload()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Mua gói đẩy sản phẩm">
        <form onSubmit={handleBuy} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="block text-[12px] text-[#8B7566]">
            Sản phẩm (đang bán, đã duyệt)
            <select className={`${inputClass} mt-1`} value={productId} onChange={(e) => setProductId(e.target.value)} disabled={productsLoading}>
              <option value="">{productsLoading ? 'Đang tải...' : 'Chọn sản phẩm'}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] text-[#8B7566]">
            Gói đẩy
            <select className={`${inputClass} mt-1`} value={packageType} onChange={(e) => setPackageType(e.target.value)}>
              {BOOST_PACKAGES.map((p) => (
                <option key={p.id} value={p.id}>{p.name} - {formatVnd(p.cost)}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={submitting} className={primaryButton}>Mua gói</button>
        </form>
        {productsError ? <p className="mt-2 text-[12px] text-rose-600">{productsError}</p> : null}
        <p className="mt-3 text-[11px] text-[#8B7566]">
          Mỗi sản phẩm chỉ có một gói đang chạy. Phí gói hiện chỉ được ghi nhận, chưa trừ vào số dư.
        </p>
      </Card>

      <Card title="Gói đẩy của gian hàng">
        <QueryState loading={boosts.loading} error={boosts.error} onRetry={boosts.reload} hasData={Boolean(boosts.data)} />
        {boosts.data && items.length === 0 ? <Empty text="Gian hàng chưa mua gói đẩy nào." /> : null}
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead className="text-[#8B7566]">
                <tr className="border-b border-[#E6D5C2]">
                  <th className="py-2 pr-3 font-medium">Sản phẩm</th>
                  <th className="py-2 pr-3 font-medium">Gói</th>
                  <th className="py-2 pr-3 font-medium">Thời gian chạy</th>
                  <th className="py-2 pr-3 font-medium">Trạng thái</th>
                  <th className="py-2 text-right font-medium">Chi phí</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className="border-b border-[#E6D5C2]/60 text-[#49352D]">
                    <td className="py-2 pr-3 font-medium">{b.productName}</td>
                    <td className="py-2 pr-3">{b.packageName}</td>
                    <td className="py-2 pr-3">{formatDateTime(b.startsAt)} - {formatDateTime(b.endsAt)}</td>
                    <td className="py-2 pr-3"><StatusPill map={BOOST_STATUS} status={b.status} /></td>
                    <td className="py-2 text-right font-semibold">{formatVnd(b.costVnd)}</td>
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

function Programs() {
  const { pushToast } = useToast()
  const { products, loading: productsLoading } = useEligibleProducts()
  const campaigns = useSellerQuery(({ signal }) => apiGetSellerCampaigns({ signal }))
  const registrations = useSellerQuery(({ signal }) => apiGetSellerCampaignRegistrations({ signal }))
  const [form, setForm] = useState({ campaignId: '', productId: '', discountPrice: '', note: '' })
  const [submitting, setSubmitting] = useState(false)

  const campaignItems = campaigns.data?.items || []
  const registrationItems = registrations.data?.items || []
  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleRegister = async (e) => {
    e.preventDefault()
    const discountPrice = Number(form.discountPrice)
    if (!form.campaignId || !form.productId) {
      pushToast('Vui lòng chọn chương trình và sản phẩm.', 'error')
      return
    }
    if (!Number.isSafeInteger(discountPrice) || discountPrice <= 0) {
      pushToast('Giá khuyến mãi phải là số nguyên dương.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await readApi(
        await apiRegisterSellerCampaign({ campaignId: form.campaignId, productId: form.productId, discountPrice, note: form.note.trim() }),
        'Không thể đăng ký chương trình.',
      )
      pushToast('Đã gửi đăng ký, vui lòng chờ Ban Quản Trị duyệt.', 'success')
      setForm({ campaignId: '', productId: '', discountPrice: '', note: '' })
      registrations.reload()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Chương trình đang mở đăng ký">
        <QueryState loading={campaigns.loading} error={campaigns.error} onRetry={campaigns.reload} hasData={Boolean(campaigns.data)} />
        {campaigns.data && campaignItems.length === 0 ? <Empty text="Hiện chưa có chương trình nào đang mở." /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {campaignItems.map((c) => (
            <div key={c.id} className="rounded-xl border border-[#E6D5C2] bg-[#FBF3E8] p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-[#49352D]">{c.name}</p>
                <Pill tone="info">{c.type === 'flash_sale' ? 'Flash Sale' : c.type}</Pill>
              </div>
              {c.description ? <p className="mt-1 text-[12px] text-[#8B7566]">{c.description}</p> : null}
              <p className="mt-1.5 text-[11px] text-[#8B7566]">{formatDate(c.startsAt)} - {formatDate(c.endsAt)}</p>
            </div>
          ))}
        </div>
      </Card>

      {campaignItems.length > 0 ? (
        <Card title="Đăng ký sản phẩm tham gia">
          <form onSubmit={handleRegister} className="grid gap-3 md:grid-cols-2">
            <label className="block text-[12px] text-[#8B7566]">
              Chương trình
              <select className={`${inputClass} mt-1`} value={form.campaignId} onChange={setField('campaignId')}>
                <option value="">Chọn chương trình</option>
                {campaignItems.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block text-[12px] text-[#8B7566]">
              Sản phẩm
              <select className={`${inputClass} mt-1`} value={form.productId} onChange={setField('productId')} disabled={productsLoading}>
                <option value="">{productsLoading ? 'Đang tải...' : 'Chọn sản phẩm'}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block text-[12px] text-[#8B7566]">
              Giá khuyến mãi cam kết (₫)
              <input className={`${inputClass} mt-1`} type="number" min={1} step={1000} value={form.discountPrice} onChange={setField('discountPrice')} />
            </label>
            <label className="block text-[12px] text-[#8B7566]">
              Ghi chú (không bắt buộc)
              <input className={`${inputClass} mt-1`} maxLength={255} value={form.note} onChange={setField('note')} />
            </label>
            <div className="md:col-span-2">
              <button type="submit" disabled={submitting} className={primaryButton}>Gửi đăng ký</button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card title="Hồ sơ đã đăng ký">
        <QueryState loading={registrations.loading} error={registrations.error} onRetry={registrations.reload} hasData={Boolean(registrations.data)} />
        {registrations.data && registrationItems.length === 0 ? <Empty text="Bạn chưa đăng ký chương trình nào." /> : null}
        {registrationItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead className="text-[#8B7566]">
                <tr className="border-b border-[#E6D5C2]">
                  <th className="py-2 pr-3 font-medium">Chương trình</th>
                  <th className="py-2 pr-3 font-medium">Sản phẩm</th>
                  <th className="py-2 pr-3 font-medium">Ngày gửi</th>
                  <th className="py-2 pr-3 font-medium">Trạng thái</th>
                  <th className="py-2 text-right font-medium">Giá cam kết</th>
                </tr>
              </thead>
              <tbody>
                {registrationItems.map((r) => (
                  <tr key={r.id} className="border-b border-[#E6D5C2]/60 text-[#49352D]">
                    <td className="py-2 pr-3 font-medium">{r.campaignName}</td>
                    <td className="py-2 pr-3">{r.productName}</td>
                    <td className="py-2 pr-3">{formatDateTime(r.createdAt)}</td>
                    <td className="py-2 pr-3"><StatusPill map={REG_STATUS} status={r.status} /></td>
                    <td className="py-2 text-right font-semibold">{formatVnd(r.discountPrice)}</td>
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

function Analytics() {
  const [range, setRange] = useState(() => lastDays(30))
  const params = rangeToParams(range)
  const { data, loading, error, reload } = useSellerQuery(
    ({ signal }) => apiGetSellerMarketingAnalytics({ ...params, signal }),
    [range.from, range.to],
  )
  const summary = data?.summary

  return (
    <div className="space-y-4">
      <Card action={<DateRange value={range} onChange={setRange} />}>
        <p className="text-[12px] text-[#8B7566]">
          Doanh thu và đơn hàng là của sản phẩm trong thời gian gói đẩy chạy (không tính đơn hủy), chưa chứng minh do quảng cáo mang lại. Hệ thống chưa ghi nhận lượt xem hay lượt nhấp.
        </p>
      </Card>
      <QueryState loading={loading} error={error} onRetry={reload} hasData={Boolean(data)} />
      {summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Gói đã mua" value={summary.totalBoosts} hint={`${summary.activeBoosts} gói đang chạy`} />
            <StatCard label="Tổng chi phí" value={formatVnd(summary.totalSpend)} tone="danger" />
            <StatCard label="Đơn trong thời gian chạy" value={summary.ordersDuringBoost} hint={`${summary.unitsDuringBoost} sản phẩm`} />
            <StatCard
              label="Doanh thu / chi phí"
              value={summary.revenueToSpendRatio === null ? 'Chưa có' : `${String(summary.revenueToSpendRatio).replace('.', ',')}x`}
              hint={formatVnd(summary.revenueDuringBoost)}
              tone="good"
            />
          </div>
          <Card title="Hồ sơ chương trình tiếp thị">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center text-[13px]">
              <div><p className="text-[18px] font-bold text-[#49352D]">{data.registrations.total}</p><p className="text-[#8B7566]">Tổng hồ sơ</p></div>
              <div><p className="text-[18px] font-bold text-amber-700">{data.registrations.pending}</p><p className="text-[#8B7566]">Chờ duyệt</p></div>
              <div><p className="text-[18px] font-bold text-emerald-700">{data.registrations.approved}</p><p className="text-[#8B7566]">Đã duyệt</p></div>
              <div><p className="text-[18px] font-bold text-rose-600">{data.registrations.rejected}</p><p className="text-[#8B7566]">Bị từ chối</p></div>
            </div>
          </Card>
          <Card title="Hiệu quả từng gói đẩy">
            {data.boosts.length === 0 ? (
              <Empty text="Chưa có gói đẩy trong khoảng thời gian này." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[12px]">
                  <thead className="text-[#8B7566]">
                    <tr className="border-b border-[#E6D5C2]">
                      <th className="py-2 pr-3 font-medium">Sản phẩm</th>
                      <th className="py-2 pr-3 font-medium">Gói</th>
                      <th className="py-2 pr-3 text-right font-medium">Chi phí</th>
                      <th className="py-2 pr-3 text-right font-medium">Đơn</th>
                      <th className="py-2 pr-3 text-right font-medium">Doanh thu</th>
                      <th className="py-2 text-right font-medium">Doanh thu / chi phí</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.boosts.map((b) => (
                      <tr key={b.id} className="border-b border-[#E6D5C2]/60 text-[#49352D]">
                        <td className="py-2 pr-3 font-medium">{b.productName}</td>
                        <td className="py-2 pr-3">{b.packageName}</td>
                        <td className="py-2 pr-3 text-right">{formatVnd(b.costVnd)}</td>
                        <td className="py-2 pr-3 text-right">{b.ordersDuringBoost}</td>
                        <td className="py-2 pr-3 text-right">{formatVnd(b.revenueDuringBoost)}</td>
                        <td className="py-2 text-right">{b.revenueToSpendRatio === null ? '-' : `${String(b.revenueToSpendRatio).replace('.', ',')}x`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.truncated ? <p className="mt-2 text-[11px] text-[#8B7566]">Chỉ hiển thị 200 gói gần nhất; số liệu tổng quan ở trên vẫn tính đủ.</p> : null}
          </Card>
        </>
      ) : null}
    </div>
  )
}
