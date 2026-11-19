import { useEffect, useRef, useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { readApi, useSellerQuery } from '../../hooks/useSellerQuery'
import {
  apiGetChatConversations,
  apiGetChatMessages,
  apiGetSellerReturns,
  apiGetSellerReviews,
  apiReplySellerReview,
  apiSendChatMessage,
  apiUpdateSellerReturnStatus,
} from '../../utils/api'
import { formatDateTime, formatVnd } from '../../utils/format'
import { IconSend, IconStar } from '../../components/ui/Icons'
import SmartImage from '../../components/ui/SmartImage'
import {
  Card,
  Empty,
  PageHeader,
  Pager,
  Pill,
  QueryState,
  StatCard,
  TabBar,
  ghostButton,
  inputClass,
  primaryButton,
  useTab,
} from '../../components/seller/SellerUi'

const TABS = [
  { id: 'chat', label: 'Tin nhắn' },
  { id: 'reviews', label: 'Đánh giá sản phẩm' },
  { id: 'inquiries', label: 'Hỗ trợ và khiếu nại' },
]

/** CSKH - Tin nhắn / Đánh giá sản phẩm / Hỗ trợ và khiếu nại */
export default function SellerCarePage() {
  const [tab, setTab] = useTab(TABS)
  return (
    <div>
      <PageHeader title="Chăm sóc khách hàng" description="Trả lời tin nhắn, đánh giá và xử lý yêu cầu trả hàng của người mua." />
      <TabBar tabs={TABS} current={tab} onChange={setTab} />
      {tab === 'chat' ? <Chat /> : null}
      {tab === 'reviews' ? <Reviews /> : null}
      {tab === 'inquiries' ? <Inquiries /> : null}
    </div>
  )
}

const POLL_MS = 10000

/** Chạy callback định kỳ khi tab trình duyệt đang hiển thị */
function usePolling(callback, intervalMs) {
  const saved = useRef(callback)
  useEffect(() => {
    saved.current = callback
  })
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') saved.current()
    }, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
}

function Chat() {
  const conversations = useSellerQuery(({ signal }) => apiGetChatConversations({ signal }))
  const [activeId, setActiveId] = useState('')

  const list = Array.isArray(conversations.data) ? conversations.data : []
  const active = list.find((c) => c.id === activeId) || null

  usePolling(conversations.reload, POLL_MS)

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card title="Hội thoại" className="max-h-[560px] overflow-y-auto">
        <QueryState loading={conversations.loading} error={conversations.error} onRetry={conversations.reload} hasData={Boolean(conversations.data)} />
        {conversations.data && list.length === 0 ? <Empty text="Chưa có khách nhắn tin cho shop." /> : null}
        <ul className="space-y-1">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                  c.id === activeId ? 'bg-[#F5E7D4]' : 'hover:bg-[#FBF3E8]'
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-[#E6D5C2] bg-[#F5E7D4] text-[13px] font-bold text-[#A95532]">
                  {c.buyerAvatar ? <SmartImage src={c.buyerAvatar} alt="" className="h-full w-full object-cover" /> : (c.buyerName || 'K').charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[#49352D]">{c.buyerName}</span>
                  <span className="block truncate text-[11px] text-[#8B7566]">{c.lastMessage || 'Chưa có tin nhắn'}</span>
                </span>
                {c.unreadCount > 0 ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#A95532] px-1 text-[10px] font-bold text-white">{c.unreadCount}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex h-[560px] flex-col !p-0">
        {active ? (
          <ChatThread key={active.id} conversation={active} onSent={conversations.reload} />
        ) : (
          <div className="grid flex-1 place-items-center text-[13px] text-[#8B7566]">Chọn một hội thoại để xem tin nhắn.</div>
        )}
      </Card>
    </div>
  )
}

function ChatThread({ conversation, onSent }) {
  const { pushToast } = useToast()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const query = useSellerQuery(({ signal }) => apiGetChatMessages(conversation.id, { limit: 100, signal }), [conversation.id])
  const messages = [...(query.data?.messages || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  usePolling(query.reload, POLL_MS)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const handleSend = async (e) => {
    e.preventDefault()
    const message = text.trim()
    if (!message) return
    setSending(true)
    try {
      await readApi(await apiSendChatMessage(conversation.id, { message }), 'Không thể gửi tin nhắn.')
      setText('')
      query.reload()
      onSent()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="border-b border-[#E6D5C2] px-4 py-3 text-[14px] font-bold text-[#49352D]">{conversation.buyerName}</div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {query.error ? <p className="text-center text-[12px] text-rose-600">{query.error}</p> : null}
        {messages.map((m) => {
          const mine = m.senderRole === 'seller'
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-[13px] ${mine ? 'bg-[#BD6E49] text-[#FFFCF7]' : 'bg-[#F5E7D4] text-[#49352D]'}`}>
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? 'text-[#FBF3E8]/80' : 'text-[#8B7566]'}`}>{formatDateTime(m.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2 border-t border-[#E6D5C2] p-3">
        <input className={inputClass} placeholder="Nhập tin nhắn..." value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />
        <button type="submit" disabled={sending || !text.trim()} className={`${primaryButton} flex items-center gap-1.5`}>
          <IconSend className="h-4 w-4" />
          Gửi
        </button>
      </form>
    </>
  )
}

const REVIEW_LIMIT = 10

function Reviews() {
  const { pushToast } = useToast()
  const [rating, setRating] = useState('')
  const [replied, setReplied] = useState('')
  const [offset, setOffset] = useState(0)
  const [replyingId, setReplyingId] = useState('')
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data, loading, error, reload } = useSellerQuery(
    ({ signal }) => apiGetSellerReviews({ rating, replied, limit: REVIEW_LIMIT, offset, signal }),
    [rating, replied, offset],
  )

  const filter = (setter) => (e) => {
    setOffset(0)
    setter(e.target.value)
  }

  const handleReply = async (reviewId) => {
    const reply = replyText.trim()
    if (!reply || reply.length > 1000) {
      pushToast('Nội dung phản hồi phải từ 1 đến 1000 ký tự.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await readApi(await apiReplySellerReview(reviewId, reply), 'Không thể gửi phản hồi.')
      pushToast('Đã gửi phản hồi, người mua sẽ nhận được thông báo.', 'success')
      setReplyingId('')
      setReplyText('')
      reload()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const summary = data?.summary
  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Tổng đánh giá" value={summary.totalReviews} />
          <StatCard label="Điểm trung bình" value={`${String(summary.averageRating).replace('.', ',')} / 5`} tone="good" />
          <StatCard label="Chưa phản hồi" value={summary.unreplied} tone={summary.unreplied > 0 ? 'danger' : 'default'} />
          <StatCard label="5 sao / 1 sao" value={`${summary.byRating[5]} / ${summary.byRating[1]}`} />
        </div>
      ) : null}

      <Card>
        <div className="flex flex-wrap gap-3">
          <select className={`${inputClass} !w-auto`} value={rating} onChange={filter(setRating)}>
            <option value="">Tất cả số sao</option>
            {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} sao</option>)}
          </select>
          <select className={`${inputClass} !w-auto`} value={replied} onChange={filter(setReplied)}>
            <option value="">Tất cả phản hồi</option>
            <option value="false">Chưa phản hồi</option>
            <option value="true">Đã phản hồi</option>
          </select>
        </div>
      </Card>

      <QueryState loading={loading} error={error} onRetry={reload} hasData={Boolean(data)} />
      {data ? (
        <Card>
          {data.items.length === 0 ? <Empty text="Chưa có đánh giá phù hợp." /> : null}
          <ul className="divide-y divide-[#E6D5C2]/70">
            {data.items.map((r) => (
              <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#49352D]">{r.buyerName}</span>
                    <span className="flex text-amber-500">
                      {Array.from({ length: 5 }, (_, i) => <IconStar key={i} filled={i < r.rating} />)}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#8B7566]">{formatDateTime(r.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-[#8B7566]">{r.productName}{r.variant ? ` - ${r.variant}` : ''}</p>
                {r.comment ? <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-[#49352D]">{r.comment}</p> : null}
                {r.images.length > 0 ? (
                  <div className="mt-2 flex gap-2">
                    {r.images.map((url) => <SmartImage key={url} src={url} alt="" className="h-16 w-16 rounded-lg border border-[#E6D5C2] object-cover" />)}
                  </div>
                ) : null}

                {r.sellerReply ? (
                  <div className="mt-2.5 rounded-xl bg-[#FBF3E8] p-3 text-[12px]">
                    <p className="font-semibold text-[#A95532]">Phản hồi của shop {r.repliedAt ? `(${formatDateTime(r.repliedAt)})` : ''}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[#49352D]">{r.sellerReply}</p>
                  </div>
                ) : replyingId === r.id ? (
                  <div className="mt-2.5 space-y-2">
                    <textarea className={inputClass} rows={3} maxLength={1000} placeholder="Nhập phản hồi (chỉ gửi được một lần)" value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                    <div className="flex gap-2">
                      <button type="button" disabled={submitting} onClick={() => handleReply(r.id)} className={primaryButton}>Gửi phản hồi</button>
                      <button type="button" onClick={() => setReplyingId('')} className={ghostButton}>Hủy</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setReplyingId(r.id); setReplyText('') }} className={`${ghostButton} mt-2.5`}>Phản hồi</button>
                )}
              </li>
            ))}
          </ul>
          <Pager total={data.total} limit={data.limit} offset={data.offset} onChange={setOffset} />
        </Card>
      ) : null}
    </div>
  )
}

const RETURN_STATUS = {
  requested: ['warn', 'Chờ xử lý'],
  approved: ['info', 'Đã chấp nhận'],
  rejected: ['bad', 'Đã từ chối'],
  completed: ['good', 'Đã hoàn tiền'],
  cancelled: ['muted', 'Người mua đã hủy'],
  disputed: ['bad', 'Người mua khiếu nại'],
}

const RETURN_FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'requested', label: 'Chờ xử lý' },
  { id: 'approved', label: 'Đã chấp nhận' },
  { id: 'disputed', label: 'Khiếu nại' },
  { id: 'completed', label: 'Đã hoàn tiền' },
  { id: 'rejected', label: 'Đã từ chối' },
]

function Inquiries() {
  const { pushToast } = useToast()
  const [status, setStatus] = useState('')
  const [notes, setNotes] = useState({})
  const [busyId, setBusyId] = useState('')

  const { data, loading, error, reload } = useSellerQuery(
    ({ signal }) => apiGetSellerReturns({ status, limit: 50, signal }),
    [status],
  )
  const items = Array.isArray(data) ? data : []

  const handleUpdate = async (returnId, nextStatus) => {
    const sellerNote = (notes[returnId] || '').trim()
    if (nextStatus === 'rejected' && !sellerNote) {
      pushToast('Vui lòng nhập lý do khi từ chối yêu cầu.', 'error')
      return
    }
    if (nextStatus === 'completed' && !window.confirm('Xác nhận đã nhận lại hàng và hoàn tiền cho người mua?')) return
    setBusyId(returnId)
    try {
      await readApi(await apiUpdateSellerReturnStatus(returnId, { status: nextStatus, ...(sellerNote ? { sellerNote } : {}) }), 'Không thể cập nhật yêu cầu.')
      pushToast('Đã cập nhật yêu cầu trả hàng.', 'success')
      reload()
    } catch (err) {
      pushToast(err.message, 'error')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap gap-1.5">
          {RETURN_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatus(f.id)}
              className={`rounded-full border px-3 py-1 text-[12px] transition ${
                status === f.id ? 'border-[#A95532] bg-[#F5E7D4] font-semibold text-[#A95532]' : 'border-[#E6D5C2] text-[#8B7566] hover:bg-[#FBF3E8]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      <QueryState loading={loading} error={error} onRetry={reload} hasData={Boolean(data)} />
      {data && items.length === 0 ? <Card><Empty text="Chưa có yêu cầu trả hàng hoặc khiếu nại nào." /></Card> : null}
      {items.map((r) => {
        const [tone, label] = RETURN_STATUS[r.status] || ['muted', r.status]
        const canDecide = r.status === 'requested'
        const canComplete = r.status === 'approved'
        return (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-[#49352D]">{r.buyerName} <span className="font-normal text-[#8B7566]">· đơn con #{r.shopOrderId}</span></p>
                <p className="text-[11px] text-[#8B7566]">{formatDateTime(r.createdAt)}</p>
              </div>
              <Pill tone={tone}>{label}</Pill>
            </div>
            <p className="mt-2 text-[13px] text-[#49352D]"><b>Lý do:</b> {r.reason}</p>
            {r.detail ? <p className="mt-1 whitespace-pre-wrap text-[12px] text-[#8B7566]">{r.detail}</p> : null}
            {r.images.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.images.map((url) => <SmartImage key={url} src={url} alt="" className="h-16 w-16 rounded-lg border border-[#E6D5C2] object-cover" />)}
              </div>
            ) : null}
            <p className="mt-2 text-[12px] text-[#8B7566]">Số tiền hoàn: <b className="text-[#A95532]">{formatVnd(r.refundAmount)}</b></p>
            {r.sellerNote ? <p className="mt-1 text-[12px] text-[#8B7566]">Ghi chú của shop: {r.sellerNote}</p> : null}

            {canDecide || canComplete ? (
              <div className="mt-3 space-y-2">
                <input
                  className={inputClass}
                  maxLength={500}
                  placeholder={canDecide ? 'Ghi chú cho người mua (bắt buộc khi từ chối)' : 'Ghi chú (không bắt buộc)'}
                  value={notes[r.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  {canDecide ? (
                    <>
                      <button type="button" disabled={busyId === r.id} onClick={() => handleUpdate(r.id, 'approved')} className={primaryButton}>Chấp nhận</button>
                      <button type="button" disabled={busyId === r.id} onClick={() => handleUpdate(r.id, 'rejected')} className={ghostButton}>Từ chối</button>
                    </>
                  ) : (
                    <button type="button" disabled={busyId === r.id} onClick={() => handleUpdate(r.id, 'completed')} className={primaryButton}>Đã nhận hàng, hoàn tiền</button>
                  )}
                </div>
              </div>
            ) : null}
            {r.status === 'disputed' ? (
              <p className="mt-3 text-[12px] text-[#8B7566]">Khiếu nại này do Ban Quản Trị xử lý; shop chưa thể thay đổi trạng thái.</p>
            ) : null}
          </Card>
        )
      })}
    </div>
  )
}
