import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { env } from '../src/config/env.js'
import { executeQuery, executeTransaction, closeDatabase } from '../src/config/database.js'

async function expectSqlError(query, sql, values, expectedCode) {
  await assert.rejects(() => query(sql, values), (error) => error.code === expectedCode)
}

async function checkDatabase() {
  const [identity] = await executeQuery('SELECT VERSION() AS version, DATABASE() AS db, CURRENT_USER() AS user')
  assert.equal(identity.db, env.dbName)
  assert.equal(identity.user.split('@')[0], env.dbUser)
  assert(!/(^|\.)root$/.test(env.dbUser), 'Ứng dụng phải dùng tài khoản runtime riêng.')
  console.log(`Kết nối Data API thành công: ${identity.version}.`)

  const schema = fs.readFileSync(new URL('../../database/schema.sql', import.meta.url), 'utf8')
  const expectedTables = [...schema.matchAll(/^CREATE TABLE (\w+) /gm)].map((match) => match[1])
  const tables = await executeQuery('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()')
  const names = new Set(tables.map((table) => table.name))
  for (const name of expectedTables) assert(names.has(name), `Thiếu bảng ${name}.`)
  console.log(`Đủ ${expectedTables.length} bảng trong schema.`)

  // TiDB 8.5 không liệt kê CHECK trong TABLE_CONSTRAINTS; đọc DDL thực tế.
  const definitions = []
  for (const name of expectedTables) {
    const [table] = await executeQuery(`SHOW CREATE TABLE \`${name}\``)
    definitions.push(table['Create Table'])
  }
  const ddl = definitions.join('\n')
  const expectedChecks = [...schema.matchAll(/CONSTRAINT (\w+) CHECK/g)].map((match) => match[1])
  for (const name of expectedChecks) {
    assert(ddl.includes(`CONSTRAINT \`${name}\` CHECK`), `Thiếu CHECK: ${name}.`)
  }
  assert(!ddl.includes('NOT ENFORCED'), 'Có CHECK chưa được thực thi.')
  const foreignKeys = [...schema.matchAll(/CONSTRAINT (\w+) FOREIGN KEY/g)].map((match) => match[1])
  for (const name of foreignKeys) assert(ddl.includes(`CONSTRAINT \`${name}\` FOREIGN KEY`), `Thiếu khóa ngoại ${name}.`)
  for (const [, table, body] of schema.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\) ENGINE/g)) {
    const definition = definitions[expectedTables.indexOf(table)]
    for (const [, column] of body.matchAll(/^  ([a-z]\w*) /gm)) {
      assert(definition.includes(`\n  \`${column}\` `), `Thiếu cột ${table}.${column}.`)
    }
  }
  console.log(`Đủ cột, ${expectedChecks.length} CHECK và ${foreignKeys.length} khóa ngoại trong schema.`)

  const grants = await executeQuery('SHOW GRANTS')
  const grantSql = grants.map((row) => Object.values(row)[0]).join('\n')
  assert(!/\b(ALL PRIVILEGES|CREATE|ALTER|DROP|GRANT OPTION|SUPER)\b/.test(grantSql), 'Runtime không được có quyền quản trị.')
  for (const permission of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) assert(grantSql.includes(permission))
  console.log('Quyền runtime chỉ có đọc/ghi dữ liệu.')

  const marker = `dbcheck_${crypto.randomBytes(8).toString('hex')}`
  const rollback = new Error('ROLLBACK_CHECK')
  await assert.rejects(() => executeTransaction(async (query) => {
    const [variant] = await query('SELECT id FROM product_variants LIMIT 1')
    assert(variant, 'Cần ít nhất một SKU để kiểm tra CHECK giá.')
    await expectSqlError(query, 'UPDATE product_variants SET price = 0 WHERE id = ?', [variant.id], 'ER_CHECK_CONSTRAINT_VIOLATED')
    await expectSqlError(query, 'INSERT INTO cart_items (user_id, variant_id, qty) VALUES (0, ?, 1)', [variant.id], 'ER_NO_REFERENCED_ROW_2')
    const user = await query('INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)', [marker, 'unusable-check-hash', 'Kiểm tra rollback'])
    await expectSqlError(query, 'INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)', [marker, 'unusable-check-hash', 'Kiểm tra trùng'], 'ER_DUP_ENTRY')
    const addressSql = 'INSERT INTO addresses (user_id, recipient_name, phone, province, ward, detail, is_default) VALUES (?, ?, ?, ?, ?, ?, TRUE)'
    const address = [user.insertId, 'Kiểm tra', '0900000000', 'Tỉnh mẫu', 'Phường mẫu', 'Địa chỉ mẫu']
    await query(addressSql, address)
    await expectSqlError(query, addressSql, address, 'ER_DUP_ENTRY')
    throw rollback
  }, 15000), (error) => error === rollback)
  const [{ count }] = await executeQuery('SELECT COUNT(*) AS count FROM users WHERE username = ?', [marker])
  assert.equal(Number(count), 0)
  console.log('CHECK giá, khóa ngoại, unique username/địa chỉ mặc định và rollback: PASS; không lưu dữ liệu kiểm tra.')
}

try {
  await checkDatabase()
} catch (error) {
  console.error(error.code ? `Kiểm tra thất bại (${error.code}).` : error.message)
  process.exitCode = 1
} finally {
  await closeDatabase()
}
