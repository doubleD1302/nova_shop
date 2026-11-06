import { callDataApi } from '../clients/data.client.js'

const STOP_WORDS = new Set(['toi', 'minh', 'ban', 'tim', 'giup', 'cho', 'mot', 'nhung', 'cua', 'san', 'pham', 'gia', 'duoi', 'tren', 'voi', 'nao', 'mua', 'shopnova', 'nova', 'can', 'muon', 'bao', 'nhieu', 'dong', 'nghin', 'ngan', 'trieu', 'khong', 'giao', 'hang', 'ship', 'trang', 'the', 'loai', 'duoc', 'co', 'hay', 'nhe'])
const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')

export async function findCatalogProducts(query, page = 1) {
  const words = [...new Map((query.match(/[\p{L}\p{N}]+/gu) || [])
    .map((word) => [normalize(word), word])
    .filter(([word]) => word.length >= 2 && !/^\d/.test(word) && !STOP_WORDS.has(word))).entries()]
    .slice(0, 3)
  if (!words.length) return { products: [], available: null, partial: false, hasMore: null }
  const offset = (page - 1) * 5

  // Mỗi từ tìm qua API danh mục, thay vì chỉ quét trang đầu không lọc.
  const results = await Promise.allSettled(words.map(async ([, word]) => {
    const data = await callDataApi(`/internal/v1/products?limit=5&offset=${offset}&q=${encodeURIComponent(word)}`)
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
  const products = [...unique.values()].map((product) => {
    const text = normalize([product.name, product.categoryName, product.shopName].join(' '))
    return { product, score: words.filter(([word]) => text.includes(word)).length }
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.product)
  const partial = successful.length < results.length
  const hasMore = successful.some(result => offset + result.value.products.length < result.value.total) ? true : partial ? null : false
  return { products, available: successful.length > 0, partial, hasMore }
}
