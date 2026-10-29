import assert from 'node:assert/strict'
import net from 'node:net'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const serverPath = path.join(backendDir, 'src', 'server.js')

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

function waitForStartup(child) {
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error('Backend startup timed out.')), 8000)
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
      if (output.includes('Server đang chạy tại')) {
        clearTimeout(timer)
        resolve()
      }
    })
    child.stderr.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`Backend exited before startup (code ${code}). ${output}`))
    })
  })
}

const port = await getAvailablePort()
const child = spawn(process.execPath, [serverPath], {
  cwd: backendDir,
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'test',
    DATA_API_KEY: 'test_google_auth_data_api_key_123456',
    JWT_SECRET: 'test_google_auth_jwt_secret_1234567890',
    FIREBASE_SERVICE_ACCOUNT_JSON: '',
    DOTENV_CONFIG_PATH: path.join(backendDir, '.google-auth-test-env-not-found'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

try {
  await waitForStartup(child)

  const emptyTokenResponse = await fetch(`http://127.0.0.1:${port}/api/v1/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: '' }),
  })
  const emptyTokenBody = await emptyTokenResponse.json()
  assert.equal(emptyTokenResponse.status, 400)
  assert.equal(emptyTokenBody.error?.code, 'VALIDATION_ERROR')

  const unconfiguredResponse = await fetch(`http://127.0.0.1:${port}/api/v1/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: 'not-a-real-token' }),
  })
  const unconfiguredBody = await unconfiguredResponse.json()
  assert.equal(unconfiguredResponse.status, 503)
  assert.equal(unconfiguredBody.error?.code, 'GOOGLE_AUTH_NOT_CONFIGURED')
  assert.match(unconfiguredBody.message, /chưa được cấu hình/i)
  console.log('Google auth endpoint validation and explicit missing-configuration checks passed.')
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM')
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Backend test process did not stop.')), 5000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }
}
