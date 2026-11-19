import { useMemo, useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { readApi, useSellerQuery } from '../../hooks/useSellerQuery'
import {
  apiCreateSellerPayout,
  apiGetSellerBankAccount,
  apiGetSellerPayoutBalance,
  apiGetSellerPayoutHistory,
  apiGetSellerRevenueReport,
  apiGetSellerTransactions,
  apiSaveSellerBankAccount,
} from '../../utils/api'
import { formatDateTime, formatVnd } from '../../utils/format'
import {
  Card,
  DateRange,
  Empty,
  PageHeader,
  Pager,
  Pill,
  QueryState,
  StatCard,
  TabBar,
  ghostButton,
  inputClass,
  lastDays,
  primaryButton,
  rangeToParams,
  useTab,
} from '../../components/seller/SellerUi'

const TABS = [
  { id: 'overview', label: 'Tổng quan doanh thu' },
  { id: 'transactions', label: 'Lịch sử giao dịch' },
  { id: 'payouts', label: 'Số dư và thanh toán' },
]

const ORDER_STATUS_LABEL = {
  pending: 'Chờ xác nhận',
  confirmed: 'Chờ lấy hàng',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  returned: 'Trả hàng',
}

const TX_TYPES = [
  { id: '', label: 'Tất cả' },
  { id: 'order_income', label: 'Tiền đơn hàng' },
  { id: 'refund', label: 'Hoàn tiền' },
  { id: 'payout', label: 'Rút tiền' },
]

const TX_TYPE_LABEL = { order_income: 'Tiền đơn hàng', refund: 'Hoàn tiền', payout: 'Rút tiền' }
const TX_STATUS = {
  available: ['good', 'Đã khả dụng'],
  escrow: ['warn', 'Đang giữ 7 ngày'],
  completed: ['info', 'Đã hoàn tất'],
  pending: ['warn', 'Chờ duyệt'],
  approved: ['info', 'Đã duyệt'],
  processing: ['info', 'Đang xử lý'],
  rejected: ['bad', 'Bị từ chối'],
}

function statusPill(status) {
  const [tone, label] = TX_STATUS[status] || ['muted', status]
  return <Pill tone={tone}>{label}</Pill>
}

/** TÀI CHÍNH - Tổng quan doanh thu / Lịch sử giao dịch / Số dư và thanh toán */
export default function SellerFinancePage() {
  const [tab, setTab] = useTab(TABS)
  return (
    <div>
      <PageHeader title="Tài chính" description="Theo dõi doanh thu, giao dịch và số dư của gian hàng." />
      <TabBar tabs={TABS} current={tab} onChange={setTab} />
      {tab === 'overview' ? <RevenueOverview /> : null}
      {tab === 'transactions' ? <Transactions /> : null}
      {tab === 'payouts' ? <Payouts /> : null}
    </div>
  )
}

function RevenueOverview() {
  const [range, setRange] = useState(() => lastDays(30))
  const params = rangeToParams(range)
  const { data, loading, error, reload } = useSellerQuery(
    ({ signal }) => apiGetSellerRevenueReport({ ...params, signal }),
    [range.from, range.to],
  )

  const summary = data?.summary
  return (
    <div className="space-y-4">
      <Card action={<DateRange value={range} onChange={setRange} />}>
        <p className="text-[12px] text-[#8B7566]">
          Doanh thu thực nhận chỉ tính các đơn đã giao, đã trừ voucher của shop và phí sàn.
        </p>
      </Card>
      <QueryState loading={loading} error={error} onRetry={reload} hasData={Boolean(data)} />
      {summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Tổng đơn trong kỳ" value={summary.totalOrders} hint={`${summary.deliveredOrders} đơn đã giao`} />
            <StatCard label="Tiền hàng (đơn đã giao)" value={formatVnd(summary.totalSubtotal)} />
            <StatCard label={`Phí sàn (${summary.commissionRate}%)`} value={formatVnd(summary.totalCommission)} tone="danger" />
            <StatCard label="Thực nhận" value={formatVnd(summary.totalPayout)} tone="good" />
          </div>
          <Card title="Chi tiết đơn hàng">
            {data.orders.length === 0 ? (
              <Empty text="Chưa có đơn hàng trong khoảng thời gian này." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[12px]">
                  <thead className="text-[#8B7566]">
                    <tr className="border-b border-[#E6D5C2]">
                      <th className="py-2 pr-3 font-medium">Mã đơn</th>
                      <th className="py-2 pr-3 font-medium">Ngày đặt</th>
                      <th className="py-2 pr-3 font-medium">Trạng thái</th>
                      <th className="py-2 pr-3 text-right font-medium">Tiền hàng</th>
                      <th className="py-2 pr-3 text-right font-medium">Phí sàn</th>
                      <th className="py-2 text-right font-medium">Thực nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((o) => (
                      <tr key={o.shopOrderId} className="border-b border-[#E6D5C2]/60 text-[#49352D]">
                        <td className="py-2 pr-3 font-medium">{o.orderCode}</td>
                        <td className="py-2 pr-3">{formatDateTime(o.createdAt)}</td>
                        <td className="py-2 pr-3">{ORDER_STATUS_LABEL[o.status] || o.status}</td>
                        <td className="py-2 pr-3 text-right">{formatVnd(o.subtotal - o.discountAmount)}</td>
                        <td className="py-2 pr-3 text-right">{formatVnd(o.commissionFee)}</td>
                        <td className="py-2 text-right font-semibold">{formatVnd(o.sellerPayout)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}

const TX_LIMIT = 20

function Transactions() {
  const [type, setType] = useState('')
  const [range, setRange] = useState({ from: '', to: '' })
  const [offset, setOffset] = useState(0)
  const params = rangeToParams(range)

  const { data, loading, error, reload } = useSellerQuery(
    ({ signal }) => apiGetSellerTransactions({ type, limit: TX_LIMIT, offset, ...params, signal }),
    [type, range.from, range.to, offset],
  )

  const changeFilter = (setter) => (value) => {
    setOffset(0)
    setter(value)
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TX_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => changeFilter(setType)(t.id)}
                className={`rounded-full border px-3 py-1 text-[12px] transition ${
                  type === t.id ? 'border-[#A95532] bg-[#F5E7D4] font-semibold text-[#A95532]' : 'border-[#E6D5C2] text-[#8B7566] hover:bg-[#FBF3E8]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <DateRange value={range} onChange={changeFilter(setRange)} />
        </div>
      </Card>
      <QueryState loading={loading} error={error} onRetry={reload} hasData={Boolean(data)} />
      {data ? (
        <Card>
          {data.items.length === 0 ? (
            <Empty text="Chưa có giao dịch phù hợp." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead className="text-[#8B7566]">
                  <tr className="border-b border-[#E6D5C2]">
                    <th className="py-2 pr-3 font-medium">Thời gian</th>
                    <th className="py-2 pr-3 font-medium">Loại</th>
                    <th className="py-2 pr-3 font-medium">Mã tham chiếu</th>
                    <th className="py-2 pr-3 font-medium">Trạng thái</th>
                    <th className="py-2 text-right font-medium">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((tx) => (
                    <tr key={tx.id} className="border-b border-[#E6D5C2]/60 text-[#49352D]">
                      <td className="py-2 pr-3">{formatDateTime(tx.occurredAt)}</td>
                      <td className="py-2 pr-3">{TX_TYPE_LABEL[tx.type] || tx.type}</td>
                      <td className="py-2 pr-3">{tx.reference}</td>
                      <td className="py-2 pr-3">{statusPill(tx.status)}</td>
                      <td className={`py-2 text-right font-semibold ${tx.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {tx.amount > 0 ? '+' : ''}
                        {formatVnd(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager total={data.total} limit={data.limit} offset={data.offset} onChange={setOffset} />
        </Card>
      ) : null}
    </div>
  )
}

const MIN_PAYOUT = 50000

function Payouts() {
  const { pushToast } = useToast()
  const balance = useSellerQuery(({ signal }) => apiGetSellerPayoutBalance({ signal }))
  const history = useSellerQuery(({ signal }) => apiGetSellerPayoutHistory({ signal }))
  const bank = useSellerQuery(({ signal }) => apiGetSellerBankAccount({ signal }))

  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingBank, setEditingBank] = useState(false)
  const [bankForm, setBankForm] = useState({ bankName: '', bankCode: '', accountNumber: '', accountHolder: '', branch: '' })

  const available = balance.data?.balance?.available ?? 0
  const hasBank = Boolean(balance.data?.hasLinkedBank)

  const reloadAll = () => {
    balance.reload()
    history.reload()
    bank.reload()
  }

  const handleWithdraw = async (e) => {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isSafeInteger(value) || value < MIN_PAYOUT) {
      pushToast(`Số tiền rút tối thiểu là ${formatVnd(MIN_PAYOUT)}.`, 'error')
      return
    }
    if (value > available) {
      pushToast('Số tiền rút vượt quá số dư khả dụng.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await readApi(await apiCreateSellerPayout(value), 'Không thể tạo lệnh rút tiền.')
      pushToast('Đã tạo lệnh rút tiền, vui lòng chờ duyệt.', 'success')
      setAmount('')
      reloadAll()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const startEditBank = () => {
    setBankForm({
      bankName: bank.data?.bankName || '',
      bankCode: bank.data?.bankCode || '',
      accountNumber: '',
      accountHolder: bank.data?.accountHolder || '',
      branch: bank.data?.branch || '',
    })
    setEditingBank(true)
  }

  const handleSaveBank = async (e) => {
    e.preventDefault()
    const payload = Object.fromEntries(Object.entries(bankForm).map(([k, v]) => [k, v.trim()]))
    if (!payload.bankName || !payload.bankCode || !payload.accountNumber || !payload.accountHolder) {
      pushToast('Vui lòng nhập đủ ngân hàng, mã ngân hàng, số tài khoản và tên chủ tài khoản.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await readApi(await apiSaveSellerBankAccount(payload), 'Không thể lưu tài khoản ngân hàng.')
      pushToast('Đã lưu tài khoản ngân hàng.', 'success')
      setEditingBank(false)
      reloadAll()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const setBankField = (key) => (e) => setBankForm((prev) => ({ ...prev, [key]: e.target.value }))

  const historyItems = useMemo(() => (Array.isArray(history.data) ? history.data : []), [history.data])

  return (
    <div className="space-y-4">
      <QueryState loading={balance.loading} error={balance.error} onRetry={balance.reload} hasData={Boolean(balance.data)} />
      {balance.data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Số dư khả dụng" value={formatVnd(balance.data.balance.available)} tone="good" />
          <StatCard label="Đang giữ (chờ 7 ngày)" value={formatVnd(balance.data.balance.pendingEscrow)} />
          <StatCard label="Đang chờ rút" value={formatVnd(balance.data.balance.withdrawing)} />
          <StatCard label="Đã rút" value={formatVnd(balance.data.balance.totalPaidOut)} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Tài khoản ngân hàng"
          action={
            !editingBank && !bank.loading ? (
              <button type="button" onClick={startEditBank} className={ghostButton}>
                {bank.data ? 'Đổi tài khoản' : 'Liên kết tài khoản'}
              </button>
            ) : null
          }
        >
          {editingBank ? (
            <form onSubmit={handleSaveBank} className="space-y-2.5">
              <input className={inputClass} placeholder="Tên ngân hàng" value={bankForm.bankName} onChange={setBankField('bankName')} maxLength={100} />
              <input className={inputClass} placeholder="Mã ngân hàng (ví dụ: VCB)" value={bankForm.bankCode} onChange={setBankField('bankCode')} maxLength={20} />
              <input className={inputClass} placeholder="Số tài khoản" value={bankForm.accountNumber} onChange={setBankField('accountNumber')} inputMode="numeric" />
              <input className={inputClass} placeholder="Tên chủ tài khoản" value={bankForm.accountHolder} onChange={setBankField('accountHolder')} />
              <input className={inputClass} placeholder="Chi nhánh (không bắt buộc)" value={bankForm.branch} onChange={setBankField('branch')} />
              <div className="flex gap-2">
                <button type="submit" disabled={submitting} className={primaryButton}>Lưu tài khoản</button>
                <button type="button" onClick={() => setEditingBank(false)} className={ghostButton}>Hủy</button>
              </div>
            </form>
          ) : bank.data ? (
            <dl className="space-y-1 text-[13px] text-[#49352D]">
              <div><dt className="inline text-[#8B7566]">Ngân hàng: </dt><dd className="inline font-medium">{bank.data.bankName}</dd></div>
              <div><dt className="inline text-[#8B7566]">Số tài khoản: </dt><dd className="inline font-medium">{bank.data.maskedAccountNumber}</dd></div>
              <div><dt className="inline text-[#8B7566]">Chủ tài khoản: </dt><dd className="inline font-medium">{bank.data.accountHolder}</dd></div>
            </dl>
          ) : (
            <Empty text={bank.error || 'Bạn chưa liên kết tài khoản ngân hàng.'} />
          )}
        </Card>

        <Card title="Tạo lệnh rút tiền">
          <form onSubmit={handleWithdraw} className="space-y-2.5">
            <input
              className={inputClass}
              type="number"
              min={MIN_PAYOUT}
              step={1000}
              placeholder={`Số tiền (tối thiểu ${formatVnd(MIN_PAYOUT)})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!hasBank}
            />
            <p className="text-[12px] text-[#8B7566]">
              {hasBank ? `Có thể rút tối đa ${formatVnd(available)}.` : 'Hãy liên kết tài khoản ngân hàng trước khi rút tiền.'}
            </p>
            <button type="submit" disabled={!hasBank || submitting || available < MIN_PAYOUT} className={primaryButton}>
              Gửi lệnh rút tiền
            </button>
          </form>
        </Card>
      </div>

      <Card title="Lịch sử rút tiền">
        <QueryState loading={history.loading} error={history.error} onRetry={history.reload} hasData={Boolean(history.data)} />
        {history.data && historyItems.length === 0 ? <Empty text="Chưa có lệnh rút tiền nào." /> : null}
        {historyItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead className="text-[#8B7566]">
                <tr className="border-b border-[#E6D5C2]">
                  <th className="py-2 pr-3 font-medium">Mã lệnh</th>
                  <th className="py-2 pr-3 font-medium">Ngày tạo</th>
                  <th className="py-2 pr-3 font-medium">Ngân hàng</th>
                  <th className="py-2 pr-3 font-medium">Trạng thái</th>
                  <th className="py-2 text-right font-medium">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((p) => (
                  <tr key={p.id} className="border-b border-[#E6D5C2]/60 text-[#49352D]">
                    <td className="py-2 pr-3 font-medium">{p.payoutCode}</td>
                    <td className="py-2 pr-3">{formatDateTime(p.createdAt)}</td>
                    <td className="py-2 pr-3">{p.bankName} {p.maskedAccountNumber}</td>
                    <td className="py-2 pr-3">
                      {statusPill(p.status)}
                      {p.status === 'rejected' && p.rejectionReason ? (
                        <span className="ml-1.5 text-[11px] text-rose-600">{p.rejectionReason}</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-right font-semibold">{formatVnd(p.amount)}</td>
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
