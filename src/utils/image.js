/**
 * Sinh ảnh SVG placeholder ngay trên trình duyệt (data URI).
 * => Website chạy được hoàn toàn OFFLINE, không phụ thuộc CDN ảnh.
 *
 * Muốn dùng ảnh thật: chỉ cần điền `image` (URL) cho sản phẩm/shop trong src/data.
 * Component <SmartImage /> sẽ tự ưu tiên dùng URL thật và fallback về SVG này.
 */

const CATEGORY_PALETTE = {
  'thoi-trang-nam': ['#dbeafe', '#bfdbfe', '#1e40af'],
  'thoi-trang-nu': ['#fce7f3', '#fbcfe8', '#9d174d'],
  'dien-thoai': ['#e0e7ff', '#c7d2fe', '#3730a3'],
  'may-tinh': ['#e2e8f0', '#cbd5e1', '#334155'],
  'thiet-bi-gia-dung': ['#cffafe', '#a5f3fc', '#155e75'],
  'sac-dep': ['#ffe4e6', '#fecdd3', '#9f1239'],
  'nha-cua': ['#dcfce7', '#bbf7d0', '#166534'],
  'me-be': ['#fef3c7', '#fde68a', '#92400e'],
  'bach-hoa': ['#ecfccb', '#d9f99d', '#3f6212'],
  'the-thao': ['#ffedd5', '#fed7aa', '#9a3412'],
  'o-to-xe-may': ['#e5e7eb', '#d1d5db', '#374151'],
  'may-anh': ['#ede9fe', '#ddd6fe', '#5b21b6'],
}

const DEFAULT_PALETTE = ['#eef2f7', '#dde5ee', '#334155']

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function toDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Ảnh sản phẩm: nền gradient pastel + emoji lớn + nhãn nhỏ.
 */
export function productImage({ emoji = '🛍️', name = '', categoryId = '', tone = 0, watermark = 'SHOPNOVA' } = {}) {
  const [c1, c2, ink] = CATEGORY_PALETTE[categoryId] || DEFAULT_PALETTE
  const shift = (tone % 4) * 22
  const label = esc(name.length > 30 ? name.slice(0, 30) + '…' : name)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="52%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="480" height="480" fill="url(#bg)"/>
  <circle cx="150" cy="120" r="120" fill="#ffffff" opacity="0.35"/>
  <circle cx="380" cy="390" r="150" fill="#ffffff" opacity="0.25"/>
  <circle cx="240" cy="215" r="132" fill="url(#glow)"/>
  <ellipse cx="240" cy="372" rx="120" ry="18" fill="${ink}" opacity="0.12"/>
  <text x="240" y="268" font-size="164" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <text x="240" y="416" font-size="21" font-family="Segoe UI, Arial" font-weight="700" text-anchor="middle" fill="${ink}" opacity="0.55">${label}</text>
  <text x="240" y="446" font-size="15" font-family="Segoe UI, Arial" font-weight="600" text-anchor="middle" fill="${ink}" opacity="0.32" letter-spacing="2">${esc(
    watermark,
  )}</text>
</svg>`
  return toDataUri(svg)
}

/** Avatar shop: nền gradient + chữ cái đầu / emoji */
export function shopAvatar({ name = 'Shop', emoji = '🏬', hue = 12 } = {}) {
  const c1 = `hsl(${hue} 90% 62%)`
  const c2 = `hsl(${(hue + 32) % 360} 88% 46%)`
  const letter = esc((name.trim()[0] || 'S').toUpperCase())
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#a)"/>
  <circle cx="100" cy="100" r="66" fill="#ffffff" opacity="0.9"/>
  <text x="100" y="132" font-size="76" text-anchor="middle" font-family="Segoe UI, Arial" font-weight="bold" fill="${c2}">${letter}</text>
  <text x="100" y="188" font-size="34" text-anchor="middle">${emoji}</text>
</svg>`
  return toDataUri(svg)
}

/** Ảnh danh mục (vòng tròn) */
export function categoryImage({ emoji = '📦', hue = 200 } = {}) {
  const c1 = `hsl(${hue} 92% 96%)`
  const c2 = `hsl(${hue} 86% 84%)`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <rect width="160" height="160" fill="#ffffff"/>
  <circle cx="80" cy="80" r="78" fill="${c1}"/>
  <circle cx="80" cy="80" r="52" fill="#ffffff" opacity="0.75"/>
  <text x="80" y="104" font-size="62" text-anchor="middle">${emoji}</text>
  <circle cx="120" cy="52" r="16" fill="${c2}"/>
</svg>`
  return toDataUri(svg)
}

/** Ảnh banner (dùng cho hero slider) */
export function bannerImage({ title = '', subtitle = '', emojis = '🛍️', from = '#ee4d2d', to = '#ff9d5c' } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400" viewBox="0 0 900 400">
  <defs>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="900" height="400" fill="url(#b)"/>
  <circle cx="760" cy="70" r="170" fill="#ffffff" opacity="0.16"/>
  <circle cx="820" cy="340" r="120" fill="#ffffff" opacity="0.12"/>
  <text x="450" y="210" font-size="150" text-anchor="middle" opacity="0.28">${emojis}</text>
  <text x="60" y="150" font-size="46" font-family="Segoe UI, Arial" font-weight="800" fill="#ffffff">${esc(title)}</text>
  <text x="60" y="205" font-size="24" font-family="Segoe UI, Arial" fill="#ffffff" opacity="0.92">${esc(
    subtitle,
  )}</text>
</svg>`
  return toDataUri(svg)
}
