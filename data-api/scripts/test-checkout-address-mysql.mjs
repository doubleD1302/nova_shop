import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'

if (process.env.CHECKOUT_ADDRESS_TEST !== '1' || !process.env.CHECKOUT_ADDRESS_DB_PASSWORD) throw new Error('Cần MySQL test cục bộ riêng.')
const port = Number(process.env.CHECKOUT_ADDRESS_DB_PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng MySQL test không hợp lệ.')
const root = path.resolve(import.meta.dirname, '../..')
const name = `shopnova_test_checkout_address_${Date.now()}`
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.CHECKOUT_ADDRESS_DB_USER || 'root', password: process.env.CHECKOUT_ADDRESS_DB_PASSWORD, multipleStatements: true })
let server, closeDatabase
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${name}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/seed.sql'), 'utf8'))
  await db.query("DELETE FROM addresses WHERE user_id=1; UPDATE products SET status='active' WHERE id=1; UPDATE product_variants SET stock_qty=20 WHERE id=1")
  await db.query("INSERT INTO users (id,username,password_hash,full_name,role,status) SELECT 4,'checkout_test',password_hash,'Test','buyer','active' FROM users WHERE id=1")
  Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(root, 'missing-checkout-address-test.env'), DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: name, DB_USER: process.env.CHECKOUT_ADDRESS_DB_USER || 'root', DB_PASSWORD: process.env.CHECKOUT_ADDRESS_DB_PASSWORD, DB_SSL_ENABLED: 'false', DATA_API_KEY: 'checkout-address-test-service-key' })
  const app = (await import('../src/app.js')).default
  ;({ closeDatabase } = await import('../src/config/database.js'))
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const base = `http://127.0.0.1:${server.address().port}/internal/v1`
  const address = { fullName: 'Người nhận thử', phone: '0123456789', province: 'Tỉnh thử', district: '', ward: '', detail: 'Địa chỉ thử' }
  async function order(userId, key, overrides = {}) {
    const response = await fetch(`${base}/orders`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-service-key': 'checkout-address-test-service-key', 'idempotency-key': key }, body: JSON.stringify({ userId, items: [{ variantId: '1', qty: 1 }], shippingMethod: 'tietkiem', paymentMethod: 'cod', address, ...overrides }) })
    return { status: response.status, body: await response.json() }
  }
  let result = await order('1', 'checkout-address-0001')
  assert.equal(result.status, 201, JSON.stringify(result.body))
  const [[saved]] = await db.query('SELECT recipient_name,phone,detail FROM addresses WHERE user_id=1 AND is_default=1 AND deleted_at IS NULL')
  assert.equal(saved.recipient_name, address.fullName)
  assert.equal(saved.phone, address.phone)
  assert.equal(saved.detail, address.detail)
  const profileResponse = await fetch(`${base}/users/1/auth-profile`, { headers: { 'x-service-key': 'checkout-address-test-service-key' } })
  assert.equal(profileResponse.status, 200)
  const profile = await profileResponse.json()
  assert.equal(profile.data.user.address.detail, address.detail)
  result = await order('1', 'checkout-address-0002', { address: { ...address, detail: 'Địa chỉ khác' } })
  assert.equal(result.status, 201, JSON.stringify(result.body))
  const [addresses] = await db.query('SELECT detail FROM addresses WHERE user_id=1 AND is_default=1 AND deleted_at IS NULL')
  assert.equal(addresses.length, 1)
  assert.equal(addresses[0].detail, address.detail)
  assert.equal((await order('1', 'checkout-address-0001')).status, 200)
  await db.query('DELETE FROM addresses WHERE user_id=4')
  const keys = ['checkout-address-0003', 'checkout-address-0004']
  const concurrent = await Promise.all(keys.map((key) => order('4', key)))
  for (let index = 0; index < concurrent.length; index++) {
    if (concurrent[index].status === 409) {
      assert.equal(concurrent[index].body.error.code, 'CHECKOUT_CONFLICT')
      assert.ok([200, 201].includes((await order('4', keys[index])).status))
    } else {
      assert.equal(concurrent[index].status, 201, JSON.stringify(concurrent[index].body))
    }
  }
  const [[count]] = await db.query('SELECT COUNT(*) AS total FROM addresses WHERE user_id=4 AND is_default=1 AND deleted_at IS NULL')
  assert.equal(Number(count.total), 1)
  await db.query('DELETE FROM addresses WHERE user_id=4')
  const [[before]] = await db.query('SELECT stock_qty FROM product_variants WHERE id=1')
  await db.query("CREATE TRIGGER fail_address_test BEFORE INSERT ON addresses FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'checkout test rollback'")
  assert.equal((await order('4', 'checkout-address-0005')).status, 500)
  const [[after]] = await db.query('SELECT stock_qty FROM product_variants WHERE id=1')
  const [[noOrder]] = await db.query("SELECT COUNT(*) AS total FROM orders WHERE idempotency_key='checkout-address-0005'")
  assert.equal(after.stock_qty, before.stock_qty)
  assert.equal(Number(noOrder.total), 0)
  console.log(`PASS MySQL ${version}: lưu địa chỉ đầu, giữ mặc định, idempotency, đồng thời và rollback khi lỗi.`)
} finally {
  if (server) await new Promise((resolve) => server.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${name}\``)
  await db.end()
}
