import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import jwt from '../../backend/node_modules/jsonwebtoken/index.js'

if (process.env.AUTH_ROLE_TEST !== '1' || !process.env.AUTH_ROLE_DB_PASSWORD) throw new Error('Cần MySQL test cục bộ riêng.')
const port = Number(process.env.AUTH_ROLE_DB_PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Cổng MySQL test không hợp lệ.')
const root = path.resolve(import.meta.dirname, '../..')
const name = `shopnova_test_auth_role_${Date.now()}`
const db = await mysql.createConnection({ host: '127.0.0.1', port, user: process.env.AUTH_ROLE_DB_USER || 'root', password: process.env.AUTH_ROLE_DB_PASSWORD, multipleStatements: true })
let backendServer, dataServer, closeDatabase
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  assert.match(version, /^8\./)
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${name}\``)
  await db.query(await readFile(path.join(root, 'database/schema.sql'), 'utf8'))
  Object.assign(process.env, { NODE_ENV: 'test', DOTENV_CONFIG_PATH: path.join(root, 'missing-auth-role-test.env'), DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: name, DB_USER: process.env.AUTH_ROLE_DB_USER || 'root', DB_PASSWORD: process.env.AUTH_ROLE_DB_PASSWORD, DB_SSL_ENABLED: 'false', DATA_API_KEY: 'auth-role-test-service-key', JWT_SECRET: 'auth-role-test-jwt-secret-at-least-32-characters' })
  const dataApp = (await import('../src/app.js')).default
  ;({ closeDatabase } = await import('../src/config/database.js'))
  dataServer = await new Promise((resolve) => { const s = dataApp.listen(0, '127.0.0.1', () => resolve(s)) })
  process.env.DATA_API_URL = `http://127.0.0.1:${dataServer.address().port}`
  const backendApp = (await import('../../backend/src/app.js')).default
  backendServer = await new Promise((resolve) => { const s = backendApp.listen(0, '127.0.0.1', () => resolve(s)) })
  const base = `http://127.0.0.1:${backendServer.address().port}/api/v1`
  const register = async (username, email) => {
    const res = await fetch(`${base}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, email, fullName: 'Test', password: 'test-password-123', role: 'buyer' }) })
    const body = await res.json()
    assert.equal(res.status, 201, JSON.stringify(body))
    return body.data
  }
  const named = await register('admin', 'first@example.test')
  const emailed = await register('second', 'admin@shopnova.vn')
  for (const user of [named, emailed]) {
    const res = await fetch(`${base}/admin/users`, { headers: { authorization: `Bearer ${user.token}` } })
    assert.equal(res.status, 403)
    const profile = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${user.token}` } })
    assert.equal((await profile.json()).data.user.role, 'buyer')
  }
  await db.query("UPDATE users SET role = 'admin' WHERE id = ?", [named.user.id])
  const promoted = await fetch(`${base}/admin/users`, { headers: { authorization: `Bearer ${named.token}` } })
  assert.equal(promoted.status, 200)
  const legacy = jwt.sign({ sub: emailed.user.id, role: 'buyer', authVersion: 2 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 900, issuer: 'shopnova-backend', audience: 'shopnova-clients' })
  const oldResponse = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${legacy}` } })
  assert.equal(oldResponse.status, 200)
  const expired = jwt.sign({ sub: emailed.user.id, role: 'buyer', authVersion: 2, iat: Math.floor(Date.now() / 1000) - 1000 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 900, issuer: 'shopnova-backend', audience: 'shopnova-clients' })
  const expiredResponse = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${expired}` } })
  assert.equal(expiredResponse.status, 401)
  const invalid = jwt.sign({ sub: emailed.user.id, role: 'buyer', authVersion: 2 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 3600, issuer: 'shopnova-backend', audience: 'shopnova-clients' })
  const invalidResponse = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${invalid}` } })
  assert.equal(invalidResponse.status, 401)
  console.log(`PASS MySQL ${version}: buyer giả admin bị chặn, admin thật được phép, token 15 phút còn hạn và thời hạn không hợp lệ.`)
} finally {
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${name}\``)
  await db.end()
}
