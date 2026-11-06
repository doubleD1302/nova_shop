import assert from 'node:assert/strict'
import { calculateCheckoutPreview, previewCheckout } from '../src/controllers/checkout-preview.controller.js'
import { calculateShipping } from '../src/utils/shipping.js'
import { closeDatabase } from '../src/config/database.js'

const makeQuery = ({ voucher = true, used = 0, stock = 5, minSubtotal = 0, price = 100000 } = {}) => async (sql, params) => {
  assert.match(sql.trim(), /^SELECT\s/i)
  assert.doesNotMatch(sql, /FOR UPDATE/i)
  if (sql.includes('FROM product_variants')) {
    return params.filter((id) => id !== '999').map((id) => ({ variant_id: id, price, stock_qty: stock, shop_id: id === '2' ? 2 : 1, free_shipping: 0, shop_name: 'Shop' }))
  }
  if (sql.includes('FROM vouchers')) return voucher ? [{ id: 7, discount_amount: 20000, min_subtotal: minSubtotal, usage_limit: 10, per_user_limit: 1, used_count: 0 }] : []
  if (sql.includes('FROM voucher_uses')) return [{ used }]
  throw new Error('Truy vấn không mong đợi')
}
const input = { userId: '1', items: [{ variantId: '1', qty: 2 }, { variantId: '2', qty: 1 }], shippingMethod: 'tietkiem', voucherCode: 'NOVA20K' }
const result = await calculateCheckoutPreview(makeQuery(), input)
assert.equal(result.subtotal, 300000)
const expectedShipping = calculateShipping('tietkiem', { subtotal: 200000, weightGrams: 2000 }).fee +
  calculateShipping('tietkiem', { subtotal: 100000, weightGrams: 1000 }).fee
assert.equal(result.shippingFee, expectedShipping)
assert.equal(result.discountAmount, 20000)
assert.equal(result.total, 300000 + expectedShipping - 20000)
assert.equal(result.shops.length, 2)
assert.equal((await calculateCheckoutPreview(makeQuery({ voucher: false }), input)).error, 'VOUCHER_INVALID')
assert.equal((await calculateCheckoutPreview(makeQuery({ used: 1 }), input)).error, 'VOUCHER_UNAVAILABLE')
assert.equal((await calculateCheckoutPreview(makeQuery({ minSubtotal: 400000 }), input)).error, 'VOUCHER_UNAVAILABLE')
assert.equal((await calculateCheckoutPreview(makeQuery({ stock: 1 }), input)).error, 'INSUFFICIENT_STOCK')
assert.equal((await calculateCheckoutPreview(makeQuery(), { ...input, items: [{ variantId: '999', qty: 1 }] })).error, 'PRODUCT_UNAVAILABLE')
assert.equal((await calculateCheckoutPreview(makeQuery({ price: 999999999999999 }), { ...input, items: [{ variantId: '1', qty: 2 }] })).error, 'ORDER_AMOUNT_INVALID')
assert.equal((await calculateCheckoutPreview(makeQuery({ price: 999999999999999 }), { ...input, items: [{ variantId: '1', qty: 1 }], voucherCode: '' })).total, 999999999999999)
const noVoucher = await calculateCheckoutPreview(makeQuery(), { ...input, voucherCode: '' })
assert.equal(noVoucher.discountAmount, 0)
assert.equal(noVoucher.total, 300000 + expectedShipping)

const smallOrderQuery = async (sql, params) => {
  if (sql.includes('FROM product_variants')) return params.map((id) => ({ variant_id: id, price: 1, stock_qty: 1, shop_id: id, free_shipping: 1, shop_name: `Shop ${id}` }))
  if (sql.includes('FROM vouchers')) return [{ id: 7, discount_amount: 2, min_subtotal: 0, usage_limit: 10, per_user_limit: 1, used_count: 0 }]
  if (sql.includes('FROM voucher_uses')) return [{ used: 0 }]
  throw new Error('Truy vấn không mong đợi')
}
const smallOrder = await calculateCheckoutPreview(smallOrderQuery, {
  ...input, items: ['1', '2', '3'].map((variantId) => ({ variantId, qty: 1 })),
})
assert.equal(smallOrder.subtotal, 3)
assert.equal(smallOrder.discountAmount, 2)
assert.equal(smallOrder.total, 1)

for (const items of [[{ variantId: '1', qty: '2' }], [{ variantId: '1', qty: 1 }, { variantId: '1', qty: 1 }]]) {
  let status
  let response
  const res = { status(value) { status = value; return this }, json(value) { response = value; return this } }
  await previewCheckout({ body: { ...input, items } }, res, (err) => { throw err })
  assert.equal(status, 400)
  assert.equal(response.error.code, 'VALIDATION_ERROR')
}
await closeDatabase()
console.log('Checkout preview: các trường hợp tính tiền và từ chối dữ liệu không hợp lệ đạt.')
