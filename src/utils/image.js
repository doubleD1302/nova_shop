/**
 * Decorative SVGs for category and shop UI only. Product photos always come
 * from the catalog API or the seller's uploaded/licensed product images.
 */

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function toDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
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
export function categoryImage({ emoji = '', hue, name = '', slug = '' } = {}) {
  const category = `${name} ${slug}`.toLowerCase()
  const categoryStyles = [
    { match: /thoi-trang-nu|thời trang nữ|my-pham|mỹ phẩm|sắc đẹp/, emoji: '👗', hue: 338 },
    { match: /thoi-trang|thời trang|quần áo/, emoji: '👕', hue: 18 },
    { match: /giay|giày|dep|dép/, emoji: '👟', hue: 28 },
    { match: /tui|túi|balo|vali/, emoji: '👜', hue: 292 },
    { match: /dien-thoai|điện thoại|phu-kien-cong-nghe|công nghệ|may-tinh|máy tính/, emoji: '📱', hue: 210 },
    { match: /nha-cua|nhà cửa|gia-dung|gia dụng|bếp/, emoji: '🏠', hue: 142 },
    { match: /the-thao|thể thao|du-lich|du lịch/, emoji: '⚽', hue: 116 },
    { match: /me-be|mẹ bé|trẻ em/, emoji: '🧸', hue: 42 },
    { match: /thuc-pham|thực phẩm|đồ ăn|đồ uống/, emoji: '🥗', hue: 82 },
  ]
  const style = categoryStyles.find(({ match }) => match.test(category))
  const categoryEmoji = emoji || style?.emoji || '📦'
  const categoryHue = hue ?? style?.hue ?? 200
  const c1 = `hsl(${categoryHue} 92% 96%)`
  const c2 = `hsl(${categoryHue} 86% 84%)`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <rect width="160" height="160" fill="#ffffff"/>
  <circle cx="80" cy="80" r="78" fill="${c1}"/>
  <circle cx="80" cy="80" r="52" fill="#ffffff" opacity="0.75"/>
  <text x="80" y="104" font-size="62" text-anchor="middle">${categoryEmoji}</text>
  <circle cx="120" cy="52" r="16" fill="${c2}"/>
</svg>`
  return toDataUri(svg)
}

/** Ảnh banner (dùng cho hero slider) */
export function bannerImage({ title = '', subtitle = '', emojis = '🛍️', from = '#BD6E49', to = '#80513B' } = {}) {
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

/** Ảnh sản phẩm dự phòng phong cách Nova Shop (Terracotta & Cream) */
export function productPlaceholder({ name = 'Sản phẩm Nova Shop', emoji = '📦' } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <defs>
    <linearGradient id="p" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FBF3E8"/>
      <stop offset="100%" stop-color="#F5E7D4"/>
    </linearGradient>
  </defs>
  <rect width="300" height="300" fill="url(#p)" rx="16"/>
  <rect x="10" y="10" width="280" height="280" fill="none" stroke="#E6D5C2" stroke-width="2" stroke-dasharray="6,6" rx="12"/>
  <circle cx="150" cy="130" r="54" fill="#FFFCF7" stroke="#E6D5C2" stroke-width="1.5"/>
  <text x="150" y="152" font-size="52" text-anchor="middle">${emoji}</text>
  <text x="150" y="215" font-size="13" font-family="'Segoe UI', Arial, sans-serif" font-weight="bold" fill="#80513B" text-anchor="middle">NOVA SHOP</text>
  <text x="150" y="235" font-size="11" font-family="'Segoe UI', Arial, sans-serif" fill="#8B7566" text-anchor="middle">${esc(name.slice(0, 32))}</text>
</svg>`
  return toDataUri(svg)
}

/** Chuyển đổi an toàn đường dẫn ảnh (uploads / relative / external) */
export function resolveImageUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) return null
  const trimmed = url.trim()
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.startsWith('/')) {
    return `http://localhost:3000${trimmed}`
  }
  return trimmed
}
