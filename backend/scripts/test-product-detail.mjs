import assert from 'node:assert/strict'
import http from 'node:http'
let mode = 'ok'
const dataApi = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json')
  const query = new URL(req.url, 'http://localhost').searchParams
  if (mode === 'error') return res.writeHead(500).end(JSON.stringify({ success: false, error: { code: 'BROKEN' } }))
  if (mode === 'bad') return res.end(JSON.stringify({ success: true, data: { products: [{ id: '9', slug: 'other' }] } }))
  if (mode === 'empty') return res.end(JSON.stringify({ success: true, data: { products: [] } }))
  assert.equal(query.get('fullImages'), '1')
  return res.end(JSON.stringify({ success: true, data: { products: [{ id: '1', slug: 'demo-product' }] } }))
})
await new Promise((resolve) => dataApi.listen(0, '127.0.0.1', resolve))
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-product-detail-test.env', DATA_API_URL: `http://127.0.0.1:${dataApi.address().port}`, DATA_API_KEY: 'product-detail-test-service-key', JWT_SECRET: 'product-detail-test-jwt-secret-32-characters' })
const { default: app } = await import('../src/app.js')
const server = http.createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/api/v1/products`
async function get(key) { const r = await fetch(`${base}/${key}`); return { status: r.status, body: await r.json() } }
try {
  assert.equal((await fetch(`${base}?ids=1&ids=2`)).status, 400)
  assert.equal((await fetch(`${base}?q=one&q=two`)).status, 400)
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/v1/shops?limit=1&limit=2`)).status, 400)
  assert.equal((await get('1')).body.data.id, '1')
  assert.equal((await get('demo-product')).body.data.slug, 'demo-product')
  assert.equal((await get('BAD')).status, 400)
  mode = 'bad'; assert.equal((await get('1')).status, 502)
  mode = 'empty'; assert.equal((await get('1')).status, 404)
  mode = 'error'; assert.equal((await get('1')).status, 502)
  await new Promise((resolve) => { dataApi.closeAllConnections(); dataApi.close(resolve) })
  assert.equal((await get('1')).status, 503)
  console.log('PASS chi tiết sản phẩm: ID/slug, lỗi dữ liệu và dịch vụ không sẵn sàng (Data API mock).')
} finally {
  await new Promise((resolve) => server.close(resolve))
  if (dataApi.listening) await new Promise((resolve) => { dataApi.closeAllConnections(); dataApi.close(resolve) })
}
