/** Labels for states and payment methods returned by the real orders API. */
export const ORDER_STATUS = {
  pending: { label: 'Chờ xác nhận', color: 'text-amber-600', bg: 'bg-amber-50' },
  confirmed: { label: 'Đã xác nhận', color: 'text-sky-600', bg: 'bg-sky-50' },
  shipping: { label: 'Đang giao', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  delivered: { label: 'Đã giao', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cancelled: { label: 'Đã hủy', color: 'text-rose-600', bg: 'bg-rose-50' },
}

export const PAYMENT_LABEL = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  momo: 'Ví điện tử MoMo',
  zalopay: 'Ví điện tử ZaloPay',
  card: 'Thẻ Tín dụng / Ghi nợ',
  bank: 'Chuyển khoản ngân hàng',
}
