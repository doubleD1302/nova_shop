import assert from 'node:assert/strict'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { once } from 'node:events'
import { randomBytes } from 'node:crypto'

const listener = net.createServer()
listener.listen(0, '127.0.0.1')
await once(listener, 'listening')
const closedPort = listener.address().port
await new Promise((resolve) => listener.close(resolve))
const marker = randomBytes(24).toString('hex')
Object.assign(process.env, {
  NODE_ENV: 'test', DB_HOST: '127.0.0.1', DB_PORT: String(closedPort), DB_NAME: 'cloud_required_test',
  DB_USER: 'test_user', DB_PASSWORD: marker, DATA_API_KEY: marker, DB_SSL_ENABLED: 'false',
  DB_READINESS_TIMEOUT_MS: '1000', DOTENV_CONFIG_PATH: path.join(os.tmpdir(), `missing-${marker}.env`),
})
delete process.env.ALLOW_LOCAL_DB_FALLBACK
const localFile = new URL('../data/shopnova_local.sqlite', import.meta.url)
const existed = fs.existsSync(localFile)
const { executeQuery, executeTransaction, checkDatabaseReadiness, closeDatabase, isDatabaseUnavailableError } = await import('../src/config/database.js')
try {
  await assert.rejects(() => executeQuery('SELECT 1', [], 1000), isDatabaseUnavailableError)
  let ran = false
  await assert.rejects(() => executeTransaction(async () => { ran = true }, 1000), isDatabaseUnavailableError)
  assert.equal(ran, false, 'Không được thực thi transaction trên database dự phòng.')
  await assert.rejects(() => checkDatabaseReadiness(1000), isDatabaseUnavailableError)
  assert.equal(fs.existsSync(localFile), existed, 'Không tự tạo SQLite khi mất database cloud.')
  console.log('PASS: query/transaction/readiness đều báo lỗi khi mất DB; không tạo hoặc dùng SQLite dự phòng mặc định.')
} finally {
  await closeDatabase()
}
