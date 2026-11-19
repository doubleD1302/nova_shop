import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Kiểm tra PATCH /users/:userId/seller-shop/shipping trên SQLite tạm, không chạm MySQL/TiDB thật.
process.env.NODE_ENV = 'test'
process.env.DB_USER = 'test_user'
process.env.DB_PASSWORD = 'test_local_value'
process.env.DB_HOST = '127.0.0.1'
process.env.DB_PORT = '1'
process.env.DB_READINESS_TIMEOUT_MS = '200'
process.env.DATA_API_KEY = 'test_local_key'
process.env.ALLOW_LOCAL_DB_FALLBACK = 'true'
process.env.SELLER_IDENTITY_KEY = crypto.randomBytes(32).toString('base64')
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shopnova-shipping-test-'))
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
const profile = { pickupAddress: '123 Test', province: 'Ha Noi', contactEmail: 'test@example.test', contactPhone: '0900000000', shippingMethods: ['nhanh', 'tietkiem'], businessType: 'personal', ownerName: 'Nguoi Ban', idCard: '123456789012', taxCode: '', invoiceEmail: '', agreeTerms: true }
try {
  const registered = await request('/auth/register', 'POST', { username: 'ship_seller', fullName: 'Ship Seller', email: 'ship@example.test', password: 'TestPassword1', role: 'seller', shopName: 'Ship Shop', sellerProfile: profile })
  assert.equal(registered.status, 201)
  const userId = registered.body.data.user.id
  const shopId = registered.body.data.user.shopId
  const patch = (body, id = userId) => request(`/users/${id}/seller-shop/shipping`, 'PATCH', body)

  // Shop chưa duyệt phải sửa trong hồ sơ đăng ký.
  const pending = await patch({ shippingMethods: ['nhanh'] })
  assert.equal(pending.status, 409)
  assert.equal(pending.body.error.code, 'SHOP_PROFILE_PENDING')

  const registration = await request(`/users/${userId}/seller-shop/registration`)
  const approved = await request(`/admin/shops/${shopId}/approval`, 'PATCH', { userId: '99', approvalStatus: 'approved', approvalVersion: registration.body.data.approvalVersion })
  assert.equal(approved.status, 200)

  // Đầu vào sai: không có gì để sửa, trường lạ, sai kiểu, trùng, rỗng, quá dài.
  for (const bad of [{}, { shippingMethods: [] }, { shippingMethods: ['nhanh', 'nhanh'] }, { shippingMethods: ['khac'] }, { shippingMethods: 'nhanh' },
    { pickupAddress: '' }, { pickupAddress: '   ' }, { pickupAddress: 5 }, { pickupAddress: 'a'.repeat(256) }, { province: 'b'.repeat(121) },
    { status: 'active' }, { shippingMethods: ['nhanh'], idCard: '1' }, [], null]) {
    const response = await patch(bad)
    assert.equal(response.status, 400, JSON.stringify(bad))
    assert.equal(response.body.error.code, 'VALIDATION_ERROR')
  }
  assert.equal((await patch({ shippingMethods: ['nhanh'] }, 'abc')).status, 400)
  assert.equal((await patch({ shippingMethods: ['nhanh'] }, '987654')).status, 404)

  // Chỉ sửa phương thức: địa chỉ giữ nguyên, không đổi phiên bản hồ sơ.
  const versionBefore = (await request(`/users/${userId}/seller-shop/registration`)).body.data.approvalVersion
  const methods = await patch({ shippingMethods: ['hoatoc', 'tietkiem'] })
  assert.equal(methods.status, 200)
  assert.deepEqual(methods.body.data, { pickupAddress: '123 Test', province: 'Ha Noi', shippingMethods: ['hoatoc', 'tietkiem'] })

  // Sửa địa chỉ: cập nhật cả hồ sơ và địa chỉ hiển thị của shop.
  const address = await patch({ pickupAddress: '  45 Lê Lợi  ', province: 'Da Nang' })
  assert.equal(address.status, 200)
  assert.equal(address.body.data.pickupAddress, '45 Lê Lợi')
  assert.deepEqual(address.body.data.shippingMethods, ['hoatoc', 'tietkiem'])
  const after = await request(`/users/${userId}/seller-shop/registration`)
  assert.equal(after.body.data.status, 'active')
  assert.equal(after.body.data.approvalVersion, versionBefore)
  assert.equal(after.body.data.profile.pickupAddress, '45 Lê Lợi')
  assert.equal(after.body.data.profile.province, 'Da Nang')
  const { getLocalDatabase } = await import(moduleUrl('config/local-db.js'))
  const db = getLocalDatabase()
  const shop = db.prepare('SELECT province, address_detail FROM shops WHERE id = ?').get(shopId)
  assert.deepEqual({ ...shop }, { province: 'Da Nang', address_detail: '45 Lê Lợi' })

  // Shop không hoạt động hoặc chưa có hồ sơ bị từ chối.
  db.prepare("UPDATE shops SET status = 'suspended' WHERE id = ?").run(shopId)
  assert.equal((await patch({ shippingMethods: ['nhanh'] })).body.error.code, 'SHOP_NOT_ACTIVE')
  db.prepare("UPDATE shops SET status = 'active' WHERE id = ?").run(shopId)
  db.prepare('DELETE FROM seller_registration_profiles WHERE shop_id = ?').run(shopId)
  assert.equal((await patch({ shippingMethods: ['nhanh'] })).body.error.code, 'SELLER_PROFILE_NOT_FOUND')
  console.log('PASS: cài đặt vận chuyển và địa chỉ lấy hàng trên SQLite tạm')
} finally {
  server.close()
  const { closeDatabase } = await import(moduleUrl('config/database.js'))
  await closeDatabase()
  const { getLocalDatabase } = await import(moduleUrl('config/local-db.js'))
  getLocalDatabase().close()
  await fs.rm(root, { recursive: true, force: true })
}
