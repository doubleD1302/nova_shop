import assert from 'node:assert/strict'
import http from 'node:http'

Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-validation-test.env', DB_USER: 'test', DB_PASSWORD: 'chat-report-test-password', DATA_API_KEY: 'chat-report-test-service-key' })
const { sequelize, closeDatabase } = await import('../src/config/database.js')
const { default: app } = await import('../src/app.js')
let updates = 0
const conn = {
  query({ sql }, values, callback) {
    let rows = []
    if (sql.includes('FROM chat_conversations c')) rows = [{ id: 1, buyer_id: 1, shop_owner_id: 2 }]
    else if (sql.includes('UPDATE chat_')) { updates++; rows = { affectedRows: 1 } }
    else if (sql.includes('SELECT id FROM shops')) rows = [{ id: 1 }]
    else if (sql.includes('INSERT INTO abuse_reports')) rows = { insertId: 1 }
    callback(null, rows)
  },
  destroy() {},
}
sequelize.connectionManager.getConnection = async () => conn
sequelize.connectionManager.releaseConnection = async () => {}
const server = http.createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/internal/v1`
async function call(path, body) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'x-service-key': process.env.DATA_API_KEY, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, body: await response.json() }
}
try {
  for (const query of ['limit=abc', 'limit=-1', 'limit=0', 'limit=1.5', 'limit=101', 'offset=-1', 'offset=1.5', 'offset=9007199254740992']) {
    updates = 0
    const result = await call(`/chat/conversations/1/messages?userId=1&${query}`)
    assert.equal(result.status, 400, query)
    assert.equal(updates, 0, `invalid ${query} must not mark messages read`)
  }
  assert.equal((await call('/chat/conversations/1/messages?userId=1&limit=50&offset=0')).status, 200)
  const report = { userId: '1', targetType: 'shop', targetId: '1', reason: 'Báo cáo' }
  for (const invalid of [{ evidenceUrl: 'a'.repeat(1025) }, { evidenceUrl: 123 }, { details: 'é'.repeat(32768) }, { details: {} }]) {
    assert.equal((await call('/reports', { ...report, ...invalid })).status, 400)
  }
  assert.equal((await call('/reports', { ...report, evidenceUrl: '/uploads/a.jpg', details: 'Thông tin bổ sung' })).status, 201)
  console.log('Chat and report HTTP validation PASS with mocked database.')
} finally {
  await new Promise((resolve) => server.close(resolve))
  await closeDatabase()
}
