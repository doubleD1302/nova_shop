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
process.env.SELLER_IDENTITY_KEY = key.toString('base64')
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
async function request(url, method = 'GET', body) {
  const response = await fetch(base + url, { method, headers: { 'x-service-key': 'test_local_key', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
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
  const { getLocalDatabase } = await import(moduleUrl('config/local-db.js'))
  const db = getLocalDatabase()
  const row = db.prepare('SELECT identity_encrypted FROM seller_registration_profiles WHERE shop_id = ?').get(shopId)
  assert.equal(row.identity_encrypted.includes(profile.idCard), false)
  const payload = JSON.parse(row.identity_encrypted)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
  assert.equal(Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString(), profile.idCard)
  const registered = await request('/auth/register', 'POST', { username: 'new_seller', fullName: 'New Seller', email: 'new@example.test', password: 'TestPassword1', role: 'seller', shopName: 'Another Shop', sellerProfile: profile })
  assert.equal(registered.status, 201)
  assert.equal((await request(`/users/${registered.body.data.user.id}/seller-shop/registration`)).status, 200)
  console.log('PASS: đăng ký và mở shop, mã hóa, owner/admin và validation trên SQLite tạm')
} finally {
  server.close()
  const { closeDatabase } = await import(moduleUrl('config/database.js'))
  await closeDatabase()
  const { getLocalDatabase } = await import(moduleUrl('config/local-db.js'))
  getLocalDatabase().close()
  await fs.rm(root, { recursive: true, force: true })
}
