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
async function request(uri, token, method = 'GET', body, headers = {}) {
  const response = await fetch(base + uri, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, headers: response.headers, body: await response.json() }
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
  const signup = await request('/auth/register', null, 'POST', {
    username: 'signup_seller_test', password: 'demo-fixture-password', fullName: 'Seller Signup',
    email: 'signup@example.test', role: 'seller', shopName: 'Shop Signup', sellerProfile: profile,
  })
  assert.equal(signup.status, 201, JSON.stringify(signup.body))
  const signupProfile = await request('/seller/shop/registration', signup.body.data.token)
  assert.equal(signupProfile.body.data.profile.identityLast4, '9012')
  assert.equal((await request('/seller/shop/registration', sellerToken)).status, 200)
  assert.equal((await request(`/admin/shops/${shopId}/registration`, sellerToken)).status, 403)
  const reviewed = await request(`/admin/shops/${shopId}/registration`, admin)
  assert.equal(reviewed.status, 200)
  assert.equal(reviewed.headers.get('cache-control'), 'no-store')
  assert.equal(reviewed.body.data.status, 'pending')
  assert.equal(reviewed.body.data.approvalVersion, 1)
  assert.equal(reviewed.body.data.profile.identityLast4, '9012')
  assert.equal(JSON.stringify(reviewed.body).includes(profile.idCard), false)
  assert.equal((await request(`/admin/shops/${shopId}/identity-access`, sellerToken, 'POST', { reason: 'Kiểm tra hồ sơ người bán' })).status, 403)
  const reveal = await request(`/admin/shops/${shopId}/identity-access`, admin, 'POST', { reason: 'Kiểm tra hồ sơ người bán' })
  assert.equal(reveal.status, 200)
  assert.equal(reveal.body.data.idCard, profile.idCard)
  assert.equal(reveal.headers.get('cache-control'), 'no-store')
  const accessEvents = await request(`/admin/shops/${shopId}/identity-access-events`, admin)
  assert.equal(accessEvents.body.data.events.length, 1)

  const shopApprovalUrl = `/admin/shops/${shopId}/approval`
  const rejected = await request(shopApprovalUrl, admin, 'PATCH', {
    approvalStatus: 'rejected', approvalVersion: 1, rejectionReason: 'Cập nhật chủ hồ sơ',
  })
  assert.equal(rejected.status, 200)
  assert.equal((await request('/seller/shop/registration', sellerToken, 'PUT', {
    ...profile, ownerName: 'Nguoi Ban Da Cap Nhat',
  })).status, 200)
  assert.equal((await request('/seller/shop/resubmit', sellerToken, 'POST')).status, 200)
  const staleShop = await request(shopApprovalUrl, admin, 'PATCH', { approvalStatus: 'approved', approvalVersion: 1 })
  assert.equal(staleShop.body.error.code, 'SHOP_APPROVAL_CONFLICT')
  const latest = await request(`/admin/shops/${shopId}/registration`, admin)
  assert.equal(latest.body.data.approvalVersion, 3)
  assert.equal(latest.body.data.profile.ownerName, 'Nguoi Ban Da Cap Nhat')
  assert.equal((await request(shopApprovalUrl, admin, 'PATCH', {
    approvalStatus: 'approved', approvalVersion: latest.body.data.approvalVersion,
  })).status, 200)

  const { getLocalDatabase } = await import(url('data-api', 'config/local-db.js'))
  const local = getLocalDatabase()
  local.prepare("UPDATE products SET approval_status = 'pending', status = 'hidden' WHERE id = 1").run()
  const listProducts = async () => {
    const products = await request('/admin/products', admin)
    assert.equal(products.status, 200, JSON.stringify(products.body))
    return products.body.data.products.find((item) => item.id === '1')
  }
  const { reviewVersion } = await listProducts()
  const productApprovalUrl = '/admin/products/1/approval'
  assert.equal((await request(productApprovalUrl, sellerToken, 'PATCH', { approvalStatus: 'approved', reviewVersion })).status, 403)
  const approved = await request(productApprovalUrl, admin, 'PATCH', { approvalStatus: 'approved', reviewVersion })
  assert.equal(approved.status, 200, JSON.stringify(approved.body))
  assert.equal(approved.body.data.status, 'hidden')
  const stale = await request(productApprovalUrl, admin, 'PATCH', {
    approvalStatus: 'rejected', reviewVersion, rejectionReason: 'Ảnh cần cập nhật',
  })
  assert.equal(stale.body.error.code, 'PRODUCT_APPROVAL_CONFLICT')
  local.prepare("UPDATE products SET status = 'archived' WHERE id = 1").run()
  const archived = await request(productApprovalUrl, admin, 'PATCH', {
    approvalStatus: 'approved', reviewVersion: (await listProducts()).reviewVersion,
  })
  assert.equal(archived.body.error.code, 'PRODUCT_ARCHIVED')
  local.prepare("UPDATE products SET status = 'active', approval_status = 'rejected' WHERE id = 1").run()
  const flash = await request('/admin/products/1/flash-sale', admin, 'PATCH', { enabled: true })
  assert.equal(flash.body.error.code, 'PRODUCT_NOT_READY')
  const cart = await request('/cart/items', sellerToken, 'POST', { variantId: '1', qty: 1 })
  assert.equal(cart.body.error.code, 'PRODUCT_UNAVAILABLE', JSON.stringify(cart.body))
  const preview = await request('/orders/preview', sellerToken, 'POST', {
    items: [{ variantId: '1', qty: 1 }], shippingMethod: 'nhanh',
  })
  assert.equal(preview.body.error.code, 'PRODUCT_UNAVAILABLE', JSON.stringify(preview.body))
  const checkout = await request('/orders', sellerToken, 'POST', {
    items: [{ variantId: '1', qty: 1 }], shippingMethod: 'nhanh', paymentMethod: 'cod',
    address: { fullName: 'Nguoi Nhan', phone: '0900000000', province: 'Ha Noi', detail: '123 Test' },
  }, { 'idempotency-key': 'moderation-checkout-fixture-01' })
  assert.equal(checkout.body.error.code, 'PRODUCT_UNAVAILABLE', JSON.stringify(checkout.body))

  console.log('PASS: HTTP Backend → Data API, hồ sơ và duyệt shop, duyệt sản phẩm, chặn flash sale và mua hàng trên SQLite tạm')
} finally {
  server.close(); dataServer.close()
  const { closeDatabase } = await import(url('data-api', 'config/database.js'))
  await closeDatabase()
  const { getLocalDatabase } = await import(url('data-api', 'config/local-db.js'))
  getLocalDatabase().close()
  await fs.rm(root, { recursive: true, force: true })
}
