import { DatabaseSync } from 'node:sqlite';
import bcrypt from '../data-api/node_modules/bcryptjs/index.js';

async function setupAdminAndSeller() {
  console.log('[Setup] Đang đồng bộ tài khoản admin và người bán vào SQLite...');
  const hashAdmin = bcrypt.hashSync('Admin@123', 10);
  const hashSeller = bcrypt.hashSync('Seller@123', 10);

  const localDb = new DatabaseSync('data-api/data/shopnova_local.sqlite');
  
  // 1. Thêm user admin: admin / Admin@123
  localDb.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, email, phone, role, status)
    VALUES (98, 'admin', ?, 'ShopNova Quản Trị Hệ Thống', 'admin@shopnova.vn', '0900000099', 'admin', 'active')
    ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, role = 'admin', status = 'active'
  `).run(hashAdmin);

  // 2. Cập nhật demo_seller_a có shop hoạt động và mật khẩu Seller@123
  localDb.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, email, phone, role, status)
    VALUES (102, 'demo_seller_a', ?, 'ShopNova Chủ Gian Hàng A', 'seller_a@shopnova.vn', '0900000102', 'seller', 'active')
    ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, role = 'seller', status = 'active'
  `).run(hashSeller);

  // 3. Shop 4 cho demo_seller_a
  localDb.prepare(`
    INSERT OR REPLACE INTO shops (id, owner_id, slug, name, tagline, description, province, status, is_mall)
    VALUES (4, 102, 'shop-gian-hang-a', 'ShopNova Gian Hàng Tiêu Chuẩn', 'Gian hàng chính thức ShopNova', 'Kênh bán hàng chất lượng cao', 'TP. Hồ Chí Minh', 'active', 1)
  `).run();

  // 4. Thêm sản phẩm vào Shop 4
  const pCount = localDb.prepare('SELECT count(*) as c FROM products WHERE shop_id = 4').get();
  if (!pCount || pCount.c === 0) {
    localDb.prepare(`
      INSERT OR REPLACE INTO products (id, shop_id, category_id, slug, name, description, specs, badges, status, is_featured, is_flash_sale, free_shipping, approval_status)
      VALUES (901, 4, 1, 'ao-polo-shopnova-premium', 'Áo Polo Nam ShopNova Premium', 'Chất liệu cao cấp co giãn 4 chiều.', '{}', '[]', 'active', 1, 1, 1, 'approved')
    `).run();
    localDb.prepare(`
      INSERT OR REPLACE INTO product_variants (id, product_id, sku, variant_key, name, attributes, price, original_price, stock_qty)
      VALUES (901, 901, 'SKU-POLO-01', 'default', 'Tiêu chuẩn', '{}', 250000, 350000, 100)
    `).run();
    localDb.prepare(`
      INSERT OR REPLACE INTO product_images (product_id, url, sort_order, is_primary)
      VALUES (901, 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600', 0, 1)
    `).run();
  }

  // 5. Thêm đơn hàng cho Shop 4 để Seller có đơn hàng quản trị thực tế
  const oCount = localDb.prepare('SELECT count(*) as c FROM shop_orders WHERE shop_id = 4').get();
  if (!oCount || oCount.c === 0) {
    localDb.prepare(`
      INSERT OR REPLACE INTO orders (id, code, buyer_id, idempotency_key, request_hash, recipient_name, recipient_phone, address_detail, province, subtotal, shipping_fee, discount_amount, total_amount, payment_method, status)
      VALUES (901, 'ORD-2026-SELLER-A', 1, 'key_901', 'hash_901', 'DEMO - Khách Mua Minh Họa', '0900000101', '123 Lê Lợi', 'TP. Hồ Chí Minh', 250000, 0, 0, 250000, 'cod', 'pending')
    `).run();
    localDb.prepare(`
      INSERT OR REPLACE INTO shop_orders (id, order_id, shop_id, shop_name, subtotal, shipping_fee, discount_amount, total_amount, status)
      VALUES (901, 901, 4, 'ShopNova Gian Hàng Tiêu Chuẩn', 250000, 0, 0, 250000, 'pending')
    `).run();
    localDb.prepare(`
      INSERT OR REPLACE INTO order_items (id, shop_order_id, shop_id, product_id, variant_id, product_name, price, qty, line_total)
      VALUES (901, 901, 4, 901, 901, 'Áo Polo Nam ShopNova Premium', 250000, 1, 250000)
    `).run();
  }

  console.log('[Setup] Hoàn tất cập nhật tài khoản và dữ liệu thành công!');
}

setupAdminAndSeller();
