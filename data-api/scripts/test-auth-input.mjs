import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-auth-input-test.env', DB_USER: 'test', DB_PASSWORD: 'isolated-test-only-secret', DATA_API_KEY: 'isolated-test-only-service-key', JWT_SECRET: 'isolated-test-only-secret-at-least-32-characters' })
const root = path.resolve(import.meta.dirname, '../..')
const backend = await import(pathToFileURL(path.join(root, 'backend/src/controllers/auth.controller.js')))
const data = await import('../src/controllers/auth.controller.js')
const { closeDatabase } = await import('../src/config/database.js')
const base = { username: 'buyer123', password: '12345678', fullName: 'Người mua', email: 'buyer@example.test', role: 'buyer' }
async function reject(controller, body) {
  let status, result
  const res = { status(value) { status = value; return this }, json(value) { result = value; return this } }
  await controller({ body }, res, (err) => { throw err })
  assert.equal(status, 400)
  assert.equal(result.error.code, 'VALIDATION_ERROR')
}
try {
  for (const controller of [backend.register, data.registerUser]) {
    for (const invalid of [{ phone: 123 }, { phone: [] }, { shopTagline: {} }, { role: false }]) await reject(controller, { ...base, ...invalid })
  }
  const address = { fullName: 'Tên', phone: '12345678', province: 'Hà Nội', detail: 'Nhà' }
  for (const field of ['district', 'ward']) for (const value of [false, 1, [], {}]) await reject(data.registerUser, { ...base, address: { ...address, [field]: value } })
  console.log('PASS auth register invalid types rejected before database access.')
} finally { await closeDatabase() }
