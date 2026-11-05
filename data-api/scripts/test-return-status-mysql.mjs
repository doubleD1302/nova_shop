import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import mysql from 'mysql2/promise'

if (process.env.RETURNS_TEST !== '1' || !process.env.RETURNS_DB_PASSWORD) throw new Error('Cần MySQL thử nghiệm cục bộ riêng.')
const port = Number(process.env.RETURNS_DB_PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng MySQL test không hợp lệ.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const name = `shopnova_test_returns_${Date.now()}`
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.RETURNS_DB_USER || 'root', password: process.env.RETURNS_DB_PASSWORD, multipleStatements: true })
let dataServer, backendServer, closeDatabase
const listen = (app) => new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)) })
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${name}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/seed.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/migrations/2026-10-30-returns-shipping-and-chat.sql'), 'utf8'))
  Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(root, 'missing-returns-test.env'), DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: name, DB_USER: process.env.RETURNS_DB_USER || 'root', DB_PASSWORD: process.env.RETURNS_DB_PASSWORD, DB_SSL_ENABLED: 'false', DATA_API_KEY: 'wallet-test-service-key', JWT_SECRET: 'wallet-test-jwt-secret-at-least-32-characters' })
  const dataApp = (await import(pathToFileURL(path.join(root, 'data-api/src/app.js')))).default
  ;({ closeDatabase } = await import(pathToFileURL(path.join(root, 'data-api/src/config/database.js'))))
  dataServer = await listen(dataApp)
  process.env.DATA_API_URL = `http://127.0.0.1:${dataServer.address().port}`
  const backendApp = (await import(pathToFileURL(path.join(root, 'backend/src/app.js')))).default
  const { signAccessToken } = await import(pathToFileURL(path.join(root, 'backend/src/middlewares/auth.middleware.js')))
  backendServer = await listen(backendApp)
  const base = `http://127.0.0.1:${backendServer.address().port}/api/v1`
  const token = (id) => signAccessToken({ id, role: id === '1' ? 'buyer' : 'seller' })
  async function call(method, route, body, user) {
    const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${token(user)}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    return { status: response.status, body: await response.json() }
  }
  await db.query(`INSERT INTO orders (id,buyer_id,code,idempotency_key,request_hash,recipient_name,recipient_phone,province,address_detail)
    VALUES (1,1,'TEST1','test1',REPEAT('a',64),'buyer','123','city','address'),
           (2,1,'TEST2','test2',REPEAT('b',64),'buyer','123','city','address')`)
  await db.query(`INSERT INTO shop_orders (id,order_id,shop_id,shop_name,status,shipping_method,shipping_name,delivered_at)
    VALUES (1,1,1,'shop','delivered','tietkiem','ship',UTC_TIMESTAMP(3)),(2,2,1,'shop','pending','tietkiem','ship',NULL)`)
  await db.query(`INSERT INTO order_items (id,shop_order_id,shop_id,product_id,variant_id,product_name,product_slug,variant_name,variant_attributes,sku,unit_price,qty,line_total)
    VALUES (1,1,1,1,1,'product','product','M',JSON_OBJECT(),'SKU1',100,1,100),
           (2,1,1,1,2,'product','product','L',JSON_OBJECT(),'SKU2',100,1,100),
           (3,2,1,1,1,'product','product','M',JSON_OBJECT(),'SKU1',100,1,100)`)
  await db.query(`INSERT INTO order_returns (id,order_id,shop_order_id,buyer_id,shop_id,reason,refund_amount,status)
    VALUES (1,1,1,1,1,'hỏng',100,'requested'), (2,1,1,1,1,'hỏng',100,'requested')`)
  const change = (id, status, user = '2') => call('PATCH', `/seller/returns/${id}/status`, { status }, user)
  assert.equal((await change('1', 'approved', '1')).status, 403)
  assert.equal((await change('1', 'approved', '3')).status, 404)
  assert.equal((await change('1', 'completed')).body.error.code, 'INVALID_TRANSITION')
  assert.equal((await change('1', 'approved')).status, 200)
  assert.equal((await change('1', 'rejected')).body.error.code, 'INVALID_TRANSITION')
  const concurrent = await Promise.all([change('1', 'completed'), change('1', 'completed')])
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 400])
  assert.equal((await change('2', 'rejected')).status, 200)
  assert.equal((await change('2', 'completed')).body.error.code, 'INVALID_TRANSITION')
  const [rows] = await db.query('SELECT id,status FROM order_returns ORDER BY id')
  assert.deepEqual(rows.map((r) => r.status), ['completed', 'rejected'])
  await db.query('DELETE FROM order_returns')
  const createReturn = () => call('POST', '/orders/1/returns', { shopOrderId: '1', reason: 'Hỏng' }, '1')
  const createdTogether = await Promise.all([createReturn(), createReturn()])
  assert.deepEqual(createdTogether.map((r) => r.status).sort(), [201, 409])
  const [[createdCount]] = await db.query('SELECT COUNT(*) AS n FROM order_returns WHERE shop_order_id = 1')
  assert.equal(createdCount.n, 1)
  await db.query('DROP TABLE order_returns')
  const created = await call('POST', '/orders/1/returns', { shopOrderId: '1', reason: 'Hỏng' }, '1')
  assert.equal(created.status, 201, JSON.stringify(created))
  const fallbackId = created.body.data.id
  assert.equal((await change(fallbackId, 'completed')).body.error.code, 'INVALID_TRANSITION')
  assert.equal((await change(fallbackId, 'approved')).status, 200)
  assert.equal((await change(fallbackId, 'completed')).status, 200)
  assert.equal((await change(fallbackId, 'completed')).body.error.code, 'INVALID_TRANSITION')
  console.log('PASS MySQL', version, ': return owner, chuyển trạng thái và xử lý đồng thời; kiểm tra fallback bộ nhớ.')
} finally {
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${name}\``)
  await db.end()
}
