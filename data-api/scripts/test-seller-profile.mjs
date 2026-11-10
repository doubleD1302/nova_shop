import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

process.env.NODE_ENV = 'test'
process.env.DB_USER = 'test_user'
process.env.DB_PASSWORD = 'test_local_value'
process.env.DB_HOST = '127.0.0.1'
process.env.DB_PORT = '1'
process.env.DB_READINESS_TIMEOUT_MS = '200'
process.env.DATA_API_KEY = 'test_local_key'
process.env.ALLOW_LOCAL_DB_FALLBACK = 'true'
const key = crypto.randomBytes(32)
const oldKey = crypto.randomBytes(32)
process.env.SELLER_IDENTITY_KEY = key.toString('base64')
process.env.SELLER_IDENTITY_PREVIOUS_KEYS = oldKey.toString('base64')
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shopnova-seller-test-'))
await fs.cp(path.resolve('src'), path.join(root, 'src'), { recursive: true })
await fs.writeFile(path.join(root, 'package.json'), '{"type":"module"}')
await fs.symlink(path.resolve('node_modules'), path.join(root, 'node_modules'), 'junction')
process.env.DOTENV_CONFIG_PATH = path.join(root, 'no-env')
const moduleUrl = (relative) => pathToFileURL(path.join(root, 'src', relative)).href
const { app } = await import(moduleUrl('app.js'))
const server = app.listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}/internal/v1`
async function request(url, method = 'GET', body, headers = {}) {
  const response = await fetch(base + url, { method, headers: { 'x-service-key': 'test_local_key', 'content-type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, body: await response.json() }
}
const profile = { pickupAddress: '123 Test', province: 'Ha Noi', contactEmail: 'test@example.test', contactPhone: '0900000000', shippingMethods: ['nhanh', 'tietkiem'], businessType: 'personal', ownerName: 'Nguoi Ban', idCard: '123456789012', taxCode: '', invoiceEmail: 'tax@example.test', agreeTerms: true }
try {
  const probe = `
    const { registerUser } = await import(${JSON.stringify(moduleUrl('controllers/auth.controller.js'))});
    const profile = ${JSON.stringify(profile)};
    let status = 0;
    const res = { status(value) { status = value; return this }, json() { return this } };
    await registerUser({ body: { username: 'new_seller', fullName: 'Test', email: 'test@example.test', password: 'TestPassword1', role: 'seller', shopName: 'Test', sellerProfile: profile } }, res, (error) => { throw error });
    if (status !== 503) process.exit(1);
  `
  const missingKey = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { env: { ...process.env, SELLER_IDENTITY_KEY: '' }, encoding: 'utf8' })
  assert.equal(missingKey.status, 0, missingKey.stderr)
  assert.equal((await request('/users/1/seller-shop', 'POST', { shopName: 'Test Shop', sellerProfile: { ...profile, agreeTerms: false } })).status, 400)
  const created = await request('/users/1/seller-shop', 'POST', { shopName: 'Test Shop', sellerProfile: profile })
  assert.equal(created.status, 200)
  const shopId = created.body.data.user.shopId
  const read = await request('/users/1/seller-shop/registration')
  assert.equal(read.status, 200)
  assert.equal(read.body.data.profile.identityLast4, '9012')
  assert.equal(JSON.stringify(read.body).includes(profile.idCard), false)
  assert.equal((await request(`/admin/shops/${shopId}/registration?userId=1`)).status, 404)
  assert.equal((await request(`/admin/shops/${shopId}/registration?userId=99`)).status, 200)
  assert.equal((await request('/users/1/seller-shop/registration', 'PUT', { ...profile, pickupAddress: '456 Test' })).status, 200)
  assert.equal((await request('/users/1/seller-shop/registration')).body.data.profile.pickupAddress, '456 Test')
  assert.equal((await request('/users/1/seller-shop', 'POST', { shopName: 'Test Shop', sellerProfile: profile })).status, 409)
  const deniedIdentity = await request(`/admin/shops/${shopId}/identity-access`, 'POST', { userId: '1', reason: 'Kiểm tra hồ sơ người bán' })
  assert.equal(deniedIdentity.status, 403)
  const invalidReason = await request(`/admin/shops/${shopId}/identity-access`, 'POST', { userId: '99', reason: 'x' })
  assert.equal(invalidReason.status, 400)
  const identity = await request(`/admin/shops/${shopId}/identity-access`, 'POST', { userId: '99', reason: 'Kiểm tra hồ sơ người bán' })
  assert.equal(identity.status, 200)
  assert.equal(identity.body.data.idCard, profile.idCard)
  assert.equal((await request(`/admin/shops/${shopId}/identity-access-events?userId=1`)).status, 403)
  assert.equal((await request(`/admin/shops/${shopId}/identity-access-events?userId=99`)).body.data.events.length, 1)
  const { getLocalDatabase } = await import(moduleUrl('config/local-db.js'))
  const db = getLocalDatabase()
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM seller_identity_access_events WHERE shop_id = ? AND admin_id = 99').get(shopId).count, 1)
  const oldIv = crypto.randomBytes(12)
  const oldCipher = crypto.createCipheriv('aes-256-gcm', oldKey, oldIv)
  const oldData = Buffer.concat([oldCipher.update(profile.idCard, 'utf8'), oldCipher.final()])
  const oldPayload = JSON.stringify({ v: 1, iv: oldIv.toString('base64'), tag: oldCipher.getAuthTag().toString('base64'), data: oldData.toString('base64') })
  db.prepare('UPDATE seller_registration_profiles SET identity_encrypted = ? WHERE shop_id = ?').run(oldPayload, shopId)
  const { executeLocalQuery, executeLocalTransaction } = await import(moduleUrl('config/local-db.js'))
  const { rotateSellerIdentities } = await import(moduleUrl('services/seller-identity-rotation.js'))
  const query = async (sql, values) => executeLocalQuery(sql, values)
  const rotation = { query, transaction: executeLocalTransaction }
  assert.equal((await rotateSellerIdentities({ ...rotation, mode: 'check' })).oldCount, 1)
  assert.equal((await request(`/admin/shops/${shopId}/identity-access`, 'POST', { userId: '99', reason: 'Kiểm tra hồ sơ người bán' })).body.data.idCard, profile.idCard)
  assert.equal((await rotateSellerIdentities({ ...rotation, mode: 'apply' })).changed, 1)
  assert.equal((await rotateSellerIdentities({ ...rotation, mode: 'check' })).oldCount, 0)

  // Kiểm tra cả preview và tạo đơn, bảo đảm từ chối không tạo đơn.
  db.prepare(`INSERT INTO seller_registration_profiles (shop_id, pickup_address, province, contact_email, contact_phone,
    shipping_methods, business_type, owner_name, identity_encrypted, identity_last4, agreed_at)
    VALUES (1, 'Test', 'Ha Noi', 'test@example.test', '0900000000', '["nhanh"]', 'personal', 'Test', '{}', '1234', '2026-01-01')`).run()
  const checkout = { userId: '1', items: [{ variantId: '1', qty: 1 }], shippingMethod: 'tietkiem', paymentMethod: 'cod', address: { fullName: 'Buyer', phone: '0900000000', province: 'Ha Noi', detail: 'Test' } }
  const preview = await request('/orders/preview', 'POST', checkout)
  assert.equal(preview.status, 409)
  assert.equal(preview.body.error.code, 'SHOP_SHIPPING_UNAVAILABLE')
  const beforeOrders = db.prepare('SELECT COUNT(*) AS count FROM orders').get().count
  const beforeStock = db.prepare('SELECT stock_qty FROM product_variants WHERE id = 1').get().stock_qty
  const order = await request('/orders', 'POST', checkout, { 'idempotency-key': 'test_shipping_key_123456' })
  assert.equal(order.status, 409)
  assert.equal(order.body.error.code, 'SHOP_SHIPPING_UNAVAILABLE')
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, beforeOrders)
  assert.equal(db.prepare('SELECT stock_qty FROM product_variants WHERE id = 1').get().stock_qty, beforeStock)
  assert.equal((await request('/orders/preview', 'POST', { ...checkout, shippingMethod: 'nhanh' })).status, 200)
  const multiShop = { ...checkout, items: [{ variantId: '1', qty: 1 }, { variantId: '2', qty: 1 }], shippingMethod: 'nhanh' }
  assert.equal((await request('/orders/preview', 'POST', multiShop)).status, 200) // shop cũ chưa có hồ sơ
  db.prepare(`INSERT INTO seller_registration_profiles (shop_id, pickup_address, province, contact_email, contact_phone, shipping_methods, business_type, owner_name, identity_encrypted, identity_last4, agreed_at) VALUES (2, 'Test', 'Ha Noi', 'test@example.test', '0900000000', '["tietkiem"]', 'personal', 'Test', '{}', '1234', '2026-01-01')`).run()
  assert.equal((await request('/orders/preview', 'POST', multiShop)).body.error.code, 'SHOP_SHIPPING_UNAVAILABLE')
  db.prepare("UPDATE seller_registration_profiles SET shipping_methods = 'invalid' WHERE shop_id = 1").run()
  assert.equal((await request('/orders/preview', 'POST', { ...checkout, shippingMethod: 'nhanh' })).body.error.code, 'SHOP_SHIPPING_UNAVAILABLE')
  const row = db.prepare('SELECT identity_encrypted FROM seller_registration_profiles WHERE shop_id = ?').get(shopId)
  assert.equal(row.identity_encrypted.includes(profile.idCard), false)
  const payload = JSON.parse(row.identity_encrypted)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
  assert.equal(Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString(), profile.idCard)
  const registered = await request('/auth/register', 'POST', { username: 'new_seller', fullName: 'New Seller', email: 'new@example.test', password: 'TestPassword1', role: 'seller', shopName: 'Another Shop', sellerProfile: profile })
  assert.equal(registered.status, 201)
  assert.equal((await request(`/users/${registered.body.data.user.id}/seller-shop/registration`)).status, 200)
  const legacy = await request('/auth/register', 'POST', { username: 'legacy_seller', fullName: 'Legacy Seller', email: 'legacy@example.test', password: 'TestPassword1', role: 'seller', shopName: 'Legacy Shop' })
  assert.equal(legacy.status, 201)
  const legacyShop = legacy.body.data.user.shopId
  const denied = await request(`/admin/shops/${legacyShop}/approval`, 'PATCH', { userId: '99', approvalStatus: 'approved', approvalVersion: 1 })
  assert.equal(denied.status, 409)
  assert.equal(denied.body.error.code, 'SHOP_PROFILE_REQUIRED')
  assert.equal((await request(`/users/${legacy.body.data.user.id}/seller-shop/registration`, 'PUT', profile)).status, 200)
  assert.equal((await request(`/admin/shops/${legacyShop}/approval`, 'PATCH', { userId: '99', approvalStatus: 'approved', approvalVersion: 2 })).status, 200)

  // Thiếu bảng audit phải từ chối tiết lộ thông tin.
  db.exec('DROP TABLE seller_identity_access_events')
  const failedAudit = await request(`/admin/shops/${shopId}/identity-access`, 'POST', { userId: '99', reason: 'Kiểm tra hồ sơ người bán' })
  assert.equal(failedAudit.status, 500)
  assert.equal(JSON.stringify(failedAudit.body).includes(profile.idCard), false)
  console.log('PASS: hồ sơ, vận chuyển, duyệt shop, quyền và xoay khóa trên SQLite tạm')
} finally {
  server.close()
  const { closeDatabase } = await import(moduleUrl('config/database.js'))
  await closeDatabase()
  const { getLocalDatabase } = await import(moduleUrl('config/local-db.js'))
  getLocalDatabase().close()
  await fs.rm(root, { recursive: true, force: true })
}
