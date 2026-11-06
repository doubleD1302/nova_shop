import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const script = path.resolve(import.meta.dirname, 'test-cart-integration.mjs')
const base = { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, TEMP: process.env.TEMP }
for (const values of [
  {},
  { CART_INTEGRATION_TEST: '1', CART_TEST_DB_NAME: 'shopnova_dev', CART_TEST_DB_PORT: '3306', CART_TEST_DB_USER: 'test', CART_TEST_DB_PASSWORD: 'test-only' },
  { CART_INTEGRATION_TEST: '1', CART_TEST_DB_NAME: 'shopnova_test_cart_isolated', CART_TEST_DB_PORT: 'invalid', CART_TEST_DB_USER: 'test', CART_TEST_DB_PASSWORD: 'test-only' },
]) {
  const result = spawnSync(process.execPath, [script], { env: { ...base, ...values }, encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /database test cục bộ riêng/)
  assert.doesNotMatch(result.stdout, /Data API đang chạy/)
}
console.log('PASS: bài test giỏ từ chối chạy nếu thiếu cấu hình hoặc tên database test riêng.')
