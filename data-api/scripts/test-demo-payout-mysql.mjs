import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import mysql from 'mysql2/promise'

if (process.env.DEMO_PAYOUT_TEST !== '1' || !process.env.DEMO_PAYOUT_DB_PASSWORD) throw new Error('Cần MySQL thử nghiệm cục bộ riêng.')
const port = Number(process.env.DEMO_PAYOUT_DB_PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng MySQL test không hợp lệ.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const name = `shopnova_test_demo_payout_${Date.now()}`
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.DEMO_PAYOUT_DB_USER || 'root', password: process.env.DEMO_PAYOUT_DB_PASSWORD, multipleStatements: true })
let dataServer, backendServer, closeDatabase
const listen = (app) => new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)) })
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${name}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query('DROP TABLE demo_payout_withdrawals; DROP TABLE demo_seller_payouts')
  await db.query(await readFile(path.join(root, 'database/migrations/2026-11-06-demo-seller-payout.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/seed.sql'), 'utf8'))
  Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(root, 'missing-demo-payout-test.env'), DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: name, DB_USER: process.env.DEMO_PAYOUT_DB_USER || 'root', DB_PASSWORD: process.env.DEMO_PAYOUT_DB_PASSWORD, DB_SSL_ENABLED: 'false', DATA_API_KEY: 'wallet-test-service-key', JWT_SECRET: 'wallet-test-jwt-secret-at-least-32-characters' })
  const dataApp = (await import(pathToFileURL(path.join(root, 'data-api/src/app.js')))).default
  ;({ closeDatabase } = await import(pathToFileURL(path.join(root, 'data-api/src/config/database.js'))))
  dataServer = await listen(dataApp)
  process.env.DATA_API_URL = `http://127.0.0.1:${dataServer.address().port}`
  const backendApp = (await import(pathToFileURL(path.join(root, 'backend/src/app.js')))).default
  const { signAccessToken } = await import(pathToFileURL(path.join(root, 'backend/src/middlewares/auth.middleware.js')))
  backendServer = await listen(backendApp)
  const base = `http://127.0.0.1:${backendServer.address().port}/api/v1`
  const token = (id) => signAccessToken({ id, role: id === '1' ? 'buyer' : 'seller' })
  async function call(method, route, body, user, key) {
    const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}), ...(user ? { authorization: `Bearer ${token(user)}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, body: await response.json() }
  }
  const baseRoute = '/seller/demo-payout'
  assert.equal((await call('GET', baseRoute)).status, 401)
  assert.equal((await call('GET', baseRoute, undefined, '1')).status, 403)
  let result = await call('GET', baseRoute, undefined, '2')
  assert.equal(result.status, 200)
  assert.deepEqual([result.body.data.mode, result.body.data.ready, result.body.data.balance], ['demo', false, null])
  const first = await Promise.all([call('POST', baseRoute + '/setup', { userId: '3' }, '2'), call('POST', baseRoute + '/setup', {}, '2')])
  assert.equal(first.filter((item) => item.body.data.created).length, 1)
  assert.equal((await call('GET', baseRoute, undefined, '3')).body.data.ready, false)
  for (const amount of [null, -1, 0, '100', true, 1.5, 1000001, {}]) {
    assert.equal((await call('POST', baseRoute + '/withdrawals', { amount }, '2', 'test-key-00000001')).status, 400)
  }
  assert.equal((await call('POST', baseRoute + '/withdrawals', { amount: 1 }, '2', 'short')).status, 400)
  const submit = (key, amount = 400000) => call('POST', baseRoute + '/withdrawals', { amount, userId: '3' }, '2', key)
  const simultaneous = await Promise.all([submit('demo-repeat-key-01'), submit('demo-repeat-key-01')])
  assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 201])
  assert.equal((await submit('demo-repeat-key-01', 300000)).body.error.code, 'IDEMPOTENCY_CONFLICT')
  const competing = await Promise.all([submit('demo-compete-key-1'), submit('demo-compete-key-2')])
  assert.deepEqual(competing.map((r) => r.status).sort(), [201, 409])
  result = await call('GET', baseRoute, undefined, '2')
  assert.equal(result.body.data.balance, 200000)
  assert.equal(result.body.data.withdrawals.length, 2)
  assert.ok(result.body.data.withdrawals.every((row) => row.status === 'simulated'))
  const [[row]] = await db.query('SELECT balance FROM demo_seller_payouts WHERE shop_id = 1')
  assert.equal(Number(row.balance), 200000)
  assert.equal((await call('GET', baseRoute, undefined, '3')).body.data.ready, false)
  console.log('PASS MySQL', version, ': nhận tiền giả, quyền, tạo trùng, số dư và cạnh tranh idempotency.')
} finally {
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${name}\``)
  await db.end()
}
