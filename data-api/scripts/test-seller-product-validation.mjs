import assert from 'node:assert/strict'
import {
  resolveSellerProductStatus,
  validateSellerProductInput,
} from '../src/utils/seller-product.validation.js'

// These URLs are validation fixtures only; this script does not fetch or save them.
const uploadedImages = ['a', 'b', 'c', 'd'].map((id) => ({
  url: `/uploads/validation-${id}.jpg`,
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
assert.equal(validateSellerProductInput(productInput(uploadedImages.slice(0, 3))).ok, false, 'rejects fewer than four images')
assert.equal(validateSellerProductInput(productInput([...uploadedImages.slice(0, 3), uploadedImages[0]])).ok, false, 'rejects duplicate image references')
assert.equal(validateSellerProductInput(productInput(uploadedImages, { price: 0 })).ok, false, 'rejects a zero price')
assert.equal(validateSellerProductInput(productInput(uploadedImages, { stock: -1 })).ok, false, 'rejects negative stock')
assert.equal(validateSellerProductInput(productInput(uploadedImages, { description: ' ' })).ok, false, 'rejects a missing description')
assert.equal(validateSellerProductInput(productInput(uploadedImages, { status: 'archived' })).ok, false, 'rejects a seller supplied archive status')
assert.equal(resolveSellerProductStatus(null, 'active'), 'draft', 'new seller products cannot bypass admin approval')
assert.equal(resolveSellerProductStatus('hidden', 'active'), 'hidden', 'hidden products cannot be reactivated by sellers')
assert.equal(resolveSellerProductStatus('active', 'active'), 'active', 'approved products remain active when sellers edit details')
assert.equal(resolveSellerProductStatus('active', 'hidden'), 'hidden', 'sellers can hide their approved products')

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

console.log('Seller product validation checks passed (10 cases).')
