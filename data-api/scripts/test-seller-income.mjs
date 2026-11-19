import assert from 'node:assert/strict'
import http from 'node:http'

// Kiểm tra cách tính tiền của shop (utils/seller-income.js) và việc các API dùng chung cách tính đó.
// Database được giả lập: bài này kiểm tra công thức và hình dạng truy vấn, không chứng minh SQL chạy đúng trên MySQL thật.
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-seller-income-test.env', DB_USER: 'test', DB_PASSWORD: 'seller-income-test-password', DATA_API_KEY: 'seller-income-test-service-key' })
const { sequelize, closeDatabase } = await import('../src/config/database.js')
const { default: app } = await import('../src/app.js')
const income = await import('../src/utils/seller-income.js')

let passed = 0
async function check(name, fn) {
  await fn()
  passed++
  console.log(`  ✓ ${name}`)
}

// Dữ liệu giả lập: tỷ lệ hoa hồng và các dòng trả về cho từng truy vấn
const db = { rate: [{ setting_value: '5.00' }], orders: [], completedGross: 0, refunds: 0, bank: true }
const log = []
const conn = {
  query({ sql }, values, callback) {
    log.push({ sql, values })
    let rows = []
    if (sql.startsWith('START') || sql.startsWith('COMMIT') || sql.startsWith('ROLLBACK')) rows = []
    else if (sql.includes("setting_key = 'commission_rate'")) rows = db.rate
    else if (sql.includes('FROM shop_orders so') && sql.includes('JOIN orders o')) rows = db.orders
    else if (sql.includes('AS completed_gross')) rows = [{ completed_gross: db.completedGross }]
    else if (sql.includes('AS total_refunded')) rows = [{ total_refunded: db.refunds }]
    else if (sql.includes('AS processing_amount')) rows = [{ processing_amount: 0, completed_amount: 0 }]
    else if (sql.includes('AS total_payouts')) rows = [{ total_payouts: 0 }]
    else if (sql.includes('AS pending_escrow')) rows = [{ pending_escrow: 0 }]
    else if (sql.includes('FROM seller_bank_accounts')) rows = db.bank ? [{ id: 1, bank_name: 'VCB', bank_code: 'VCB', account_number: '123456789', account_holder: 'A' }] : []
    else if (sql.includes('INSERT INTO seller_payout_requests')) rows = { insertId: 7 }
    callback(null, rows)
  },
  destroy() {},
}
sequelize.connectionManager.getConnection = async () => conn
sequelize.connectionManager.releaseConnection = async () => {}

const server = http.createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/internal/v1`
async function call(path, body) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-service-key': process.env.DATA_API_KEY, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: response.status, body: await response.json() }
}
const sqlOf = (marker) => log.filter((entry) => entry.sql.includes(marker)).map((entry) => entry.sql)

try {
  console.log('--- Công thức ---')
  await check('hoa hồng làm tròn nửa lên, đúng với số lớn', () => {
    assert.equal(income.commissionOf(100000, 5), 5000)
    assert.equal(income.commissionOf(30, 5), 2) // 1,5 làm tròn lên 2 như ROUND của MySQL
    assert.equal(income.commissionOf(10, 5.5), 1) // 0,55
    assert.equal(income.commissionOf(0, 5), 0)
    assert.equal(income.commissionOf(100000, 0), 0)
    assert.equal(income.commissionOf(999999999999999, 5), 50000000000000) // vượt 2^53 khi nhân, vẫn đúng nhờ BigInt
  })
  await check('thực nhận = tiền hàng sau giảm - hoa hồng, không phụ thuộc phí ship', () => {
    assert.equal(income.salesOf(110000, 10000), 100000)
    assert.equal(income.incomeOf(110000, 10000, 5), 95000)
    assert.equal(income.incomeOf(100000, 100000, 5), 0)
    assert.equal(income.incomeOf(100, 500, 5), 0, 'giảm giá lớn hơn tiền hàng không cho kết quả âm')
    assert.equal(income.refundNetOf(50000, 5), 47500)
  })
  await check('tỷ lệ hoa hồng: đọc từ cấu hình, giá trị hỏng hoặc thiếu dùng mặc định 5%', async () => {
    const read = (rows) => income.readCommissionRate(async () => rows)
    assert.equal(await read([]), 5)
    assert.equal(await read([{ setting_value: '7.5' }]), 7.5)
    assert.equal(await read([{ setting_value: '0' }]), 0)
    assert.equal(await read([{ setting_value: '5.678' }]), 5.68)
    for (const bad of ['abc', '-1', '101', '', '   ', null, 'NaN', '1e3']) assert.equal(await read([{ setting_value: bad }]), 5, bad)
    assert.equal(await income.readCommissionRate(async () => { throw new Error("Table 'x.system_settings' doesn't exist") }), 5)
    await assert.rejects(income.readCommissionRate(async () => { throw new Error('connection lost') }), /connection lost/)
  })
  await check('đoạn SQL dùng đúng tỷ lệ số, không nhận chuỗi tùy ý', () => {
    assert.equal(income.incomeSql(7.5), '((so.subtotal - so.discount_amount) - ROUND((so.subtotal - so.discount_amount) * 7.5 / 100))')
    assert.equal(income.refundNetSql(5), '(refund_amount - ROUND(refund_amount * 5 / 100))')
  })

  console.log('--- API dùng chung công thức ---')
  await check('số dư: truy vấn tiền đơn và hoàn tiền dùng hoa hồng 5%, không cộng total_amount', async () => {
    log.length = 0
    db.completedGross = 570000
    db.refunds = 47500
    const result = await call('/seller/payout/balance?shopId=1')
    assert.equal(result.status, 200)
    assert.equal(result.body.data.balance.available, 522500)
    const [gross] = sqlOf('AS completed_gross')
    assert.ok(gross.includes('(so.subtotal - so.discount_amount) * 5 / 100'))
    assert.ok(!gross.includes('total_amount'))
    assert.ok(sqlOf('AS total_refunded')[0].includes('refund_amount * 5 / 100'))
    assert.ok(!sqlOf('AS pending_escrow')[0].includes('total_amount'))
  })
  await check('đổi tỷ lệ hoa hồng trong cấu hình thì truy vấn dùng tỷ lệ mới', async () => {
    log.length = 0
    db.rate = [{ setting_value: '8' }]
    await call('/seller/payout/balance?shopId=1')
    db.rate = [{ setting_value: '5.00' }]
    assert.ok(sqlOf('AS completed_gross')[0].includes('* 8 / 100'))
  })
  await check('rút tiền: số dư trong transaction cùng công thức; vượt số dư bị từ chối', async () => {
    log.length = 0
    db.completedGross = 100000
    db.refunds = 0
    assert.ok(sqlOf('AS completed_gross').length === 0)
    const ok = await call('/seller/payout/request', { shopId: '1', amount: 100000 })
    assert.equal(ok.status, 201)
    assert.ok(sqlOf('AS completed_gross')[0].includes('* 5 / 100'))
    db.completedGross = 99999
    const tooMuch = await call('/seller/payout/request', { shopId: '1', amount: 100000 })
    assert.equal(tooMuch.status, 400)
    assert.equal(tooMuch.body.error.code, 'INSUFFICIENT_BALANCE')
    assert.equal(tooMuch.body.error.available, 99999)
  })
  await check('báo cáo doanh thu: đơn delivered và completed đều tính, đơn khác thì không', async () => {
    const row = (id, status, subtotal, discount) => ({ shop_order_id: id, order_id: id, order_code: `NS${id}`, status, subtotal, shipping_fee: 30000, discount_amount: discount, total_amount: Number(subtotal) - Number(discount) + 30000, shipping_method: 'nhanh', shipping_name: 'Nhanh', tracking_code: null, created_at: new Date('2026-11-18T00:00:00.000Z'), customer_name: 'An', customer_phone: '0900000000' })
    db.orders = [row(1, 'delivered', '110000', '10000'), row(2, 'completed', '200000', '0'), row(3, 'shipping', '500000', '0'), row(4, 'cancelled', '300000', '0')]
    const result = await call('/seller/reports/revenue?shopId=1')
    assert.equal(result.status, 200)
    const { summary, orders } = result.body.data
    assert.equal(summary.totalOrders, 4)
    assert.equal(summary.deliveredOrders, 2)
    assert.equal(summary.totalSubtotal, 310000)
    assert.equal(summary.totalDiscount, 10000)
    assert.equal(summary.totalCommission, 5000 + 10000)
    assert.equal(summary.totalPayout, 95000 + 190000)
    assert.equal(summary.commissionRate, 5)
    assert.equal(orders[0].sellerPayout, 95000)
    assert.equal(orders[1].sellerPayout, 190000)
  })

  console.log(`\nSeller income Data API: ${passed} kiểm tra PASS (database giả lập).`)
} catch (error) {
  console.error('\n✗ THẤT BẠI:', error)
  process.exitCode = 1
} finally {
  server.closeAllConnections?.()
  await new Promise((resolve) => server.close(resolve))
  await closeDatabase()
}
