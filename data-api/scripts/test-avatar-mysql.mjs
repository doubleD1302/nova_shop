import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import mysql from 'mysql2/promise'

// Dùng MySQL cục bộ riêng; không đọc credential từ .env của ứng dụng.
const port = Number(process.env.AVATAR_DB_PORT)
if (process.env.AVATAR_MYSQL_TEST !== '1' || !process.env.AVATAR_DB_PASSWORD ||
    !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Cần AVATAR_MYSQL_TEST=1, AVATAR_DB_PORT và AVATAR_DB_PASSWORD của MySQL thử nghiệm riêng.')
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const database = `shopnova_test_avatar_${Date.now()}`
const uploadDir = await mkdtemp(path.join(tmpdir(), 'shopnova-avatar-images-'))
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.AVATAR_DB_USER || 'root', password: process.env.AVATAR_DB_PASSWORD, multipleStatements: true })
let dataServer, backendServer, closeDatabase
const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server))
})
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${database}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  await db.query(await readFile(path.join(root, 'database/seed.sql'), 'utf8'))
  await db.query("UPDATE users SET avatar_url = 'https://example.test/old-avatar' WHERE id = 1")
  Object.assign(process.env, {
    NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(uploadDir, 'missing.env'),
    DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: database,
    DB_USER: process.env.AVATAR_DB_USER || 'root', DB_PASSWORD: process.env.AVATAR_DB_PASSWORD,
    DB_SSL_ENABLED: 'false', DATA_API_KEY: 'avatar-mysql-only-service-key',
    JWT_SECRET: 'avatar-mysql-only-jwt-secret-over-32-characters', UPLOAD_STORAGE: 'local', UPLOAD_DIR: uploadDir,
  })
  const dataApp = (await import(pathToFileURL(path.join(root, 'data-api/src/app.js')))).default
  ;({ closeDatabase } = await import(pathToFileURL(path.join(root, 'data-api/src/config/database.js'))))
  dataServer = await listen(dataApp)
  process.env.DATA_API_URL = `http://127.0.0.1:${dataServer.address().port}`
  const backendApp = (await import(pathToFileURL(path.join(root, 'backend/src/app.js')))).default
  const { signAccessToken } = await import(pathToFileURL(path.join(root, 'backend/src/middlewares/auth.middleware.js')))
  backendServer = await listen(backendApp)
  const base = `http://127.0.0.1:${backendServer.address().port}`
  const token = signAccessToken({ id: '1', role: 'buyer' })
  const otherToken = signAccessToken({ id: '2', role: 'seller' })
  async function call(method, endpoint, body, bearer = token) {
    const response = await fetch(base + '/api/v1' + endpoint, {
      method, headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` }, body: JSON.stringify(body),
    })
    return { status: response.status, ...await response.json() }
  }
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWNYffb96rPvGSAUAEJCCZ0WY1CJAAAAAElFTkSuQmCC', 'base64')
  const dataUrl = (bytes) => `data:image/png;base64,${bytes.toString('base64')}`
  const small = await call('POST', '/uploads/images', { dataUrl: dataUrl(png) })
  assert.equal(small.status, 201)
  const largeBytes = Buffer.alloc(1024 * 1024 + 1)
  png.copy(largeBytes)
  const large = await call('POST', '/uploads/images', { dataUrl: dataUrl(largeBytes) })
  assert.equal(large.status, 201)
  const other = await call('POST', '/uploads/images', { purpose: 'avatar', dataUrl: dataUrl(png) }, otherToken)
  assert.equal(other.status, 201)
  const profile = (avatarUrl) => ({ fullName: 'Buyer', email: 'buyer@example.test', avatarUrl })
  assert.equal((await call('PUT', '/auth/profile', profile('https://example.test/old-avatar'))).status, 200)
  for (const url of [large.data.url, other.data.url, 'https://example.test/new-avatar']) {
    const result = await call('PUT', '/auth/profile', profile(url))
    assert.equal(result.status, 400, JSON.stringify(result))
    assert.equal(result.error.code, 'INVALID_AVATAR_IMAGE')
  }
  assert.equal((await call('PUT', '/auth/profile', profile(small.data.url))).status, 200)
  assert.equal((await call('PUT', '/auth/profile', profile(undefined))).status, 200)
  const [[saved]] = await db.query('SELECT avatar_url FROM users WHERE id = 1')
  assert.equal(saved.avatar_url, small.data.url)
  const downloaded = await fetch(base + small.data.url)
  assert.equal(downloaded.status, 200)
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png)
  assert.equal((await call('PUT', '/auth/profile', profile(null))).status, 200)
  const [[removed]] = await db.query('SELECT avatar_url FROM users WHERE id = 1')
  assert.equal(removed.avatar_url, null)
  console.log(`PASS MySQL ${version}: HTTP upload/profile, legacy size guard, owner, existing URL, omission, removal, local image serving.`)
} finally {
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${database}\``)
  await db.end()
  assert.equal(path.dirname(uploadDir), path.resolve(tmpdir()))
  assert.ok(path.basename(uploadDir).startsWith('shopnova-avatar-images-'))
  await rm(uploadDir, { recursive: true })
}
