import assert from 'node:assert/strict'
import http from 'node:http'
import sharp from 'sharp'

const store = new Map()
const storage = http.createServer(async (req, res) => {
  const key = new URL(req.url, 'http://127.0.0.1').pathname
  if (req.method === 'HEAD') {
    const body = store.get(key)
    if (!body) return res.writeHead(404).end()
    return res.writeHead(200, { 'Content-Length': body.length, 'Content-Type': 'image/png' }).end()
  }
  if (req.method === 'GET') {
    const body = store.get(key)
    if (!body) return res.writeHead(404).end()
    return res.writeHead(200, { 'Content-Length': body.length, 'Content-Type': 'image/png' }).end(body)
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  store.set(key, Buffer.concat(chunks))
  res.writeHead(200, { ETag: '"test"' }).end()
})
await new Promise((resolve) => storage.listen(0, '127.0.0.1', resolve))
const dataApi = http.createServer((req, res) => {
  const id = req.url?.match(/^\/internal\/v1\/users\/(\d+)\/auth-profile$/)?.[1]
  res.setHeader('content-type', 'application/json')
  if (req.method === 'POST' && req.url === '/internal/v1/products/1/reviews') {
    return res.writeHead(201).end(JSON.stringify({ success: true, data: { review: { id: '1' } } }))
  }
  if (!id) return res.writeHead(404).end('{}')
  const role = id === '2' ? 'seller' : 'buyer'
  res.end(JSON.stringify({ success: true, data: { user: { id, username: 'test', fullName: 'Test', email: null, phone: null, avatarUrl: null, role, status: 'active', shopId: role === 'seller' ? '1' : null, address: null } } }))
})
await new Promise((resolve) => dataApi.listen(0, '127.0.0.1', resolve))
Object.assign(process.env, {
  NODE_ENV: 'test', DATA_API_URL: `http://127.0.0.1:${dataApi.address().port}`,
  DATA_API_KEY: 'upload_test_service_key_for_local_use', JWT_SECRET: 'upload_test_jwt_secret_at_least_32_chars',
  UPLOAD_STORAGE: 's3', S3_ENDPOINT: `http://127.0.0.1:${storage.address().port}`,
  S3_REGION: 'us-east-1', S3_BUCKET: 'test', S3_ACCESS_KEY_ID: 'test-key', S3_SECRET_ACCESS_KEY: 'test-key-secret',
  S3_FORCE_PATH_STYLE: 'true', DOTENV_CONFIG_PATH: 'missing-upload-test.env',
})
const { default: app } = await import('../src/app.js')
const { signAccessToken } = await import('../src/middlewares/auth.middleware.js')
const { closeObjectStorage, headUploadedImage } = await import('../src/services/object-storage.js')
const server = http.createServer(app)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}/api/v1/uploads/images`
const tokens = { buyer: signAccessToken({ id: '1', role: 'buyer' }), seller: signAccessToken({ id: '2', role: 'seller' }) }
const source = { create: { width: 2, height: 2, channels: 3, background: '#abcdef' } }
const png = await sharp(source).png().toBuffer()
const jpeg = await sharp(source).jpeg().toBuffer()
const webp = await sharp(source).webp().toBuffer()
const dataUrl = (mime, bytes) => `data:${mime};base64,${bytes.toString('base64')}`
const sizedPng = (length) => Buffer.concat([png, Buffer.alloc(length - png.length)])
async function upload(body, role = 'buyer') {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(role ? { authorization: `Bearer ${tokens[role]}` } : {}) }, body: JSON.stringify(body) })
  return { status: response.status, json: await response.json() }
}

try {
  assert.equal((await upload({ dataUrl: dataUrl('image/png', png) }, null)).status, 401)
  for (const [mime, bytes] of [['image/png', png], ['image/jpeg', jpeg], ['image/webp', webp]]) {
    const uploaded = await upload({ purpose: 'avatar', dataUrl: dataUrl(mime, bytes) })
    assert.equal(uploaded.status, 201)
    assert.match(uploaded.json.data.url, /^\/uploads\/avatar-1-/)
    const downloaded = await fetch(`http://127.0.0.1:${server.address().port}${uploaded.json.data.url}`)
    assert.equal(downloaded.status, 200)
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes)
  }
  const reviewImage = await upload({ purpose: 'review', dataUrl: dataUrl('image/png', png) })
  assert.equal(reviewImage.status, 201)
  assert.match(reviewImage.json.data.url, /^\/uploads\/review-1-/)
  const metadata = await headUploadedImage(reviewImage.json.data.url.slice('/uploads/'.length))
  assert.equal(metadata.size, png.length)
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}${reviewImage.json.data.url}`)).status, 200)
  const reviewUrl = `http://127.0.0.1:${server.address().port}/api/v1/products/1/reviews`
  async function submitReview(images) {
    return fetch(reviewUrl, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.buyer}` }, body: JSON.stringify({ orderItemId: '1', rating: 5, comment: 'Tốt', images }) })
  }
  assert.equal((await submitReview([reviewImage.json.data.url])).status, 201)
  assert.equal((await submitReview(['/uploads/review-1-00000000-0000-0000-0000-000000000000.png'])).status, 400)

  assert.equal((await upload({ purpose: 'avatar', dataUrl: dataUrl('image/jpeg', png) })).status, 400)
  assert.equal((await upload({ purpose: 'avatar', dataUrl: dataUrl('image/png', png.subarray(0, 20)) })).status, 400)
  const tooWide = await sharp({ create: { width: 4097, height: 1, channels: 3, background: '#fff' } }).png().toBuffer()
  const tooManyPixels = await sharp({ create: { width: 4001, height: 4000, channels: 3, background: '#fff' } }).png().toBuffer()
  assert.equal((await upload({ purpose: 'avatar', dataUrl: dataUrl('image/png', tooWide) })).status, 400)
  assert.equal((await upload({ purpose: 'avatar', dataUrl: dataUrl('image/png', tooManyPixels) })).status, 400)
  assert.equal(store.size, 4)
  assert.equal((await upload({ purpose: 'avatar', dataUrl: 'data:image/png;base64,' })).status, 400)
  assert.equal((await upload({ purpose: 'avatar', dataUrl: dataUrl('image/png', Buffer.from('<html>')) })).status, 400)
  assert.equal((await upload({ purpose: 'avatar', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' })).status, 400)
  assert.equal((await upload({ purpose: 'avatar', dataUrl: dataUrl('image/gif', Buffer.from('GIF89a')) })).status, 400)
  assert.equal((await upload({ purpose: 'avatar', dataUrl: 'data:image/png;base64,abcd=' })).status, 400)
  assert.equal((await upload({ purpose: '__proto__', dataUrl: dataUrl('image/png', png) })).status, 400)
  assert.equal((await upload({ purpose: 'product', dataUrl: dataUrl('image/png', png) })).status, 403)
  assert.equal((await upload({ purpose: 'shop', dataUrl: dataUrl('image/png', png) }, 'seller')).status, 201)
  const productImage = await upload({ purpose: 'product', dataUrl: dataUrl('image/png', png) }, 'seller')
  assert.equal(productImage.status, 201)
  assert.match(productImage.json.data.url, /^\/uploads\/product-2-/)
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}${productImage.json.data.url}`)).status, 200)
  const badProduct = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/seller/products`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.seller}` }, body: JSON.stringify({ images: [{ url: '/uploads/product-2-00000000-0000-4000-8000-000000000000.png' }] }) })
  assert.equal(badProduct.status, 400)
  assert.equal((await badProduct.json()).error.code, 'INVALID_PRODUCT_IMAGE')
  for (const [purpose, limit, role] of [['avatar', 1, 'buyer'], ['review', 2, 'buyer'], ['product', 5, 'seller']]) {
    assert.equal((await upload({ purpose, dataUrl: dataUrl('image/png', sizedPng(limit * 1024 * 1024)) }, role)).status, 201)
    assert.equal((await upload({ purpose, dataUrl: dataUrl('image/png', sizedPng(limit * 1024 * 1024 + 1)) }, role)).status, 400)
  }
  const legacy = await upload({ dataUrl: dataUrl('image/png', png) })
  assert.equal(legacy.status, 201)
  assert.match(legacy.json.data.url, /^\/uploads\/avatar-1-/)
  console.log('Upload HTTP policy PASS: auth, roles, decode, dimensions, types, MIME, purpose and size boundaries; mocked Data API and S3.')
} finally {
  closeObjectStorage()
  await Promise.all([new Promise((resolve) => server.close(resolve)), new Promise((resolve) => dataApi.close(resolve)), new Promise((resolve) => storage.close(resolve))])
}
