import assert from 'node:assert/strict'
import http from 'node:http'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const marker = randomBytes(16).toString('hex')
const passwords = Object.fromEntries(['buyer', 'seller', 'admin'].map((role) => [`DEMO_${role.toUpperCase()}_PASSWORD`, `${role}-${marker}`]))
let mode = 'valid'
let calls = 0
const dataApi = http.createServer(async (req, res) => {
  calls++
  let body = ''
  for await (const chunk of req) body += chunk
  const input = JSON.parse(body)
  const role = input.username.split('_')[1]
  assert.equal(req.headers['x-service-key'], marker)
  res.setHeader('Content-Type', 'application/json')
  if (mode === 'offline') {
    res.writeHead(503).end(JSON.stringify({ success: false, error: { code: 'DATABASE_UNAVAILABLE' } }))
    return
  }
  res.end(JSON.stringify({ success: true, data: { user: {
    id: '123', username: input.username, fullName: 'Demo', email: null, phone: null, avatarUrl: null,
    role: mode === 'wrong-role' ? 'buyer' : role, status: 'active', shopId: role === 'seller' ? '456' : null,
  } } }))
})
dataApi.listen(0, '127.0.0.1')
await once(dataApi, 'listening')

async function start(enabled) {
  const portServer = http.createServer()
  portServer.listen(0, '127.0.0.1')
  await once(portServer, 'listening')
  const port = portServer.address().port
  await new Promise((resolve) => portServer.close(resolve))
  const child = fork(new URL('../src/server.js', import.meta.url), [], {
    env: { ...process.env, ...passwords, PORT: String(port), NODE_ENV: 'test', DATA_API_KEY: marker,
      DATA_API_URL: `http://127.0.0.1:${dataApi.address().port}`, JWT_SECRET: marker,
      DEMO_LOGIN_ENABLED: String(enabled), DOTENV_CONFIG_PATH: path.join(os.tmpdir(), `missing-${marker}.env`) },
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  })
  const url = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${url}/api/v1/health`)).ok) return { child, url } } catch { /* Chờ khởi động. */ }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  child.kill()
  throw new Error('Backend test không khởi động được.')
}

async function stop(run) {
  if (run.child.exitCode === null) {
    run.child.kill('SIGTERM')
    await once(run.child, 'close')
  }
}

let run
try {
  run = await start(false)
  const disabled = await fetch(`${run.url}/api/v1/auth/demo-accounts`)
  assert.deepEqual((await disabled.json()).data.accounts, [])
  assert.equal(calls, 0)
  await stop(run)
  run = await start(true)
  const enabled = await fetch(`${run.url}/api/v1/auth/demo-accounts`)
  assert.equal(enabled.headers.get('cache-control'), 'no-store')
  assert.equal((await enabled.json()).data.accounts.length, 3)
  for (mode of ['wrong-role', 'offline']) {
    const response = await fetch(`${run.url}/api/v1/auth/demo-accounts`)
    const body = await response.text()
    assert.equal(response.status, 503)
    for (const password of Object.values(passwords)) assert(!body.includes(password))
  }
  console.log('PASS: demo mặc định tắt; xác minh role; không trả mật khẩu khi role sai hoặc Data API lỗi; no-store.')
} finally {
  if (run) await stop(run)
  await new Promise((resolve) => dataApi.close(resolve))
}
