import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

// Chỉ chạy trên MySQL thử nghiệm cục bộ riêng do người chạy cung cấp.
if (process.env.SHOP_APPROVAL_TEST !== '1' || !process.env.SHOP_APPROVAL_DB_PASSWORD) throw new Error('Cần SHOP_APPROVAL_TEST=1 và SHOP_APPROVAL_DB_PASSWORD cho MySQL cục bộ riêng.')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const requireData = createRequire(path.join(root, 'data-api/package.json'))
const mysql = requireData('mysql2/promise')
const dbName = `shopnova_test_approval_${Date.now()}`
const port = Number(process.env.SHOP_APPROVAL_DB_PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cần SHOP_APPROVAL_DB_PORT của MySQL thử nghiệm riêng.')
const isolatedRoot = fs.realpathSync(process.env.SHOP_APPROVAL_TEST_ROOT || '.')
const tmpRoot = fs.realpathSync(os.tmpdir())
if (path.dirname(isolatedRoot).toLowerCase() !== tmpRoot.toLowerCase() || !path.basename(isolatedRoot).startsWith('shopnova-approval-db-') || !fs.existsSync(path.join(isolatedRoot, '.shopnova-approval-isolated'))) throw new Error('Cần thư mục dữ liệu test cô lập có marker.')
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.SHOP_APPROVAL_DB_USER || 'root', password: process.env.SHOP_APPROVAL_DB_PASSWORD, multipleStatements: true })
const [[serverInfo]] = await db.query('SELECT @@datadir AS datadir')
if (fs.realpathSync(serverInfo.datadir).toLowerCase() !== fs.realpathSync(path.join(isolatedRoot, 'data')).toLowerCase()) { await db.end(); throw new Error('MySQL không dùng thư mục dữ liệu test cô lập.') }
let dataServer, backendServer, closeDatabase
const listen = (app) => new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)) })
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`)
  await db.query(`USE \`${dbName}\``)
  // Kiểm tra migration trên shop legacy, không thay đổi trạng thái cũ.
  await db.query("CREATE TABLE users (id BIGINT UNSIGNED NOT NULL PRIMARY KEY) ENGINE=InnoDB; CREATE TABLE shops (id BIGINT UNSIGNED NOT NULL PRIMARY KEY, status ENUM('active','suspended','closed') NOT NULL DEFAULT 'active') ENGINE=InnoDB; INSERT INTO users VALUES (1); INSERT INTO shops VALUES (1,'active'),(2,'suspended'),(3,'closed')")
  const migration = fs.readFileSync(path.join(root, 'database/migrations/2026-11-04-shop-approval.sql'), 'utf8')
  await db.query(migration)
  const [legacy] = await db.query('SELECT status FROM shops ORDER BY id')
  assert.deepEqual(legacy.map((row) => row.status), ['active', 'suspended', 'closed'])
  await db.query('INSERT INTO shops (id) VALUES (4)')
  const [[fresh]] = await db.query('SELECT status FROM shops WHERE id = 4')
  assert.equal(fresh.status, 'pending')
  await db.query('DROP TABLE shop_approval_events; DROP TABLE shops; DROP TABLE users')
  // Sau probe migration legacy, dùng schema/seed hiện tại cho HTTP regression.
  await db.query(fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query(fs.readFileSync(path.join(root, 'database/seed.sql'), 'utf8'))
  const [admin] = await db.query("INSERT INTO users(username,password_hash,full_name,role) VALUES ('test_admin','test','Admin','admin')")
  process.env.SELLER_IDENTITY_KEY = randomBytes(32).toString('base64')
  process.env.ALLOW_LOCAL_DB_FALLBACK = 'false'
  Object.assign(process.env, { DOTENV_CONFIG_PATH: path.join(root, 'nonexistent-shop-test.env'), NODE_ENV: 'test', DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_USER: process.env.SHOP_APPROVAL_DB_USER || 'root', DB_PASSWORD: process.env.SHOP_APPROVAL_DB_PASSWORD, DB_NAME: dbName, DB_SSL_ENABLED: 'false', DATA_API_KEY: 'shop-approval-isolated-test-key', JWT_SECRET: 'shop-approval-test-jwt-secret-long-1234567890', DB_READINESS_TIMEOUT_MS: '4500' })
  const dataApp = (await import(pathToFileURL(path.join(root, 'data-api/src/app.js')))).default
  ;({ closeDatabase } = await import(pathToFileURL(path.join(root, 'data-api/src/config/database.js'))))
  dataServer = await listen(dataApp)
  process.env.DATA_API_URL = `http://127.0.0.1:${dataServer.address().port}`
  const backendApp = (await import(pathToFileURL(path.join(root, 'backend/src/app.js')))).default
  const { signAccessToken } = await import(pathToFileURL(path.join(root, 'backend/src/middlewares/auth.middleware.js')))
  backendServer = await listen(backendApp)
  const url = `http://127.0.0.1:${backendServer.address().port}/api/v1`
  const buyer = signAccessToken({ id: '1', role: 'buyer' })
  const adminToken = signAccessToken({ id: String(admin.insertId), role: 'admin' })
  async function call(method, endpoint, body, token, headers = {}) {
    const response = await fetch(url + endpoint, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const data = await response.json(); return { status: response.status, ...data }
  }
  let r = await call('POST', '/auth/seller-shop', { shopName: 'Shop pending test' }, buyer)
  assert.equal(r.status, 200, JSON.stringify(r)); const token = r.data.token
  r = await call('GET', '/seller/shop', undefined, token); assert.equal(r.status, 200, JSON.stringify(r)); const shop = r.data.shop; assert.equal(shop.status, 'pending'); assert.equal(shop.approvalVersion, 1)
  assert.equal((await call('GET', '/seller/shop')).status, 401)
  r = await call('POST', '/auth/seller-shop', { shopName: 'Duplicate ignored' }, token)
  assert.equal(r.data.shopStatus, 'pending')
  const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM shops WHERE owner_id = 1')
  assert.equal(count, 1)
  assert.equal((await call('GET', `/shops/${shop.id}`)).status, 404)
  const [product] = await db.query("INSERT INTO products (shop_id,category_id,slug,name,status,approval_status) VALUES (?,1,'shop-approval-test','Test product','active','approved')", [shop.id])
  const [variant] = await db.query("INSERT INTO product_variants (product_id,sku,variant_key,name,attributes,price,stock_qty) VALUES (?,'APPROVAL-TEST','default','Default',JSON_OBJECT(),100,5)", [product.insertId])
  for (let i = 0; i < 4; i += 1) await db.query('INSERT INTO product_images (product_id,url,sort_order) VALUES (?,?,?)', [product.insertId, `/uploads/test-${i}.jpg`, i])
  r = await call('GET', '/products?limit=100'); assert.equal(r.status, 200, JSON.stringify(r)); assert.ok(!r.data.products.some((p) => p.id === String(product.insertId)))
  const previewBody = { items: [{ variantId: String(variant.insertId), qty: 1 }], shippingMethod: 'tietkiem' }
  r = await call('POST', '/orders/preview', previewBody, token); assert.equal(r.status, 409, JSON.stringify(r)); assert.equal(r.error.code, 'PRODUCT_UNAVAILABLE')
  const orderBody = { ...previewBody, paymentMethod: 'cod', address: { fullName: 'Buyer', phone: '0900000000', province: 'Test', detail: 'Test address' } }
  r = await call('POST', '/orders', orderBody, token, { 'idempotency-key': 'approval-pending-order-0001' })
  assert.equal(r.status, 409, JSON.stringify(r)); assert.equal(r.error.code, 'PRODUCT_UNAVAILABLE')
  const [[stock]] = await db.query('SELECT stock_qty FROM product_variants WHERE id = ?', [variant.insertId])
  assert.equal(stock.stock_qty, 5)
  r = await call('POST', '/cart/items', { variantId: String(variant.insertId), qty: 1 }, token); assert.equal(r.status, 400, JSON.stringify(r))
  assert.equal((await call('POST', '/chat/conversations', { shopId: shop.id }, token)).status, 404)
  const productInput = { name: 'Test product', categoryId: 'thoi-trang-nam', description: 'Mô tả', price: 100, stock: 5, images: [1,2,3,4].map((n) => ({ url: `https://upload.wikimedia.org/wikipedia/commons/fixture-${n}.jpg`, sourcePageUrl: `https://commons.wikimedia.org/wiki/File:Fixture-${n}.jpg`, author: 'Validation fixture', licenseName: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' })) }
  r = await call('POST', '/seller/products', productInput, token); assert.equal(r.error.code, 'SHOP_INACTIVE', JSON.stringify(r))
  r = await call('PUT', `/seller/products/${product.insertId}`, productInput, token); assert.equal(r.error.code, 'SHOP_INACTIVE', JSON.stringify(r))
  assert.equal((await call('PATCH', `/admin/shops/${shop.id}/approval`, { approvalStatus: 'approved', approvalVersion: 1 }, token)).status, 403)
  assert.equal((await call('GET', `/admin/shops/${shop.id}/approval-events`, undefined, token)).status, 403)
  const otherSeller = signAccessToken({ id: '2', role: 'seller' })
  r = await call('GET', '/seller/shop', undefined, otherSeller); assert.equal(r.status, 200); assert.notEqual(r.data.shop.id, shop.id)
  r = await call('POST', '/seller/shop/resubmit', { userId: '1', shopId: shop.id }, otherSeller)
  assert.equal(r.error.code, 'SHOP_NOT_REJECTED', JSON.stringify(r))
  r = await call('PATCH', `/admin/shops/${shop.id}/status`, { status: 'active' }, adminToken); assert.equal(r.status, 409); assert.equal(r.error.code, 'SHOP_REQUIRES_APPROVAL')
  const profile = { name: 'Shop pending update', province: 'Test', address: 'Test', description: 'Test' }
  r = await call('PUT', '/seller/shop', profile, token); assert.equal(r.status, 200, JSON.stringify(r)); assert.equal(r.data.shop.approvalVersion, 2)
  r = await call('PATCH', `/admin/shops/${shop.id}/approval`, { approvalStatus: 'approved', approvalVersion: 1 }, adminToken); assert.equal(r.status, 409); assert.equal(r.error.code, 'SHOP_APPROVAL_CONFLICT')
  for (const body of [{ approvalStatus: 'active', approvalVersion: 2 }, { approvalStatus: 'approved' }, { approvalStatus: 'rejected', approvalVersion: 2, rejectionReason: ' ' }]) {
    r = await call('PATCH', `/admin/shops/${shop.id}/approval`, body, adminToken)
    assert.equal(r.status, 400, JSON.stringify(r))
  }
  r = await call('PATCH', `/admin/shops/${shop.id}/approval`, { approvalStatus: 'rejected', approvalVersion: 2, rejectionReason: 'Thiếu thông tin' }, adminToken); assert.equal(r.status, 200, JSON.stringify(r))
  r = await call('GET', '/seller/shop', undefined, token); assert.equal(r.data.shop.rejectionReason, 'Thiếu thông tin')
  r = await call('PATCH', `/admin/shops/${shop.id}/status`, { status: 'suspended', reason: 'Test bypass' }, adminToken)
  assert.equal(r.error.code, 'SHOP_REQUIRES_APPROVAL', JSON.stringify(r))
  r = await call('PUT', '/seller/shop', { ...profile, name: 'Shop edited' }, token); assert.equal(r.status, 200); assert.equal(r.data.shop.approvalVersion, 3)
  r = await call('POST', '/seller/shop/resubmit', {}, token); assert.equal(r.status, 200); assert.equal(r.data.approvalVersion, 4)
  r = await call('PATCH', `/admin/shops/${shop.id}/approval`, { approvalStatus: 'approved', approvalVersion: 4 }, adminToken)
  assert.equal(r.error.code, 'SHOP_PROFILE_REQUIRED')
  const registration = { pickupAddress: '123 Test', province: 'Test', contactEmail: 'owner@example.test', contactPhone: '0900000000', shippingMethods: ['nhanh', 'tietkiem'], businessType: 'personal', ownerName: 'Seller', idCard: '123456789012', agreeTerms: true }
  r = await call('PUT', '/seller/shop/registration', registration, token)
  assert.equal(r.status, 200, JSON.stringify(r))
  const results = await Promise.all([call('PATCH', `/admin/shops/${shop.id}/approval`, { approvalStatus: 'approved', approvalVersion: 5 }, adminToken), call('PATCH', `/admin/shops/${shop.id}/approval`, { approvalStatus: 'approved', approvalVersion: 5 }, adminToken)])
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 409], JSON.stringify(results)); assert.equal((await call('GET', `/shops/${shop.id}`)).status, 200)
  assert.equal((await call('POST', '/seller/shop/resubmit', {}, token)).status, 409)
  r = await call('POST', '/orders/preview', previewBody, token); assert.equal(r.status, 200, JSON.stringify(r))
  r = await call('GET', '/products?limit=100'); assert.ok(r.data.products.some((p) => p.id === String(product.insertId)))
  const [events] = await db.query('SELECT action,profile_version,reason FROM shop_approval_events WHERE shop_id = ? ORDER BY id', [shop.id])
  assert.deepEqual(events.map((e) => e.action), ['submitted', 'rejected', 'submitted', 'approved'])
  assert.deepEqual(events.map((e) => e.profile_version), [1, 2, 4, 5]); assert.equal(events[1].reason, 'Thiếu thông tin')
  r = await call('GET', `/admin/shops/${shop.id}/approval-events`, undefined, adminToken); assert.equal(r.status, 200, JSON.stringify(r)); assert.equal(r.data.events.length, 4)
  r = await call('POST', '/auth/register', { username: 'seller_new', password: 'Only-Test-123', fullName: 'Seller', email: 'seller@example.test', role: 'seller', shopName: 'New seller shop' })
  assert.equal(r.status, 201, JSON.stringify(r)); const newToken = r.data.token
  r = await call('GET', '/seller/shop', undefined, newToken); assert.equal(r.status, 200); assert.equal(r.data.shop.status, 'pending')
  const pendingId = r.data.shop.id
  const internalUrl = `http://127.0.0.1:${dataServer.address().port}/internal/v1/admin/shops/${pendingId}/approval`
  const internal = await fetch(internalUrl, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-service-key': process.env.DATA_API_KEY }, body: JSON.stringify({ userId: '1', approvalStatus: 'approved', approvalVersion: 1 }) })
  assert.equal(internal.status, 403, 'Data API phải tự kiểm tra quyền Admin')
  await db.query("UPDATE users SET status = 'blocked' WHERE id = ?", [admin.insertId])
  r = await call('PATCH', `/admin/shops/${pendingId}/approval`, { approvalStatus: 'approved', approvalVersion: 1 }, adminToken)
  assert.equal(r.status, 401); assert.equal(r.error.code, 'AUTH_INVALID')
  const blocked = await fetch(internalUrl, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-service-key': process.env.DATA_API_KEY }, body: JSON.stringify({ userId: String(admin.insertId), approvalStatus: 'approved', approvalVersion: 1 }) })
  assert.equal(blocked.status, 403)
  console.log('PASS MySQL', version, ': migration giữ shop cũ; đăng ký/mở shop pending; quyền, chặn bypass, sửa hồ sơ, chống duyệt cũ, từ chối/gửi lại, duyệt đồng thời, public và lịch sử.')
  console.log('Database test riêng:', dbName)
} finally {
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${dbName}\``)
  await db.end()
}
