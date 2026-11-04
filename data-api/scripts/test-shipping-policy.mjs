import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateShipping, calculateShippingOptions } from '../src/utils/shipping.js'
import { allocateDiscounts, isValidAmount, MAX_ORDER_AMOUNT } from '../src/utils/money.js'

test('báo giá và tính phí cùng phương thức, đơn giá cho từng shop', () => {
  const group = { subtotal: 999999, hasFreeShipping: false }
  const options = calculateShippingOptions(group)
  assert.deepEqual(options.map(({ id, fee }) => [id, fee]), [
    ['tietkiem', 16500], ['nhanh', 32000], ['hoatoc', 22000],
  ])
  for (const option of options) assert.deepEqual(calculateShipping(option.id, group), option)
  assert.equal(calculateShipping('unknown', group), null)
})

test('giới hạn tiền khớp DECIMAL(15,0) và phân bổ không mất chính xác', () => {
  assert.equal(isValidAmount(MAX_ORDER_AMOUNT), true)
  assert.equal(isValidAmount(MAX_ORDER_AMOUNT + 1), false)
  assert.equal(isValidAmount(-1), false)
  assert.equal(isValidAmount(0.5), false)
  assert.equal(isValidAmount('1'), false)
  assert.deepEqual(allocateDiscounts(999999999999999, [999999999999998, 1]), [999999999999998, 1])
})

test('phân bổ voucher đủ tổng và không vượt tiền hàng của từng shop', () => {
  for (const amounts of [[1, 1, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0], [0, 0, 0], [2, 3, 1, 0]]) {
    const subtotal = amounts.reduce((sum, value) => sum + value, 0)
    for (let discount = 0; discount <= subtotal; discount += 1) {
      const allocated = allocateDiscounts(discount, amounts)
      assert.equal(allocated.reduce((sum, value) => sum + value, 0), discount)
      allocated.forEach((value, index) => {
        assert.ok(Number.isInteger(value) && value >= 0 && value <= amounts[index])
      })
    }
  }
  assert.deepEqual(allocateDiscounts(2, [1, 1, 1]), [0, 1, 1])
})

test('miễn phí theo ngưỡng hoặc sản phẩm miễn phí ship của từng shop', () => {
  for (const group of [
    { subtotal: 1000000, hasFreeShipping: false },
    { subtotal: 1, hasFreeShipping: true },
  ]) {
    for (const option of calculateShippingOptions(group)) {
      assert.equal(option.fee, 0)
      assert.equal(option.discount, option.originalFee)
    }
  }
  const groups = [
    { subtotal: 1000000, hasFreeShipping: false },
    { subtotal: 1000, hasFreeShipping: false },
  ]
  assert.equal(groups.reduce((sum, group) => sum + calculateShipping('tietkiem', group).fee, 0), 16500)
})
