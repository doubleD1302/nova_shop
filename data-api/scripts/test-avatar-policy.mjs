import assert from 'node:assert/strict'

Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-avatar-test.env', DB_USER: 'test', DB_PASSWORD: 'test-avatar-only', DATA_API_KEY: 'test-avatar-service-key' })
const { sequelize, closeDatabase } = await import('../src/config/database.js')
const { updateUserProfile } = await import('../src/controllers/auth.controller.js')
let existingAvatar = null
let writes = 0
const conn = {
  query({ sql }, values, callback) {
    let rows = []
    if (sql.includes('SELECT id, avatar_url FROM users')) rows = [{ id: '1', avatar_url: existingAvatar }]
    else if (sql.includes('UPDATE users SET full_name')) { writes += 1; existingAvatar = values[3]; rows = { affectedRows: 1 } }
    else if (sql.includes('SELECT u.id, u.username')) rows = [{ id: '1', username: 'test', full_name: 'Test', email: 'test@example.test', phone: null, avatar_url: existingAvatar, role: 'buyer', status: 'active', shop_id: null, recipient_name: null }]
    callback(null, rows)
  },
  destroy() {},
}
sequelize.connectionManager.getConnection = async () => conn
sequelize.connectionManager.releaseConnection = async () => {}
async function update(value, { omit = false } = {}) {
  let status, body
  const res = { status(value) { status = value; return this }, json(value) { body = value; return this } }
  const payload = { fullName: 'Test', email: 'test@example.test', ...(!omit ? { avatarUrl: value } : {}) }
  await updateUserProfile({ params: { userId: '1' }, body: payload }, res, (err) => { throw err })
  return { status, body }
}
try {
  assert.equal((await update(null, { omit: true })).status, 200)
  assert.equal(existingAvatar, null)
  const avatar = '/uploads/avatar-1-12345678-1234-1234-1234-123456789abc.png'
  assert.equal((await update(avatar)).status, 200)
  assert.equal(existingAvatar, avatar)
  for (const url of ['/uploads/12345678-1234-1234-1234-123456789abc.png', '/uploads/avatar-2-12345678-1234-1234-1234-123456789abc.png', 'https://example.test/photo.png']) {
    const before = writes
    const rejected = await update(url)
    assert.equal(rejected.status, 400)
    assert.equal(rejected.body.error.code, 'INVALID_AVATAR_IMAGE')
    assert.equal(writes, before)
    assert.equal(existingAvatar, avatar)
  }
  existingAvatar = 'https://example.test/existing-google-avatar'
  assert.equal((await update(existingAvatar)).status, 200)
  assert.equal((await update(null, { omit: true })).status, 200)
  assert.equal(existingAvatar, 'https://example.test/existing-google-avatar')
  existingAvatar = ''
  assert.equal((await update('')).status, 200)
  assert.equal(existingAvatar, '')
  assert.equal((await update(null)).status, 200)
  assert.equal(existingAvatar, null)
  console.log('Avatar policy PASS: owner, changed URL, existing external URL, omission and removal (mock MySQL).')
} finally {
  await closeDatabase()
}
