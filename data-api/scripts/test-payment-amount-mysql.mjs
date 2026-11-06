import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'

if (process.env.PAYMENT_AMOUNT_TEST !== '1' || !process.env.PAYMENT_AMOUNT_DB_PASSWORD) throw new Error('Cần MySQL test cục bộ riêng.')
const port = Number(process.env.PAYMENT_AMOUNT_DB_PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng MySQL test không hợp lệ.')
const root = path.resolve(import.meta.dirname, '../..')
const name = `shopnova_test_payment_amount_${Date.now()}`
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.PAYMENT_AMOUNT_DB_USER || 'root', password: process.env.PAYMENT_AMOUNT_DB_PASSWORD, multipleStatements: true })
let server, closeDatabase
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${name}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/seed.sql'), 'utf8'))
  await db.query("UPDATE products SET status='active', free_shipping=1 WHERE id=1; UPDATE product_variants SET stock_qty=10,price=999 WHERE id=1")
  Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(root, 'missing-payment-amount-test.env'), DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: name, DB_USER: process.env.PAYMENT_AMOUNT_DB_USER || 'root', DB_PASSWORD: process.env.PAYMENT_AMOUNT_DB_PASSWORD, DB_SSL_ENABLED: 'false', DATA_API_KEY: 'payment-amount-test-service-key' })
  const app = (await import('../src/app.js')).default
  ;({ closeDatabase } = await import('../src/config/database.js'))
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const base = `http://127.0.0.1:${server.address().port}/internal/v1`
  const body = { userId: '1', items: [{ variantId: '1', qty: 1 }], shippingMethod: 'tietkiem', paymentMethod: 'vnpay', address: { fullName: 'Người nhận', phone: '0123456789', province: 'Hà Nội', detail: 'Địa chỉ thử' } }
  const create = (key) => fetch(`${base}/orders`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-service-key': 'payment-amount-test-service-key', 'idempotency-key': key }, body: JSON.stringify(body) })
  const below = await create('payment-amount-below-001')
  assert.equal(below.status, 400, JSON.stringify(await below.json()))
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM orders')
  assert.equal(total, 0)
  await db.query('UPDATE product_variants SET price=1000 WHERE id=1')
  const accepted = await create('payment-amount-limit-001')
  const created = await accepted.json()
  assert.equal(accepted.status, 201, JSON.stringify(created))
  const orderId = created.data.order.id
  const session = await fetch(`${base}/orders/${orderId}/payment-session`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-service-key': 'payment-amount-test-service-key' }, body: JSON.stringify({ userId: '1' }) })
  const sessionBody = await session.json()
  assert.equal(session.status, 200, JSON.stringify(sessionBody))
  assert.equal(sessionBody.data.amount, 1000)
  console.log(`PASS MySQL ${version}: VNPay 999 bị từ chối và 1000 tạo được đơn cùng phiên thanh toán.`)
} finally {
  if (server) await new Promise((resolve) => server.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${name}\``)
  await db.end()
}
