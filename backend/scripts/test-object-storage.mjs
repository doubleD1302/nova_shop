import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const storedObjects = new Map()
let storageError = null
const server = http.createServer(async (req, res) => {
  const segments = new URL(req.url, 'http://127.0.0.1').pathname.split('/').filter(Boolean)
  const key = decodeURIComponent(segments.slice(1).join('/'))

  if (req.method === 'PUT') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    storedObjects.set(key, {
      body: Buffer.concat(chunks),
      contentType: req.headers['content-type'],
    })
    res.writeHead(200, { ETag: '"test-object"' }).end()
    return
  }

  if (storageError) {
    res.writeHead(storageError.status, { 'Content-Type': 'application/xml' }).end(
      `<Error><Code>${storageError.code}</Code><Message>private-storage-message</Message></Error>`,
    )
    return
  }

  const object = storedObjects.get(key)
  if (!object) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, {
    'Content-Length': object.body.length,
    'Content-Type': object.contentType,
    ETag: '"test-object"',
  }).end(object.body)
})

await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})

const { port } = server.address()
process.env.NODE_ENV = 'test'
process.env.PORT = '3000'
process.env.DATA_API_URL = 'http://127.0.0.1:3001'
process.env.DATA_API_KEY = 'object_storage_test_service_key_123456'
process.env.JWT_SECRET = 'object_storage_test_jwt_secret_1234567890'
process.env.UPLOAD_STORAGE = 's3'
process.env.S3_ENDPOINT = `http://127.0.0.1:${port}`
process.env.S3_REGION = 'us-east-1'
process.env.S3_BUCKET = 'shopnova-test'
process.env.S3_ACCESS_KEY_ID = 'test-access-key'
process.env.S3_SECRET_ACCESS_KEY = 'test-secret-key'
process.env.S3_FORCE_PATH_STYLE = 'true'
process.env.DOTENV_CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'missing-test.env')

try {
  const { closeObjectStorage, getUploadedImage, saveUploadedImage } = await import('../src/services/object-storage.js')
  const filename = '0713f59e-311d-4bde-a13c-6fa163a9ff61.png'
  const body = Buffer.from('durable image bytes')
  await saveUploadedImage(filename, body, 'image/png')
  const retrieved = await getUploadedImage(filename)

  assert.deepEqual(retrieved.body, body)
  assert.equal(retrieved.contentType, 'image/png')
  assert.equal(storedObjects.size, 1)

  const { default: app } = await import('../src/app.js')
  const appServer = http.createServer(app)
  await new Promise((resolve, reject) => {
    appServer.once('error', reject)
    appServer.listen(0, '127.0.0.1', resolve)
  })
  try {
    const response = await fetch(`http://127.0.0.1:${appServer.address().port}/uploads/${filename}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable')
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), body)

    const base = `http://127.0.0.1:${appServer.address().port}`
    const logs = []
    const originalError = console.error
    console.error = (...args) => logs.push(args.join(' '))
    try {
      for (const failure of [
        { status: 403, code: 'AccessDenied' },
        { status: 403, code: 'SignatureDoesNotMatch' },
        { status: 404, code: 'NoSuchBucket' },
        { status: 500, code: 'InternalError' },
      ]) {
        storageError = failure
        const failed = await fetch(`${base}/uploads/${filename}`)
        assert.equal(failed.status, 503, failure.code)
        assert.equal(failed.headers.get('cache-control'), 'no-store')
        assert.equal((await failed.json()).error.code, 'IMAGE_STORAGE_UNAVAILABLE')
        assert.ok(logs.at(-1).includes(`code=${failure.code}, status=${failure.status}`))
      }
      assert.equal(logs.length, 4)
      assert.ok(logs.every((line) => !line.includes('private-storage-message') && !line.includes('test-secret-key')))

      storageError = { status: 404, code: 'NoSuchKey' }
      const missing = await fetch(`${base}/uploads/${filename}`)
      assert.equal(missing.status, 404)
      assert.equal(missing.headers.get('cache-control'), 'no-store')
      assert.equal(logs.length, 4, 'Ảnh không tồn tại không ghi log lỗi kho ảnh.')

      const invalid = await fetch(`${base}/uploads/not-an-image.png`)
      assert.equal(invalid.status, 404)
      assert.equal(invalid.headers.get('cache-control'), 'no-store')
      assert.equal(logs.length, 4)
    } finally {
      console.error = originalError
      storageError = null
    }

    const recovered = await fetch(`${base}/uploads/${filename}`)
    assert.equal(recovered.status, 200)
    assert.deepEqual(Buffer.from(await recovered.arrayBuffer()), body)
  } finally {
    await new Promise((resolve) => appServer.close(resolve))
  }

  closeObjectStorage()
  console.log('S3-compatible upload/read/proxy checks passed.')
} finally {
  await new Promise((resolve) => server.close(resolve))
}
