import assert from 'node:assert/strict'
import http from 'node:http'

const requests = []
let failing = new Set()
const dataApi = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const q = url.searchParams.get('q')
  requests.push(q)
  res.setHeader('content-type', 'application/json')
  if (failing.has(q)) return res.writeHead(503).end(JSON.stringify({ success: false, message: 'Tạm ngưng' }))
  const products = q === 'tai' || q === 'nghe'
    ? [{ id: '201', name: 'Tai nghe thật', categoryName: 'Điện tử' }]
    : []
  return res.end(JSON.stringify({ success: true, data: { products } }))
})
await new Promise(resolve => dataApi.listen(0, '127.0.0.1', resolve))
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-ai-catalog-test.env', DATA_API_URL: `http://127.0.0.1:${dataApi.address().port}`, DATA_API_KEY: 'ai-catalog-test-service-key', JWT_SECRET: 'ai-catalog-test-jwt-secret-32-characters' })
const { findCatalogProducts } = await import('../src/services/ai-catalog.service.js')
try {
  const result = await findCatalogProducts('Tìm tai nghe dưới 300 nghìn')
  assert.deepEqual(requests, ['tai', 'nghe'])
  assert.equal(result.products.length, 1)
  assert.equal(result.products[0].id, '201')
  assert.equal(result.partial, false)
  failing = new Set(['tai'])
  const partial = await findCatalogProducts('Tìm tai nghe')
  assert.equal(partial.available, true)
  assert.equal(partial.partial, true)
  assert.equal(partial.products[0].id, '201')
  failing = new Set(['tai', 'nghe'])
  const down = await findCatalogProducts('Tìm tai nghe')
  assert.equal(down.available, false)
  assert.equal(down.partial, true)
  const count = requests.length
  const noKeywords = await findCatalogProducts('giúp tôi')
  assert.deepEqual(noKeywords.products, [])
  assert.equal(noKeywords.available, null)
  assert.equal(requests.length, count)
  console.log('PASS: tìm qua Data API theo từ khóa, khử trùng lặp và nhận biết lỗi một phần (mock).')
} finally {
  await new Promise(resolve => dataApi.close(resolve))
}
