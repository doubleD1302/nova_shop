import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicPort = Number(process.env.PORT || 10000)
const dataPort = Number(process.env.DATA_API_PORT || 3001)

if (
  !Number.isInteger(publicPort) || publicPort < 1 || publicPort > 65535 ||
  !Number.isInteger(dataPort) || dataPort < 1 || dataPort > 65535 ||
  publicPort === dataPort
) {
  console.error('PORT và DATA_API_PORT phải là hai cổng hợp lệ, khác nhau.')
  process.exit(1)
}

// Hai tiến trình vẫn giao tiếp bằng HTTP; chỉ Backend nhận request công khai.
const backendEnv = {
  ...process.env,
  PORT: String(publicPort),
  DATA_API_URL: `http://127.0.0.1:${dataPort}`,
}
const dataEnv = { ...process.env, HOST: '127.0.0.1', PORT: String(dataPort) }

for (const key of Object.keys(backendEnv)) {
  if (key.startsWith('DB_')) delete backendEnv[key]
}
delete backendEnv.HOST
delete dataEnv.JWT_SECRET
delete dataEnv.CORS_ORIGINS
delete dataEnv.DATA_API_URL

const children = new Set()
let stopping = false
let exitCode = 0

function stop(code) {
  if (stopping) return
  stopping = true
  exitCode = code

  for (const child of children) child.kill('SIGTERM')

  // Giới hạn thời gian dừng để một tiến trình lỗi không giữ dịch vụ chạy mãi.
  setTimeout(() => {
    for (const child of children) child.kill('SIGKILL')
  }, 7000).unref()
}

function start(name, directory, env) {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(root, directory),
    env,
    stdio: 'inherit',
  })
  children.add(child)

  child.on('error', () => {
    console.error(`Không thể khởi động ${name}.`)
    stop(1)
  })
  child.on('close', (code) => {
    children.delete(child)
    if (!stopping) {
      console.error(`${name} đã dừng ngoài dự kiến (mã ${code}).`)
      stop(1)
    }
    if (children.size === 0) process.exit(exitCode)
  })
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
process.on('message', (message) => {
  if (message === 'shutdown') stop(0)
})

start('Data API', 'data-api', dataEnv)
start('Backend', 'backend', backendEnv)
