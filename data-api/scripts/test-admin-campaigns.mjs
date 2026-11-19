import assert from 'node:assert/strict'
import http from 'node:http'

// Kiểm tra HTTP của Data API cho quản trị chiến dịch marketing và duyệt đăng ký của shop.
// Database được giả lập nên bài này kiểm tra validation, quyền admin, trạng thái và hình dạng dữ liệu,
// không chứng minh cú pháp SQL chạy đúng trên MySQL thật.
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-admin-campaigns-test.env', DB_USER: 'test', DB_PASSWORD: 'admin-campaigns-test-password', DATA_API_KEY: 'admin-campaigns-test-service-key' })
const { sequelize, closeDatabase } = await import('../src/config/database.js')
const { default: app } = await import('../src/app.js')

const db = {
  isAdmin: true,
  campaign: { id: 3, starts_at: new Date('2026-11-01T00:00:00.000Z'), ends_at: new Date('2026-12-01T00:00:00.000Z') },
  registration: null,
  list: [],
  regList: [],
}
const resetRegistration = (overrides = {}) => {
  db.registration = {
    id: 8, campaign_id: 3, shop_id: 1, product_id: 7, status: 'pending', campaign_name: 'Flash Sale', is_active: 1, running: 1,
    owner_id: 5, product_name: 'Tai nghe', product_status: 'active', product_approval: 'approved', ...overrides,
  }
}
const log = []
const conn = {
  query({ sql }, values, callback) {
    log.push({ sql, values })
    let rows = []
    if (sql.startsWith('START') || sql.startsWith('COMMIT') || sql.startsWith('ROLLBACK')) rows = []
    else if (sql.includes("FROM users WHERE id = ? AND role = 'admin'")) rows = db.isAdmin ? [{ id: 1 }] : []
    else if (sql.includes('COUNT(*) AS total FROM marketing_campaigns')) rows = [{ total: db.list.length }]
    else if (sql.includes('FROM marketing_campaigns c') && sql.includes('LEFT JOIN campaign_registrations')) rows = db.list
    else if (sql.includes('INSERT INTO marketing_campaigns')) rows = { insertId: 9 }
    else if (sql.includes('FROM marketing_campaigns WHERE id = ? FOR UPDATE')) rows = db.campaign ? [db.campaign] : []
    else if (sql.includes('UPDATE marketing_campaigns')) rows = { affectedRows: 1 }
    else if (sql.includes('FROM marketing_campaigns WHERE id = ?')) rows = [{ id: 9, name: 'Mega', type: 'mega_sale', description: null, starts_at: new Date('2026-12-01T00:00:00.000Z'), ends_at: new Date('2026-12-10T00:00:00.000Z'), banner_url: null, is_active: 1 }]
    else if (sql.includes('COUNT(*) AS total FROM campaign_registrations')) rows = [{ total: db.regList.length }]
    else if (sql.includes('FROM campaign_registrations r') && sql.includes('shop_name')) rows = db.regList
    else if (sql.includes('FROM campaign_registrations r') && sql.includes('FOR UPDATE')) rows = db.registration ? [db.registration] : []
    else if (sql.includes('UPDATE campaign_registrations')) rows = { affectedRows: 1 }
    callback(null, rows)
  },
  destroy() {},
}
sequelize.connectionManager.getConnection = async () => conn
sequelize.connectionManager.releaseConnection = async () => {}

const server = http.createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/internal/v1`
async function call(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: { 'x-service-key': process.env.DATA_API_KEY, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: response.status, body: await response.json() }
}
const ran = (text) => log.filter((entry) => entry.sql.includes(text)).length

let passed = 0
async function check(name, fn) {
  await fn()
  passed++
  console.log(`  ✓ ${name}`)
}

const campaign = { userId: '1', name: 'Mega Sale 12.12', type: 'mega_sale', startsAt: '2026-12-01T00:00:00Z', endsAt: '2026-12-10T00:00:00Z' }

try {
  console.log('--- Chiến dịch ---')
  await check('danh sách: cần userId admin; người không phải admin bị chặn (403); bộ lọc sai bị từ chối (400)', async () => {
    db.list = [{ id: 3, name: 'Flash Sale', type: 'flash_sale', description: null, starts_at: new Date('2026-11-01T00:00:00.000Z'), ends_at: new Date('2026-12-01T00:00:00.000Z'), banner_url: null, is_active: 0, pending: '2', approved: '1', rejected: '0' }]
    const ok = await call('/admin/campaigns?userId=1')
    assert.equal(ok.status, 200)
    assert.equal(ok.body.data.total, 1)
    assert.equal(ok.body.data.items[0].isActive, false, 'chiến dịch đã tắt vẫn được liệt kê')
    assert.deepEqual(ok.body.data.items[0].registrations, { pending: 2, approved: 1, rejected: 0 })
    db.isAdmin = false
    assert.equal((await call('/admin/campaigns?userId=1')).status, 403)
    db.isAdmin = true
    for (const query of ['', 'userId=abc', 'userId=1&limit=0', 'userId=1&limit=101', 'userId=1&offset=-1']) {
      assert.equal((await call(`/admin/campaigns?${query}`)).status, 400, query)
    }
  })
  await check('tạo chiến dịch: hợp lệ trả 201, mặc định bật, không ghi userId vào bảng', async () => {
    log.length = 0
    const result = await call('/admin/campaigns', 'POST', { ...campaign, description: '  Giảm sâu  ', bannerUrl: '/uploads/banner.png' })
    assert.equal(result.status, 201)
    assert.equal(result.body.data.name, 'Mega')
    const insert = log.find((entry) => entry.sql.includes('INSERT INTO marketing_campaigns'))
    assert.ok(insert.sql.includes('is_active') && !insert.sql.includes('user_id') && !insert.sql.includes('userId'))
    assert.equal(insert.values[insert.values.length - 1] === 1 || insert.values.includes(1), true)
    assert.ok(insert.values.includes('Giảm sâu'), 'mô tả được cắt khoảng trắng')
  })
  await check('tạo chiến dịch: từ chối dữ liệu sai (400) và người không phải admin (403)', async () => {
    const bad = [
      { ...campaign, name: '   ' }, { ...campaign, name: 'a'.repeat(151) }, { ...campaign, name: 5 },
      { ...campaign, type: 'sale' }, { ...campaign, type: undefined },
      { ...campaign, startsAt: '2026-12-01' }, { ...campaign, startsAt: '2026-12-01T00:00:00' }, { ...campaign, endsAt: 'mai' },
      { ...campaign, endsAt: '2026-12-01T00:00:00Z' }, { ...campaign, endsAt: '2026-11-30T00:00:00Z' },
      { ...campaign, bannerUrl: 'javascript:alert(1)' }, { ...campaign, bannerUrl: 'http://x.test/a.png' }, { ...campaign, bannerUrl: '/uploads/' + 'a'.repeat(500) },
      { ...campaign, isActive: 'yes' }, { ...campaign, description: 'a'.repeat(2001) }, { ...campaign, id: '1' }, { ...campaign, userId: undefined }, [],
    ]
    for (const body of bad) assert.equal((await call('/admin/campaigns', 'POST', body)).status, 400, JSON.stringify(body).slice(0, 80))
    db.isAdmin = false
    log.length = 0
    assert.equal((await call('/admin/campaigns', 'POST', campaign)).status, 403)
    db.isAdmin = true
    assert.equal(ran('INSERT INTO marketing_campaigns'), 0)
  })
  await check('sửa chiến dịch: đổi từng trường, khoảng thời gian được kiểm tra lại với giá trị đang lưu', async () => {
    log.length = 0
    assert.equal((await call('/admin/campaigns/3', 'PATCH', { userId: '1', isActive: false })).status, 200)
    assert.equal(ran('UPDATE marketing_campaigns'), 1)
    assert.equal((await call('/admin/campaigns/3', 'PATCH', { userId: '1', endsAt: '2026-10-01T00:00:00Z' })).status, 400, 'kết thúc trước ngày bắt đầu đang lưu')
    assert.equal((await call('/admin/campaigns/3', 'PATCH', { userId: '1', endsAt: '2026-12-31T00:00:00Z', startsAt: '2026-11-15T00:00:00Z' })).status, 200)
    for (const body of [{ userId: '1' }, { userId: '1', type: 'x' }, { userId: '1', unknown: 1 }, { userId: '1', name: '' }]) {
      assert.equal((await call('/admin/campaigns/3', 'PATCH', body)).status, 400, JSON.stringify(body))
    }
    assert.equal((await call('/admin/campaigns/abc', 'PATCH', { userId: '1', isActive: true })).status, 400)
    db.campaign = null
    const missing = await call('/admin/campaigns/3', 'PATCH', { userId: '1', isActive: true })
    db.campaign = { id: 3, starts_at: new Date('2026-11-01T00:00:00.000Z'), ends_at: new Date('2026-12-01T00:00:00.000Z') }
    assert.equal(missing.status, 404)
    db.isAdmin = false
    assert.equal((await call('/admin/campaigns/3', 'PATCH', { userId: '1', isActive: true })).status, 403)
    db.isAdmin = true
  })

  console.log('--- Đăng ký chiến dịch ---')
  await check('danh sách đăng ký: lọc theo campaignId/status, kèm shop, sản phẩm và giá hiện tại', async () => {
    db.regList = [{ id: 8, campaign_id: 3, shop_id: 1, product_id: 7, discount_price: '90000', status: 'pending', note: null, created_at: new Date('2026-11-10T00:00:00.000Z'), updated_at: new Date('2026-11-10T00:00:00.000Z'), campaign_name: 'Flash Sale', campaign_type: 'flash_sale', starts_at: new Date('2026-11-01T00:00:00.000Z'), ends_at: new Date('2026-12-01T00:00:00.000Z'), shop_name: 'Shop A', product_name: 'Tai nghe', current_price: '120000' }]
    log.length = 0
    const result = await call('/admin/campaign-registrations?userId=1&campaignId=3&status=pending')
    assert.equal(result.status, 200)
    const [item] = result.body.data.items
    assert.deepEqual([item.shopName, item.productName, item.currentPrice, item.discountPrice, item.status], ['Shop A', 'Tai nghe', 120000, 90000, 'pending'])
    const query = log.find((entry) => entry.sql.includes('shop_name'))
    assert.ok(query.sql.includes('r.campaign_id = ?') && query.sql.includes('r.status = ?'))
    for (const bad of ['userId=1&status=done', 'userId=1&campaignId=x', 'userId=x', '']) {
      assert.equal((await call(`/admin/campaign-registrations?${bad}`)).status, 400, bad)
    }
    db.isAdmin = false
    assert.equal((await call('/admin/campaign-registrations?userId=1')).status, 403)
    db.isAdmin = true
  })
  await check('duyệt đăng ký: ghi trạng thái, trả thông tin chủ shop để gửi thông báo', async () => {
    resetRegistration()
    log.length = 0
    const result = await call('/admin/campaign-registrations/8', 'PATCH', { userId: '1', status: 'approved' })
    assert.equal(result.status, 200)
    assert.deepEqual([result.body.data.status, result.body.data.ownerId, result.body.data.productName, result.body.data.campaignName], ['approved', '5', 'Tai nghe', 'Flash Sale'])
    assert.equal(ran('UPDATE campaign_registrations'), 1)
    assert.equal(ran('UPDATE products'), 0, 'duyệt chưa tự đổi giá hay bật Flash Sale')
    assert.equal(ran('UPDATE product_variants'), 0)
  })
  await check('từ chối đăng ký: bắt buộc có lý do, lưu ghi chú', async () => {
    resetRegistration()
    for (const body of [{ userId: '1', status: 'rejected' }, { userId: '1', status: 'rejected', note: '   ' }, { userId: '1', status: 'rejected', note: 'a'.repeat(256) }]) {
      assert.equal((await call('/admin/campaign-registrations/8', 'PATCH', body)).status, 400, JSON.stringify(body).slice(0, 60))
    }
    log.length = 0
    const result = await call('/admin/campaign-registrations/8', 'PATCH', { userId: '1', status: 'rejected', note: '  Giá chưa đủ sâu  ' })
    assert.equal(result.status, 200)
    assert.equal(result.body.data.note, 'Giá chưa đủ sâu')
    const update = log.find((entry) => entry.sql.includes('UPDATE campaign_registrations'))
    assert.deepEqual(update.values.slice(0, 2), ['rejected', 'Giá chưa đủ sâu'])
  })
  await check('đầu vào sai: trạng thái lạ, id sai, thiếu admin (400); không phải admin (403); không có đăng ký (404)', async () => {
    resetRegistration()
    for (const [id, body] of [['8', { userId: '1', status: 'pending' }], ['8', { userId: '1', status: 'done' }], ['8', { userId: '1' }], ['x', { userId: '1', status: 'approved' }], ['8', { status: 'approved' }], ['8', { userId: '1', status: 'approved', note: 5 }]]) {
      assert.equal((await call(`/admin/campaign-registrations/${id}`, 'PATCH', body)).status, 400, JSON.stringify(body))
    }
    db.isAdmin = false
    log.length = 0
    assert.equal((await call('/admin/campaign-registrations/8', 'PATCH', { userId: '1', status: 'approved' })).status, 403)
    assert.equal(ran('UPDATE campaign_registrations'), 0)
    db.isAdmin = true
    db.registration = null
    assert.equal((await call('/admin/campaign-registrations/8', 'PATCH', { userId: '1', status: 'approved' })).status, 404)
  })
  await check('đăng ký đã xử lý trả 409; duyệt khi chiến dịch đã kết thúc/tắt hoặc sản phẩm không đủ điều kiện trả 409', async () => {
    log.length = 0
    for (const status of ['approved', 'rejected']) {
      resetRegistration({ status })
      const result = await call('/admin/campaign-registrations/8', 'PATCH', { userId: '1', status: 'rejected', note: 'x' })
      assert.equal(result.status, 409)
      assert.equal(result.body.error.code, 'REGISTRATION_ALREADY_REVIEWED')
    }
    for (const [overrides, code] of [[{ running: 0 }, 'CAMPAIGN_ENDED'], [{ is_active: 0 }, 'CAMPAIGN_ENDED'], [{ product_status: 'hidden' }, 'PRODUCT_NOT_ELIGIBLE'], [{ product_approval: 'pending' }, 'PRODUCT_NOT_ELIGIBLE']]) {
      resetRegistration(overrides)
      const result = await call('/admin/campaign-registrations/8', 'PATCH', { userId: '1', status: 'approved' })
      assert.equal(result.status, 409, code)
      assert.equal(result.body.error.code, code)
    }
    assert.equal(ran('UPDATE campaign_registrations'), 0)
    // Từ chối vẫn được phép khi chiến dịch đã kết thúc để shop biết kết quả
    resetRegistration({ running: 0 })
    assert.equal((await call('/admin/campaign-registrations/8', 'PATCH', { userId: '1', status: 'rejected', note: 'Hết hạn' })).status, 200)
  })

  console.log(`\nAdmin campaigns Data API: ${passed} kiểm tra PASS (database giả lập).`)
} catch (error) {
  console.error('\n✗ THẤT BẠI:', error)
  process.exitCode = 1
} finally {
  server.closeAllConnections?.()
  await new Promise((resolve) => server.close(resolve))
  await closeDatabase()
}
