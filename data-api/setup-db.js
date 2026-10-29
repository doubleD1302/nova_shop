import mysql from 'mysql2/promise';

async function setup() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    multipleStatements: true,
  });

  console.log('Connected to MySQL as root.');
  await conn.query("CREATE DATABASE IF NOT EXISTS shopnova_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
  console.log('Database shopnova_dev verified.');
  
  await conn.query("CREATE USER IF NOT EXISTS 'shopnova_data_api'@'127.0.0.1' IDENTIFIED BY 'ShopNovaDev2026StrongPass';");
  await conn.query("CREATE USER IF NOT EXISTS 'shopnova_data_api'@'localhost' IDENTIFIED BY 'ShopNovaDev2026StrongPass';");
  await conn.query("GRANT ALL PRIVILEGES ON shopnova_dev.* TO 'shopnova_data_api'@'127.0.0.1';");
  await conn.query("GRANT ALL PRIVILEGES ON shopnova_dev.* TO 'shopnova_data_api'@'localhost';");
  await conn.query("FLUSH PRIVILEGES;");
  console.log('User shopnova_data_api created and granted privileges.');

  await conn.end();
}

setup().catch(console.error);

