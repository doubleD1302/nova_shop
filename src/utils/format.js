/**
 * Các hàm định dạng dùng chung toàn ứng dụng.
 * Tất cả đều là hàm thuần (pure) => dễ test, dễ thay bằng dữ liệu API sau này.
 */

/** 179000 -> "179.000₫" */
export function formatVnd(value) {
  const n = Number(value) || 0
  return new Intl.NumberFormat('vi-VN').format(n) + '₫'
}

/** Tách giá thành phần số (dùng để render <sup>₫</sup>) */
export function splitVnd(value) {
  const n = Number(value) || 0
  return { amount: new Intl.NumberFormat('vi-VN').format(n), symbol: '₫' }
}

/** 18200 -> "18,2k" ; 980 -> "980" ; 1250000 -> "1,2tr" */
export function formatSold(value) {
  const n = Number(value) || 0
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + 'tr'
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + 'k'
  return String(n)
}

/** 240000 -> "240K" (dùng cho người theo dõi) */
export function formatFollowers(value) {
  const n = Number(value) || 0
  if (n >= 1000) return Math.round(n / 1000) + 'K'
  return String(n)
}

/** 4.95 -> "4,95" */
export function formatRating(value) {
  return Number(value || 0).toFixed(2).replace(/0$/, '').replace('.', ',')
}

/** Phần trăm giảm giá: 890000/1850000 -> 52 */
export function discountPercent(price, originalPrice) {
  if (!originalPrice || originalPrice <= price) return 0
  return Math.round((1 - price / originalPrice) * 100)
}

/** "tai nghe bluetooth" -> "tai-nghe-bluetooth" (bỏ dấu tiếng Việt) */
export function toSlug(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

/** 179000 -> "179.000" (không có ký hiệu tiền tệ) */
export function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

/** ISO string -> "12/06/2025 14:30" */
export function formatDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (x) => String(x).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

/** ISO string -> "12/06/2025" */
export function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (x) => String(x).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Mã đơn hàng: SN20250612XXXX */
export function makeOrderCode() {
  const d = new Date()
  const pad = (x) => String(x).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `SN${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${rand}`
}

export function makeId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** Đếm ngược trả về {h, m, s} từ số giây */
export function secondsToHms(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  return {
    h: String(Math.floor(s / 3600)).padStart(2, '0'),
    m: String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
    s: String(s % 60).padStart(2, '0'),
  }
}
