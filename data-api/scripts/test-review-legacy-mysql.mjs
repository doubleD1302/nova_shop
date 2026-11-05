import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import mysql from 'mysql2/promise'

if (process.env.LEGACY_REVIEW_TEST !== '1' || !process.env.LEGACY_REVIEW_DB_PASSWORD) throw new Error('Cần MySQL thử nghiệm cục bộ riêng.')
const port = Number(process.env.LEGACY_REVIEW_DB_PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng MySQL test không hợp lệ.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const name = `shopnova_test_review_legacy_${Date.now()}`
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.LEGACY_REVIEW_DB_USER || 'root', password: process.env.LEGACY_REVIEW_DB_PASSWORD, multipleStatements: true })
let dataServer, backendServer, closeDatabase
const listen = (app) => new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)) })
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${name}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/seed.sql'), 'utf8'))
  Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(root, 'missing-catalog-test.env'), DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: name, DB_USER: process.env.LEGACY_REVIEW_DB_USER || 'root', DB_PASSWORD: process.env.LEGACY_REVIEW_DB_PASSWORD, DB_SSL_ENABLED: 'false', DATA_API_KEY: 'wallet-test-service-key', JWT_SECRET: 'wallet-test-jwt-secret-at-least-32-characters' })
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
  await db.query("UPDATE products SET status='active' WHERE id=1")
  await db.query(`INSERT INTO orders (id,buyer_id,code,idempotency_key,request_hash,recipient_name,recipient_phone,province,address_detail)
    VALUES (1,1,'LEGACY1','legacy1',REPEAT('a',64),'buyer','123','city','address')`)
  await db.query(`INSERT INTO shop_orders (id,order_id,shop_id,shop_name,status,shipping_method,shipping_name,delivered_at)
    VALUES (1,1,1,'shop','delivered','tietkiem','ship',UTC_TIMESTAMP(3))`)
  await db.query(`INSERT INTO order_items (id,shop_order_id,shop_id,product_id,variant_id,product_name,product_slug,variant_name,variant_attributes,sku,unit_price,qty,line_total)
    VALUES (1,1,1,1,1,'product','product','M',JSON_OBJECT(),'SKU1',100,1,100)`)
  await db.query("INSERT INTO reviews (order_item_id,user_id,product_id,rating,comment,status) VALUES (1,1,1,5,'Tốt','visible')")
  let result = await call('GET', '/products/1/reviews')
  assert.equal(result.status, 200, JSON.stringify(result))
  assert.equal(result.body.data.reviews.length, 1)
  await db.query("ALTER TABLE products ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'")
  result = await call('GET', '/products/1/reviews')
  assert.equal(result.status, 200, JSON.stringify(result))
  assert.equal(result.body.data.reviews.length, 0)
  await db.query("UPDATE products SET approval_status='approved' WHERE id=1")
  assert.equal((await call('GET', '/products/1/reviews')).body.data.reviews.length, 1)
  console.log('PASS MySQL', version, ': đọc đánh giá với schema cũ và schema có kiểm duyệt.')
} finally {
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${name}\``)
  await db.end()
}
