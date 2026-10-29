import bcrypt from 'file:///d:/download/nova_shop-main/nova_shop-main/data-api/node_modules/bcryptjs/index.js';
import mysql from 'file:///d:/download/nova_shop-main/nova_shop-main/data-api/node_modules/mysql2/promise.js';

async function setupAccounts() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'shopnova_data_api',
    password: 'ShopNovaDev2026StrongPass',
    database: 'shopnova_dev',
  });

  const buyerHash = bcrypt.hashSync('Buyer123456', 10);
  const sellerHash = bcrypt.hashSync('Seller123456', 10);
  const adminHash = bcrypt.hashSync('Admin123456', 10);

  // 1. Update demo_buyer
  await conn.query(
    `UPDATE users SET password_hash = ?, full_name = 'Nguyễn Văn Mua', email = 'buyer@shopnova.vn', status = 'active' WHERE username = 'demo_buyer'`,
    [buyerHash]
  );
  console.log('Updated demo_buyer password and profile.');

  // 2. Update demo_seller_a
  await conn.query(
    `UPDATE users SET password_hash = ?, full_name = 'ShopNova Official Seller', email = 'seller@shopnova.vn', status = 'active' WHERE username = 'demo_seller_a'`,
    [sellerHash]
  );
  console.log('Updated demo_seller_a password and profile.');

  // 3. Create or update demo_admin
  const [existingAdmin] = await conn.query(`SELECT id FROM users WHERE username = 'demo_admin'`);
  if (existingAdmin.length === 0) {
    await conn.query(
      `INSERT INTO users (username, password_hash, full_name, email, role, status) VALUES ('demo_admin', ?, 'Quản Trị Viên Hệ Thống', 'admin@shopnova.vn', 'admin', 'active')`,
      [adminHash]
    );
    console.log('Created demo_admin account.');
  } else {
    await conn.query(
      `UPDATE users SET password_hash = ?, role = 'admin', status = 'active' WHERE username = 'demo_admin'`,
      [adminHash]
    );
    console.log('Updated demo_admin account.');
  }

  // 4. Insert categories: 'may-tinh', 'thiet-bi-gia-dung' if missing
  const [existingCats] = await conn.query(`SELECT slug FROM categories WHERE slug IN ('may-tinh', 'thiet-bi-gia-dung')`);
  const slugs = existingCats.map(c => c.slug);
  if (!slugs.includes('may-tinh')) {
    await conn.query(`INSERT INTO categories (slug, name, sort_order, is_active) VALUES ('may-tinh', 'Máy tính & Laptop', 9, 1)`);
    console.log('Added category: may-tinh');
  }
  if (!slugs.includes('thiet-bi-gia-dung')) {
    await conn.query(`INSERT INTO categories (slug, name, sort_order, is_active) VALUES ('thiet-bi-gia-dung', 'Thiết bị gia dụng & Nhà bếp', 10, 1)`);
    console.log('Added category: thiet-bi-gia-dung');
  }

  const [users] = await conn.query('SELECT id, username, full_name, email, role, status FROM users');
  console.log('Current users:', users);

  await conn.end();
}

setupAccounts().catch(console.error);

