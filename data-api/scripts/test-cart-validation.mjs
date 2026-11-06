import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import express from 'express'

Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-cart-validation.env', DB_USER: 'test', DB_PASSWORD: 'cart-validation-test-only', DATA_API_KEY: 'cart-validation-test-only', JWT_SECRET: 'cart-validation-test-secret-over-32-characters' })
const root = path.resolve(import.meta.dirname, '../..')
const backend = await import(pathToFileURL(path.join(root, 'backend/src/controllers/cart.controller.js')))
const data = await import('../src/controllers/cart.controller.js')
const backendShipping = await import(pathToFileURL(path.join(root, 'backend/src/controllers/shipping.controller.js')))
const dataShipping = await import('../src/controllers/shipping.controller.js')
const backendReturns = await import(pathToFileURL(path.join(root, 'backend/src/controllers/returns.controller.js')))
const dataReturns = await import('../src/controllers/returns.controller.js')
const dataShops = await import('../src/controllers/shops.controller.js')
const dataOrders = await import('../src/controllers/orders.controller.js')
const backendChat = await import(pathToFileURL(path.join(root, 'backend/src/controllers/chat.controller.js')))
const dataChat = await import('../src/controllers/chat.controller.js')
const { sequelize, closeDatabase } = await import('../src/config/database.js')
const queries = []
const conn = {
  query({ sql }, values, callback) {
    queries.push(sql)
    const rows = sql.includes('SELECT ci.id, ci.variant_id') ? [{ id: 7, variant_id: 1, qty: 2, selected: 1, stock_qty: 10 }] : []
    callback(null, rows)
  },
  destroy() {},
}
sequelize.connectionManager.getConnection = async () => conn
sequelize.connectionManager.releaseConnection = async () => {}

async function invoke(controller, body, query = {}, params = { itemId: '7', orderId: '2', shopOrderId: '3' }) {
  let status, result
  const req = { body, query, params, headers: { 'idempotency-key': 'validation-test-0001' }, user: { id: '1' } }
  const res = { status(code) { status = code; return this }, json(value) { result = value; return this } }
  await controller(req, res, (error) => { throw error })
  return { status, result }
}

try {
  for (const controller of [backend, data]) {
    for (const qty of [null, false, true, '', ' ', -1, -0.5, 100, 1.5, {}, []]) {
      const start = queries.length
      const response = await invoke(controller.updateCartItem, { userId: '1', qty })
      assert.equal(response.status, 400, `PATCH qty ${JSON.stringify(qty)}`)
      assert.equal(queries.length, start, 'Invalid quantity reached database')
    }
    for (const selected of ['false', 0, null, {}, []]) {
      assert.equal((await invoke(controller.updateCartSelection, { userId: '1', selected })).status, 400)
      assert.equal((await invoke(controller.updateCartItem, { userId: '1', selected })).status, 400)
    }
    for (const shopId of ['', null, 0, {}, [], ['1'], Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal((await invoke(controller.updateCartSelection, { userId: '1', selected: true, shopId })).status, 400)
    }
    for (const selectedOnly of ['true', 1, null, {}]) {
      const start = queries.length
      assert.equal((await invoke(controller.clearCart, { userId: '1', selectedOnly })).status, 400)
      assert.equal(queries.length, start, 'Invalid deletion filter reached database')
    }
    for (const selected of ['yes', '', ['true', 'false']]) {
      assert.equal((await invoke(controller.clearCart, { userId: '1' }, { selected })).status, 400)
    }
    for (const variantId of [null, ['1'], {}, true, Number.MAX_SAFE_INTEGER + 1]) {
      const before = queries.length
      assert.equal((await invoke(controller.addItemToCart, { userId: '1', variantId, qty: 1 })).status, 400)
      assert.equal((await invoke(controller.syncCart, { userId: '1', items: [{ variantId, qty: 1 }] })).status, 400)
      assert.equal(queries.length, before)
    }
    for (const body of [{ qty: null }, { qty: true }, { qty: 1, selected: 'false' }, { qty: 1, replaceQty: 'false' }]) {
      assert.equal((await invoke(controller.addItemToCart, { userId: '1', ...body })).status, 400)
    }
  }
  for (const controller of [backend, data]) {
    for (const itemId of ['0', '-1', 'abc', '1.5', '1'.repeat(21)]) {
      const before = queries.length
      for (const fn of [controller.updateCartItem, controller.removeCartItem]) {
        assert.equal((await invoke(fn, { userId: '1', qty: 1 }, {}, { itemId })).status, 400)
      }
      assert.equal(queries.length, before)
    }
  }
  let start = queries.length
  assert.equal((await invoke(data.clearCart, { userId: '1', selectedOnly: true })).status, 200)
  assert.ok(queries.slice(start).some((sql) => sql.includes('AND selected = 1')))
  start = queries.length
  assert.equal((await invoke(data.clearCart, { userId: '1', selectedOnly: false })).status, 200)
  assert.ok(queries.slice(start).some((sql) => sql === 'DELETE FROM cart_items WHERE user_id = ?'))
  start = queries.length
  assert.equal((await invoke(data.updateCartItem, { userId: '1', qty: 0 })).status, 200)
  assert.ok(queries.slice(start).some((sql) => sql.startsWith('DELETE FROM cart_items WHERE id')))
  for (const value of ['false', null, 0, {}, []]) {
    for (const controller of [backendShipping, dataShipping]) {
      assert.equal((await invoke(controller.updateOrderTracking, { userId: '1', trackingCode: 'TRACK', autoAdvanceStatus: value })).status, 400)
    }
  }
  for (const controller of [backendShipping, dataShipping]) {
    for (const bad of [{ trackingCode: 'x'.repeat(101) }, { trackingCode: 'ß'.repeat(51) }, { trackingCode: 'T', carrier: false }, { trackingCode: 'T', carrier: [] }, { trackingCode: 'T', carrier: '' }, { trackingCode: 'T', carrier: 'x'.repeat(61) }]) {
      const before = queries.length
      assert.equal((await invoke(controller.updateOrderTracking, { userId: '1', ...bad })).status, 400)
      assert.equal(queries.length, before)
    }
  }
  for (const value of [null, 0, -1, 0.5, '100', true, {}, Number.MAX_SAFE_INTEGER + 1]) {
    for (const controller of [backendReturns, dataReturns]) {
      assert.equal((await invoke(controller.createOrderReturn, { userId: '1', shopOrderId: '3', reason: 'Hỏng', refundAmount: value })).status, 400)
    }
  }
  for (const controller of [backendReturns, dataReturns]) {
    const base = { userId: '1', shopOrderId: '3', reason: 'Hỏng' }
    for (const invalid of [{ reason: 'x'.repeat(256) }, { detail: false }, { images: {} }, { images: [false] }, { images: Array(6).fill('/uploads/a.jpg') }]) {
      const before = queries.length
      assert.equal((await invoke(controller.createOrderReturn, { ...base, ...invalid })).status, 400)
      assert.equal(queries.length, before)
    }
    for (const shopOrderId of [['3'], { id: '3' }, true, Number.MAX_SAFE_INTEGER + 1]) {
      const before = queries.length
      assert.equal((await invoke(controller.createOrderReturn, { ...base, shopOrderId })).status, 400)
      assert.equal(queries.length, before)
    }
    for (const sellerNote of [false, {}, 'x'.repeat(501)]) {
      assert.equal((await invoke(controller.updateSellerReturnStatus, { userId: '1', status: 'approved', sellerNote }, {}, { returnId: '1' })).status, 400)
    }
  }
  for (const controller of [backendChat, dataChat]) {
    for (const shopId of [['1'], true, Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal((await invoke(controller.getOrCreateConversation, { buyerId: '1', shopId })).status, 400)
    }
    for (const invalid of [{ message: 'x'.repeat(4001) }, { attachments: {} }, { attachments: Array(11).fill('x') }, { attachments: ['é'.repeat(32768)] }]) {
      const before = queries.length
      assert.equal((await invoke(controller.sendConversationMessage, { senderId: '1', senderRole: 'buyer', message: 'Hello', ...invalid }, {}, { id: '1' })).status, 400)
      assert.equal(queries.length, before)
    }
  }
  for (const field of ['tagline', 'description', 'address']) {
    assert.equal((await invoke(dataShops.updateSellerShop, { userId: '1', name: 'Shop', province: 'Hà Nội', [field]: {} })).status, 400)
  }
  const order = { userId: '1', items: [{ variantId: '1', qty: 1 }], address: { fullName: 'Tên', phone: '123', province: 'Hà Nội', detail: 'Nhà' }, paymentMethod: 'cod', shippingMethod: 'nhanh' }
  for (const bad of [{ ...order, items: [{ variantId: '1', qty: true }] }, { ...order, items: [{ variantId: ['1'], qty: 1 }] }, { ...order, items: [{ variantId: Number.MAX_SAFE_INTEGER + 1, qty: 1 }] }, { ...order, address: { ...order.address, fullName: {} } }, { ...order, note: {} }, { ...order, voucherCode: [] }]) {
    assert.equal((await invoke(dataOrders.createOrder, bad)).status, 400)
  }
  const app = express()
  app.use(express.json())
  app.use((req, res, next) => { req.user = { id: '1' }; next() })
  for (const [prefix, controller] of [['backend', backend], ['internal', data]]) {
    app.patch(`/${prefix}/cart/items/:itemId`, controller.updateCartItem)
    app.delete(`/${prefix}/cart/items`, controller.clearCart)
    app.post(`/${prefix}/cart/sync`, controller.syncCart)
  }
  app.patch('/internal/seller/orders/:shopOrderId/tracking', dataShipping.updateOrderTracking)
  app.post('/internal/orders/:orderId/returns', dataReturns.createOrderReturn)
  app.post('/internal/orders', dataOrders.createOrder)
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)) })
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    const cases = [
      ['PATCH', '/backend/cart/items/7', { qty: null }],
      ['PATCH', '/internal/cart/items/7', { userId: '1', qty: -1 }],
      ['DELETE', '/backend/cart/items', { selectedOnly: 'true' }],
      ['DELETE', '/internal/cart/items', { userId: '1', selectedOnly: 'true' }],
      ['POST', '/backend/cart/sync', { items: [{ variantId: '1', qty: true }] }],
      ['POST', '/internal/cart/sync', { userId: '1', items: [{ variantId: '1', qty: 2, selected: 'false' }] }],
      ['PATCH', '/internal/seller/orders/3/tracking', { userId: '1', trackingCode: 'TRACK', autoAdvanceStatus: 'false' }],
      ['POST', '/internal/orders/2/returns', { userId: '1', shopOrderId: '3', reason: 'Hỏng', refundAmount: 0 }],
      ['POST', '/internal/orders/2/returns', { userId: '1', shopOrderId: ['3'], reason: 'Hỏng' }],
      ['POST', '/internal/orders', { ...order, items: [{ variantId: '1', qty: true }] }],
    ]
    for (const [method, endpoint, body] of cases) {
      const before = queries.length
      const response = await fetch(base + endpoint, { method, headers: { 'content-type': 'application/json', 'idempotency-key': 'validation-test-0001' }, body: JSON.stringify(body) })
      assert.equal(response.status, 400, endpoint)
      assert.equal((await response.json()).error.code, 'VALIDATION_ERROR')
      assert.equal(queries.length, before, 'Invalid HTTP request reached database')
    }
  } finally { await new Promise((resolve) => server.close(resolve)) }
  console.log('PASS cart validation: invalid quantities/booleans cannot trigger mutations; valid clear filters and zero deletion (mock database).')
  console.log('PASS invalid tracking, refund, shop profile and order input rejected before database access (mock database).')
  console.log('PASS HTTP routes reject invalid cart, tracking, refund and order input (mock database).')
} finally {
  await closeDatabase()
}
