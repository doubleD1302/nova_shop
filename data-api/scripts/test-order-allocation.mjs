import assert from 'node:assert/strict'

// Không đọc cấu hình database thật và không mở kết nối mạng.
process.env.DOTENV_CONFIG_PATH = 'nonexistent-checkout-test.env'
process.env.DB_USER = 'checkout_test'
process.env.DB_PASSWORD = 'checkout-test-only'
process.env.DATA_API_KEY = 'checkout-test-only-key'
const { sequelize, closeDatabase } = await import('../src/config/database.js')
const { createOrder } = await import('../src/controllers/orders.controller.js')

async function runOrder({ failStock = false, lockError = null, hasAddress = false, failAddress = false } = {}) {
  const commands = []
  const shopOrders = []
  const payments = []
  const connection = {
    query({ sql }, values, callback) {
      try {
        commands.push(sql.trim())
        if (lockError && sql.includes('FROM product_variants v')) return callback(Object.assign(new Error('test lock error'), { code: lockError }))
        let result = { insertId: 1, affectedRows: 1 }
        if (sql.includes('FROM orders WHERE')) result = []
        else if (sql.includes('SELECT id FROM users WHERE')) result = [{ id: '1' }]
        else if (sql.includes('SELECT id FROM addresses WHERE')) result = hasAddress ? [{ id: '1' }] : []
        else if (sql.includes('INSERT INTO addresses') && failAddress) return callback(new Error('test address write failure'))
        else if (sql.includes('FROM product_variants v')) {
          const id = values[0]
          result = [{ variant_id: id, product_id: id, variant_name: 'SKU', attributes: {}, sku: id,
            price: 1, original_price: null, stock_qty: 1, shop_id: id, product_name: 'Sản phẩm',
            product_slug: 'san-pham', free_shipping: 1, shop_name: `Shop ${id}`, image_url: null }]
        } else if (sql.includes('FROM vouchers')) {
          result = [{ id: 7, discount_amount: 2, min_subtotal: 0, usage_limit: 10, per_user_limit: 1, used_count: 0 }]
        } else if (sql.includes('FROM voucher_uses')) result = [{ used: 0 }]
        else if (sql.includes('INSERT INTO shop_orders')) shopOrders.push(values)
        else if (sql.includes('INSERT INTO payments')) payments.push(values)
        else if (sql.includes('UPDATE product_variants SET stock_qty')) result = { affectedRows: failStock ? 0 : 1 }
        callback(null, result)
      } catch (err) { callback(err) }
    },
    destroy() {},
  }
  sequelize.connectionManager.getConnection = async () => connection
  sequelize.connectionManager.releaseConnection = async () => {}
  let status, body
  const res = { status(value) { status = value; return this }, json(value) { body = value; return this } }
  await createOrder({
    headers: { 'idempotency-key': 'checkout-test-123456' },
    body: { userId: '1', items: ['1', '2', '3'].map((variantId) => ({ variantId, qty: 1 })),
      shippingMethod: 'tietkiem', paymentMethod: 'cod', voucherCode: 'TEST',
      address: { fullName: 'Test', phone: '0123456789', province: 'Test', detail: 'Test' } },
  }, res, (err) => { throw err })
  return { status, body, commands, shopOrders, payments }
}

try {
  const success = await runOrder()
  assert.equal(success.status, 201)
  assert.equal(success.body.data.order.total, 1)
  assert.deepEqual(success.shopOrders.map((values) => values[5]), [0, 1, 1])
  assert.deepEqual(success.shopOrders.map((values) => values[6]), [1, 0, 0])
  assert.deepEqual(success.payments.map((values) => values[1]), [1, 0, 0])
  assert.ok(success.commands.includes('COMMIT'))
  assert.ok(success.commands.some((sql) => sql.includes('INSERT INTO addresses')))
  const existing = await runOrder({ hasAddress: true })
  assert.equal(existing.status, 201)
  assert.ok(!existing.commands.some((sql) => sql.includes('INSERT INTO addresses')))
  await assert.rejects(runOrder({ failAddress: true }), /test address write failure/)
  const failure = await runOrder({ failStock: true })
  assert.equal(failure.status, 409)
  assert.equal(failure.body.error.code, 'INSUFFICIENT_STOCK')
  assert.ok(failure.commands.includes('ROLLBACK'))
  assert.ok(!failure.commands.includes('COMMIT'))
  assert.ok(!failure.commands.some((sql) => sql.includes('INSERT INTO addresses')))
  for (const code of ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']) {
    const conflict = await runOrder({ lockError: code })
    assert.equal(conflict.status, 409)
    assert.equal(conflict.body.error.code, 'CHECKOUT_CONFLICT')
    assert.ok(conflict.commands.includes('ROLLBACK'))
    assert.ok(!conflict.commands.includes('COMMIT'))
  }
  console.log('Tạo đơn và rollback: PASS với kết nối database giả lập.')
} finally {
  await closeDatabase()
}
