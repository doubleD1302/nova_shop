import fs from 'node:fs';
import mysql from 'mysql2/promise';

async function importSchema() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'shopnova_data_api',
    password: 'ShopNovaDev2026StrongPass',
    database: 'shopnova_dev',
    multipleStatements: true,
  });

  console.log('Connected to shopnova_dev database.');

  let schemaSql = fs.readFileSync('d:/download/nova_shop-main/nova_shop-main/database/schema.sql', 'utf8');
  // Replace collation for MariaDB compatibility
  schemaSql = schemaSql.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_unicode_ci');

  try {
    await conn.query(schemaSql);
    console.log('schema.sql executed successfully.');
  } catch (err) {
    console.error('Error executing schema.sql:', err);
    await conn.end();
    return;
  }

  let seedSql = fs.readFileSync('d:/download/nova_shop-main/nova_shop-main/database/seed.sql', 'utf8');
  seedSql = seedSql.replace(/utf8mb4_0900_ai_ci/g, 'utf8mb4_unicode_ci');

  try {
    await conn.query(seedSql);
    console.log('seed.sql executed successfully.');
  } catch (err) {
    console.error('Error executing seed.sql:', err);
  }

  await conn.end();
}

importSchema().catch(console.error);

