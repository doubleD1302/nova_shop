import assert from 'node:assert/strict'
import http from 'node:http'

// Kiểm tra HTTP của Data API cho Tài chính, Quảng cáo và Chăm sóc khách hàng của seller.
// Database được giả lập nên bài này kiểm tra validation, phân quyền shop và hình dạng dữ liệu,
// không chứng minh cú pháp SQL chạy đúng trên MySQL thật.
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-seller-center-test.env', DB_USER: 'test', DB_PASSWORD: 'seller-center-test-password', DATA_API_KEY: 'seller-center-test-service-key' })
const { sequelize, closeDatabase } = await import('../src/config/database.js')
const { default: app } = await import('../src/app.js')

// Dữ liệu giả lập, mỗi bài chỉnh lại trước khi gọi
const db = {
  shopExists: true,
  income: [],
  refunds: [],
  payouts: [],
  product: { id: 7, shop_id: 1, name: 'Tai nghe', slug: 'tai-nghe', status: 'active', approval_status: 'approved' },
  runningBoost: false,
  review: { id: 5, user_id: 9, product_id: 7, status: 'visible', seller_reply: null },
  shopOwned: true,
  boostRows: [],
  regRows: [],
  chartRows: [],
  totalRows: [{ distinct_orders: 0, distinct_units: 0, distinct_revenue: 0 }],
  spendRows: [{ total_boosts: 0, total_spend: 0, active_boosts: 0 }],
}
const log = []

const conn = {
  query({ sql }, values, callback) {
    log.push({ sql, values })
    let rows = []
    if (sql.startsWith('START') || sql.startsWith('COMMIT') || sql.startsWith('ROLLBACK')) rows = []
    // Dashboard: tên shop và số liệu biểu đồ theo ngày
    else if (sql.includes('SELECT id, name FROM shops')) rows = [{ id: 1, name: 'Shop' }]
    else if (sql.includes("DATE_FORMAT(created_at, '%Y-%m-%d') AS order_date")) rows = db.chartRows
    // Lịch sử giao dịch
    else if (sql.includes('SELECT id FROM shops WHERE id = ? LIMIT 1')) rows = db.shopExists ? [{ id: 1 }] : []
    else if (sql.includes('COUNT(*) AS total FROM shop_orders so')) rows = [{ total: db.income.length }]
    else if (sql.includes('FROM shop_orders so') && sql.includes('past_hold')) rows = db.income
    else if (sql.includes('COUNT(*) AS total FROM order_returns ret')) rows = [{ total: db.refunds.length }]
    else if (sql.includes('FROM order_returns ret') && sql.includes('refund_amount, ret.updated_at')) rows = db.refunds
    else if (sql.includes('COUNT(*) AS total FROM seller_payout_requests')) rows = [{ total: db.payouts.length }]
    else if (sql.includes('FROM seller_payout_requests pr')) rows = db.payouts
    // Gói đẩy và hiệu quả quảng cáo
    else if (sql.includes('AS distinct_orders')) rows = db.totalRows
    else if (sql.includes('AS total_boosts')) rows = db.spendRows
    else if (sql.includes('FROM products WHERE id = ? FOR UPDATE')) rows = db.product ? [db.product] : []
    else if (sql.includes('FROM product_boosts') && sql.includes('LIMIT 1')) rows = db.runningBoost ? [{ id: 1 }] : []
    else if (sql.includes('INSERT INTO product_boosts')) rows = { insertId: 99 }
    else if (sql.includes('FROM product_boosts b')) rows = db.boostRows
    else if (sql.includes('FROM campaign_registrations r')) rows = db.regRows
    // Đánh giá
    else if (sql.includes('SELECT id FROM shops WHERE id = ? AND owner_id = ?')) rows = db.shopOwned ? [{ id: 1 }] : []
    else if (sql.includes('FROM reviews WHERE id = ? FOR UPDATE')) rows = db.review ? [db.review] : []
    else if (sql.includes('FROM products WHERE id = ? LIMIT 1')) rows = db.product ? [db.product] : []
    else if (sql.includes('UPDATE reviews SET seller_reply')) rows = { affectedRows: 1 }
    else if (sql.includes('SELECT replied_at FROM reviews')) rows = [{ replied_at: new Date('2026-11-19T03:00:00.000Z') }]
    else if (sql.includes('COUNT(*) AS total FROM reviews r')) rows = [{ total: 2 }]
    else if (sql.includes('FROM review_images')) rows = [{ review_id: 5, url: '/uploads/review-9-a.png' }]
    else if (sql.includes('AVG(r.rating)')) rows = [{ total: 3, average: '4.3333', unreplied: '2', star1: '0', star2: '0', star3: '1', star4: '0', star5: '2' }]
    else if (sql.includes('FROM reviews r')) rows = [
      { id: 5, product_id: 7, rating: 5, comment: 'Rất tốt', created_at: new Date('2026-11-18T01:00:00.000Z'), seller_reply: null, replied_at: null, product_name: 'Tai nghe', buyer_name: 'An', variant_name: 'Đen' },
      { id: 4, product_id: 7, rating: 3, comment: 'Tạm ổn', created_at: new Date('2026-11-17T01:00:00.000Z'), seller_reply: 'Cảm ơn bạn', replied_at: new Date('2026-11-17T05:00:00.000Z'), product_name: 'Tai nghe', buyer_name: 'Bình', variant_name: 'Trắng' },
    ]
    // Trả hàng của seller
    else if (sql.includes('SELECT id FROM shops WHERE owner_id = ?')) rows = [{ id: 1 }]
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
const ran = (text) => log.filter((entry) => entry.sql.includes(text)).length

let passed = 0
function check(name, fn) {
  return Promise.resolve(fn()).then(() => { passed++; console.log(`  ✓ ${name}`) })
}

try {
  console.log('--- Tài chính: lịch sử giao dịch ---')
  await check('từ chối shopId, loại, ngày, limit không hợp lệ (HTTP 400)', async () => {
    for (const query of ['shopId=abc', 'shopId=1&type=bank', 'shopId=1&startDate=hôm-nay', 'shopId=1&startDate=2026-11-20&endDate=2026-11-01',
      'shopId=1&startDate=2026-11-01T00:00:00', 'shopId=1&endDate=2026-11-01T10:00',
      'shopId=1&limit=0', 'shopId=1&limit=101', 'shopId=1&limit=100&offset=901']) {
      assert.equal((await call(`/seller/finance/transactions?${query}`)).status, 400, query)
    }
  })
  await check('ngày giờ có múi giờ (Z hoặc +07:00) được chấp nhận', async () => {
    assert.equal((await call('/seller/finance/transactions?shopId=1&startDate=2026-11-01T00:00:00Z&endDate=2026-11-30T23:59:59%2B07:00')).status, 200)
  })
  await check('shop không tồn tại trả 404 SHOP_NOT_FOUND', async () => {
    db.shopExists = false
    const result = await call('/seller/finance/transactions?shopId=1')
    db.shopExists = true
    assert.equal(result.status, 404)
    assert.equal(result.body.error.code, 'SHOP_NOT_FOUND')
  })

  db.income = [
    { id: 11, order_code: 'NS11', total_amount: '300000', delivered_at: new Date('2026-11-10T00:00:00.000Z'), past_hold: 1, has_open_return: 0 },
    { id: 12, order_code: 'NS12', total_amount: '200000', delivered_at: new Date('2026-11-18T00:00:00.000Z'), past_hold: 0, has_open_return: 0 },
    { id: 13, order_code: 'NS13', total_amount: '100000', delivered_at: new Date('2026-11-01T00:00:00.000Z'), past_hold: 1, has_open_return: 1 },
  ]
  db.refunds = [{ id: 3, refund_amount: '50000', updated_at: new Date('2026-11-12T00:00:00.000Z'), order_code: 'NS11' }]
  db.payouts = [{ id: 2, payout_code: 'PO-2', amount: '150000', status: 'pending', created_at: new Date('2026-11-15T00:00:00.000Z') }]

  await check('gộp 3 nguồn, mới nhất trước, tiền ra là số âm', async () => {
    const result = await call('/seller/finance/transactions?shopId=1')
    assert.equal(result.status, 200)
    const { items, total } = result.body.data
    assert.equal(total, 5)
    assert.deepEqual(items.map((item) => item.id), ['order_income-12', 'payout-2', 'refund-3', 'order_income-11', 'order_income-13'])
    assert.equal(items.find((item) => item.type === 'refund').amount, -50000)
    assert.equal(items.find((item) => item.type === 'payout').amount, -150000)
    assert.equal(items.find((item) => item.id === 'order_income-11').amount, 300000)
  })
  await check('cùng thời điểm thì xếp id số lớn trước (10 trước 9), không theo thứ tự chuỗi', async () => {
    const saved = db.income
    const at = new Date('2026-11-18T00:00:00.000Z')
    db.income = [9, 10].map((id) => ({ id, order_code: `NS${id}`, total_amount: '1000', delivered_at: at, past_hold: 1, has_open_return: 0 }))
    db.refunds = []
    db.payouts = []
    const { items } = (await call('/seller/finance/transactions?shopId=1')).body.data
    db.income = saved
    db.refunds = [{ id: 3, refund_amount: '50000', updated_at: new Date('2026-11-12T00:00:00.000Z'), order_code: 'NS11' }]
    db.payouts = [{ id: 2, payout_code: 'PO-2', amount: '150000', status: 'pending', created_at: new Date('2026-11-15T00:00:00.000Z') }]
    assert.deepEqual(items.map((item) => item.id), ['order_income-10', 'order_income-9'])
  })
  await check('trạng thái tiền đơn: available / escrow (đang giữ hoặc đang trả hàng)', async () => {
    const { items } = (await call('/seller/finance/transactions?shopId=1&type=order_income')).body.data
    const byId = Object.fromEntries(items.map((item) => [item.id, item.status]))
    assert.equal(byId['order_income-11'], 'available')
    assert.equal(byId['order_income-12'], 'escrow')
    assert.equal(byId['order_income-13'], 'escrow')
  })
  await check('lọc theo loại chỉ truy vấn nguồn tương ứng', async () => {
    log.length = 0
    const result = await call('/seller/finance/transactions?shopId=1&type=refund')
    assert.equal(result.body.data.items.length, 1)
    assert.equal(ran('seller_payout_requests'), 0)
    assert.equal(ran("so.status IN ('delivered', 'completed')"), 0)
  })
  await check('phân trang bằng limit/offset và truyền khoảng ngày vào truy vấn', async () => {
    log.length = 0
    const result = await call('/seller/finance/transactions?shopId=1&limit=2&offset=1&startDate=2026-11-01&endDate=2026-11-19')
    assert.deepEqual(result.body.data.items.map((item) => item.id), ['payout-2', 'refund-3'])
    assert.equal(result.body.data.total, 5)
    const rangeQuery = log.find((entry) => entry.sql.includes('FROM seller_payout_requests pr') && entry.sql.includes('LIMIT'))
    assert.ok(rangeQuery.sql.includes('pr.created_at >= ?') && rangeQuery.sql.includes('pr.created_at <= ?'))
    assert.equal(rangeQuery.values[rangeQuery.values.length - 1], 3, 'mỗi nguồn lấy offset + limit dòng')
    assert.equal(rangeQuery.values[2].toISOString(), '2026-11-19T23:59:59.999Z', 'endDate chỉ có ngày được hiểu là hết ngày')
  })

  console.log('--- Quảng cáo: gói đẩy và hiệu quả ---')
  await check('mua gói đẩy sản phẩm đã duyệt thành công, khóa dòng sản phẩm', async () => {
    log.length = 0
    const result = await call('/seller/marketing/boost', { shopId: '1', productId: '7', packageType: 'basic_1d' })
    assert.equal(result.status, 201)
    assert.equal(result.body.data.boostId, '99')
    assert.equal(ran('FOR UPDATE'), 1)
    assert.equal(ran('INSERT INTO product_boosts'), 1)
  })
  await check('chặn sản phẩm chưa duyệt hoặc đang ẩn (400 PRODUCT_NOT_ELIGIBLE)', async () => {
    for (const patch of [{ approval_status: 'pending' }, { status: 'draft' }]) {
      const saved = db.product
      db.product = { ...saved, ...patch }
      log.length = 0
      const result = await call('/seller/marketing/boost', { shopId: '1', productId: '7', packageType: 'basic_1d' })
      db.product = saved
      assert.equal(result.status, 400)
      assert.equal(result.body.error.code, 'PRODUCT_NOT_ELIGIBLE')
      assert.equal(ran('INSERT INTO product_boosts'), 0)
    }
  })
  await check('chặn sản phẩm của shop khác (403) và sản phẩm không tồn tại (404)', async () => {
    assert.equal((await call('/seller/marketing/boost', { shopId: '2', productId: '7', packageType: 'basic_1d' })).status, 403)
    const saved = db.product
    db.product = null
    const missing = await call('/seller/marketing/boost', { shopId: '1', productId: '7', packageType: 'basic_1d' })
    db.product = saved
    assert.equal(missing.status, 404)
  })
  await check('chặn mua trùng khi còn gói đang chạy (409 BOOST_ALREADY_ACTIVE)', async () => {
    db.runningBoost = true
    log.length = 0
    const result = await call('/seller/marketing/boost', { shopId: '1', productId: '7', packageType: 'basic_1d' })
    db.runningBoost = false
    assert.equal(result.status, 409)
    assert.equal(result.body.error.code, 'BOOST_ALREADY_ACTIVE')
    assert.equal(ran('INSERT INTO product_boosts'), 0)
  })
  await check('báo cáo hiệu quả: không có gói đẩy thì ratio là null và đếm đủ trạng thái hồ sơ', async () => {
    db.boostRows = []
    db.regRows = [{ status: 'pending', total: 2 }, { status: 'approved', total: 1 }]
    const result = await call('/seller/marketing/analytics?shopId=1')
    assert.equal(result.status, 200)
    assert.equal(result.body.data.summary.totalSpend, 0)
    assert.equal(result.body.data.summary.revenueToSpendRatio, null)
    assert.deepEqual(result.body.data.registrations, { pending: 2, approved: 1, rejected: 0, total: 3 })
    assert.equal(result.body.data.truncated, false)
  })
  await check('báo cáo hiệu quả: tổng tính riêng nên đơn nằm trong nhiều gói không bị đếm lặp', async () => {
    const make = (id, cost, revenue, expired) => ({
      id, product_id: 7, product_name: 'Tai nghe', package_type: 'basic_1d', status: 'active',
      starts_at: new Date('2026-11-10T00:00:00.000Z'), ends_at: new Date('2026-11-11T00:00:00.000Z'), created_at: new Date('2026-11-10T00:00:00.000Z'),
      cost_vnd: cost, is_expired: expired, orders_count: 2, units_sold: 3, revenue,
    })
    db.boostRows = [make(2, '50000', '400000', 0), make(1, '50000', '100000', 1)]
    // Tổng các gói là 500000 nhưng một số đơn thuộc cả hai gói, nên tổng không trùng chỉ là 450000
    db.totalRows = [{ distinct_orders: 3, distinct_units: 4, distinct_revenue: '450000' }]
    db.spendRows = [{ total_boosts: 2, total_spend: '100000', active_boosts: '1' }]
    log.length = 0
    const { summary, boosts } = (await call('/seller/marketing/analytics?shopId=1&startDate=2026-11-01&endDate=2026-11-30')).body.data
    assert.equal(summary.totalBoosts, 2)
    assert.equal(summary.activeBoosts, 1)
    assert.equal(summary.totalSpend, 100000)
    assert.equal(summary.ordersDuringBoost, 3)
    assert.equal(summary.unitsDuringBoost, 4)
    assert.equal(summary.revenueDuringBoost, 450000)
    assert.equal(summary.revenueToSpendRatio, 4.5)
    assert.equal(boosts[0].revenueToSpendRatio, 8)
    assert.equal(boosts[1].status, 'expired')
    assert.ok(!('impressions' in summary) && !('clicks' in summary), 'không bịa số lượt xem/nhấp')
    const totalsQuery = log.find((entry) => entry.sql.includes('AS distinct_orders'))
    assert.ok(totalsQuery.sql.includes('EXISTS') && totalsQuery.sql.includes('b.created_at >= ?') && totalsQuery.sql.includes('b.created_at <= ?'), 'tổng cũng lọc theo khoảng ngày')
    db.totalRows = [{ distinct_orders: 0, distinct_units: 0, distinct_revenue: 0 }]
    db.spendRows = [{ total_boosts: 0, total_spend: 0, active_boosts: 0 }]
  })
  await check('báo cáo hiệu quả: số gói và chi phí không bị cắt theo giới hạn 200 gói của danh sách', async () => {
    db.boostRows = []
    db.totalRows = [{ distinct_orders: 10, distinct_units: 10, distinct_revenue: '1000000' }]
    db.spendRows = [{ total_boosts: 350, total_spend: '17500000', active_boosts: 4 }]
    const data = (await call('/seller/marketing/analytics?shopId=1')).body.data
    db.totalRows = [{ distinct_orders: 0, distinct_units: 0, distinct_revenue: 0 }]
    db.spendRows = [{ total_boosts: 0, total_spend: 0, active_boosts: 0 }]
    assert.equal(data.summary.totalBoosts, 350)
    assert.equal(data.summary.totalSpend, 17500000)
    assert.equal(data.summary.revenueToSpendRatio, Number((1000000 / 17500000).toFixed(2)))
  })
  await check('báo cáo hiệu quả từ chối shopId hoặc ngày sai (HTTP 400)', async () => {
    assert.equal((await call('/seller/marketing/analytics?shopId=x')).status, 400)
    assert.equal((await call('/seller/marketing/analytics?shopId=1&endDate=abc')).status, 400)
  })

  console.log('--- Chăm sóc khách hàng: đánh giá ---')
  await check('danh sách đánh giá kèm ảnh, phản hồi và thống kê toàn shop', async () => {
    const result = await call('/seller/reviews?shopId=1')
    assert.equal(result.status, 200)
    const { items, summary } = result.body.data
    assert.equal(items.length, 2)
    assert.deepEqual(items[0].images, ['/uploads/review-9-a.png'])
    assert.equal(items[0].sellerReply, null)
    assert.equal(items[1].sellerReply, 'Cảm ơn bạn')
    assert.equal(summary.unreplied, 2)
    assert.equal(summary.byRating[5], 2)
    assert.equal(summary.averageRating, 4.33)
  })
  await check('bộ lọc rating/replied/productId được đưa vào truy vấn', async () => {
    log.length = 0
    assert.equal((await call('/seller/reviews?shopId=1&rating=5&replied=false&productId=7')).status, 200)
    const query = log.find((entry) => entry.sql.includes('ORDER BY r.created_at DESC'))
    assert.ok(query.sql.includes('r.rating = ?') && query.sql.includes('r.seller_reply IS NULL') && query.sql.includes('r.product_id = ?'))
    assert.ok(query.sql.includes("r.status = 'visible'"), 'không lộ đánh giá đã bị ẩn')
  })
  await check('từ chối bộ lọc đánh giá không hợp lệ (HTTP 400)', async () => {
    for (const query of ['shopId=1&rating=6', 'shopId=1&rating=0', 'shopId=1&replied=maybe', 'shopId=1&productId=abc', 'shopId=1&limit=0', 'shopId=y']) {
      assert.equal((await call(`/seller/reviews?${query}`)).status, 400, query)
    }
  })

  const reply = { shopId: '1', userId: '2', reply: 'Cảm ơn bạn đã ủng hộ shop!' }
  await check('trả lời đánh giá thành công, trả thông tin để gửi thông báo cho người mua', async () => {
    log.length = 0
    const result = await call('/seller/reviews/5/reply', reply)
    assert.equal(result.status, 201)
    assert.equal(result.body.data.sellerReply, reply.reply)
    assert.equal(result.body.data.buyerId, '9')
    assert.equal(result.body.data.productSlug, 'tai-nghe')
    assert.equal(ran('UPDATE reviews SET seller_reply'), 1)
  })
  await check('từ chối nội dung rỗng, quá dài, sai kiểu hoặc reviewId sai (HTTP 400)', async () => {
    for (const body of [{ ...reply, reply: '   ' }, { ...reply, reply: 'a'.repeat(1001) }, { ...reply, reply: 123 }, { ...reply, shopId: 'x' }]) {
      assert.equal((await call('/seller/reviews/5/reply', body)).status, 400)
    }
    assert.equal((await call('/seller/reviews/abc/reply', reply)).status, 400)
  })
  await check('người không phải chủ shop bị chặn (403)', async () => {
    db.shopOwned = false
    log.length = 0
    const result = await call('/seller/reviews/5/reply', reply)
    db.shopOwned = true
    assert.equal(result.status, 403)
    assert.equal(ran('UPDATE reviews SET seller_reply'), 0)
  })
  await check('đánh giá của shop khác, không tồn tại hoặc đã ẩn đều trả 404', async () => {
    const saved = db.review
    for (const review of [null, { ...saved, status: 'hidden' }]) {
      db.review = review
      assert.equal((await call('/seller/reviews/5/reply', reply)).status, 404)
    }
    db.review = saved
    db.product = { ...db.product, shop_id: 2 }
    log.length = 0
    const other = await call('/seller/reviews/5/reply', reply)
    db.product = { ...db.product, shop_id: 1 }
    assert.equal(other.status, 404)
    assert.equal(other.body.error.code, 'REVIEW_NOT_FOUND')
    assert.equal(ran('UPDATE reviews SET seller_reply'), 0)
  })
  await check('mỗi đánh giá chỉ trả lời một lần (409 REVIEW_ALREADY_REPLIED)', async () => {
    const saved = db.review
    db.review = { ...saved, seller_reply: 'Đã trả lời' }
    log.length = 0
    const result = await call('/seller/reviews/5/reply', reply)
    db.review = saved
    assert.equal(result.status, 409)
    assert.equal(result.body.error.code, 'REVIEW_ALREADY_REPLIED')
    assert.equal(ran('UPDATE reviews SET seller_reply'), 0)
  })

  console.log('--- Dashboard: biểu đồ doanh thu theo ngày ---')
  await check('biểu đồ mặc định 7 ngày, đủ từng ngày kể cả ngày không có đơn', async () => {
    const today = new Date().toISOString().slice(0, 10)
    db.chartRows = [{ order_date: today, orders: 3, revenue: '900000' }]
    const { chart } = (await call('/seller/dashboard?shopId=1')).body.data
    assert.equal(chart.length, 7)
    assert.equal(chart[6].date, today)
    assert.equal(chart[6].revenue, 900000)
    assert.equal(chart[6].orders, 3)
    assert.deepEqual(chart[0], { date: chart[0].date, label: `${chart[0].date.slice(8, 10)}/${chart[0].date.slice(5, 7)}`, orders: 0, revenue: 0 })
  })
  await check('days=30 trả 30 ngày và truy vấn lùi 29 ngày', async () => {
    log.length = 0
    const { chart } = (await call('/seller/dashboard?shopId=1&days=30')).body.data
    assert.equal(chart.length, 30)
    assert.ok(log.some((entry) => entry.sql.includes('INTERVAL 29 DAY')))
  })
  await check('days khác 7 hoặc 30 bị từ chối (HTTP 400)', async () => {
    for (const days of ['14', '0', 'abc', '30;DROP']) assert.equal((await call(`/seller/dashboard?shopId=1&days=${days}`)).status, 400, days)
    db.chartRows = []
  })

  console.log('--- Chăm sóc khách hàng: khiếu nại trả hàng ---')
  await check('seller lọc được yêu cầu trả hàng đang tranh chấp (disputed)', async () => {
    assert.equal((await call('/seller/returns?userId=2&status=disputed')).status, 200)
    assert.equal((await call('/seller/returns?userId=2&status=bogus')).status, 400)
  })

  console.log(`\nSeller center Data API: ${passed} kiểm tra PASS (database giả lập).`)
} finally {
  await new Promise((resolve) => server.close(resolve))
  await closeDatabase()
}
