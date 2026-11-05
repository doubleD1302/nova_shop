import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import mysql from 'mysql2/promise'

const port = Number(process.env.ADDRESS_DB_PORT)
if (process.env.ADDRESS_MYSQL_TEST !== '1' || !process.env.ADDRESS_DB_PASSWORD || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cần MySQL thử nghiệm cục bộ riêng.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const database = `shopnova_test_address_${Date.now()}`
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.ADDRESS_DB_USER || 'root', password: process.env.ADDRESS_DB_PASSWORD, multipleStatements: true })
let dataServer, backendServer, closeDatabase
const listen = (app) => new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)) })
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${database}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/seed.sql'), 'utf8'))
  Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(root, 'missing-address-test.env'), DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: database, DB_USER: process.env.ADDRESS_DB_USER || 'root', DB_PASSWORD: process.env.ADDRESS_DB_PASSWORD, DB_SSL_ENABLED: 'false', DATA_API_KEY: 'address-test-service-key', JWT_SECRET: 'address-test-jwt-secret-at-least-32-chars' })
  const dataApp = (await import(pathToFileURL(path.join(root, 'data-api/src/app.js')))).default
  ;({ closeDatabase } = await import(pathToFileURL(path.join(root, 'data-api/src/config/database.js'))))
  dataServer = await listen(dataApp)
  process.env.DATA_API_URL = `http://127.0.0.1:${dataServer.address().port}`
  const backendApp = (await import(pathToFileURL(path.join(root, 'backend/src/app.js')))).default
  const { signAccessToken } = await import(pathToFileURL(path.join(root, 'backend/src/middlewares/auth.middleware.js')))
  backendServer = await listen(backendApp)
  const base = `http://127.0.0.1:${backendServer.address().port}/api/v1`
  const token1 = signAccessToken({ id: '1', role: 'buyer' })
  const token2 = signAccessToken({ id: '2', role: 'seller' })
  async function call(method, route, body, token) {
    const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, body: await response.json() }
  }
  const address = { fullName: 'Người nhận', phone: '0901234567', province: 'Hà Nội', district: 'Cầu Giấy', ward: 'Dịch Vọng', detail: 'Số 1' }
  const profile = { fullName: 'Buyer', email: 'buyer@example.test' }
  assert.equal((await call('PUT', '/auth/profile', { ...profile, address })).status, 401)
  let result = await call('PUT', '/auth/profile', { ...profile, address }, token1)
  assert.equal(result.status, 200, JSON.stringify(result))
  result = await call('GET', '/auth/me', undefined, token1)
  assert.equal(result.status, 200, JSON.stringify(result))
  assert.deepEqual(result.body.data.user.address, address)
  const changed = { ...address, detail: 'Số 2' }
  result = await call('PUT', '/auth/profile', { ...profile, address: changed, userId: '2' }, token1)
  assert.equal(result.status, 200, JSON.stringify(result))
  const [[saved]] = await db.query('SELECT COUNT(*) AS count, MAX(detail) AS detail FROM addresses WHERE user_id = 1 AND is_default = 1 AND deleted_at IS NULL')
  assert.equal(saved.count, 1)
  assert.equal(saved.detail, 'Số 2')
  result = await call('GET', '/auth/me', undefined, token2)
  assert.equal(result.status, 200)
  assert.equal(result.body.data.user.address, null)
  const other = { ...address, fullName: 'Người khác' }
  result = await call('PUT', '/auth/profile', { fullName: 'Seller', email: 'seller-a@example.test', address: other }, token2)
  assert.equal(result.status, 200, JSON.stringify(result))
  result = await call('GET', '/auth/me', undefined, token1)
  assert.equal(result.body.data.user.address.detail, 'Số 2')
  for (const bad of [null, [], {}, { ...address, detail: '' }, { ...address, phone: 123 }, { ...address, province: 'x'.repeat(121) }, { ...address, district: 0 }, { ...address, ward: false }]) {
    result = await call('PUT', '/auth/profile', { ...profile, address: bad }, token1)
    assert.equal(result.status, 400, JSON.stringify({ bad, result }))
  }
  for (const phone of [false, 123, [], {}]) {
    result = await call('PUT', '/auth/profile', { ...profile, phone }, token1)
    assert.equal(result.status, 400, JSON.stringify(result))
  }
  result = await call('PUT', '/auth/profile', { phone: '+84 901 234 567' }, token1)
  assert.equal(result.status, 200, JSON.stringify(result))
  result = await call('PUT', '/auth/profile', { fullName: 'Tên đã sửa' }, token1)
  assert.equal(result.status, 200, JSON.stringify(result))
  assert.equal(result.body.data.user.phone, '+84 901 234 567')
  assert.equal(result.body.data.user.email, profile.email)
  result = await call('PUT', '/auth/profile', { phone: 'không hợp lệ' }, token1)
  assert.equal(result.status, 400, JSON.stringify(result))
  result = await call('PUT', '/auth/profile', {}, token1)
  assert.equal(result.status, 400, JSON.stringify(result))
  result = await call('PUT', '/auth/profile', { phone: null }, token1)
  assert.equal(result.status, 200, JSON.stringify(result))
  assert.equal(result.body.data.user.phone, null)
  result = await call('PUT', '/auth/profile', profile, token1)
  assert.equal(result.status, 200)
  result = await call('GET', '/auth/me', undefined, token1)
  assert.equal(result.body.data.user.address.detail, 'Số 2')
  result = await call('PUT', '/auth/profile', { ...profile, address: { ...address, district: null, ward: null } }, token1)
  assert.equal(result.status, 200, JSON.stringify(result))
  console.log('PASS MySQL', version, ': HTTP lưu/đọc/sửa địa chỉ, cách ly owner, bỏ field và input sai.')
} finally {
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${database}\``)
  await db.end()
}
