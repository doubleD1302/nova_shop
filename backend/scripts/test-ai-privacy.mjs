import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const baseId = String(Date.now()) + String(Math.floor(Math.random() * 10000)).padStart(4, '0')
const user1 = baseId + '1'
const user2 = baseId + '2'
const brainDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/ai-brains')
const files = [user1, user2].map((id) => path.join(brainDir, `account_${id}.json`))
for (const file of files) assert.equal(fs.existsSync(file), false, 'Không ghi đè dữ liệu test có sẵn')
const dataApi = http.createServer((req, res) => {
  const id = req.url?.match(/^\/internal\/v1\/users\/(\d+)\/auth-profile$/)?.[1]
  res.setHeader('content-type', 'application/json')
  if (req.url?.startsWith('/internal/v1/orders?')) return res.end(JSON.stringify({ success: true, data: { orders: [] } }))
  if (!id) return res.writeHead(404).end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }))
  return res.end(JSON.stringify({ success: true, data: { user: { id, username: `test${id}`, fullName: 'Test', email: null, phone: null, avatarUrl: null, role: 'buyer', status: 'active', shopId: null, address: null } } }))
})
await new Promise((resolve) => dataApi.listen(0, '127.0.0.1', resolve))
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-ai-privacy-test.env', DATA_API_URL: `http://127.0.0.1:${dataApi.address().port}`, DATA_API_KEY: 'ai-privacy-test-service-key', JWT_SECRET: 'ai-privacy-test-jwt-secret-32-characters' })
const { default: app } = await import('../src/app.js')
const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')
const server = http.createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/api/v1/ai`
async function call(method, route, body, user) {
  const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${signAccessToken({ id: user, role: 'buyer' })}` } : {}), 'x-session-id': 'shared-unsafe-id' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  return { status: response.status, body: await response.json() }
}
try {
  assert.equal((await call('GET', '/brain/profile')).status, 401)
  assert.equal((await call('POST', '/brain/feedback', {})).status, 401)
  assert.equal((await call('DELETE', '/brain/reset')).status, 401)
  for (const invalid of [{ message: {} }, { message: 'x'.repeat(4001) }, { message: 'test', context: [] }, { message: 'test', history: [{}] }]) {
    assert.equal((await call('POST', '/chat', invalid)).status, 400)
  }
  const guestBody = { message: 'đơn hàng', context: { userId: user1 } }
  const g1 = await call('POST', '/chat', guestBody)
  const g2 = await call('POST', '/chat', guestBody)
  assert.equal(g1.status, 200)
  assert.equal(g2.status, 200)
  assert.equal(g1.body.data.brain.stats.totalInteractions, 1)
  assert.equal(g2.body.data.brain.stats.totalInteractions, 1)
  assert.equal(fs.existsSync(files[0]), false, 'Khách không được ghi ký ức vào tài khoản do client chọn')
  const profile2 = await call('GET', '/brain/profile', undefined, user2)
  assert.equal(profile2.status, 200)
  assert.equal(profile2.body.data.userId, `account_${user2}`)
  const logged = await call('POST', '/chat', { message: 'đơn hàng', context: { userId: user2 } }, user1)
  assert.equal(logged.status, 200)
  assert.equal((await call('GET', '/brain/profile', undefined, user1)).body.data.stats.totalInteractions, 1)
  assert.equal((await call('GET', '/brain/profile', undefined, user2)).body.data.stats.totalInteractions, 0)
  assert.equal((await call('POST', '/brain/feedback', { action: {}, helpful: true }, user1)).status, 400)
  console.log('PASS AI: khách riêng từng request, tài khoản lấy từ token, chặn input sai (Data API mock).')
} finally {
  await new Promise((resolve) => server.close(resolve))
  await new Promise((resolve) => dataApi.close(resolve))
  for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file)
}
