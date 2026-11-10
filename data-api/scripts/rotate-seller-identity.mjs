import { env } from '../src/config/env.js'
import { executeQuery, executeTransaction, closeDatabase } from '../src/config/database.js'
import { rotateSellerIdentities } from '../src/services/seller-identity-rotation.js'

const argument = process.argv[2]
if (!['--check', '--apply'].includes(argument) || process.argv.length !== 3) throw new Error('Dùng --check hoặc --apply; đọc hướng dẫn xoay khóa trước.')
if (!env.sellerIdentityKey || !env.sellerIdentityPreviousKeys.length || env.allowLocalDbFallback) {
  throw new Error('Cần khóa hiện tại, ít nhất một khóa cũ và tắt SQLite fallback.')
}
try {
  const result = await rotateSellerIdentities({ query: executeQuery, transaction: executeTransaction, mode: argument.slice(2) })
  console.log(JSON.stringify(result))
} catch {
  console.error('Không thể kiểm tra hoặc xoay khóa. Dừng; giữ cả khóa hiện tại và khóa cũ, kiểm tra cấu hình rồi chạy lại.')
  process.exitCode = 1
} finally { await closeDatabase() }
