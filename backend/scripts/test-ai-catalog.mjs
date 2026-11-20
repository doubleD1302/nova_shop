import assert from 'node:assert/strict'
import http from 'node:http'

const requests = []
const urls = []
let failing = new Set()
const dataApi = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const q = url.searchParams.get('q')
  requests.push(q)
  urls.push(url)
  res.setHeader('content-type', 'application/json')
  if (failing.has(q)) return res.writeHead(503).end(JSON.stringify({ success: false, message: 'Tạm ngưng' }))
  const offset = Number(url.searchParams.get('offset'))
  // Cụm "áo sơ mi": không có ở Hà Nội, có ở TP.HCM; kèm hàng gây nhiễu có "mi" trong "gaming" và "ao" trong "thao".
  if (q === 'áo sơ mi' || q === 'sơ mi' || q === 'áo' || q === 'sơ') {
    const decoys = [{ id: '301', name: 'Chuột gaming không dây', categoryName: 'Điện tử & Công nghệ', location: 'Hà Nội' }, { id: '302', name: 'Túi thể thao 55L', categoryName: 'Thể thao', location: 'Hà Nội' }, { id: '303', name: 'áo thunnnn mì xí', categoryName: 'Thời trang', location: 'Hà Nội' }]
    const shirts = url.searchParams.get('location') === 'Hà Nội' ? [] : [{ id: '300', name: 'Áo sơ mi nam công sở', categoryName: 'Thời trang', location: 'TP. Hồ Chí Minh' }]
    const products = [...shirts, ...decoys]
    return res.end(JSON.stringify({ success: true, data: { products, total: products.length } }))
  }
  const products = q === 'tai nghe' || q === 'tai' || q === 'nghe'
    ? [{ id: '201', name: 'Tai nghe thật', categoryName: 'Điện tử' }, ...(q === 'nghe' ? [{ id: '202', name: 'Chuột không dây', categoryName: 'Điện tử & Công nghệ' }] : [])]
    : q === 'balo' ? [{ id: String(offset + 1), name: 'Balo kiểm thử', categoryName: 'Túi' }] : []
  return res.end(JSON.stringify({ success: true, data: { products, total: q === 'balo' ? 1002 : products.length } }))
})
await new Promise(resolve => dataApi.listen(0, '127.0.0.1', resolve))
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-ai-catalog-test.env', DATA_API_URL: `http://127.0.0.1:${dataApi.address().port}`, DATA_API_KEY: 'ai-catalog-test-service-key', JWT_SECRET: 'ai-catalog-test-jwt-secret-32-characters' })
const { findCatalogProducts } = await import('../src/services/ai-catalog.service.js')
try {
  const result = await findCatalogProducts('Tìm tai nghe dưới 300 nghìn')
  assert.deepEqual(requests, ['tai nghe', 'tai', 'nghe'])
  assert.equal(result.products.length, 1)
  assert.equal(result.products[0].id, '201')
  assert.equal(result.partial, false)
  failing = new Set(['tai'])
  const partial = await findCatalogProducts('Tìm tai nghe')
  assert.equal(partial.available, true)
  assert.equal(partial.partial, true)
  assert.equal(partial.products[0].id, '201')
  failing = new Set(['tai nghe', 'tai', 'nghe'])
  const down = await findCatalogProducts('Tìm tai nghe')
  assert.equal(down.available, false)
  assert.equal(down.partial, true)
  const deepPage = await findCatalogProducts('Tìm balo trang 101', 101)
  assert.equal(deepPage.products[0].id, '501')
  assert.equal(deepPage.hasMore, true)
  // Không có ở khu vực khách muốn thì gợi ý cùng loại ở nơi khác, không lẫn hàng khớp nhầm mảnh chữ
  urls.length = 0
  const shirt = await findCatalogProducts('áo sơ mi công sở dưới 500k khu vực hà nội')
  assert.deepEqual(shirt.products.map((product) => product.id), ['300'])
  assert.equal(shirt.filters.locationRelaxed, true)
  assert.equal(shirt.filters.location, 'Hà Nội')
  assert.ok(urls.slice(0, 4).every((url) => url.searchParams.get('location') === 'Hà Nội' && url.searchParams.get('maxPrice') === '500000'))
  assert.ok(urls.slice(4).every((url) => !url.searchParams.has('location') && url.searchParams.get('maxPrice') === '500000'))
  assert.equal(new Set(urls.map((url) => url.searchParams.get('q'))).size, 4)
  // Trang sau cũng nới địa điểm khi nơi khách muốn không có kết quả, để không bị trang trống
  const nextPage = await findCatalogProducts('áo sơ mi ở hà nội trang 2', 2)
  assert.equal(nextPage.filters.locationRelaxed, true)
  assert.equal(nextPage.products.length > 0, true)
  // "mì xí" không phải "mi" của sơ mi: áo thun chỉ khớp 2/3 từ nên bị loại
  const noisy = await findCatalogProducts('áo sơ mi')
  assert.ok(noisy.products.every((product) => product.id === '300'))
  const count = requests.length
  const noKeywords = await findCatalogProducts('giúp tôi')
  assert.deepEqual(noKeywords.products, [])
  assert.equal(noKeywords.available, null)
  assert.equal(requests.length, count)
  console.log('PASS: tìm qua Data API theo từ khóa, khử trùng lặp và nhận biết lỗi một phần (mock).')
} finally {
  await new Promise(resolve => dataApi.close(resolve))
}
