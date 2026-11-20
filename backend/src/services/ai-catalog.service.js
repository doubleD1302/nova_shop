import { callDataApi } from '../clients/data.client.js'

const STOP_WORDS = new Set([
  'toi', 'minh', 'ban', 'tim', 'giup', 'cho', 'mot', 'nhung', 'cac', 'cua', 'san', 'pham', 'gia', 'duoi', 'tren', 'voi', 'nao', 'mua',
  'shopnova', 'nova', 'can', 'muon', 'bao', 'nhieu', 'dong', 'nghin', 'ngan', 'trieu', 'khong', 'giao', 'hang', 'ship', 'trang', 'the',
  'loai', 'duoc', 'co', 'hay', 'nhe',
  // Từ chỉ giá, sắp xếp và lời hỏi chung: đã đổi thành bộ lọc hoặc không phải tên sản phẩm.
  're', 'nhat', 'dat', 'cao', 'tot', 'hot', 'chay', 'moi', 'tu', 'den', 'toi', 'da', 'qua', 'hon', 'khoang', 'tam', 'xem', 'mau',
  'gi', 'vay', 'thap', 'freeship', 'free', 'xin', 'danh', 'rating', 'sao', 'sale', 'khuyen',
  'giam', 'mien', 'phi', 'van', 'chuyen', 'it', 'thieu', 'lon', 'nho', 'vnd', 'tr',
  // Lời nối tiếp hội thoại.
  'khac', 'them', 'tuong', 'goi', 'xuat', 'gioi', 'thieu', 'cung', 'nua', 'cai', 'nay', 'kia',
])
const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')

const UNIT_MULTIPLIER = { k: 1000, nghin: 1000, ngan: 1000, tr: 1000000, trieu: 1000000, m: 1000000 }
// Số tiền: 300k, 300 nghìn, 1,5 triệu, 2tr5, 1.500.000đ.
const MONEY = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|trieu|tr|m|vnd|dong|d)?(?:(?<=tr|trieu)(\d{1,2}))?(?![a-z0-9])/g

function toVnd(numberText, unit, fraction) {
  const hasUnit = Boolean(UNIT_MULTIPLIER[unit])
  // "1.500.000" hoặc "1,500,000": dấu phân cách hàng nghìn. Còn lại ("1,5") là số thập phân.
  const isGrouped = /^\d{1,3}([.,]\d{3})+$/.test(numberText)
  let value = isGrouped ? Number(numberText.replace(/[.,]/g, '')) : Number(numberText.replace(',', '.'))
  if (fraction) value = Number(`${Math.trunc(value)}.${fraction}`)
  if (!Number.isFinite(value)) return null
  const vnd = Math.round(value * (hasUnit ? UNIT_MULTIPLIER[unit] : 1))
  // Số trần nhỏ hơn 1.000 không có đơn vị thì không đủ để hiểu là tiền (ví dụ "size 40").
  return vnd >= 1000 && vnd <= 1000000000 ? vnd : null
}

/**
 * Hiểu giá, kiểu sắp xếp và điều kiện giao hàng từ câu hỏi để Data API lọc đúng thay vì chỉ khớp từ khóa.
 * Trả về các khóa không rỗng trong { minPrice, maxPrice, sort, freeship }.
 */
export function parseSearchFilters(query) {
  const text = normalize(query)
  const filters = {}

  for (const match of text.matchAll(MONEY)) {
    const before = text.slice(Math.max(0, match.index - 16), match.index)
    const after = text.slice(match.index + match[0].length)

    // "từ 200 đến 500 nghìn": số thứ nhất dùng chung đơn vị với số thứ hai nếu chưa có đơn vị.
    const range = /\btu\s*$/.test(before) && after.match(/^\s*(?:den|toi|-)\s*(\d[\d.,]*\s*(?:k|nghin|ngan|trieu|tr|m)?(?:\d{1,2})?)/)
    if (range) {
      const upper = [...range[1].matchAll(MONEY)][0]
      const lowerAmount = toVnd(match[1], match[2] || upper?.[2], match[3])
      const upperAmount = upper ? toVnd(upper[1], upper[2], upper[3]) : null
      if (lowerAmount !== null) {
        filters.minPrice = lowerAmount
        if (upperAmount !== null && upperAmount >= lowerAmount) filters.maxPrice = upperAmount
      }
      continue
    }

    const amount = toVnd(match[1], match[2], match[3])
    if (amount === null) continue
    if (/(?:\bduoi|toi da|khong qua|khong vuot|nho hon|re hon|<)\s*$/.test(before)) {
      filters.maxPrice = amount
    } else if (/(?:\btu|\btren|toi thieu|it nhat|lon hon|\bhon|khong duoi|>)\s*$/.test(before)) {
      filters.minPrice = amount
    } else if (/\b(?:khoang|tam|gia)\s*$/.test(before)) {
      filters.minPrice = Math.round(amount * 0.7)
      filters.maxPrice = Math.round(amount * 1.3)
    }
  }

  if (/\b(?:re nhat|gia thap nhat|thap nhat|gia re|re re|re hon)\b/.test(text)) filters.sort = 'price-asc'
  else if (/\b(?:dat nhat|cao cap nhat|gia cao nhat)\b/.test(text)) filters.sort = 'price-desc'
  else if (/\b(?:ban chay|hot nhat|pho bien|nhieu nguoi mua|best ?seller)\b/.test(text)) filters.sort = 'popular'
  else if (/\b(?:danh gia cao|nhieu sao|rating cao|duoc danh gia tot|review tot)\b/.test(text)) filters.sort = 'rating'
  else if (/\b(?:giam gia|khuyen mai|sale|giam sau)\b/.test(text)) filters.sort = 'discount'
  else if (/\b(?:moi nhat|hang moi|moi ve)\b/.test(text)) filters.sort = 'newest'

  if (/\b(?:freeship|free ship|mien phi van chuyen|mien phi ship)\b/.test(text)) filters.freeship = true
  return filters
}

/**
 * Từ khóa tên sản phẩm: bỏ từ phổ thông, số tiền và đơn vị, tối đa 3 từ khác nhau.
 */
export function extractSearchTerms(query) {
  return [...new Map((String(query).match(/[\p{L}\p{N}]+/gu) || [])
    .map((word) => [normalize(word), word])
    .filter(([word]) => word.length >= 2 && !/^\d/.test(word) && !STOP_WORDS.has(word))).entries()]
    .slice(0, 3)
}

const SORT_FIELDS = {
  'price-asc': (product) => Number(product.price) || 0,
  'price-desc': (product) => -(Number(product.price) || 0),
  rating: (product) => -(Number(product.rating) || 0),
  popular: (product) => -(Number(product.sold) || 0),
}

export async function findCatalogProducts(query, page = 1) {
  const words = extractSearchTerms(query)
  const filters = parseSearchFilters(query)
  const hasFilters = Object.keys(filters).length > 0
  if (!words.length && !hasFilters) return { products: [], available: null, partial: false, hasMore: null, filters }
  const offset = (page - 1) * 5

  const params = new URLSearchParams({ limit: '5', offset: String(offset) })
  for (const key of ['minPrice', 'maxPrice', 'sort']) if (filters[key] !== undefined) params.set(key, String(filters[key]))
  if (filters.freeship) params.set('freeship', '1')

  // Mỗi từ tìm qua API danh mục, thay vì chỉ quét trang đầu không lọc. Không có từ khóa nhưng có bộ lọc: một truy vấn chỉ theo bộ lọc.
  const searches = words.length ? words.map(([, word]) => word) : [null]
  const results = await Promise.allSettled(searches.map(async (word) => {
    const wordParams = new URLSearchParams(params)
    if (word) wordParams.set('q', word)
    const data = await callDataApi(`/internal/v1/products?${wordParams}`)
    if (!Array.isArray(data?.products) || !Number.isSafeInteger(data.total) || data.total < 0) throw new Error('Invalid catalog response')
    return data
  }))
  const successful = results.filter((result) => result.status === 'fulfilled')
  const unique = new Map()
  for (const result of successful) {
    for (const product of result.value.products) {
      if (product && product.id != null) unique.set(String(product.id), product)
    }
  }
  let products = [...unique.values()].map((product) => {
    const text = normalize([product.name, product.categoryName, product.shopName].join(' '))
    return { product, score: words.length ? words.filter(([word]) => text.includes(word)).length : 1 }
  }).filter((item) => item.score > 0)
  const sortValue = SORT_FIELDS[filters.sort]
  products.sort((a, b) => b.score - a.score || (sortValue ? sortValue(a.product) - sortValue(b.product) : 0))
  products = products.map((item) => item.product)
  const partial = successful.length < results.length
  const hasMore = successful.some(result => offset + result.value.products.length < result.value.total) ? true : partial ? null : false
  return { products, available: successful.length > 0, partial, hasMore, filters }
}

/**
 * Lấy chi tiết (kèm biến thể màu/size, tồn kho) của các sản phẩm đang được bàn tới để trả lời câu hỏi tiếp nối.
 * Lỗi dịch vụ dữ liệu không làm hỏng cuộc trò chuyện: trả danh sách rỗng.
 */
export async function findProductsByIds(ids) {
  const valid = [...new Set((ids || []).map(String).filter((id) => /^[1-9]\d{0,19}$/.test(id)))].slice(0, 3)
  if (!valid.length) return []
  try {
    const data = await callDataApi(`/internal/v1/products?ids=${valid.join(',')}&limit=${valid.length}`)
    return Array.isArray(data?.products) ? data.products : []
  } catch {
    return []
  }
}
