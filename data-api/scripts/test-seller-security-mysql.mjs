import assert from 'node:assert/strict'
import { randomBytes, createCipheriv } from 'node:crypto'
import { readFile, mkdtemp, writeFile, rm, realpath, access } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import mysql from 'mysql2/promise'

// Never consume the application's DB_* settings or a shared database name.
if (process.env.SELLER_SECURITY_TEST !== '1' || !process.env.SELLER_SECURITY_DB_PASSWORD) throw new Error('Requires an explicitly supplied isolated local MySQL test instance.')
const port = Number(process.env.SELLER_SECURITY_DB_PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid isolated MySQL port.')
const root = path.resolve(import.meta.dirname, '../..')
const name = `shopnova_test_seller_security_${Date.now()}_${randomBytes(4).toString('hex')}`
const config = { host: '127.0.0.1', port, user: process.env.SELLER_SECURITY_DB_USER || 'root', password: process.env.SELLER_SECURITY_DB_PASSWORD, multipleStatements: true }
const isolatedRoot = await realpath(process.env.SELLER_SECURITY_TEST_ROOT || '.')
const tmpRoot = await realpath(os.tmpdir())
if (path.dirname(isolatedRoot).toLowerCase() !== tmpRoot.toLowerCase() || !path.basename(isolatedRoot).startsWith('shopnova-seller-db-')) throw new Error('Test root must be an isolated temporary directory.')
await access(path.join(isolatedRoot, '.shopnova-seller-isolated'))
const db = await mysql.createConnection(config)
const [[serverInfo]] = await db.query('SELECT @@datadir AS datadir')
const actualData = await realpath(serverInfo.datadir)
const expectedData = await realpath(path.join(isolatedRoot, 'data'))
if (actualData.toLowerCase() !== expectedData.toLowerCase()) { await db.end(); throw new Error('Database server is not using the isolated test data directory.') }
const oldKey = randomBytes(32), key = randomBytes(32)
const profile = { pickupAddress: '123 Test', province: 'Ha Noi', contactEmail: 'owner@example.test', contactPhone: '0900000000', shippingMethods: ['nhanh'], businessType: 'personal', ownerName: 'Test Seller', idCard: '123456789012', agreeTerms: true }
const reason = 'Review isolated seller profile'
const oldPayload = (identity) => {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', oldKey, iv)
  const data = Buffer.concat([cipher.update(identity, 'utf8'), cipher.final()])
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') })
}
let dataServer, backendServer, closeDatabase, blocker, backupRoot
const logs = []
const originalError = console.error
console.error = (...args) => { logs.push(args.join(' ')) }
const listen = (app) => new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); })
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
try {
  const [[{ version }]] = await db.query('SELECT VERSION() AS version')
  const maria = /^10\..*MariaDB/i.test(version) && process.env.SELLER_SECURITY_ALLOW_MARIADB === '1'
  if (!/^8\./.test(version) && !maria) throw new Error('Requires MySQL 8.x, or explicitly allowed MariaDB for a compatibility-only test.')
  const collation = maria ? 'utf8mb4_unicode_ci' : 'utf8mb4_0900_ai_ci'
  const sqlForEngine = (sql) => maria ? sql.replaceAll('utf8mb4_0900_ai_ci', collation) : sql
  await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE ${collation}; USE \`${name}\``)
  await db.query(sqlForEngine(await readFile(path.join(root, 'database/schema.sql'), 'utf8')))
  await db.query(sqlForEngine(await readFile(path.join(root, 'database/seed.sql'), 'utf8')))
  // Apply the pending migration only inside the database created above, twice.
  await db.query('DROP TABLE seller_identity_access_events')
  const migration = sqlForEngine(await readFile(path.join(root, 'database/migrations/2026-11-10-seller-identity-access-events.sql'), 'utf8'))
  await db.query(migration)
  const [[beforeSchema]] = await db.query('SHOW CREATE TABLE seller_identity_access_events')
  await db.query(migration)
  const [[afterSchema]] = await db.query('SHOW CREATE TABLE seller_identity_access_events')
  assert.deepEqual(afterSchema, beforeSchema)
  Object.assign(process.env, { DOTENV_CONFIG_PATH: path.join(root, 'missing-isolated-seller-security.env'), NODE_ENV: 'test',
    DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: name, DB_USER: config.user, DB_PASSWORD: config.password, DB_SSL_ENABLED: 'false',
    DB_READINESS_TIMEOUT_MS: '4500', ALLOW_LOCAL_DB_FALLBACK: 'false', DATA_API_KEY: randomBytes(32).toString('hex'), JWT_SECRET: randomBytes(32).toString('hex'),
    SELLER_IDENTITY_KEY: key.toString('base64'), SELLER_IDENTITY_PREVIOUS_KEYS: oldKey.toString('base64'), WEATHER_API_KEY: '',
    SMTP_HOST: '', VNPAY_ENABLED: 'false', MOMO_ENABLED: 'false' })
  const { default: dataApp } = await import('../src/app.js')
  const database = await import('../src/config/database.js')
  closeDatabase = database.closeDatabase
  const { encryptIdentity, decryptIdentity, saveSellerProfile } = await import('../src/utils/seller-profile.js')
  const { rotateSellerIdentities } = await import('../src/services/seller-identity-rotation.js')
  const rotation = { query: database.executeQuery, transaction: database.executeTransaction }
  dataServer = await listen(dataApp)
  process.env.DATA_API_URL = `http://127.0.0.1:${dataServer.address().port}`
  const { default: backendApp } = await import('../../backend/src/app.js')
  const { signAccessToken } = await import('../../backend/src/middlewares/auth.middleware.js')
  backendServer = await listen(backendApp)
  const base = `http://127.0.0.1:${backendServer.address().port}/api/v1`
  const call = async (route, token, method = 'GET', body, extra = {}) => {
    const response = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: response.status, headers: response.headers, body: await response.json() }
  }
  const [admin] = await db.query("INSERT INTO users(username,password_hash,full_name,role) VALUES ('security_admin','test-only','Admin','admin')")
  const adminToken = signAccessToken({ id: String(admin.insertId), role: 'admin' })
  const buyer = signAccessToken({ id: '1', role: 'buyer' })
  await saveSellerProfile(async (sql, values) => (await db.query(sql, values))[0], '1', profile, encryptIdentity(profile.idCard))
  const reveal = '/admin/shops/1/identity-access'
  for (const [token, expected] of [[null, 401], [buyer, 403]]) {
    const denied = await call(reveal, token, 'POST', { userId: admin.insertId, reason })
    assert.equal(denied.status, expected)
    assert.equal(denied.headers.get('cache-control'), 'no-store')
    assert.ok(!JSON.stringify(denied.body).includes(profile.idCard))
  }
  const internal = await fetch(`http://127.0.0.1:${dataServer.address().port}/internal/v1${reveal}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-service-key': process.env.DATA_API_KEY }, body: JSON.stringify({ userId: '1', reason }) })
  assert.equal(internal.status, 403)
  assert.equal((await call(reveal, adminToken, 'POST', { reason: 'x' })).status, 400)
  await db.query("UPDATE users SET status = 'blocked' WHERE id = ?", [admin.insertId])
  assert.equal((await call(reveal, adminToken, 'POST', { reason })).status, 401)
  await db.query("UPDATE users SET status = 'active' WHERE id = ?", [admin.insertId])
  const access = await call(reveal, adminToken, 'POST', { reason })
  assert.equal(access.status, 200)
  assert.equal(access.body.data.idCard, profile.idCard)
  assert.equal(access.headers.get('cache-control'), 'no-store')
  const [[event]] = await db.query('SELECT admin_id, reason FROM seller_identity_access_events WHERE shop_id = 1')
  assert.equal(String(event.admin_id), String(admin.insertId)); assert.equal(event.reason, reason)
  const listed = await call('/admin/shops/1/identity-access-events', adminToken)
  assert.equal(listed.body.data.events.length, 1)
  assert.equal(listed.headers.get('cache-control'), 'no-store')
  assert.equal((await call('/admin/shops/1/identity-access-events', buyer)).status, 403)
  // An insert error containing sensitive text must reach neither logs nor response.
  await db.query(`CREATE TRIGGER deny_identity_audit BEFORE INSERT ON seller_identity_access_events FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '${profile.idCard}'`)
  const failed = await call(reveal, adminToken, 'POST', { reason })
  assert.equal(failed.status, 502) // Backend maps an upstream internal error to Bad Gateway.
  assert.equal(failed.headers.get('cache-control'), 'no-store')
  assert.ok(!JSON.stringify(failed.body).includes(profile.idCard))
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM seller_identity_access_events'))[0][0].n, 1)
  await db.query('DROP TRIGGER deny_identity_audit')
  await db.query('RENAME TABLE seller_identity_access_events TO saved_identity_events')
  const missingAudit = await call(reveal, adminToken, 'POST', { reason })
  assert.equal(missingAudit.status, 502)
  assert.ok(!JSON.stringify(missingAudit.body).includes(profile.idCard))
  await db.query('RENAME TABLE saved_identity_events TO seller_identity_access_events')
  assert.ok(!logs.join('\n').includes(profile.idCard)); assert.ok(!logs.join('\n').includes(reason))

  // Real row locks: failed second row leaves the committed first row readable.
  await saveSellerProfile(async (sql, values) => (await db.query(sql, values))[0], '2', profile, oldPayload(profile.idCard))
  await db.query('UPDATE seller_registration_profiles SET identity_encrypted = ? WHERE shop_id = 1', [oldPayload(profile.idCard)])
  assert.equal((await rotateSellerIdentities({ ...rotation, mode: 'check' })).oldCount, 2)
  await assert.rejects(() => rotateSellerIdentities({ ...rotation, mode: 'invalid' }), /INVALID_IDENTITY_ROTATION_CONFIG/)
  await db.query("UPDATE seller_registration_profiles SET identity_encrypted = '{}' WHERE shop_id = 2")
  await assert.rejects(() => rotateSellerIdentities({ ...rotation, mode: 'apply' }))
  const [[first]] = await db.query('SELECT identity_encrypted FROM seller_registration_profiles WHERE shop_id = 1')
  assert.equal(decryptIdentity(first.identity_encrypted, [key]), profile.idCard)
  await db.query('UPDATE seller_registration_profiles SET identity_encrypted = ? WHERE shop_id = 2', [oldPayload(profile.idCard)])
  assert.equal((await rotateSellerIdentities({ ...rotation, mode: 'apply' })).changed, 1)
  assert.equal((await rotateSellerIdentities({ ...rotation, mode: 'apply' })).changed, 0)
  for (const id of ['1', '2']) await db.query('UPDATE seller_registration_profiles SET identity_encrypted = ? WHERE shop_id = ?', [oldPayload(profile.idCard), id])

  // An actual dump/restore retains old encrypted rows; the old key is still necessary.
  let backupVerified = false
  if (process.env.SELLER_SECURITY_MYSQLDUMP) {
    backupRoot = await mkdtemp(path.join(os.tmpdir(), 'shopnova-seller-backup-'))
    const defaults = path.join(backupRoot, 'client.cnf')
    assert.match(config.user, /^[a-zA-Z0-9_]+$/)
    assert.match(config.password, /^[a-zA-Z0-9]+$/)
    await writeFile(defaults, `[client]\nhost=127.0.0.1\nport=${port}\nuser=${config.user}\npassword=${config.password}\n`)
    const dumpArgs = [`--defaults-extra-file=${defaults}`, ...(maria ? [] : ['--set-gtid-purged=OFF', '--no-tablespaces']), '--skip-add-locks', '--skip-comments', name]
    const dump = spawnSync(process.env.SELLER_SECURITY_MYSQLDUMP, dumpArgs, { windowsHide: true, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
    assert.equal(dump.status, 0, 'Isolated backup command failed')
    assert.ok(!dump.stdout.includes(profile.idCard))
    await db.query(`CREATE DATABASE \`${name}_restore\` CHARACTER SET utf8mb4 COLLATE ${collation}; USE \`${name}_restore\``)
    await db.query(dump.stdout)
    const [[restored]] = await db.query('SELECT identity_encrypted FROM seller_registration_profiles WHERE shop_id = 1')
    assert.throws(() => decryptIdentity(restored.identity_encrypted, [key]))
    assert.equal(decryptIdentity(restored.identity_encrypted, [oldKey]), profile.idCard)
    await db.query(`USE \`${name}\``)
    backupVerified = true
  }
  const concurrent = await Promise.all([rotateSellerIdentities({ ...rotation, mode: 'apply' }), rotateSellerIdentities({ ...rotation, mode: 'apply' })])
  assert.equal(concurrent.reduce((sum, result) => sum + result.changed, 0), 2)
  blocker = await mysql.createConnection({ ...config, database: name })
  await blocker.beginTransaction()
  await blocker.query('SELECT identity_encrypted FROM seller_registration_profiles WHERE shop_id = 2 FOR UPDATE')
  let reachedLock
  const locked = new Promise((resolve) => { reachedLock = resolve })
  const running = rotateSellerIdentities({ query: rotation.query, mode: 'apply', transaction: (operation) => rotation.transaction((query) => operation(async (sql, values) => {
    if (sql.includes('FOR UPDATE') && values[0] === '2') reachedLock()
    return query(sql, values)
  })) })
  await locked
  const editedIdentity = '987654321098', editedPayload = encryptIdentity(editedIdentity)
  await blocker.query("UPDATE seller_registration_profiles SET identity_encrypted = ?, identity_last4 = ?, pickup_address = 'concurrent edit' WHERE shop_id = 2", [editedPayload, editedIdentity.slice(-4)])
  await pause(75)
  await blocker.commit()
  await running
  const [[edited]] = await db.query('SELECT identity_encrypted, pickup_address FROM seller_registration_profiles WHERE shop_id = 2')
  assert.equal(edited.identity_encrypted, editedPayload); assert.equal(edited.pickup_address, 'concurrent edit')
  assert.equal((await rotateSellerIdentities({ ...rotation, mode: 'check' })).oldCount, 0)

  await db.query("UPDATE products SET status = 'active' WHERE id IN (1,2); UPDATE product_variants SET stock_qty = 10 WHERE id IN (1,3); UPDATE seller_registration_profiles SET shipping_methods = JSON_ARRAY('nhanh') WHERE shop_id = 1; DELETE FROM seller_registration_profiles WHERE shop_id = 2")
  const order = { items: [{ variantId: '1', qty: 1 }], shippingMethod: 'tietkiem', paymentMethod: 'cod', address: { fullName: 'Test Buyer', phone: '0900000000', province: 'Ha Noi', ward: 'Test', detail: '123 Test' } }
  const snapshot = async () => {
    const [[counts]] = await db.query('SELECT (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM addresses) AS addresses')
    const [stock] = await db.query('SELECT id, stock_qty FROM product_variants ORDER BY id')
    return { counts, stock }
  }
  let sequence = 0
  const deniedShipping = async (input) => {
    const before = await snapshot()
    for (const route of ['/orders/preview', '/orders']) {
      const r = await call(route, buyer, 'POST', input, { 'idempotency-key': `seller-security-denied-${++sequence}` })
      assert.equal(r.status, 409); assert.equal(r.body.error.code, 'SHOP_SHIPPING_UNAVAILABLE')
    }
    assert.deepEqual(await snapshot(), before)
  }
  await deniedShipping(order)
  const multi = { ...order, items: [{ variantId: '1', qty: 1 }, { variantId: '3', qty: 1 }], shippingMethod: 'nhanh' }
  assert.equal((await call('/orders/preview', buyer, 'POST', multi)).status, 200)
  const created = await call('/orders', buyer, 'POST', multi, { 'idempotency-key': 'seller-security-legacy-multi' })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM shop_orders'))[0][0].n, 2)
  await saveSellerProfile(async (sql, values) => (await db.query(sql, values))[0], '2', { ...profile, shippingMethods: ['tietkiem'] }, encryptIdentity(profile.idCard))
  await deniedShipping(multi)
  for (const invalid of ['{}', '["unknown"]', '[]']) {
    await db.query('UPDATE seller_registration_profiles SET shipping_methods = ? WHERE shop_id = 1', [invalid])
    await deniedShipping({ ...order, shippingMethod: 'nhanh' })
  }
  // Legacy pending shops require a profile, then a fresh approval version.
  const registered = await call('/auth/register', null, 'POST', { username: 'legacy_pending_security', email: 'pending@example.test', password: 'Isolated-Password-123', fullName: 'Test Seller', role: 'seller', shopName: 'Pending Test' })
  assert.equal(registered.status, 201, JSON.stringify(registered.body))
  const { token: seller, user } = registered.body.data
  const approval = `/admin/shops/${user.shopId}/approval`
  const deniedApproval = await call(approval, adminToken, 'PATCH', { approvalStatus: 'approved', approvalVersion: 1 })
  assert.equal(deniedApproval.body.error.code, 'SHOP_PROFILE_REQUIRED')
  assert.equal((await call('/seller/shop/registration', seller, 'PUT', profile)).status, 200)
  assert.equal((await call(approval, adminToken, 'PATCH', { approvalStatus: 'approved', approvalVersion: 1 })).status, 409)
  const approvals = await Promise.all([
    call(approval, adminToken, 'PATCH', { approvalStatus: 'approved', approvalVersion: 2 }),
    call(approval, adminToken, 'PATCH', { approvalStatus: 'approved', approvalVersion: 2 }),
  ])
  assert.deepEqual(approvals.map((result) => result.status).sort(), [200, 409])
  const login = await call('/auth/login', null, 'POST', { username: 'legacy_pending_security', password: 'Isolated-Password-123' })
  assert.equal(login.status, 200)
  const oldRefresh = login.body.data.refreshToken
  assert.equal(typeof oldRefresh, 'string')
  let currentRefresh = oldRefresh
  let activeSession
  for (let attempt = 0; attempt < 8; attempt++) {
    const refreshed = await Promise.all([call('/auth/refresh', null, 'POST', { refreshToken: currentRefresh }), call('/auth/refresh', null, 'POST', { refreshToken: currentRefresh })])
    assert.deepEqual(refreshed.map((r) => r.status).sort(), [200, 401], `Concurrent refresh iteration ${attempt}`)
    activeSession = refreshed.find((r) => r.status === 200).body.data
    currentRefresh = activeSession.refreshToken
  }
  assert.equal((await call('/auth/refresh', null, 'POST', { refreshToken: oldRefresh })).status, 401)
  const secondLogin = await call('/auth/login', null, 'POST', { username: 'legacy_pending_security', password: 'Isolated-Password-123' })
  assert.equal(secondLogin.status, 200)
  const separateSessions = await Promise.all([
    call('/auth/refresh', null, 'POST', { refreshToken: activeSession.refreshToken }),
    call('/auth/refresh', null, 'POST', { refreshToken: secondLogin.body.data.refreshToken }),
  ])
  assert.deepEqual(separateSessions.map((result) => result.status).sort(), [200, 200])
  activeSession = separateSessions[0].body.data
  const [racingRefresh, password] = await Promise.all([
    call('/auth/refresh', null, 'POST', { refreshToken: activeSession.refreshToken }),
    call('/auth/change-password', activeSession.token, 'POST', { currentPassword: 'Isolated-Password-123', newPassword: 'Changed-Password-123' }),
  ])
  assert.ok([200, 401].includes(racingRefresh.status), `Refresh/password race returned ${racingRefresh.status}`)
  assert.equal(password.status, 200)
  assert.equal((await call('/auth/refresh', null, 'POST', { refreshToken: activeSession.refreshToken })).status, 401)
  if (racingRefresh.status === 200) assert.equal((await call('/auth/refresh', null, 'POST', { refreshToken: racingRefresh.body.data.refreshToken })).status, 401)
  const passwordRefresh = password.body.data.refreshToken
  assert.equal((await call('/auth/logout', null, 'POST', { refreshToken: passwordRefresh })).status, 200)
  assert.equal((await call('/auth/refresh', null, 'POST', { refreshToken: passwordRefresh })).status, 401)
  console.log(`PASS ${version}: isolated migration/re-run, admin/no-store/audit failures/log redaction, rotation partial failure/re-run/concurrency, legacy and multi-shop preview/create, profile approval. Backup/restore: ${backupVerified ? 'PASS' : 'NOT RUN (set SELLER_SECURITY_MYSQLDUMP)'}.`)
} finally {
  console.error = originalError
  if (blocker) { await blocker.rollback(); await blocker.end() }
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve))
  if (dataServer) await new Promise((resolve) => dataServer.close(resolve))
  if (closeDatabase) await closeDatabase()
  await db.query(`DROP DATABASE IF EXISTS \`${name}_restore\`; DROP DATABASE IF EXISTS \`${name}\``)
  await db.end()
  if (backupRoot) {
    assert.ok(path.resolve(backupRoot).startsWith(path.resolve(os.tmpdir()) + path.sep))
    await rm(backupRoot, { recursive: true, force: true })
  }
}
