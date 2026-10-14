import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function listen(port = 0) {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return server
}

async function freePort() {
  const server = await listen()
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

function launch(publicPort, dataPort) {
  const key = randomBytes(32).toString('hex')
  const child = spawn(process.execPath, ['scripts/host.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(publicPort),
      DATA_API_PORT: String(dataPort),
      DATA_API_URL: 'http://127.0.0.1:1',
      DATA_API_KEY: key,
      JWT_SECRET: randomBytes(32).toString('hex'),
      DB_HOST: '127.0.0.1',
      DB_PORT: '1',
      DB_NAME: 'hosting_test',
      DB_USER: 'hosting_test',
      DB_PASSWORD: randomBytes(32).toString('hex'),
      DB_SSL_ENABLED: 'false',
      DB_READINESS_TIMEOUT_MS: '1000',
      DOTENV_CONFIG_PATH: path.join(os.tmpdir(), `missing-${key}.env`),
    },
    stdio: 'ignore',
  })
  const closed = new Promise((resolve) => child.once('close', resolve))
  return { child, closed, key }
}

async function waitForHealth(url, expectedStatus = 200) {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) })
      if (response.status === expectedStatus) return response
    } catch { /* Tiến trình con có thể chưa mở cổng. */ }
    await delay(100)
  }
  throw new Error('Hosting chưa mở Backend sau 10 giây.')
}

async function waitForExit(closed) {
  let timer
  try {
    return await Promise.race([
      closed,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Hosting không dừng đúng hạn.')), 10000)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function cleanup(run) {
  if (run.child.exitCode !== null) return
  if (process.platform === 'win32') {
    // Chỉ dừng cây tiến trình do kiểm tra này vừa tạo.
    const kill = spawn('taskkill', ['/PID', String(run.child.pid), '/T', '/F'], { stdio: 'ignore' })
    await new Promise((resolve) => kill.once('close', resolve))
  } else {
    run.child.kill('SIGTERM')
  }
  await waitForExit(run.closed)
}

const publicPort = await freePort()
let dataPort = await freePort()
while (dataPort === publicPort) dataPort = await freePort()
const base = `http://127.0.0.1:${publicPort}`
const run = launch(publicPort, dataPort)

try {
  await waitForHealth(`${base}/api/v1/health`)
  await waitForHealth(`http://127.0.0.1:${dataPort}/internal/v1/health`, 401)
  assert.equal((await fetch(`${base}/internal/v1/health`)).status, 404)
  assert.equal((await fetch(`http://127.0.0.1:${dataPort}/internal/v1/health`)).status, 401)
  assert.equal((await fetch(`http://127.0.0.1:${dataPort}/internal/v1/health`, {
    headers: { 'x-service-key': run.key },
  })).status, 200)
  const ready = await fetch(`${base}/api/v1/ready`)
  assert.equal(ready.status, 503)
  assert.equal((await ready.json()).error.code, 'DATA_API_UNAVAILABLE')
  console.log('PASS: Backend public, Data API có xác thực và readiness báo MySQL chưa sẵn sàng.')
} finally {
  await cleanup(run)
}

const busy = await listen(dataPort)
const failedRun = launch(publicPort, dataPort)
try {
  assert.equal(await waitForExit(failedRun.closed), 1)
  const released = await listen(publicPort)
  await new Promise((resolve) => released.close(resolve))
  console.log('PASS: Data API lỗi cổng thì hosting dừng Backend, không giữ dịch vụ chạy dở.')
} finally {
  await cleanup(failedRun)
  await new Promise((resolve) => busy.close(resolve))
}

console.log('Kiểm tra dùng cấu hình cô lập, không đọc hoặc sửa MySQL Aiven.')
