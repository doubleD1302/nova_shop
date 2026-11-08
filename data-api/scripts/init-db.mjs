import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

// Chỉ khởi tạo database trống; không nâng cấp hoặc xóa database đã có bảng.
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' })
const config = process.env
const database = config.DB_NAME
const databaseDir = fileURLToPath(new URL('../../database/', import.meta.url))
const seed = process.argv.includes('--seed')

async function initialize() {
  if (process.argv.slice(2).some((arg) => arg !== '--seed')) {
    throw new Error('Chỉ hỗ trợ tùy chọn --seed để nạp dữ liệu mẫu.')
  }
  if (!database || !/^[a-zA-Z0-9_]{1,64}$/.test(database)
      || ['mysql', 'sys', 'test', 'information_schema', 'performance_schema'].includes(database.toLowerCase())) {
    throw new Error('DB_NAME phải là tên database ứng dụng riêng, chỉ gồm chữ, số hoặc dấu gạch dưới.')
  }
  for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD']) {
    if (!config[key]) throw new Error(`Thiếu cấu hình ${key}.`)
  }
  if (!['true', 'false'].includes(config.DB_SSL_ENABLED)) {
    throw new Error('DB_SSL_ENABLED phải là true hoặc false.')
  }
  if (config.DB_SSL_ENABLED === 'true' && !config.DB_SSL_CA) {
    throw new Error('Thiếu cấu hình DB_SSL_CA.')
  }

  const connection = await mysql.createConnection({
    host: config.DB_HOST,
    port: Number(config.DB_PORT),
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    connectTimeout: 15000,
    multipleStatements: true,
    ...(config.DB_SSL_ENABLED === 'true' ? {
      ssl: { ca: fs.readFileSync(config.DB_SSL_CA), rejectUnauthorized: true, verifyIdentity: true },
    } : {}),
  })

  try {
    const [tables] = await connection.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [database],
    )
    if (tables.length) throw new Error('Database đã có bảng. Dừng để bảo toàn dữ liệu; không chạy lại schema/seed.')

    const [[{ version }]] = await connection.query('SELECT VERSION() AS version')
    if (version.includes('TiDB')) {
      // TiDB 8.5 mặc định không thực thi CHECK nếu chưa bật tính năng này.
      await connection.query('SET GLOBAL tidb_enable_check_constraint = ON')
      const [[setting]] = await connection.query("SHOW GLOBAL VARIABLES LIKE 'tidb_enable_check_constraint'")
      if (setting?.Value !== 'ON') throw new Error('TiDB chưa bật CHECK; dừng trước khi tạo bảng.')
    }

    await connection.query(`CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`)
    await connection.changeUser({ database })
    const schema = fs.readFileSync(path.join(databaseDir, 'schema.sql'), 'utf8')
    await connection.query(schema)
    if (seed) {
      try {
        await connection.query(fs.readFileSync(path.join(databaseDir, 'seed.sql'), 'utf8'))
      } catch (error) {
        await connection.rollback()
        throw error
      }
    }
    const [[{ count }]] = await connection.query(
      'SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?', [database],
    )
    console.log(`Đã tạo ${database}: ${count} bảng; dữ liệu mẫu: ${seed ? 'đã nạp' : 'chưa nạp'}.`)
  } finally {
    await connection.end()
  }
}

initialize().catch((error) => {
  // Lỗi SQL có thể chứa dữ liệu hoặc thông tin kết nối; chỉ công khai mã lỗi.
  console.error(error.code ? `Khởi tạo thất bại (${error.code}).` : error.message)
  console.error('Không xóa bảng đã tạo. Kiểm tra trạng thái database trước khi chạy lại.')
  process.exitCode = 1
})
