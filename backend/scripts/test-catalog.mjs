import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

const base = (process.env.CATALOG_BACKEND_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const password = process.env.CATALOG_SEED_PASSWORD
assert.ok(password, 'Cần CATALOG_SEED_PASSWORD của các shop mẫu.')
const profile = process.env.CATALOG_SEED_PROFILE || 'catalog'
assert.ok(['catalog', 'empty-categories'].includes(profile), 'Profile không hợp lệ.')
const catalog = JSON.parse(await readFile(new URL(`../../data-api/seeders/${profile}.json`, import.meta.url), 'utf8'))
const productCount = profile === 'catalog' ? 50 : 10
const accounts = profile === 'empty-categories' ? catalog : [
  { category: 'me-be', username: 'shopmebe', slug: 'may-nho-me-be' },
  { category: 'bach-hoa', username: 'shopbachhoa', slug: 'an-nhien-bach-hoa' },
  { category: 'the-thao', username: 'shopthethao', slug: 'nang-dong-sports' },
]

async function json(path, options = {}) {
  const response = await fetch(`${base}/api/v1${path}`, { ...options, signal: AbortSignal.timeout(30000) })
  const result = await response.json()
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`)
  assert.equal(result.success, true, `${path}: ${result.error?.code}`)
  return result.data
}

async function checkImages(product) {
  const hashes = new Set()
  for (const image of product.images) {
    assert.match(image.url, /^\/uploads\/product-\d+-[0-9a-f-]+\.(jpg|webp|png)$/i)
    const response = await fetch(`${base}${image.url}`, { signal: AbortSignal.timeout(30000) })
    assert.equal(response.status, 200, `${product.slug}: ảnh phải đọc được từ kho của dự án.`)
    assert.match(response.headers.get('content-type') || '', /^image\//)
    const bytes = Buffer.from(await response.arrayBuffer())
    const decoder = sharp(bytes, { failOn: 'warning', limitInputPixels: 16_000_000 })
    const metadata = await decoder.metadata()
    assert.ok(metadata.width >= 200 && metadata.height >= 200, `${product.slug}: ảnh quá nhỏ.`)
    await decoder.raw().toBuffer()
    hashes.add(createHash('sha256').update(bytes).digest('hex'))
  }
  assert.equal(hashes.size, 4, `${product.slug}: cần 4 file ảnh khác nhau.`)
}

const categories = await json('/categories')
let imageCount = 0
const shopIds = []
for (const account of accounts) {
  const category = categories.categories.find((row) => row.slug === account.category)
  assert.ok(category, `Thiếu danh mục ${account.category}.`)
  assert.ok(category.productCount >= productCount, `Danh mục ${account.category} chưa đủ ${productCount} sản phẩm có ảnh.`)
  const publicShop = (await json(`/shops/${account.slug}`)).shop
  assert.ok(publicShop, 'Thiếu gian hàng public.')
  assert.equal(publicShop.status, 'active')
  assert.equal(publicShop.productCount, productCount)
  for (const url of [publicShop.logoUrl, publicShop.bannerUrl, category.imageUrl]) {
    assert.ok(url, 'Shop và danh mục cần có ảnh đại diện.')
    const image = await fetch(`${base}${url}`, { method: 'HEAD', signal: AbortSignal.timeout(30000) })
    assert.equal(image.status, 200, 'Ảnh đại diện shop/danh mục phải đọc được.')
  }
  const login = await json('/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: account.username, password }),
  })
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${login.token}` }
  try {
    assert.equal(login.user.role, 'seller')
    assert.equal(String(login.user.shopId), String(publicShop.id))
    assert.ok(!Object.keys(login.user).some((key) => /password|hash/i.test(key)))
    const sellerShop = await json('/seller/shop', { headers })
    assert.equal(sellerShop.shop.slug, account.slug)
    const own = await json('/seller/products?limit=100', { headers })
    assert.equal(own.total, productCount)
    assert.equal(own.products.length, productCount)
    assert.ok(own.products.every((product) => product.status === 'active' && product.approvalStatus === 'approved'))
    const result = await json(`/products?categoryId=${account.category}&shopId=${account.slug}&fullImages=1&limit=100`)
    assert.equal(result.total, productCount)
    assert.equal(result.products.length, productCount)
    assert.equal(new Set(result.products.map((product) => product.name)).size, productCount)
    assert.deepEqual(new Set(result.products.map((product) => product.id)), new Set(own.products.map((product) => product.id)))
    const fixtures = catalog.find((group) => group.category === account.category).products
    for (let offset = 0; offset < result.products.length; offset += 4) {
      const batch = result.products.slice(offset, offset + 4)
      await Promise.all(batch.map(async (product) => {
        assert.equal(String(product.shopId), String(publicShop.id))
        assert.equal(product.categoryId, account.category)
        assert.equal(product.images.length, 4)
        assert.ok(product.images.every((image) => image.url.startsWith(`/uploads/product-${login.user.id}-`)))
        assert.equal(new Set(product.images.map((image) => image.url)).size, 4)
        assert.ok(product.stock > 0 && product.variants.length > 0)
        const fixture = fixtures.find((row) => product.slug === `${account.slug}-${row.sourceId}`)
        assert.ok(fixture, `Sản phẩm ngoài danh sách mẫu: ${product.slug}.`)
        assert.equal(product.name, fixture.name)
        assert.equal(product.price, fixture.price)
        await checkImages(product)
        imageCount += product.images.length
      }))
    }
    const detail = await json(`/products?slug=${encodeURIComponent(result.products[0].slug)}&fullImages=1&limit=1`)
    assert.equal(detail.products[0].images.length, 4)
    if (shopIds.length) {
      const other = await json(`/seller/products?productId=${shopIds[0].productId}`, { headers })
      assert.equal(other.total, 0, 'Seller không được đọc sản phẩm riêng của shop khác.')
      assert.equal(other.products.length, 0)
    }
    shopIds.push({ productId: result.products[0].id })
    console.log(`PASS ${account.username}: đăng nhập, đúng shop/danh mục, ${productCount} sản phẩm và ${productCount * 4} ảnh giải mã được.`)
  } finally {
    if (login.refreshToken) await json('/auth/logout', { method: 'POST', headers, body: JSON.stringify({ refreshToken: login.refreshToken }) })
  }
}
assert.equal(imageCount, accounts.length * productCount * 4)
console.log(`PASS: ${accounts.length} shop, ${accounts.length * productCount} sản phẩm, ${imageCount} ảnh qua Backend → Data API → database/kho ảnh.`)
