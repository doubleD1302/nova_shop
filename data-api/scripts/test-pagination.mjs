import assert from 'node:assert/strict'
import http from 'node:http'

Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-pagination-test.env', DB_USER: 'test', DB_PASSWORD: 'pagination-test-only-password', DATA_API_KEY: 'pagination-test-only-key' })
const { sequelize, closeDatabase } = await import('../src/config/database.js')
const { default: app } = await import('../src/app.js')
let queries = 0
const conn = { query({ sql }, values, callback) { queries++; callback(null, sql.includes('COUNT(') ? [{ total: 0, order_count: 0 }] : []) }, destroy() {} }
sequelize.connectionManager.getConnection = async () => conn
sequelize.connectionManager.releaseConnection = async () => {}
const server = http.createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/internal/v1`
async function call(route, query) {
  const response = await fetch(`${base}${route}?userId=1&${query}`, { headers: { 'x-service-key': process.env.DATA_API_KEY } })
  return { status: response.status, body: await response.json() }
}
try {
  const routes = ['/products', '/shops', '/orders', '/seller/products', '/seller/orders', '/seller/returns']
  for (const route of routes) for (const query of ['limit=abc', 'limit=-1', 'limit=101', 'limit=1.5', 'offset=-1', 'offset=1.5', 'offset=9007199254740992', 'offset=']) {
    const before = queries
    const result = await call(route, query)
    assert.equal(result.status, 400, `${route}?${query}: ${JSON.stringify(result)}`)
    assert.equal(queries, before, 'Invalid pagination must not reach database')
  }
  for (const route of routes.filter((route) => route !== '/orders')) assert.equal((await call(route, 'limit=0')).status, 400, route)
  assert.equal((await call('/orders', 'limit=0')).status, 200)
  assert.equal((await call('/products', 'limit=20&offset=0')).status, 200)
  assert.equal((await call('/shops', 'limit=100&offset=0')).status, 200)
  assert.equal((await call('/seller/returns', 'status=bogus')).status, 400)
  console.log('PASS HTTP phân trang: đầu vào sai bị chặn trước query, giữ limit=0 cho tổng kết đơn (mock database).')
} finally {
  await new Promise((resolve) => server.close(resolve))
  await closeDatabase()
}
