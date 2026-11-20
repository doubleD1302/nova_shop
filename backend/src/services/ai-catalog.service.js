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
  // Cụm chỉ địa điểm nhận hàng (đã đổi thành bộ lọc).
  'khu', 'vuc',
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

// Địa điểm hay gặp. Data API so khớp một phần với tỉnh/thành của shop nên dùng tên không có "TP.".
const LOCATIONS = [
  ['Hà Nội', 'ha noi|hanoi'],
  ['Hồ Chí Minh', 'ho chi minh|tp ?hcm|tphcm|hcm|sai gon'],
  ['Đà Nẵng', 'da nang'],
  ['Hải Phòng', 'hai phong'],
  ['Cần Thơ', 'can tho'],
].map(([name, words]) => [name, new RegExp(`(?:\\b(?:khu vuc|o|tai|gan|giao ve|giao den|noi nhan)\\s+)?\\b(?:${words})\\b`)])

/**
 * Tách địa điểm khỏi câu hỏi. `rest` là câu đã bỏ cụm địa điểm (cắt theo vị trí ký tự nên giữ nguyên dấu của phần còn lại).
 */
export function splitLocation(query) {
  const chars = [...String(query).normalize('NFC')]
  const flat = chars.map((char) => {
    const plain = char.length === 1 ? normalize(char) : ' '
    return plain.length === 1 ? plain : ' '
  }).join('')
  for (const [location, pattern] of LOCATIONS) {
    const match = pattern.exec(flat)
    if (match) {
      const end = match.index + match[0].length
      return { location, rest: chars.map((char, index) => (index >= match.index && index < end ? ' ' : char)).join('') }
    }
  }
  return { location: null, rest: String(query) }
}

/**
 * Hiểu giá, kiểu sắp xếp và điều kiện giao hàng từ câu hỏi để Data API lọc đúng thay vì chỉ khớp từ khóa.
 * Trả về các khóa không rỗng trong { minPrice, maxPrice, sort, freeship, location }.
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
  const { location } = splitLocation(query)
  if (location) filters.location = location
  return filters
}

/**
 * Từ khóa tên sản phẩm theo thứ tự trong câu: bỏ từ phổ thông, số tiền, đơn vị và cụm địa điểm; tối đa 5 từ khác nhau.
 * Mỗi phần tử là [dạng không dấu, dạng gốc].
 */
export function extractSearchTerms(query) {
  const seen = new Set()
  const terms = []
  for (const word of splitLocation(query).rest.match(/[\p{L}\p{N}]+/gu) || []) {
    const key = normalize(word)
    if (key.length < 2 || /^\d/.test(key) || STOP_WORDS.has(key) || seen.has(key)) continue
    seen.add(key)
    terms.push([key, word])
  }
  return terms.slice(0, 5)
}

const SORT_FIELDS = {
  'price-asc': (product) => Number(product.price) || 0,
  'price-desc': (product) => -(Number(product.price) || 0),
  rating: (product) => -(Number(product.rating) || 0),
  popular: (product) => -(Number(product.sold) || 0),
}

// Tiếng Việt viết từng âm tiết ("sơ mi", "tai nghe"), nên tìm theo cụm trước rồi mới tới từng từ.
function buildSearches(terms) {
  const words = terms.map(([, word]) => word)
  const phrases = []
  if (words.length >= 3) phrases.push(words.slice(0, 3).join(' '))
  if (words.length >= 2) phrases.push(words.slice(words.length >= 3 ? 1 : 0, 3).join(' '))
  return [...new Set([...phrases, ...words])].slice(0, 4)
}

// So khớp theo nguyên từ (không phải chuỗi con) để "mi" không khớp "gaming", "ao" không khớp "thao".
const tokensOf = (text) => new Set(normalize(text).match(/[a-z0-9]+/g) || [])
// Câu ngắn (tới 3 từ) phải khớp đủ; câu dài có từ mô tả không nằm trong tên ("công sở") thì cho thiếu một phần.
const requiredMatches = (count) => (count <= 3 ? count : Math.ceil(count * 0.6))

async function searchProducts(searches, baseParams, location) {
  return Promise.allSettled(searches.map(async (query) => {
    const params = new URLSearchParams(baseParams)
    if (query) params.set('q', query)
    if (location) params.set('location', location)
    const data = await callDataApi(`/internal/v1/products?${params}`)
    if (!Array.isArray(data?.products) || !Number.isSafeInteger(data.total) || data.total < 0) throw new Error('Invalid catalog response')
    return data
  }))
}

// Gộp kết quả các truy vấn, giữ sản phẩm thực sự đúng loại: tên khớp đủ số từ cần thiết, hoặc danh mục/shop khớp đủ mọi từ
// (tìm theo tên shop, danh mục). Tránh trả thẻ sản phẩm không liên quan.
function pickRelevant(results, terms, sortValue) {
  const unique = new Map()
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const product of result.value.products) {
      if (product && product.id != null) unique.set(String(product.id), product)
    }
  }
  const scored = [...unique.values()].map((product) => {
    const nameTokens = tokensOf(product.name)
    const allTokens = tokensOf([product.name, product.categoryName, product.shopName].join(' '))
    const nameMatches = terms.filter(([key]) => nameTokens.has(key)).length
    const allMatches = terms.filter(([key]) => allTokens.has(key)).length
    const keep = !terms.length || nameMatches >= requiredMatches(terms.length) || allMatches === terms.length
    return { product, keep, score: terms.length ? allMatches + nameMatches : 1 }
  }).filter((item) => item.keep)
  scored.sort((a, b) => b.score - a.score || (sortValue ? sortValue(a.product) - sortValue(b.product) : 0))
  return scored.map((item) => item.product)
}

export async function findCatalogProducts(query, page = 1) {
  const terms = extractSearchTerms(query)
  const filters = parseSearchFilters(query)
  const hasFilters = Object.keys(filters).length > 0
  if (!terms.length && !hasFilters) return { products: [], available: null, partial: false, hasMore: null, filters }
  const offset = (page - 1) * 5

  const baseParams = new URLSearchParams({ limit: '5', offset: String(offset) })
  for (const key of ['minPrice', 'maxPrice', 'sort']) if (filters[key] !== undefined) baseParams.set(key, String(filters[key]))
  if (filters.freeship) baseParams.set('freeship', '1')

  // Không có từ khóa nhưng có bộ lọc: một truy vấn chỉ theo bộ lọc.
  const searches = terms.length ? buildSearches(terms) : [null]
  const sortValue = SORT_FIELDS[filters.sort]
  let results = await searchProducts(searches, baseParams, filters.location)
  let products = pickRelevant(results, terms, sortValue)
  let locationRelaxed = false

  // Địa điểm là ưu tiên, không phải điều kiện bắt buộc: trang đầu không có sản phẩm ở nơi khách muốn
  // thì gợi ý cùng loại ở khu vực khác và đánh dấu để Nova nói rõ điều đó.
  if (filters.location && !products.length && results.some((result) => result.status === 'fulfilled')) {
    const relaxed = await searchProducts(searches, baseParams, null)
    const relaxedProducts = pickRelevant(relaxed, terms, sortValue)
    if (relaxedProducts.length) {
      results = relaxed
      products = relaxedProducts
      locationRelaxed = true
    }
  }

  const successful = results.filter((result) => result.status === 'fulfilled')
  const partial = successful.length < results.length
  // Đã lọc bỏ kết quả không liên quan nên không còn trang nào để xem tiếp nếu danh sách rỗng.
  const hasMore = !products.length ? false : successful.some((result) => offset + result.value.products.length < result.value.total) ? true : partial ? null : false
  return { products, available: successful.length > 0, partial, hasMore, filters: locationRelaxed ? { ...filters, locationRelaxed: true } : filters }
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
