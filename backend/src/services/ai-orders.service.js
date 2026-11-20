const STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
}

// Từ khóa người mua hay dùng → trạng thái đơn.
const STATUS_KEYWORDS = [
  ['cancelled', /đã\s*hủy|bị\s*hủy|đơn\s*hủy/i],
  ['shipping', /đang\s*giao|đang\s*vận\s*chuyển|đang\s*trên\s*đường/i],
  ['delivered', /đã\s*giao|giao\s*thành\s*công|đã\s*nhận/i],
  ['pending', /chờ\s*xác\s*nhận|chưa\s*xác\s*nhận/i],
  ['confirmed', /đã\s*xác\s*nhận/i],
]

const money = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)}₫`
const label = (status) => STATUS_LABELS[status] || String(status || 'Không rõ')

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function summarizeOrder(order) {
  const parts = [`${order.code}: ${label(order.status)}`]
  if (order.total !== undefined) parts.push(money(order.total))
  const date = order.createdAt ? formatDate(order.createdAt) : ''
  if (date) parts.push(`đặt ${date}`)
  return `- ${parts.join(' — ')}`
}

function describeOrder(order) {
  const lines = [`Đơn ${order.code}: ${label(order.status)}.`]
  const items = Array.isArray(order.items) ? order.items : []
  if (items.length) lines.push(`Sản phẩm: ${items.slice(0, 5).map((item) => `${item.name || item.productName} x${item.qty ?? item.quantity ?? 1}`).join('; ')}${items.length > 5 ? ` và ${items.length - 5} sản phẩm khác` : ''}.`)
  if (order.total !== undefined) lines.push(`Tổng thanh toán: ${money(order.total)}${order.payment ? ` (${String(order.payment).toUpperCase()})` : ''}.`)
  if (order.shippingUnit) lines.push(`Đơn vị vận chuyển: ${order.shippingUnit}.`)
  const last = Array.isArray(order.statusHistory) ? order.statusHistory.at(-1) : null
  if (last?.at) lines.push(`Cập nhật gần nhất: ${label(last.status)} lúc ${formatDate(last.at)}.`)
  return lines.join('\n')
}

/**
 * Trả lời câu hỏi về đơn hàng của chính người mua bằng dữ liệu thật, không qua mô hình ngôn ngữ nên không thể bịa trạng thái.
 * `result` là phản hồi của Data API /internal/v1/orders; `code` là mã đơn khách nhắc tới (nếu có).
 * Trả { reply, pagination? }.
 */
export function buildBuyerOrderReply({ result, text, code, page, offset }) {
  if (code) {
    const found = result.orders.find((order) => String(order.code).toUpperCase() === code.toUpperCase())
    return found
      ? { reply: `${describeOrder(found)}\nBạn có thể xem chi tiết trong mục Đơn hàng.` }
      : { reply: `Nova không thấy đơn mã ${code} trong ${result.orders.length} đơn gần nhất của tài khoản bạn. Hãy kiểm tra lại mã đơn trong mục Đơn hàng.` }
  }

  const wanted = STATUS_KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0]
  const orders = wanted ? result.orders.filter((order) => order.status === wanted) : result.orders
  const pagination = { page, total: result.total, hasMore: offset + result.orders.length < result.total }
  if (!orders.length) {
    const reply = !result.total
      ? 'Bạn chưa có đơn hàng để hiển thị.'
      : !result.orders.length
        ? 'Không có đơn hàng ở trang này.'
        : `Không có đơn "${label(wanted)}" trong trang này.`
    return { reply, pagination }
  }
  const header = wanted ? `Các đơn "${label(wanted)}" của bạn (trong trang này):` : 'Các đơn của bạn:'
  return { reply: `${header}\n${orders.map(summarizeOrder).join('\n')}\nBạn có thể xem chi tiết trong mục Đơn hàng.`, pagination }
}
