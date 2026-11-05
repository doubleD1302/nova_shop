import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
Object.assign(process.env, { NODE_ENV: 'production', DOTENV_CONFIG_PATH: 'missing-demo-production-test.env', DB_USER: 'test', DB_PASSWORD: 'demo-production-test-password', DATA_API_KEY: 'demo-production-test-service-key', JWT_SECRET: 'demo-production-test-jwt-secret-32-characters' })
const root = path.resolve(import.meta.dirname, '../..')
const backend = await import(pathToFileURL(path.join(root, 'backend/src/controllers/demo-payout.controller.js')))
const data = await import('../src/controllers/demo-payout.controller.js')
const { closeDatabase } = await import('../src/config/database.js')
try {
  for (const controllers of [backend, data]) for (const name of ['getDemoPayout', 'setupDemoPayout', 'createDemoWithdrawal']) {
    let status
    const res = { status(value) { status = value; return this }, json() { return this } }
    await controllers[name]({ query: {}, body: {}, headers: {}, user: { id: '1' } }, res, (err) => { throw err })
    assert.equal(status, 404, `${name} phải tắt ở production`)
  }
  console.log('PASS: API nhận tiền demo bị tắt ở production tại cả hai tầng, không kết nối database.')
} finally { await closeDatabase() }
