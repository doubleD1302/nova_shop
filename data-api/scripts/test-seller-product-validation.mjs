import assert from 'node:assert/strict'
import {
  validateSellerProductInput,
} from '../src/utils/seller-product.validation.js'

// These URLs are validation fixtures only; this script does not fetch or save them.
const uploadedImages = ['a', 'b', 'c', 'd'].map((id) => ({
  url: `/uploads/product-21-00000000-0000-4000-8000-00000000000${id === 'a' ? 1 : id === 'b' ? 2 : id === 'c' ? 3 : 4}.jpg`,
  altText: 'Validation fixture',
}))

function productInput(images = uploadedImages, overrides = {}) {
  return {
    body: {
      name: 'Sản phẩm kiểm tra',
      categoryId: 'thoi-trang-nam',
      description: 'Mô tả dùng trong kiểm tra đầu vào.',
      price: 120000,
      originalPrice: null,
      stock: 0,
      status: 'active',
      images,
      ...overrides,
    },
    userId: '21',
    productId: null,
  }
}

assert.equal(validateSellerProductInput(productInput()).ok, true, 'accepts exactly four distinct uploaded image references')
for (const url of ['/uploads/does-not-exist.jpg', '/uploads/review-2-00000000-0000-4000-8000-000000000001.png', '/uploads/....']) {
  assert.equal(validateSellerProductInput(productInput([{ url }, ...uploadedImages.slice(1)])).ok, false)
}
assert.equal(validateSellerProductInput(productInput(uploadedImages.slice(0, 3))).ok, false, 'rejects fewer than four images')
assert.equal(validateSellerProductInput(productInput([...uploadedImages.slice(0, 3), uploadedImages[0]])).ok, false, 'rejects duplicate image references')
assert.equal(validateSellerProductInput(productInput(uploadedImages, { price: 0 })).ok, false, 'rejects a zero price')
assert.equal(validateSellerProductInput(productInput(uploadedImages, { stock: -1 })).ok, false, 'rejects negative stock')
for (const stock of [null, '', ' ', '0', false, true, [], {}, undefined]) {
  assert.equal(validateSellerProductInput(productInput(uploadedImages, { stock })).ok, false, 'rejects nonnumeric stock rather than resetting inventory')
}
for (const price of [true, false, null, '', '120000', [], {}, undefined]) {
  assert.equal(validateSellerProductInput(productInput(uploadedImages, { price })).ok, false, 'rejects a nonnumeric price')
}
for (const originalPrice of [true, false, '150000', [], {}]) {
  assert.equal(validateSellerProductInput(productInput(uploadedImages, { originalPrice })).ok, false, 'rejects a nonnumeric original price')
}
assert.equal(validateSellerProductInput(productInput(uploadedImages, { stock: 0, price: 1, originalPrice: null })).ok, true, 'accepts zero inventory, numeric price and omitted original price')
assert.equal(validateSellerProductInput(productInput(uploadedImages, { price: 120000, originalPrice: 150000, stock: 99 })).ok, true, 'accepts valid numeric fields')
assert.equal(validateSellerProductInput(productInput(uploadedImages, { description: ' ' })).ok, false, 'rejects a missing description')
assert.equal(validateSellerProductInput(productInput(uploadedImages, { status: 'archived' })).ok, false, 'rejects a seller supplied archive status')
for (const freeShipping of [null, 'false', 0, 1, [], {}]) {
  assert.equal(validateSellerProductInput(productInput(uploadedImages, { freeShipping })).ok, false, 'rejects nonboolean freeShipping')
}
for (const status of [null, false, '', 0]) {
  assert.equal(validateSellerProductInput(productInput(uploadedImages, { status })).ok, false, 'rejects invalid status rather than defaulting')
}
assert.equal(validateSellerProductInput(productInput(uploadedImages, { freeShipping: false })).ok, true)

const commonsImages = ['one', 'two', 'three', 'four'].map((id) => ({
  url: `https://upload.wikimedia.org/wikipedia/commons/thumb/Validation/${id}.jpg/640px-${id}.jpg`,
  sourcePageUrl: `https://commons.wikimedia.org/wiki/File%3AValidation_${id}.jpg`,
  author: 'Validation fixture author',
  licenseName: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
}))
assert.equal(validateSellerProductInput(productInput(commonsImages)).ok, true, 'accepts four Commons records with an allowed license and attribution metadata')
assert.equal(validateSellerProductInput(productInput(commonsImages.map((image) => ({ ...image, licenseName: 'CC BY-NC 4.0' })))).ok, false, 'rejects non-commercial Commons licenses')
assert.equal(validateSellerProductInput(productInput(commonsImages.map((image) => ({ ...image, url: image.url.replace('upload.wikimedia.org', 'example.test') })))).ok, false, 'rejects image URLs outside the Wikimedia upload host')

console.log('Seller product validation checks passed, including numeric field type boundaries.')
