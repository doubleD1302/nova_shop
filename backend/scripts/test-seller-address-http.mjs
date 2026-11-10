import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

process.env.NODE_ENV = 'test'
process.env.DB_USER = 'test_user'
process.env.DB_PASSWORD = 'test_local_value'
process.env.DB_HOST = '127.0.0.1'
process.env.DB_PORT = '1'
process.env.DB_READINESS_TIMEOUT_MS = '200'
process.env.DATA_API_KEY = 'test_local_key'
process.env.JWT_SECRET = 'test_jwt_key_for_isolated_backend_1234567890'
process.env.ALLOW_LOCAL_DB_FALLBACK = 'true'
process.env.SELLER_IDENTITY_KEY = crypto.randomBytes(32).toString('base64')
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shopnova-http-test-'))
const backendRoot = path.resolve('.')
const dataRoot = path.resolve('../data-api')
for (const [name, source] of [['backend', backendRoot], ['data-api', dataRoot]]) {
  const dest = path.join(root, name)
  await fs.mkdir(dest)
  await fs.cp(path.join(source, 'src'), path.join(dest, 'src'), { recursive: true })
  await fs.writeFile(path.join(dest, 'package.json'), '{"type":"module"}')
  await fs.symlink(path.join(source, 'node_modules'), path.join(dest, 'node_modules'), 'junction')
}
process.env.DOTENV_CONFIG_PATH = path.join(root, 'no-env')
const url = (part, relative) => pathToFileURL(path.join(root, part, 'src', relative)).href
const { app: dataApp } = await import(url('data-api', 'app.js'))
const dataServer = dataApp.listen(0, '127.0.0.1')
await new Promise((resolve) => dataServer.once('listening', resolve))
process.env.DATA_API_URL = `http://127.0.0.1:${dataServer.address().port}`
const { app: backend } = await import(url('backend', 'app.js'))
const { signAccessToken } = await import(url('backend', 'middlewares/auth.middleware.js'))
const server = backend.listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}/api/v1`
async function request(uri, token, method = 'GET', body) {
  const response = await fetch(base + uri, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, body: await response.json() }
}
try {
  const buyer = signAccessToken({ id: '1', role: 'buyer' })
  const admin = signAccessToken({ id: '99', role: 'admin' })
  assert.equal((await request('/addresses', null)).status, 401)
  const addr = await request('/addresses', buyer, 'POST', { fullName: 'Nguoi Nhan', phone: '0900000000', province: 'Ha Noi', detail: '123 Test' })
  assert.equal(addr.status, 201)
  assert.equal((await request(`/addresses/${addr.body.data.address.id}/default`, buyer, 'PATCH')).status, 200)
  const profile = { pickupAddress: '123 Test', province: 'Ha Noi', contactEmail: 'test@example.test', contactPhone: '0900000000', shippingMethods: ['nhanh'], businessType: 'personal', ownerName: 'Nguoi Ban', idCard: '123456789012', agreeTerms: true }
  const created = await request('/auth/seller-shop', buyer, 'POST', { shopName: 'Shop Test', shopTagline: 'Slogan test', sellerProfile: profile })
  assert.equal(created.status, 200)
  const shopId = created.body.data.user.shopId
  const sellerToken = created.body.data.token
  assert.equal((await request('/seller/shop/registration', sellerToken)).status, 200)
  assert.equal((await request(`/admin/shops/${shopId}/registration`, sellerToken)).status, 403)
  const reviewed = await request(`/admin/shops/${shopId}/registration`, admin)
  assert.equal(reviewed.status, 200)
  assert.equal(reviewed.body.data.profile.identityLast4, '9012')
  assert.equal(JSON.stringify(reviewed.body).includes(profile.idCard), false)
  console.log('PASS: Backend → Data API HTTP, auth, địa chỉ và hồ sơ seller trên SQLite tạm')
} finally {
  server.close(); dataServer.close()
  const { closeDatabase } = await import(url('data-api', 'config/database.js'))
  await closeDatabase()
  const { getLocalDatabase } = await import(url('data-api', 'config/local-db.js'))
  getLocalDatabase().close()
  await fs.rm(root, { recursive: true, force: true })
}
