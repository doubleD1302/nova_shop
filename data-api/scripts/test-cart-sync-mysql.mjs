import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import mysql from 'mysql2/promise'

const port = Number(process.env.AVATAR_DB_PORT)
if (process.env.AVATAR_MYSQL_TEST !== '1' || !process.env.AVATAR_DB_PASSWORD || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cần MySQL cục bộ riêng cho test.')
const root = path.resolve(import.meta.dirname, '../..')
const name = `shopnova_test_cart_sync_${Date.now()}`
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.AVATAR_DB_USER || 'root', password: process.env.AVATAR_DB_PASSWORD, multipleStatements: true })
let dataServer, backendServer, closeDatabase
const listen = (app) => new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)) })
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${name}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/seed.sql'), 'utf8'))
  await db.query("ALTER TABLE shops ADD COLUMN suspension_reason VARCHAR(1000) NULL, ADD COLUMN suspended_by BIGINT UNSIGNED NULL, ADD COLUMN suspended_at DATETIME(3) NULL; UPDATE products SET status = 'active' WHERE id IN (1,2); UPDATE product_variants SET stock_qty = 10 WHERE id IN (1,2,3); UPDATE shops SET status = 'pending' WHERE id = 2")
  Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(root, 'missing-cart-sync-test.env'), DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: name, DB_USER: process.env.AVATAR_DB_USER || 'root', DB_PASSWORD: process.env.AVATAR_DB_PASSWORD, DB_SSL_ENABLED: 'false', DATA_API_KEY: 'cart-sync-mysql-test-key', JWT_SECRET: 'cart-sync-mysql-test-secret-over-32-characters' })
  const dataApp = (await import(pathToFileURL(path.join(root, 'data-api/src/app.js')))).default
  ;({ closeDatabase } = await import(pathToFileURL(path.join(root, 'data-api/src/config/database.js'))))
  dataServer = await listen(dataApp)
  process.env.DATA_API_URL = `http://127.0.0.1:${dataServer.address().port}`
  const backendApp = (await import(pathToFileURL(path.join(root, 'backend/src/app.js')))).default
  const { signAccessToken } = await import(pathToFileURL(path.join(root, 'backend/src/middlewares/auth.middleware.js')))
  backendServer = await listen(backendApp)
  const base = `http://127.0.0.1:${backendServer.address().port}/api/v1`
  const buyer = signAccessToken({ id: '1', role: 'buyer' })
  const seller = signAccessToken({ id: '2', role: 'seller' })
  async function request(method, endpoint, body, token = buyer) {
    const response = await fetch(base + endpoint, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    return { status: response.status, body: await response.json() }
  }
  const sync = (items) => request('POST', '/cart/sync', { items })
  assert.equal((await sync([{ variantId: '1', qty: 2, selected: false }, { variantId: '3', qty: 1 }])).status, 200)
  let [rows] = await db.query('SELECT variant_id, qty, selected FROM cart_items WHERE user_id = 1 ORDER BY variant_id')
  assert.deepEqual(rows.map((r) => [Number(r.variant_id), r.qty, r.selected]), [[1, 2, 0]])
  for (const items of [null, {}, [{ variantId: '1', qty: true }], [{ variantId: '1', qty: null }], [{ variantId: '1', qty: 1, selected: 'false' }], [{ variantId: '1', qty: 1 }, { variantId: '2', qty: 0 }], Array.from({ length: 101 }, () => ({ variantId: '1', qty: 1 }))]) {
    const result = await sync(items)
    assert.equal(result.status, 400, JSON.stringify(result))
    ;[rows] = await db.query('SELECT variant_id, qty, selected FROM cart_items WHERE user_id = 1 ORDER BY variant_id')
    assert.deepEqual(rows.map((r) => [Number(r.variant_id), r.qty, r.selected]), [[1, 2, 0]])
  }
  await db.query("CREATE TRIGGER reject_cart_item_test BEFORE INSERT ON cart_items FOR EACH ROW BEGIN IF NEW.variant_id = 2 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced test failure'; END IF; END")
  const failed = await sync([{ variantId: '1', qty: 1 }, { variantId: '2', qty: 1 }])
  assert.equal(failed.status, 502, JSON.stringify(failed))
  ;[rows] = await db.query('SELECT variant_id, qty, selected FROM cart_items WHERE user_id = 1 ORDER BY variant_id')
  assert.deepEqual(rows.map((r) => [Number(r.variant_id), r.qty, r.selected]), [[1, 2, 0]], 'Transaction phải rollback item đầu')
  await db.query('DROP TRIGGER reject_cart_item_test')
  const product = { name: 'Test', categoryId: 'thoi-trang-nam', description: 'Mô tả', price: 120000, stock: 10, images: [1, 2, 3, 4].map((i) => ({ url: `/uploads/test-${i}.jpg` })) }
  for (const stock of [null, false, true, '', '0']) {
    const result = await request('PUT', '/seller/products/1', { ...product, stock }, seller)
    assert.equal(result.status, 400, JSON.stringify(result))
    const [[saved]] = await db.query('SELECT stock_qty, price FROM product_variants WHERE id = 1')
    assert.equal(saved.stock_qty, 10)
    assert.equal(Number(saved.price), 180000)
  }
  for (const price of [true, false, null, '120000']) {
    const result = await request('PUT', '/seller/products/1', { ...product, price }, seller)
    assert.equal(result.status, 400, JSON.stringify(result))
    const [[saved]] = await db.query('SELECT stock_qty, price FROM product_variants WHERE id = 1')
    assert.equal(saved.stock_qty, 10)
    assert.equal(Number(saved.price), 180000)
  }
  console.log(`PASS MySQL ${version}: HTTP cart sync validates atomically, skips pending shop, rolls back failure; seller product invalid stock/price preserves data.`)
} finally {
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${name}\``)
  await db.end()
}
