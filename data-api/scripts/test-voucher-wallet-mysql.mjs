import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import mysql from 'mysql2/promise'

if (process.env.VOUCHER_TEST !== '1' || !process.env.VOUCHER_DB_PASSWORD) throw new Error('Cần MySQL thử nghiệm cục bộ riêng.')
const port = Number(process.env.VOUCHER_DB_PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng MySQL test không hợp lệ.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const name = `shopnova_test_wallet_${Date.now()}`
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.VOUCHER_DB_USER || 'root', password: process.env.VOUCHER_DB_PASSWORD, multipleStatements: true })
let dataServer, backendServer, closeDatabase
const listen = (app) => new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)) })
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${name}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query('DROP TABLE voucher_wallet')
  await db.query(await readFile(path.join(root, 'database/migrations/2026-11-06-voucher-wallet.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/seed.sql'), 'utf8'))
  Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(root, 'missing-wallet-test.env'), DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: name, DB_USER: process.env.VOUCHER_DB_USER || 'root', DB_PASSWORD: process.env.VOUCHER_DB_PASSWORD, DB_SSL_ENABLED: 'false', DATA_API_KEY: 'wallet-test-service-key', JWT_SECRET: 'wallet-test-jwt-secret-at-least-32-characters' })
  const dataApp = (await import(pathToFileURL(path.join(root, 'data-api/src/app.js')))).default
  ;({ closeDatabase } = await import(pathToFileURL(path.join(root, 'data-api/src/config/database.js'))))
  dataServer = await listen(dataApp)
  process.env.DATA_API_URL = `http://127.0.0.1:${dataServer.address().port}`
  const backendApp = (await import(pathToFileURL(path.join(root, 'backend/src/app.js')))).default
  const { signAccessToken } = await import(pathToFileURL(path.join(root, 'backend/src/middlewares/auth.middleware.js')))
  backendServer = await listen(backendApp)
  const base = `http://127.0.0.1:${backendServer.address().port}/api/v1`
  const token = (id) => signAccessToken({ id, role: 'buyer' })
  async function call(method, route, body, user) {
    const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${token(user)}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, body: await response.json() }
  }
  assert.equal((await call('GET', '/vouchers/wallet')).status, 401)
  for (const code of [null, '', {}, 'a'.repeat(33), 'ab c']) assert.equal((await call('POST', '/vouchers/wallet', { code }, '1')).status, 400)
  assert.equal((await call('GET', '/vouchers/wallet?page=0', undefined, '1')).status, 400)
  assert.equal((await call('POST', '/vouchers/wallet', { code: 'UNKNOWN' }, '1')).status, 404)
  const saved = await Promise.all(Array.from({ length: 3 }, () => call('POST', '/vouchers/wallet', { code: ' nova20k ', userId: '2' }, '1')))
  assert.deepEqual(saved.map((r) => r.status), [200, 200, 200])
  assert.equal(saved.filter((r) => r.body.data.saved).length, 1)
  let list = await call('GET', '/vouchers/wallet', undefined, '1')
  assert.equal(list.body.data.items[0].code, 'NOVA20K')
  assert.equal(list.body.data.items[0].status, 'available')
  assert.equal((await call('GET', '/vouchers/wallet', undefined, '2')).body.data.items.length, 0)
  await db.query(`INSERT INTO orders (id,buyer_id,code,idempotency_key,request_hash,recipient_name,recipient_phone,province,address_detail,subtotal,discount_amount,total_amount,voucher_code)
    VALUES (1,1,'WALLET-TEST','wallet-test',REPEAT('a',64),'buyer','123','city','address',1000,1000,0,'NOVA20K')`)
  await db.query("INSERT INTO voucher_uses (voucher_id,order_id,buyer_id,discount_amount,state) VALUES (1,1,1,1000,'applied')")
  assert.equal((await call('GET', '/vouchers/wallet', undefined, '1')).body.data.items[0].status, 'used')
  await db.query("UPDATE voucher_uses SET state = 'released', released_at = UTC_TIMESTAMP(3) WHERE order_id = 1")
  assert.equal((await call('GET', '/vouchers/wallet', undefined, '1')).body.data.items[0].status, 'available')
  await db.query('UPDATE vouchers SET used_count = usage_limit WHERE id = 1')
  assert.equal((await call('GET', '/vouchers/wallet', undefined, '1')).body.data.items[0].status, 'exhausted')
  await db.query('UPDATE vouchers SET used_count = 0, starts_at = UTC_TIMESTAMP(3) - INTERVAL 2 DAY, ends_at = UTC_TIMESTAMP(3) - INTERVAL 1 DAY WHERE id = 1')
  assert.equal((await call('GET', '/vouchers/wallet', undefined, '1')).body.data.items[0].status, 'expired')
  assert.equal((await call('POST', '/vouchers/wallet', { code: 'NOVA20K' }, '2')).status, 404)
  await db.query('UPDATE vouchers SET starts_at = UTC_TIMESTAMP(3) + INTERVAL 1 DAY, ends_at = UTC_TIMESTAMP(3) + INTERVAL 2 DAY WHERE id = 1')
  assert.equal((await call('GET', '/vouchers/wallet', undefined, '1')).body.data.items[0].status, 'upcoming')
  assert.equal((await call('POST', '/vouchers/wallet', { code: 'NOVA20K' }, '2')).status, 404)
  await db.query('UPDATE vouchers SET starts_at = UTC_TIMESTAMP(3) - INTERVAL 1 DAY, ends_at = UTC_TIMESTAMP(3) + INTERVAL 1 DAY WHERE id = 1')
  await db.query('UPDATE vouchers SET is_active = 0 WHERE id = 1')
  list = await call('GET', '/vouchers/wallet', undefined, '1')
  assert.equal(list.body.data.items[0].status, 'inactive')
  assert.equal((await call('POST', '/vouchers/wallet', { code: 'NOVA20K' }, '2')).status, 404)
  for (let i = 0; i < 22; i++) {
    const [created] = await db.query(`INSERT INTO vouchers (code,name,discount_amount,min_subtotal,starts_at,ends_at,per_user_limit,is_active)
      VALUES (?, 'Test', 1000, 0, UTC_TIMESTAMP(3) - INTERVAL 1 DAY, UTC_TIMESTAMP(3) + INTERVAL 1 DAY, 1, 1)`, [`PAGE${i}`])
    await db.query('INSERT INTO voucher_wallet (user_id,voucher_id) VALUES (1,?)', [created.insertId])
  }
  const page1 = await call('GET', '/vouchers/wallet?page=1', undefined, '1')
  const page2 = await call('GET', '/vouchers/wallet?page=2', undefined, '1')
  assert.equal(page1.body.data.items.length, 20)
  assert.equal(page1.body.data.hasMore, true)
  assert.equal(page2.body.data.items.length, 3)
  assert.equal(page2.body.data.hasMore, false)
  assert.equal(new Set([...page1.body.data.items, ...page2.body.data.items].map((item) => item.id)).size, 23)
  console.log('PASS MySQL', version, ': migration, ví voucher qua HTTP, owner, input, lưu đồng thời, trạng thái.')
} finally {
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${name}\``)
  await db.end()
}
