import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { upgradeLocalColumns } from '../src/config/sqlite-upgrade.js'

const input = process.argv[2]
if (!input || process.argv.length !== 3) throw new Error('Dùng: node scripts/upgrade-local-db.mjs <đường dẫn file SQLite>')
const file = path.resolve(input)
if (!fs.statSync(file).isFile()) throw new Error('Đường dẫn phải là file SQLite có sẵn.')
const backup = `${file}.before-upgrade`
if (fs.existsSync(backup)) throw new Error('File backup đã tồn tại; hãy chọn vị trí sao lưu khác trước khi chạy.')
const db = new DatabaseSync(file)
try {
  // VACUUM INTO tạo bản sao nhất quán kể cả khi database đang dùng WAL.
  db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`)
  const added = upgradeLocalColumns(db)
  console.log(`Đã thêm ${added.length} cột; bản sao lưu: ${backup}`)
  console.log('Các giá trị lịch sử chưa xác định để NULL và cần được kiểm tra trước khi sử dụng.')
} finally { db.close() }
