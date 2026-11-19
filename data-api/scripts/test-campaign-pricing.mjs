import assert from 'node:assert/strict'

// Kiểm tra logic áp giá và hoàn giá chiến dịch (utils/campaign-pricing.js) bằng database giả lập có trạng thái.
// Giả lập đọc câu SQL theo từng đoạn đặc trưng, nên bài này kiểm tra luồng nghiệp vụ, không chứng minh SQL
// chạy đúng trên MySQL thật (xem docs/backend/ADMIN_CAMPAIGNS.md để biết phần đã kiểm trên database thật).
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-campaign-pricing-test.env', DB_USER: 'test', DB_PASSWORD: 'campaign-pricing-test-password', DATA_API_KEY: 'campaign-pricing-test-service-key' })
const { syncCampaignPrices } = await import('../src/utils/campaign-pricing.js')
const { closeDatabase } = await import('../src/config/database.js')

const T = (text) => new Date(text)
let db
function reset() {
  db = {
    now: T('2026-11-20T00:00:00.000Z'),
    campaigns: { 1: { type: 'flash_sale', is_active: 1, starts_at: T('2026-11-01T00:00:00.000Z'), ends_at: T('2026-12-01T00:00:00.000Z') } },
    products: { 7: { status: 'active', approval: 'approved', flash: 0 } },
    variants: [
      { id: 71, product_id: 7, price: '100000', original_price: null, is_active: 1 },
      { id: 72, product_id: 7, price: '50000', original_price: null, is_active: 1 },
    ],
    regs: { 8: { id: 8, campaign_id: 1, product_id: 7, discount_price: '80000', status: 'approved', price_snapshot: null, applied_at: null, reverted_at: null } },
    failOn: null,
  }
}
const running = (c) => c.is_active === 1 && c.starts_at <= db.now && c.ends_at > db.now
const finished = (c) => c.is_active === 0 || c.ends_at <= db.now

async function run(sql, values = []) {
  const reg = (id) => db.regs[id]
  if (sql.includes('SELECT r.id FROM campaign_registrations r') && sql.includes('r.applied_at IS NOT NULL AND r.reverted_at IS NULL AND (c.is_active = 0')) {
    return Object.values(db.regs).filter((r) => r.applied_at && !r.reverted_at && finished(db.campaigns[r.campaign_id])).map((r) => ({ id: r.id }))
  }
  if (sql.includes('SELECT r.id FROM campaign_registrations r') && sql.includes("r.status = 'approved'")) {
    return Object.values(db.regs).filter((r) => r.status === 'approved' && (!r.applied_at || r.reverted_at) && running(db.campaigns[r.campaign_id])).map((r) => ({ id: r.id }))
  }
  if (sql.includes('c.type AS campaign_type') && sql.includes('FOR UPDATE')) {
    if (db.failOn === String(values[0])) throw new Error('lỗi giả lập')
    const r = reg(values[0])
    if (!r) return []
    const c = db.campaigns[r.campaign_id]
    const p = db.products[r.product_id]
    return [{ ...r, campaign_type: c.type, running: running(c) ? 1 : 0, finished: finished(c) ? 1 : 0, product_status: p.status, product_approval: p.approval, is_flash_sale: p.flash }]
  }
  if (sql.includes('WHERE product_id = ? AND id <> ? AND applied_at IS NOT NULL')) {
    return Object.values(db.regs).filter((r) => String(r.product_id) === String(values[0]) && String(r.id) !== String(values[1]) && r.applied_at && !r.reverted_at).map((r) => ({ id: r.id }))
  }
  if (sql.includes('JOIN marketing_campaigns oc')) {
    return Object.values(db.regs).filter((r) => String(r.product_id) === String(values[0]) && String(r.id) !== String(values[1]) && r.applied_at && !r.reverted_at && db.campaigns[r.campaign_id].type === 'flash_sale').map((r) => ({ id: r.id }))
  }
  if (sql.includes('FROM product_variants WHERE product_id = ?')) return db.variants.filter((v) => String(v.product_id) === String(values[0]) && v.is_active).map((v) => ({ ...v }))
  if (sql.startsWith('UPDATE product_variants SET price = ?, original_price = ? WHERE id = ? AND price = ?')) {
    const v = db.variants.find((x) => String(x.id) === String(values[2]))
    if (v && Number(v.price) === Number(values[3])) { v.price = String(values[0]); v.original_price = values[1] === null ? null : String(values[1]) }
    return { affectedRows: 1 }
  }
  if (sql.startsWith('UPDATE product_variants SET price = ?, original_price = ? WHERE id = ?')) {
    const v = db.variants.find((x) => String(x.id) === String(values[2]))
    v.price = String(values[0]); v.original_price = String(values[1])
    return { affectedRows: 1 }
  }
  if (sql.startsWith('UPDATE products SET is_flash_sale = 1')) { db.products[values[0]].flash = 1; return { affectedRows: 1 } }
  if (sql.startsWith('UPDATE products SET is_flash_sale = 0')) { db.products[values[0]].flash = 0; return { affectedRows: 1 } }
  if (sql.startsWith('UPDATE campaign_registrations SET price_snapshot')) {
    Object.assign(reg(values[1]), { price_snapshot: values[0], applied_at: db.now, reverted_at: null })
    return { affectedRows: 1 }
  }
  if (sql.startsWith('UPDATE campaign_registrations SET reverted_at')) { reg(values[0]).reverted_at = db.now; return { affectedRows: 1 } }
  throw new Error('Câu SQL ngoài dự kiến: ' + sql.slice(0, 80))
}
const sync = () => syncCampaignPrices({ query: run, transaction: (fn) => fn(run), checkMigration: false })
const price = (id) => db.variants.find((v) => v.id === id)
const shown = (id) => [Number(price(id).price), price(id).original_price === null ? null : Number(price(id).original_price)]

let passed = 0
async function check(name, fn) {
  reset()
  await fn()
  passed++
  console.log(`  ✓ ${name}`)
}

try {
  await check('chưa chạy migration (thiếu cột applied_at): bỏ qua, không đụng giá', async () => {
    const result = await syncCampaignPrices({ query: async () => [], transaction: () => { throw new Error('không được ghi') } })
    assert.deepEqual(result, { skipped: true, reason: 'MIGRATION_PENDING', applied: 0, reverted: 0 })
  })
  await check('áp giá: hạ biến thể cao hơn giá khuyến mãi, giá cũ thành giá gạch ngang, bật Flash Sale', async () => {
    assert.deepEqual(await sync(), { applied: 1, reverted: 0, failed: 0 })
    assert.deepEqual(shown(71), [80000, 100000])
    assert.deepEqual(shown(72), [50000, null], 'biến thể rẻ hơn giá khuyến mãi giữ nguyên')
    assert.equal(db.products[7].flash, 1)
    const snapshot = JSON.parse(db.regs[8].price_snapshot)
    assert.deepEqual(snapshot, { variants: [{ id: '71', price: 100000, originalPrice: null }], flash: 0 })
    assert.ok(db.regs[8].applied_at)
  })
  await check('chạy lại không áp hai lần', async () => {
    await sync()
    assert.deepEqual(await sync(), { applied: 0, reverted: 0, failed: 0 })
    assert.deepEqual(shown(71), [80000, 100000])
  })
  await check('giá gạch ngang cũ được giữ nguyên', async () => {
    db.variants[0].original_price = '120000'
    await sync()
    assert.deepEqual(shown(71), [80000, 120000])
  })
  await check('chiến dịch chưa bắt đầu thì chờ, đến giờ mới áp', async () => {
    db.campaigns[1].starts_at = T('2026-11-25T00:00:00.000Z')
    assert.equal((await sync()).applied, 0)
    assert.deepEqual(shown(71), [100000, null])
    db.now = T('2026-11-26T00:00:00.000Z')
    assert.equal((await sync()).applied, 1)
    assert.deepEqual(shown(71), [80000, 100000])
  })
  await check('đăng ký chưa duyệt, bị từ chối hoặc sản phẩm chưa kiểm duyệt thì không áp', async () => {
    for (const status of ['pending', 'rejected']) { db.regs[8].status = status; assert.equal((await sync()).applied, 0) }
    db.regs[8].status = 'approved'
    db.products[7].approval = 'pending'
    assert.equal((await sync()).applied, 0)
    db.products[7].approval = 'approved'
    db.products[7].status = 'hidden'
    assert.equal((await sync()).applied, 0)
    assert.deepEqual(shown(71), [100000, null])
    db.products[7].status = 'active'
    assert.equal((await sync()).applied, 1, 'đủ điều kiện thì lần sau áp được')
  })
  await check('không biến thể nào cao hơn giá khuyến mãi: đánh dấu đã xử lý, không bật Flash Sale', async () => {
    db.regs[8].discount_price = '50000'
    db.variants[0].price = '50000'
    assert.deepEqual(await sync(), { applied: 1, reverted: 0, failed: 0 })
    assert.equal(db.products[7].flash, 0)
    assert.deepEqual(JSON.parse(db.regs[8].price_snapshot), { variants: [], flash: null })
    assert.equal((await sync()).applied, 0)
  })
  await check('hết hạn: hoàn giá và tắt Flash Sale do chiến dịch bật', async () => {
    await sync()
    db.now = T('2026-12-02T00:00:00.000Z')
    assert.deepEqual(await sync(), { applied: 0, reverted: 1, failed: 0 })
    assert.deepEqual(shown(71), [100000, null])
    assert.equal(db.products[7].flash, 0)
    assert.ok(db.regs[8].reverted_at)
    assert.equal((await sync()).reverted, 0, 'hoàn giá chỉ một lần')
  })
  await check('hết hạn: shop đã tự đổi giá thì giữ giá shop đặt; Flash Sale có sẵn vẫn giữ', async () => {
    db.products[7].flash = 1
    await sync()
    db.variants[0].price = '90000' // shop sửa giá trong lúc chiến dịch chạy
    db.now = T('2026-12-02T00:00:00.000Z')
    await sync()
    assert.deepEqual(shown(71), [90000, 100000])
    assert.equal(db.products[7].flash, 1)
  })
  await check('tắt chiến dịch giữa chừng: hoàn giá; bật lại: áp lại', async () => {
    await sync()
    db.campaigns[1].is_active = 0
    assert.equal((await sync()).reverted, 1)
    assert.deepEqual(shown(71), [100000, null])
    db.campaigns[1].is_active = 1
    assert.equal((await sync()).applied, 1)
    assert.deepEqual(shown(71), [80000, 100000])
    assert.equal(db.regs[8].reverted_at, null)
  })
  await check('hai đăng ký cùng sản phẩm: đăng ký sau chờ đến khi đăng ký trước được hoàn giá', async () => {
    db.campaigns[2] = { type: 'mega_sale', is_active: 1, starts_at: T('2026-11-01T00:00:00.000Z'), ends_at: T('2027-01-01T00:00:00.000Z') }
    db.regs[9] = { id: 9, campaign_id: 2, product_id: 7, discount_price: '70000', status: 'approved', price_snapshot: null, applied_at: null, reverted_at: null }
    assert.equal((await sync()).applied, 1)
    assert.deepEqual(shown(71), [80000, 100000], 'đăng ký 8 áp trước')
    assert.equal(db.regs[9].applied_at, null)
    db.now = T('2026-12-02T00:00:00.000Z') // chiến dịch 1 hết hạn
    assert.deepEqual(await sync(), { applied: 1, reverted: 1, failed: 0 })
    assert.deepEqual(shown(71), [70000, 100000], 'giá hoàn về gốc rồi mới áp giá chiến dịch 2')
    assert.equal(db.products[7].flash, 0, 'chiến dịch mega_sale không bật Flash Sale')
  })
  await check('một đăng ký lỗi không chặn các đăng ký còn lại', async () => {
    db.products[8] = { status: 'active', approval: 'approved', flash: 0 }
    db.variants.push({ id: 81, product_id: 8, price: '100000', original_price: null, is_active: 1 })
    db.regs[10] = { id: 10, campaign_id: 1, product_id: 8, discount_price: '60000', status: 'approved', price_snapshot: null, applied_at: null, reverted_at: null }
    db.failOn = '8'
    const result = await sync()
    assert.deepEqual(result, { applied: 1, reverted: 0, failed: 1 })
    assert.deepEqual(shown(81), [60000, 100000])
    assert.deepEqual(shown(71), [100000, null])
  })

  console.log(`\nCampaign pricing: ${passed} kiểm tra PASS (database giả lập có trạng thái).`)
} catch (error) {
  console.error('\n✗ THẤT BẠI:', error)
  process.exitCode = 1
} finally {
  await closeDatabase()
}
