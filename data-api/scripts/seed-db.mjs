import { Sequelize, QueryTypes } from 'sequelize'
import { env } from '../src/config/env.js'

// Công cụ seed chạy thủ công cần chờ cloud khởi động lâu hơn readiness HTTP.
const database = new Sequelize(env.dbName, env.dbUser, env.dbPassword, {
  host: env.dbHost,
  port: env.dbPort,
  dialect: 'mysql',
  logging: false,
  timezone: '+00:00',
  pool: { max: 2, min: 0, acquire: 30000, idle: 10000 },
  retry: { max: 0 },
  dialectOptions: {
    connectTimeout: 25000,
    ...(env.dbSslEnabled ? { ssl: { ca: env.dbSslCaContent, rejectUnauthorized: true, verifyIdentity: true } } : {}),
  },
})

export async function executeQuery(sql, values = [], timeout = 15000, transaction) {
  let type = QueryTypes.UPDATE
  if (/^SELECT\b/i.test(sql)) type = QueryTypes.SELECT
  else if (/^INSERT\b/i.test(sql)) type = QueryTypes.INSERT
  const result = await database.query(sql, {
    replacements: values, type, transaction, timeout,
  })
  return type === QueryTypes.SELECT ? result : { insertId: result[0], affectedRows: result[1] }
}

export function executeTransaction(callback, timeout = 30000) {
  return database.transaction((transaction) => callback((sql, values) => executeQuery(sql, values, timeout, transaction)))
}

export function closeDatabase() {
  return database.close()
}
