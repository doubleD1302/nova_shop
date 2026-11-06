import assert from 'node:assert/strict'
import { getCategoryDefinitions, validateCategoryAttributes } from '../src/utils/category-attributes.js'

for (const slug of ['thoi-trang-nam', 'thoi-trang-nu', 'dien-thoai', 'may-tinh', 'thiet-bi-gia-dung', 'sac-dep', 'nha-cua', 'me-be']) {
  const definition = getCategoryDefinitions(slug)
  assert.equal(definition.version, 2)
  assert.ok(definition.attributes.some((field) => field.key === 'brand'), slug)
  assert.ok(definition.attributes.some((field) => field.key === 'country_of_origin'), slug)
}
assert.deepEqual(getCategoryDefinitions('danh-muc-moi', 1).attributes, [])
assert.deepEqual(getCategoryDefinitions('danh-muc-moi').attributes.map((field) => field.key), ['brand', 'country_of_origin'])
assert.deepEqual(validateCategoryAttributes('dien-thoai', { version: 1, values: { storage_gb: 128 } }), { version: 1, values: { storage_gb: 128 } })
assert.equal(validateCategoryAttributes('dien-thoai', { version: 1, values: { country_of_origin: 'Việt Nam' } }), null)
assert.deepEqual(validateCategoryAttributes('dien-thoai', { version: 2, values: { storage_gb: 128, country_of_origin: ' Việt Nam ' } }), { version: 2, values: { storage_gb: 128, country_of_origin: 'Việt Nam' } })
for (const bad of [{ values: {} }, { version: '2', values: {} }, { version: 3, values: {} }, { version: 2, values: { storage_gb: '128' } }, { version: 2, values: { style: 'không thuộc ngành này' } }]) {
  assert.equal(validateCategoryAttributes('dien-thoai', bad), null)
}
console.log('PASS: định nghĩa các ngành hàng, version cũ/mới và validation thuộc tính.')
