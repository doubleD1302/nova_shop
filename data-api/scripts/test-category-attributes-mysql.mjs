import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import mysql from 'mysql2/promise'

if (process.env.CATEGORY_TEST !== '1' || !process.env.CATEGORY_DB_PASSWORD) throw new Error('Cần MySQL thử nghiệm cục bộ riêng.')
const port = Number(process.env.CATEGORY_DB_PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng MySQL test không hợp lệ.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const name = `shopnova_test_category_${Date.now()}`
const uploadDir = await mkdtemp(path.join(tmpdir(), 'shopnova-category-upload-'))
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.CATEGORY_DB_USER || 'root', password: process.env.CATEGORY_DB_PASSWORD, multipleStatements: true })
let dataServer, backendServer, closeDatabase
const listen = (app) => new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)) })
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${name}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query('DROP TABLE product_category_attributes')
  await db.query(await readFile(path.join(root, 'database/migrations/2026-11-06-product-category-attributes.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/seed.sql'), 'utf8'))
  await db.query("UPDATE products SET status='active' WHERE id=1")
  await db.query(await readFile(path.join(root, 'database/migrations/2026-10-23-product-approval.sql'), 'utf8'))
  const [[legacy]] = await db.query('SELECT status, approval_status, reviewed_by, reviewed_at FROM products WHERE id=1')
  assert.equal(legacy.status, 'active')
  assert.equal(legacy.approval_status, null)
  assert.equal(legacy.reviewed_by, null)
  assert.equal(legacy.reviewed_at, null)
  await db.query("ALTER TABLE shops ADD COLUMN suspension_reason VARCHAR(1000) NULL")
  Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(root, 'missing-category-test.env'), DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: name, DB_USER: process.env.CATEGORY_DB_USER || 'root', DB_PASSWORD: process.env.CATEGORY_DB_PASSWORD, DB_SSL_ENABLED: 'false', UPLOAD_STORAGE: 'local', UPLOAD_DIR: uploadDir, DATA_API_KEY: 'wallet-test-service-key', JWT_SECRET: 'wallet-test-jwt-secret-at-least-32-characters' })
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
  let result = await call('GET', '/categories/thoi-trang-nam/attributes')
  assert.equal(result.status, 200, JSON.stringify(result))
  assert.equal(result.body.data.version, 1)
  assert.equal(result.body.data.example, true)
  assert.ok(result.body.data.attributes.some((item) => item.key === 'material'))
  assert.equal((await call('GET', '/categories/khong-co/attributes')).status, 404)
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWNYffb96rPvGSAUAEJCCZ0WY1CJAAAAAElFTkSuQmCC'
  const images = []
  for (let i = 0; i < 4; i++) {
    const uploaded = await call('POST', '/uploads/images', { purpose: 'product', dataUrl: `data:image/png;base64,${png}` }, '2')
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded))
    images.push({ url: uploaded.body.data.url })
  }
  const product = { name: 'Test', categoryId: 'thoi-trang-nam', description: 'Mô tả', price: 120000, stock: 0, images }
  const wrongOwner = await call('POST', '/uploads/images', { purpose: 'product', dataUrl: `data:image/png;base64,${png}` }, '3')
  assert.equal(wrongOwner.status, 201)
  assert.equal((await call('POST', '/seller/products', { ...product, images: [{ url: wrongOwner.body.data.url }, ...images.slice(1)] }, '2')).status, 400)

  const get = (id, user = '2') => call('GET', `/seller/products/${id}/category-attributes`, undefined, user)
  const save = (body, user = '2') => call('PUT', '/seller/products/1', body, user)
  assert.equal((await get('1')).status, 200)
  assert.deepEqual((await get('1')).body.data.values, {})
  assert.equal((await get('1', '3')).status, 404)
  assert.equal((await save({ ...product, categoryAttributes: { version: 1, values: {} } }, '1')).status, 403)
  assert.equal((await save({ ...product, categoryAttributes: { version: 1, values: {} } }, '3')).status, 404)
  assert.equal((await save({ ...product, categoryAttributes: { version: 1, values: { brand: 'Mẫu', material: 'Cotton' } } })).status, 200)
  result = await get('1')
  assert.deepEqual(result.body.data.values, { brand: 'Mẫu', material: 'Cotton' })
  const [[original]] = await db.query('SELECT specs FROM products WHERE id = 1')
  assert.ok(JSON.stringify(original.specs).includes('Cotton'))
  for (const categoryAttributes of [null, {}, { version: 2, values: {} }, { version: 1, values: [] }, { version: 1, values: { unknown: 'x' } }, { version: 1, values: { material: false } }, { version: 1, values: { material: 'x'.repeat(121) } }]) {
    assert.equal((await save({ ...product, categoryAttributes })).status, 400)
  }
  assert.deepEqual((await get('1')).body.data.values, { brand: 'Mẫu', material: 'Cotton' })
  result = await save({ ...product, categoryId: 'dien-thoai' })
  assert.equal(result.status, 409, JSON.stringify(result))
  assert.equal((await get('1')).body.data.categoryId, 'thoi-trang-nam')
  assert.equal((await save({ ...product, categoryId: 'dien-thoai', categoryAttributes: { version: 1, values: { storage_gb: 128 } } })).status, 200)
  assert.deepEqual((await get('1')).body.data.values, { storage_gb: 128 })
  assert.equal((await save({ ...product, categoryId: 'dien-thoai', categoryAttributes: { version: 1, values: { storage_gb: '128' } } })).status, 400)
  assert.equal((await call('GET', '/products/1/category-attributes')).status, 404)
  await db.query("UPDATE products SET status='active', approval_status='approved', reviewed_at=UTC_TIMESTAMP(3), reviewed_by=1 WHERE id=1")
  assert.equal((await save({ ...product, categoryId: 'dien-thoai', categoryAttributes: { version: 1, values: { storage_gb: 128 } } })).status, 200)
  const [[moderation]] = await db.query('SELECT status, approval_status, reviewed_at, reviewed_by FROM products WHERE id=1')
  assert.equal(moderation.status, 'draft')
  assert.equal(moderation.approval_status, 'pending')
  assert.equal(moderation.reviewed_at, null)
  assert.equal(moderation.reviewed_by, null)
  await db.query("UPDATE products SET status='active', approval_status='approved' WHERE id=1")
  assert.deepEqual((await call('GET', '/products/1/category-attributes')).body.data.values, { storage_gb: 128 })
  await db.query("UPDATE shops SET status='suspended' WHERE id=1")
  assert.equal((await call('GET', '/products/1/category-attributes')).status, 404)
  const [[after]] = await db.query('SELECT specs FROM products WHERE id = 1')
  assert.deepEqual(after.specs, original.specs)
  console.log('PASS MySQL', version, ': thuộc tính mẫu, migration, owner, input, đổi danh mục và giữ specs cũ.')
} finally {
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${name}\``)
  await db.end()
  assert.equal(path.dirname(uploadDir), path.resolve(tmpdir()))
  assert.ok(path.basename(uploadDir).startsWith('shopnova-category-upload-'))
  await rm(uploadDir, { recursive: true })
}
