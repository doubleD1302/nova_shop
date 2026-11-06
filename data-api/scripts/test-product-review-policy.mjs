import assert from 'node:assert/strict'
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-product-review-test.env', DB_USER: 'test', DB_PASSWORD: 'product-review-test-password', DATA_API_KEY: 'product-review-test-key' })
const { sequelize, closeDatabase } = await import('../src/config/database.js')
const { saveSellerProduct } = await import('../src/controllers/products.controller.js')
const calls = []
const oldUrl = '/uploads/00000000-0000-4000-8000-000000000001.png'
const ownUrls = [2, 3, 4, 5].map((n) => `/uploads/product-2-00000000-0000-4000-8000-00000000000${n}.png`)
const conn = {
  query({ sql }, values, callback) {
    calls.push({ sql, values })
    let rows = []
    if (sql.includes('information_schema.columns')) rows = [{ present: 1 }]
    else if (sql.includes('SELECT id, status,') && sql.includes('FROM shops')) rows = [{ id: '1', status: 'active' }]
    else if (sql.includes('SELECT id FROM categories')) rows = [{ id: '1' }]
    else if (sql.includes('SELECT id FROM products WHERE')) rows = [{ id: '7' }]
    else if (sql.includes('SELECT url FROM product_images')) rows = [{ url: oldUrl }]
    else if (sql.includes('SELECT id, category_id, status,')) rows = [{ id: '7', category_id: '1', status: 'active', approval_status: 'approved', reviewed_by: '1', reviewed_at: new Date() }]
    else if (sql.includes('SELECT id, stock_qty FROM product_variants')) rows = [{ id: '1', stock_qty: 1 }]
    else if (sql.startsWith('INSERT INTO')) rows = { insertId: 1 }
    callback(null, rows)
  },
  destroy() {},
}
sequelize.connectionManager.getConnection = async () => conn
sequelize.connectionManager.releaseConnection = async () => {}
async function save(urls) {
  let status, body
  const req = { params: { productId: '7' }, body: { userId: '2', name: 'Test', categoryId: 'thoi-trang-nam', description: 'Test', price: 1, stock: 1, status: 'active', images: urls.map((url) => ({ url })) } }
  const res = { status(value) { status = value; return this }, json(value) { body = value; return this } }
  await saveSellerProduct(req, res, (err) => { throw err })
  return { status, body }
}
try {
  const other = '/uploads/product-3-00000000-0000-4000-8000-000000000006.png'
  assert.equal((await save([other, ...ownUrls.slice(0, 3)])).body.error.code, 'INVALID_PRODUCT_IMAGE')
  assert.equal(calls.some((call) => call.sql.includes('UPDATE products SET')), false)
  calls.length = 0
  assert.equal((await save([oldUrl, ...ownUrls.slice(0, 3)])).status, 200)
  const update = calls.find((call) => call.sql.includes('UPDATE products SET'))
  assert.equal(update.values[4], 'draft')
  assert.equal(update.values[5], 'pending')
  assert.equal(update.values[6], null)
  assert.equal(update.values[7], null)
  assert.equal(update.values[8], null)
  console.log('PASS: ảnh owner khác bị chặn, ảnh cũ đã gắn được giữ, sửa sản phẩm đưa về chờ duyệt (DB giả lập).')
} finally { await closeDatabase() }
