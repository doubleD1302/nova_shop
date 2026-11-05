import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import mysql from 'mysql2/promise'

if (process.env.CATALOG_TEST !== '1' || !process.env.CATALOG_DB_PASSWORD) throw new Error('Cần MySQL thử nghiệm cục bộ riêng.')
const port = Number(process.env.CATALOG_DB_PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng MySQL test không hợp lệ.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const name = `shopnova_test_catalog_${Date.now()}`
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.CATALOG_DB_USER || 'root', password: process.env.CATALOG_DB_PASSWORD, multipleStatements: true })
let dataServer, backendServer, closeDatabase
const listen = (app) => new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)) })
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${name}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/seed.sql'), 'utf8'))
  Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(root, 'missing-catalog-test.env'), DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: name, DB_USER: process.env.CATALOG_DB_USER || 'root', DB_PASSWORD: process.env.CATALOG_DB_PASSWORD, DB_SSL_ENABLED: 'false', DATA_API_KEY: 'wallet-test-service-key', JWT_SECRET: 'wallet-test-jwt-secret-at-least-32-characters' })
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
  await db.query("ALTER TABLE products ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'; UPDATE products SET status='active', approval_status='approved' WHERE id=1; UPDATE product_variants SET price=CASE id WHEN 1 THEN 50 ELSE 100 END, original_price=NULL, stock_qty=10 WHERE id IN (1,2)")
  for (const query of ['minPrice=abc', 'maxPrice=-1', 'minPrice=1.5', 'minPrice=100&maxPrice=50', 'minRating=6', 'minDiscount=101', 'sort=constructor', 'ids=1,nope', 'flash=maybe', 'offset=9007199254740992']) {
    const result = await call('GET', `/products?${query}`)
    assert.equal(result.status, 400, `${query}: ${JSON.stringify(result)}`)
  }
  let result = await call('GET', '/products?minPrice=60&maxPrice=90')
  assert.equal(result.status, 200, JSON.stringify(result))
  assert.equal(result.body.data.products.length, 0, 'Hai biến thể khác nhau không được cùng thỏa hai đầu khoảng giá')
  result = await call('GET', '/products?minPrice=50&maxPrice=50&sort=price_asc')
  assert.equal(result.status, 200, JSON.stringify(result))
  assert.equal(result.body.data.products[0].id, '1')
  assert.equal((await call('GET', '/products?minPrice=0&maxPrice=100&sort=price_desc')).status, 200)
  console.log('PASS MySQL', version, ': bộ lọc catalog, giới hạn, sort và khoảng giá theo cùng SKU.')
} finally {
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${name}\``)
  await db.end()
}
