import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const isWindows = process.platform === 'win32'

console.log('='.repeat(60))
console.log('  SHOPNOVA - KHỞI CHẠY ĐỒNG BỘ TOÀN BỘ HỆ THỐNG')
console.log('  1. Data API (MySQL/Sequelize): http://127.0.0.1:3001')
console.log('  2. Backend Express API:        http://127.0.0.1:3000')
console.log('  3. Frontend React + Vite:      http://localhost:5173')
console.log('='.repeat(60))

const processes = []

function startService(name, command, args, cwd, colorCode) {
  const color = `\x1b[${colorCode}m`
  const reset = '\x1b[0m'
  const prefix = `${color}[${name}]${reset} `

  console.log(`${prefix}Đang khởi động...`)
  const child = spawn(command, args, {
    cwd,
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n')
    for (const line of lines) {
      if (line.trim()) console.log(`${prefix}${line}`)
    }
  })

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n')
    for (const line of lines) {
      if (line.trim()) console.error(`${prefix}\x1b[31m${line}${reset}`)
    }
  })

  child.on('close', (code) => {
    console.log(`${prefix}Tiến trình đã dừng (mã thoát: ${code})`)
  })

  processes.push(child)
  return child
}

// 1. Data API (port 3001)
startService(
  'Data-API',
  'node',
  ['src/server.js'],
  path.join(rootDir, 'data-api'),
  '36' // Cyan
)

// 2. Backend (port 3000)
setTimeout(() => {
  startService(
    'Backend',
    'node',
    ['src/server.js'],
    path.join(rootDir, 'backend'),
    '35' // Magenta
  )
}, 800)

// 3. Frontend Vite (port 5173)
setTimeout(() => {
  const npxCmd = isWindows ? 'npx.cmd' : 'npx'
  startService(
    'Frontend',
    npxCmd,
    ['vite', '--host', '0.0.0.0', '--port', '5173'],
    rootDir,
    '32' // Green
  )
}, 1600)

function cleanup() {
  console.log('\nĐang dừng tất cả các dịch vụ ShopNova...')
  for (const child of processes) {
    try {
      if (isWindows && child.pid) {
        spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t'], { shell: true })
      } else {
        child.kill('SIGTERM')
      }
    } catch {}
  }
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('exit', cleanup)

