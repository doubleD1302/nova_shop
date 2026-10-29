const fs = require('fs');
const mysql = require('d:/download/nova_shop-main/nova_shop-main/data-api/node_modules/mysql2/promise');

async function run() {
  const sql = fs.readFileSync('d:/download/nova_shop-main/nova_shop-main/database/migrations/2026-10-29-shop-violations-and-email-warnings.sql', 'utf8');
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'shopnova_data_api',
    password: 'ShopNovaDev2026StrongPass',
    database: 'shopnova_dev'
  });
  console.log('Running migration...');
  await conn.query(sql);
  console.log('Migration completed successfully!');
  const [cols] = await conn.query('SHOW COLUMNS FROM shop_violations');
  console.log('Columns:', cols.map(c => c.Field));
  await conn.end();
}

run().catch(console.error);

