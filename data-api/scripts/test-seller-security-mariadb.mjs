import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import mysql from 'mysql2/promise'

if (process.platform !== 'win32') throw new Error('Harness requires Windows and an explicitly installed local MariaDB.')
const bin = process.env.SELLER_SECURITY_MARIADB_BIN || 'C:/xampp/mysql/bin'
const tmp = await realpath(os.tmpdir())
const root = await mkdtemp(path.join(tmp, 'shopnova-seller-db-'))
assert.equal(path.dirname(await realpath(root)).toLowerCase(), tmp.toLowerCase())
assert.ok(path.basename(root).startsWith('shopnova-seller-db-'))
const data = path.join(root, 'data')
await mkdir(data)
await writeFile(path.join(root, '.shopnova-seller-isolated'), 'temporary test database')
const port = await new Promise((resolve, reject) => {
  const probe = net.createServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => { const value = probe.address().port; probe.close(() => resolve(value)) })
})
const password = randomBytes(20).toString('hex')
let server
try {
  const init = spawnSync(path.join(bin, 'mysql_install_db.exe'), [`--datadir=${data}`, `--password=${password}`, `--port=${port}`, '--silent'], { windowsHide: true, timeout: 120000, stdio: 'ignore' })
  if (init.status !== 0) throw new Error('Failed to initialize the isolated MariaDB data directory.')
  server = spawn(path.join(bin, 'mysqld.exe'), ['--no-defaults', `--basedir=${path.dirname(bin)}`, `--datadir=${data}`, `--port=${port}`, '--bind-address=127.0.0.1', '--skip-log-bin', '--console'], { windowsHide: true, stdio: 'ignore' })
  let ready = false
  for (let attempt = 0; attempt < 80 && !ready; attempt++) {
    if (server.exitCode != null) throw new Error('Isolated MariaDB exited before becoming ready.')
    try { const connection = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password, connectTimeout: 500 }); await connection.end(); ready = true } catch { await new Promise((resolve) => setTimeout(resolve, 250)) }
  }
  if (!ready) throw new Error('Isolated MariaDB did not become ready.')
  const result = spawnSync(process.execPath, ['scripts/test-seller-security-mysql.mjs'], { cwd: path.resolve('.'), windowsHide: true, encoding: 'utf8', timeout: 180000, env: { ...process.env, SELLER_SECURITY_TEST: '1', SELLER_SECURITY_TEST_ROOT: root, SELLER_SECURITY_DB_PORT: String(port), SELLER_SECURITY_DB_USER: 'root', SELLER_SECURITY_DB_PASSWORD: password, SELLER_SECURITY_ALLOW_MARIADB: '1', SELLER_SECURITY_MYSQLDUMP: path.join(bin, 'mysqldump.exe') } })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) throw new Error('Isolated MariaDB integration test failed.')
} finally {
  if (server && server.exitCode == null) {
    spawnSync(path.join(bin, 'mysqladmin.exe'), ['--no-defaults', '--host=127.0.0.1', `--port=${port}`, '--user=root', `--password=${password}`, 'shutdown'], { windowsHide: true, timeout: 10000, stdio: 'ignore' })
    if (server.exitCode == null) server.kill()
    await Promise.race([new Promise((resolve) => server.once('exit', resolve)), new Promise((resolve) => setTimeout(resolve, 5000))])
  }
  assert.equal(path.dirname(await realpath(root)).toLowerCase(), tmp.toLowerCase())
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
}
