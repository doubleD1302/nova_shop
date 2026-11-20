import assert from 'node:assert/strict'
import http from 'node:http'
import { DatabaseSync } from 'node:sqlite'

// Kiểm tra API lịch sử Nova AI bằng SQLite trong bộ nhớ (không dùng MySQL thật, không đụng database dev).
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-ai-chat-test.env', DB_USER: 'test', DB_PASSWORD: 'ai-chat-test-password', DATA_API_KEY: 'ai-chat-test-service-key' })
const { sequelize } = await import('../src/config/database.js')
const { default: app } = await import('../src/app.js')

const db = new DatabaseSync(':memory:')
db.exec(`
  CREATE TABLE ai_conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL,
    message_count INTEGER DEFAULT 0, last_message_at TEXT DEFAULT (datetime('now')), created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE ai_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, role TEXT NOT NULL,
    content TEXT NOT NULL, intent TEXT, metadata TEXT, created_at TEXT DEFAULT (datetime('now')));
`)
// Dịch phần khác biệt MySQL ↔ SQLite rồi chạy câu SQL thật của controller.
const conn = {
  query({ sql }, values, callback) {
    try {
      const text = sql.replace(/\bFOR UPDATE\b/gi, '').replace(/UTC_TIMESTAMP\(\d*\)/gi, "datetime('now')").trim()
      if (/^START TRANSACTION/i.test(text)) { db.exec('BEGIN'); return callback(null, []) }
      if (/^(COMMIT|ROLLBACK)/i.test(text)) { db.exec(text); return callback(null, []) }
      if (/^SET\s+/i.test(text)) return callback(null, [])
      const statement = db.prepare(text)
      if (/^SELECT/i.test(text)) return callback(null, statement.all(...values))
      const result = statement.run(...values)
      return callback(null, { insertId: Number(result.lastInsertRowid), affectedRows: result.changes })
    } catch (err) {
      return callback(err)
    }
  },
  destroy() {},
}
sequelize.connectionManager.getConnection = async () => conn
sequelize.connectionManager.releaseConnection = async () => {}

const server = http.createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/internal/v1/ai`
async function call(method, path, body) {
  const response = await fetch(base + path, {
    method,
    headers: { 'x-service-key': process.env.DATA_API_KEY, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: response.status, body: await response.json() }
}

try {
  // Không có khóa dịch vụ thì bị chặn
  const noKey = await fetch(`${base}/conversations?userId=1`)
  assert.equal(noKey.status, 401)

  // Tạo cuộc trò chuyện, tiêu đề được gọn khoảng trắng
  const created = await call('POST', '/conversations', { userId: '7', title: '  Tìm   tai nghe   chống ồn ' })
  assert.equal(created.status, 201)
  assert.equal(created.body.data.conversation.title, 'Tìm tai nghe chống ồn')
  const id = created.body.data.conversation.id
  for (const invalid of [{ userId: 'abc', title: 'x' }, { userId: '7', title: '   ' }, { userId: '7' }, { userId: '0', title: 'x' }]) {
    assert.equal((await call('POST', '/conversations', invalid)).status, 400)
  }

  // Lưu một lượt hỏi - đáp kèm thẻ sản phẩm
  const turn = [
    { role: 'user', content: 'Tìm tai nghe chống ồn' },
    { role: 'assistant', content: 'Nova gợi ý tai nghe A.', intent: 'product_recommendation', metadata: { products: [{ id: '5', name: 'Tai nghe A' }] } },
  ]
  const saved = await call('POST', `/conversations/${id}/messages`, { userId: '7', messages: turn })
  assert.equal(saved.status, 201)
  assert.equal(saved.body.data.conversation.messageCount, 2)

  // Dữ liệu sai bị từ chối, không lưu gì thêm
  for (const messages of [[], [{ role: 'system', content: 'x' }], [{ role: 'user', content: '' }], [{ role: 'user', content: 'x'.repeat(4001) }],
    [{ role: 'user', content: 'x', metadata: [] }], [{ role: 'assistant', content: 'x', metadata: { big: 'y'.repeat(17000) } }], Array(5).fill({ role: 'user', content: 'x' })]) {
    assert.equal((await call('POST', `/conversations/${id}/messages`, { userId: '7', messages })).status, 400)
  }

  // Đọc lại đúng thứ tự cũ → mới và đọc được metadata
  const read = await call('GET', `/conversations/${id}/messages?userId=7`)
  assert.equal(read.status, 200)
  assert.deepEqual(read.body.data.messages.map((m) => m.role), ['user', 'assistant'])
  assert.equal(read.body.data.messages[1].metadata.products[0].name, 'Tai nghe A')
  assert.equal(read.body.data.hasMore, false)

  // Người khác không đọc, ghi hay xóa được cuộc trò chuyện này
  assert.equal((await call('GET', `/conversations/${id}/messages?userId=8`)).status, 404)
  assert.equal((await call('POST', `/conversations/${id}/messages`, { userId: '8', messages: turn })).status, 404)
  assert.equal((await call('DELETE', `/conversations/${id}?userId=8`)).status, 404)
  assert.equal((await call('GET', '/conversations?userId=8')).body.data.total, 0)

  // Phân trang tin nhắn: limit=1 lấy tin mới nhất, beforeId lấy tin cũ hơn
  const newest = await call('GET', `/conversations/${id}/messages?userId=7&limit=1`)
  assert.equal(newest.body.data.messages[0].role, 'assistant')
  assert.equal(newest.body.data.hasMore, true)
  const older = await call('GET', `/conversations/${id}/messages?userId=7&limit=5&beforeId=${newest.body.data.messages[0].id}`)
  assert.deepEqual(older.body.data.messages.map((m) => m.role), ['user'])
  assert.equal((await call('GET', `/conversations/${id}/messages?userId=7&limit=0`)).status, 400)
  assert.equal((await call('GET', `/conversations/${id}/messages?userId=7&beforeId=abc`)).status, 400)

  // Giới hạn số tin trong một cuộc trò chuyện
  const full = await call('POST', '/conversations', { userId: '7', title: 'Cuộc dài' })
  db.prepare('UPDATE ai_conversations SET message_count = 299 WHERE id = ?').run(Number(full.body.data.conversation.id))
  const overflow = await call('POST', `/conversations/${full.body.data.conversation.id}/messages`, { userId: '7', messages: turn })
  assert.equal(overflow.status, 409)
  assert.equal(overflow.body.error.code, 'CONVERSATION_FULL')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ai_messages WHERE conversation_id = ?').get(Number(full.body.data.conversation.id)).n, 0)

  // Chỉ giữ 50 cuộc trò chuyện gần nhất của mỗi tài khoản
  for (let index = 0; index < 52; index++) await call('POST', '/conversations', { userId: '9', title: `Cuộc ${index}` })
  const list = await call('GET', '/conversations?userId=9&limit=50')
  assert.equal(list.body.data.total, 50)
  assert.equal(list.body.data.conversations[0].title, 'Cuộc 51')
  assert.equal((await call('GET', '/conversations?userId=9&limit=51')).status, 400)

  // Xóa cuộc trò chuyện kèm toàn bộ tin nhắn
  assert.equal((await call('DELETE', `/conversations/${id}?userId=7`)).status, 200)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ai_messages WHERE conversation_id = ?').get(Number(id)).n, 0)
  assert.equal((await call('DELETE', `/conversations/${id}?userId=7`)).status, 404)
  console.log('PASS: API lịch sử Nova AI — lưu/đọc/xóa, đúng chủ sở hữu, giới hạn và validation (SQLite bộ nhớ, không phải MySQL thật).')
} finally {
  await new Promise((resolve) => server.close(resolve))
  db.close()
}
