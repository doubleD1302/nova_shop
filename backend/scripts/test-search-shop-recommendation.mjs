import assert from 'node:assert/strict'
import { DEFAULT_PRODUCTS, DEFAULT_SHOPS } from '../../src/data/defaultCatalog.js'

console.log('=== BẮT ĐẦU KIỂM THỬ TÍNH NĂNG TÌM KIẾM ĐỀ XUẤT SHOP CHO MÓN ĐỒ ===\n')

let passed = 0
let failed = 0

function test(description, fn) {
  try {
    fn()
    console.log(`  ✓ PASS: ${description}`)
    passed++
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`, err.message)
    failed++
  }
}

// 1. Kiểm tra thuật toán phân nhóm và chấm điểm shop đề xuất
function computeRecommendedShops({ products, shops, queryQ = '', category = '', selectedShopId = null }) {
  if (!shops || shops.length === 0) {
    return { recommendedShop: null, recommendedShopProducts: [], otherRecommendedShops: [] }
  }

  const productsByShopId = new Map()
  products.forEach((p) => {
    const sid = String(p.shopId)
    if (!productsByShopId.has(sid)) productsByShopId.set(sid, [])
    productsByShopId.get(sid).push(p)
  })

  const qNorm = (queryQ || '').trim().toLowerCase()
  const catNorm = (category || '').trim().toLowerCase()

  const scoredShops = shops.map((s) => {
    const sId = String(s.id)
    const matchedProducts = productsByShopId.get(sId) || []
    let score = 0

    // Điểm từ số lượng sản phẩm khớp
    score += matchedProducts.length * 15

    // Điểm từ tổng lượt bán
    const totalSold = matchedProducts.reduce((sum, p) => sum + (Number(p.sold) || 0), 0)
    score += Math.min(totalSold, 50)

    // Điểm danh tiếng: Mall, Rating, Followers
    if (s.mall) score += 20
    score += (Number(s.rating) || 0) * 4
    score += Math.min((Number(s.followers) || 0) / 400, 10)

    const sName = (s.name || '').toLowerCase()
    const sTagline = (s.tagline || '').toLowerCase()
    if (qNorm && (sName.includes(qNorm) || sTagline.includes(qNorm))) {
      score += 35
    }

    if (catNorm && matchedProducts.some((p) => String(p.categoryId).toLowerCase() === catNorm)) {
      score += 25
    }

    return {
      shop: s,
      matchedProducts,
      score,
    }
  })

  const shopsWithProducts = scoredShops
    .filter((item) => item.matchedProducts.length > 0)
    .sort((a, b) => b.score - a.score)

  let bestItem = null
  let others = []

  if (selectedShopId) {
    bestItem = scoredShops.find((item) => String(item.shop.id) === String(selectedShopId))
  }

  if (!bestItem) {
    bestItem = shopsWithProducts.length > 0 ? shopsWithProducts[0] : (scoredShops[0] || null)
  }

  if (shopsWithProducts.length > 0) {
    others = shopsWithProducts
      .filter((item) => String(item.shop.id) !== String(bestItem?.shop?.id))
      .map((item) => item.shop)
      .slice(0, 3)
  } else {
    others = scoredShops
      .filter((item) => String(item.shop.id) !== String(bestItem?.shop?.id))
      .slice(0, 3)
      .map((item) => item.shop)
  }

  if (!bestItem) {
    return { recommendedShop: null, recommendedShopProducts: [], otherRecommendedShops: [] }
  }

  let showcaseProducts = [...bestItem.matchedProducts]
  if (showcaseProducts.length < 4) {
    const moreProducts = products.filter(
      (p) => String(p.shopId) === String(bestItem.shop.id) && !showcaseProducts.some((sp) => sp.id === p.id),
    )
    showcaseProducts.push(...moreProducts.slice(0, 4 - showcaseProducts.length))
  }

  return {
    recommendedShop: bestItem.shop,
    recommendedShopProducts: showcaseProducts,
    otherRecommendedShops: others,
  }
}

// Chạy các kịch bản kiểm thử
test('Tìm kiếm "tai nghe": Đề xuất gian hàng bán tai nghe/âm thanh chính hãng', () => {
  const matchingProducts = DEFAULT_PRODUCTS.filter((p) => p.name.toLowerCase().includes('tai nghe'))
  assert.ok(matchingProducts.length > 0, 'Phải có sản phẩm tai nghe trong catalog')

  const res = computeRecommendedShops({
    products: matchingProducts,
    shops: DEFAULT_SHOPS,
    queryQ: 'tai nghe',
  })

  assert.ok(res.recommendedShop, 'Phải tìm thấy shop đề xuất')
  assert.ok(
    res.recommendedShop.id === '1' || res.recommendedShop.id === '3',
    'Shop đề xuất phải là ShopNova Official Mall hoặc Autumn Vibe Audio',
  )
  assert.ok(res.recommendedShopProducts.length > 0, 'Phải có sản phẩm của shop trong danh sách showcase')
})

test('Tìm kiếm "áo thun": Đề xuất gian hàng thời trang bán áo thun', () => {
  const matchingProducts = DEFAULT_PRODUCTS.filter((p) => p.name.toLowerCase().includes('áo thun'))
  assert.ok(matchingProducts.length > 0, 'Phải có sản phẩm áo thun trong catalog')

  const res = computeRecommendedShops({
    products: matchingProducts,
    shops: DEFAULT_SHOPS,
    queryQ: 'áo thun',
  })

  assert.ok(res.recommendedShop, 'Phải tìm thấy shop đề xuất')
  assert.equal(res.recommendedShop.id, '2', 'Shop đề xuất phải là Terracotta Living & Decor (shop bán áo thun)')
  assert.ok(res.recommendedShopProducts.some((p) => p.name.includes('Áo Thun Form Rộng')))
})

test('Tìm kiếm "dưỡng da": Đề xuất gian hàng mỹ phẩm và chăm sóc da', () => {
  const matchingProducts = DEFAULT_PRODUCTS.filter(
    (p) => p.name.toLowerCase().includes('dưỡng da') || p.name.toLowerCase().includes('tinh chất') || p.categoryName === 'Mỹ phẩm',
  )

  const res = computeRecommendedShops({
    products: matchingProducts,
    shops: DEFAULT_SHOPS,
    queryQ: 'dưỡng da',
  })

  assert.ok(res.recommendedShop, 'Phải tìm thấy shop đề xuất')
  assert.equal(res.recommendedShop.id, '4', 'Shop đề xuất phải là Glow Beauty Natural Care')
})

test('Tìm kiếm theo ngành hàng (category="thoi-trang-nu"): Đề xuất shop thời trang nữ chính hãng', () => {
  const matchingProducts = DEFAULT_PRODUCTS.filter((p) => p.categoryId === 'thoi-trang-nu')

  const res = computeRecommendedShops({
    products: matchingProducts,
    shops: DEFAULT_SHOPS,
    category: 'thoi-trang-nu',
  })

  assert.ok(res.recommendedShop, 'Phải tìm thấy shop đề xuất')
  assert.ok(res.recommendedShopProducts.length > 0, 'Phải có sản phẩm thời trang nữ')
})

test('Chuyển đổi lựa chọn shop thủ công qua selectedShopId', () => {
  const matchingProducts = DEFAULT_PRODUCTS

  const res = computeRecommendedShops({
    products: matchingProducts,
    shops: DEFAULT_SHOPS,
    queryQ: 'phụ kiện',
    selectedShopId: '3', // Chọn gian hàng Autumn Vibe
  })

  assert.equal(res.recommendedShop.id, '3', 'Shop đề xuất phải đổi sang shop 3 khi người dùng chọn')
})

test('Đề xuất fallback uy tín khi từ khóa không có sản phẩm trùng khớp', () => {
  const res = computeRecommendedShops({
    products: [],
    shops: DEFAULT_SHOPS,
    queryQ: 'mặt hàng lạ không có sản phẩm',
  })

  assert.ok(res.recommendedShop, 'Vẫn phải đề xuất gian hàng uy tín trên sàn')
  assert.ok(res.recommendedShop.rating >= 4.5, 'Shop đề xuất phải có đánh giá cao')
})

console.log(`\n=== TỔNG KẾT: ${passed} PASS, ${failed} FAIL ===\n`)
if (failed > 0) process.exit(1)
