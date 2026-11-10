import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shopnova-upgrade-test-'))
const file = path.join(root, 'old.sqlite')
try {
  const db = new DatabaseSync(file)
  db.exec(`CREATE TABLE cart_items (id INTEGER PRIMARY KEY, quantity INTEGER);
    INSERT INTO cart_items VALUES (1, 3);
    CREATE TABLE order_items (id INTEGER PRIMARY KEY, price REAL, qty INTEGER);
    INSERT INTO order_items VALUES (1, 15000, 2);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, total_amount REAL);
    INSERT INTO orders VALUES (1, 30000);`)
  db.close()
  const cli = path.resolve('scripts/upgrade-local-db.mjs')
  const result = spawnSync(process.execPath, [cli, file], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const upgraded = new DatabaseSync(file)
  assert.equal(upgraded.prepare('SELECT qty FROM cart_items').get().qty, 3)
  const item = upgraded.prepare('SELECT unit_price, line_total, sku FROM order_items').get()
  assert.equal(item.unit_price, 15000)
  assert.equal(item.line_total, 30000)
  assert.equal(item.sku, null)
  assert.equal(upgraded.prepare('SELECT total_amount, subtotal FROM orders').get().subtotal, null)
  upgraded.close()
  const backup = new DatabaseSync(`${file}.before-upgrade`)
  assert.equal(backup.prepare('PRAGMA table_info(cart_items)').all().some((column) => column.name === 'qty'), false)
  backup.close()
  assert.notEqual(spawnSync(process.execPath, [cli, file], { encoding: 'utf8' }).status, 0)
  console.log('PASS: SQLite cũ, backup, giữ dữ liệu và chặn ghi đè backup')
} finally { await fs.rm(root, { recursive: true, force: true }) }
