import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../../data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}
const dbPath = path.join(dataDir, 'shopnova_local.sqlite')

let dbInstance = null

export function getLocalDatabase() {
  if (dbInstance) return dbInstance

  const db = new DatabaseSync(dbPath)

  // Đăng ký các hàm tương thích MySQL cho SQLite
  db.function('CONCAT', { varargs: true }, (...args) => args.map((a) => (a === null || a === undefined ? '' : String(a))).join(''))
  db.function('FIELD', { varargs: true }, (val, ...items) => {
    const strVal = String(val)
    const idx = items.findIndex((x) => String(x) === strVal)
    return idx === -1 ? 0 : idx + 1
  })
  db.function('IF', { varargs: true }, (cond, tVal, fVal) => (cond ? tVal : fVal))
  db.function('UTC_TIMESTAMP', { varargs: true }, () => new Date().toISOString())
  db.function('NOW', { varargs: true }, () => new Date().toISOString())
  db.function('DATABASE', () => 'shopnova_dev')
  db.function('JSON_ARRAY', { varargs: true }, (...args) => JSON.stringify(args))
  db.function('JSON_OBJECT', { varargs: true }, (...args) => {
    const obj = {}
    for (let i = 0; i < args.length; i += 2) {
      if (i + 1 < args.length) obj[args[i]] = args[i + 1]
    }
    return JSON.stringify(obj)
  })

  // Khởi tạo bảng dữ liệu khớp 100% với database/schema.sql
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      firebase_uid TEXT UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      avatar_url TEXT,
      role TEXT DEFAULT 'buyer',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      province TEXT NOT NULL,
      district TEXT,
      ward TEXT,
      detail TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      logo_url TEXT,
      banner_url TEXT,
      tagline TEXT,
      description TEXT,
      province TEXT NOT NULL,
      address_detail TEXT,
      is_mall INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      suspension_reason TEXT,
      suspended_by INTEGER,
      suspended_at TEXT,
      approval_version INTEGER DEFAULT 1,
      rejection_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seller_registration_profiles (
      shop_id INTEGER PRIMARY KEY,
      pickup_address TEXT NOT NULL, province TEXT NOT NULL,
      contact_email TEXT NOT NULL, contact_phone TEXT NOT NULL,
      shipping_methods TEXT NOT NULL, business_type TEXT NOT NULL,
      owner_name TEXT NOT NULL, identity_encrypted TEXT NOT NULL, identity_last4 TEXT NOT NULL,
      tax_code TEXT, invoice_email TEXT, agreed_at TEXT NOT NULL,
      FOREIGN KEY (shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS seller_identity_access_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, shop_id INTEGER NOT NULL, admin_id INTEGER NOT NULL,
      reason TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (shop_id) REFERENCES shops(id), FOREIGN KEY (admin_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS shop_approval_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      actor_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      profile_version INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shop_follows (
      user_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, shop_id)
    );

    CREATE TABLE IF NOT EXISTS shop_violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      report_id INTEGER,
      violation_number INTEGER DEFAULT 1,
      violation_type TEXT DEFAULT 'counterfeit',
      reason TEXT NOT NULL,
      action_taken TEXT NOT NULL,
      admin_id INTEGER NOT NULL,
      email_sent_to TEXT,
      email_status TEXT DEFAULT 'not_configured',
      email_sent_at TEXT,
      email_error TEXT,
      email_content TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      image_url TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS category_attribute_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      definition_version INTEGER DEFAULT 1,
      attribute_values TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_category_attributes (
      product_id INTEGER PRIMARY KEY,
      category_id INTEGER NOT NULL,
      definition_version INTEGER DEFAULT 1,
      attribute_values TEXT DEFAULT '{}',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      specs TEXT DEFAULT '{}',
      badges TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      approval_status TEXT DEFAULT 'approved',
      rejection_reason TEXT,
      reviewed_by INTEGER,
      reviewed_at TEXT,
      is_featured INTEGER DEFAULT 1,
      is_flash_sale INTEGER DEFAULT 1,
      free_shipping INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_favorites (
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      sku TEXT,
      variant_key TEXT DEFAULT 'default',
      name TEXT NOT NULL,
      attributes TEXT DEFAULT '{}',
      price REAL NOT NULL,
      original_price REAL,
      stock_qty INTEGER DEFAULT 50,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      alt_text TEXT,
      sort_order INTEGER DEFAULT 0,
      is_primary INTEGER DEFAULT 0,
      source_page_url TEXT,
      author TEXT,
      license_name TEXT,
      license_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER DEFAULT 1,
      variant_id INTEGER NOT NULL,
      qty INTEGER DEFAULT 1,
      quantity INTEGER DEFAULT 1,
      selected INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (user_id, variant_id)
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      discount_amount REAL NOT NULL,
      min_subtotal REAL DEFAULT 0,
      starts_at TEXT DEFAULT '2026-01-01T00:00:00.000Z',
      ends_at TEXT DEFAULT '2028-12-31T23:59:59.000Z',
      usage_limit INTEGER DEFAULT 1000,
      per_user_limit INTEGER DEFAULT 1,
      used_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS voucher_wallet (
      user_id INTEGER NOT NULL,
      voucher_id INTEGER NOT NULL,
      saved_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, voucher_id)
    );

    CREATE TABLE IF NOT EXISTS voucher_uses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      discount_amount REAL NOT NULL,
      state TEXT DEFAULT 'applied',
      released_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      buyer_id INTEGER NOT NULL,
      idempotency_key TEXT DEFAULT '',
      request_hash TEXT DEFAULT '',
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      address_detail TEXT NOT NULL,
      province TEXT NOT NULL,
      district TEXT,
      ward TEXT,
      note TEXT,
      voucher_code TEXT,
      payment_method TEXT DEFAULT 'cod',
      subtotal REAL DEFAULT 0,
      shipping_fee REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'delivered',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shop_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      shop_name TEXT NOT NULL,
      status TEXT DEFAULT 'delivered',
      subtotal REAL DEFAULT 0,
      shipping_fee REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      shipping_method TEXT DEFAULT 'tietkiem',
      shipping_name TEXT DEFAULT 'Tiết kiệm',
      tracking_code TEXT,
      cancel_reason TEXT,
      cancelled_at TEXT,
      delivered_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_order_id INTEGER NOT NULL,
      shop_id INTEGER DEFAULT 1,
      product_id INTEGER NOT NULL,
      variant_id INTEGER DEFAULT 1,
      product_name TEXT NOT NULL,
      product_slug TEXT DEFAULT 'san-pham',
      variant_name TEXT DEFAULT 'Tiêu chuẩn',
      variant_attributes TEXT DEFAULT '{}',
      sku TEXT DEFAULT 'SKU-1',
      image_url TEXT,
      unit_price REAL DEFAULT 180000,
      original_price REAL,
      price REAL DEFAULT 180000,
      qty INTEGER DEFAULT 1,
      line_total REAL DEFAULT 180000,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_order_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor_id INTEGER,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_order_id INTEGER UNIQUE NOT NULL,
      method TEXT DEFAULT 'cod',
      status TEXT DEFAULT 'unpaid',
      amount REAL DEFAULT 0,
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      reference TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      provider_transaction_id TEXT,
      result_code TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id INTEGER NOT NULL,
      order_item_id INTEGER,
      reason TEXT NOT NULL,
      delta_qty INTEGER NOT NULL,
      actor_id INTEGER,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      shop_order_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      detail TEXT,
      images TEXT DEFAULT '[]',
      refund_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'requested',
      seller_note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shipment_trackings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_order_id INTEGER NOT NULL,
      tracking_code TEXT NOT NULL,
      carrier TEXT NOT NULL,
      status TEXT NOT NULL,
      location TEXT,
      description TEXT NOT NULL,
      event_time TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_item_id INTEGER DEFAULT 1,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      status TEXT DEFAULT 'visible',
      seller_reply TEXT,
      replied_by INTEGER,
      replied_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_likes (
      review_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (review_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS abuse_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      shop_id INTEGER,
      reason TEXT NOT NULL,
      details TEXT,
      evidence_url TEXT,
      status TEXT DEFAULT 'investigating',
      resolved_by INTEGER,
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS demo_seller_payouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER UNIQUE NOT NULL,
      balance REAL DEFAULT 1000000,
      pending_balance REAL DEFAULT 250000,
      total_withdrawn REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS demo_payout_withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      request_key TEXT DEFAULT 'req_1',
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      last_message TEXT,
      last_message_at TEXT DEFAULT (datetime('now')),
      buyer_unread_count INTEGER DEFAULT 0,
      seller_unread_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL,
      message TEXT NOT NULL,
      attachments TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Kiểm tra và seed dữ liệu mẫu
  seedInitialData(db)

  dbInstance = db
  return dbInstance
}

function seedInitialData(db) {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get()?.c || 0
  if (userCount > 0) return

  const hashAdmin = bcrypt.hashSync('DemoAdmin2026', 10)
  const hashSeller = bcrypt.hashSync('DemoSeller2026', 10)
  const hashBuyer = bcrypt.hashSync('DemoBuyer2026', 10)

  // 1. Users (bao gồm cả tài khoản demo mới & cũ)
  const userStmt = db.prepare(`
    INSERT INTO users (id, username, password_hash, full_name, email, phone, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  userStmt.run(1, 'demo_buyer_guest', hashBuyer, 'DEMO - Khách Mua Minh Họa', 'demo-buyer@shopnova.local', '0900000101', 'buyer', 'active')
  userStmt.run(2, 'demo_seller_guest', hashSeller, 'DEMO - Người Bán Minh Họa', 'demo-seller@shopnova.local', '0900000102', 'seller', 'active')
  userStmt.run(3, 'demo_seller_b', hashSeller, 'Shop Nova Seller B', 'seller-b@example.test', '0912345679', 'seller', 'active')
  userStmt.run(99, 'demo_admin_guest', hashAdmin, 'DEMO - Quản Trị Minh Họa', 'demo-admin@shopnova.local', '0900000103', 'admin', 'active')

  // 2. Addresses
  const addrStmt = db.prepare(`
    INSERT INTO addresses (id, user_id, recipient_name, phone, province, district, ward, detail, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  addrStmt.run(1, 1, 'DEMO - Khách Mua Minh Họa', '0900000101', 'TP. Hồ Chí Minh', 'Quận 1', 'Phường Bến Nghé', 'Số 10 Nguyễn Huệ', 1)
  addrStmt.run(2, 2, 'DEMO - Người Bán Minh Họa', '0900000102', 'TP. Hồ Chí Minh', 'Quận 3', 'Phường Võ Thị Sáu', '123 Lê Lợi', 1)
  addrStmt.run(3, 99, 'DEMO - Quản Trị Minh Họa', '0900000103', 'Hà Nội', 'Quận Ba Đình', 'Phường Điện Biên', 'Số 1 Độc Lập', 1)

  // 3. Shops
  const shopStmt = db.prepare(`
    INSERT INTO shops (id, owner_id, slug, name, tagline, description, province, address_detail, status, is_mall)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  shopStmt.run(1, 2, 'demo-gian-hang-minh-hoa', 'DEMO - Gian Hàng Minh Họa', 'DỮ LIỆU MẪU MINH HỌA', 'Gian hàng người bán chính thức trên ShopNova', 'TP. Hồ Chí Minh', 'Số 20 Lê Lợi, Quận 1', 'active', 1)
  shopStmt.run(2, 3, 'shop-mau-b', 'DEMO - Shop mẫu B', 'DỮ LIỆU THẬT', 'Gian hàng người bán B', 'Hà Nội', 'Số 15 Hàng Bài, Hoàn Kiếm', 'active', 0)

  // 4. Categories
  const catStmt = db.prepare(`INSERT INTO categories (id, slug, name, sort_order) VALUES (?, ?, ?, ?)`)
  catStmt.run(1, 'thoi-trang-nam', 'Thời trang nam', 1)
  catStmt.run(2, 'dien-thoai', 'Điện thoại và phụ kiện', 2)
  catStmt.run(3, 'thoi-trang-nu', 'Thời trang nữ', 3)
  catStmt.run(4, 'giay-dep', 'Giày dép', 4)
  catStmt.run(5, 'tui-xach', 'Túi xách', 5)
  catStmt.run(6, 'my-pham', 'Mỹ phẩm', 6)
  catStmt.run(7, 'nha-cua-doi-song', 'Nhà cửa & đời sống', 7)
  catStmt.run(8, 'phu-kien-cong-nghe', 'Phụ kiện công nghệ', 8)

  // 5. Products & Variants (Mỗi sản phẩm có đủ 4 ảnh theo chuẩn Backend)
  const prodStmt = db.prepare(`
    INSERT INTO products (id, shop_id, category_id, slug, name, description, specs, badges, status, is_featured, is_flash_sale, free_shipping, approval_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const variantStmt = db.prepare(`
    INSERT INTO product_variants (id, product_id, sku, variant_key, name, attributes, price, original_price, stock_qty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const imgStmt = db.prepare(`INSERT INTO product_images (product_id, url, sort_order, is_primary) VALUES (?, ?, ?, ?)`)

  const productsData = [
    { id: 1, shopId: 1, catId: 1, slug: 'demo-ao-thun-mau', name: 'DEMO - Áo thun nam Cotton Compact', price: 180000, orig: 220000, img: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80' },
    { id: 2, shopId: 2, catId: 2, slug: 'demo-cu-sac-mau', name: 'DEMO - Củ sạc nhanh GaN 65W 3 cổng', price: 350000, orig: 450000, img: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80' },
    { id: 3, shopId: 1, catId: 4, slug: 'demo-giay-sneaker', name: 'DEMO - Giày Sneaker Thể Thao Nam Trắng', price: 450000, orig: 550000, img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80' },
    { id: 4, shopId: 2, catId: 5, slug: 'demo-tui-vai', name: 'DEMO - Túi vải Canvas phong cách Vintage', price: 120000, orig: 150000, img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80' },
    { id: 5, shopId: 1, catId: 6, slug: 'demo-kem-duong', name: 'DEMO - Kem Dưỡng Ẩm Chuyên Sâu 50ml', price: 230000, orig: 290000, img: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80' },
    { id: 6, shopId: 2, catId: 7, slug: 'demo-den-ban', name: 'DEMO - Đèn Bàn LED Chống Cận Thị Cảm Ứng', price: 310000, orig: 390000, img: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80' },
    { id: 7, shopId: 1, catId: 8, slug: 'demo-tai-nghe', name: 'DEMO - Tai Nghe Bluetooth Chống Ồn ANC', price: 590000, orig: 750000, img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80' },
    { id: 8, shopId: 2, catId: 3, slug: 'demo-ao-khoac-nu', name: 'DEMO - Áo Khoác Nữ Cardigan Mùa Thu', price: 520000, orig: 620000, img: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=600&q=80' },
  ]

  for (const p of productsData) {
    prodStmt.run(p.id, p.shopId, p.catId, p.slug, p.name, `${p.name} chính hãng chất lượng cao.`, '{}', '[]', 'active', 1, 1, 1, 'approved')
    variantStmt.run(p.id, p.id, `SKU-${p.id}`, 'default', 'Tiêu chuẩn', '{}', p.price, p.orig, 50)
    for (let idx = 0; idx < 4; idx++) {
      imgStmt.run(p.id, p.img, idx, idx === 0 ? 1 : 0)
    }
  }

  // 6. Orders
  db.prepare(`
    INSERT INTO orders (id, code, buyer_id, idempotency_key, request_hash, subtotal, shipping_fee, discount_amount, total_amount, payment_method, recipient_name, recipient_phone, address_detail, province, status)
    VALUES (1, 'ORD-2026-001', 1, 'init_seed_order_0001', 'hash_0001', 180000, 0, 0, 180000, 'cod', 'DEMO - Khách Mua Minh Họa', '0900000101', 'Số 10 Nguyễn Huệ', 'TP. Hồ Chí Minh', 'delivered')
  `).run()

  db.prepare(`
    INSERT INTO shop_orders (id, order_id, shop_id, shop_name, subtotal, shipping_fee, discount_amount, total_amount, shipping_method, shipping_name, status)
    VALUES (1, 1, 1, 'DEMO - Gian Hàng Minh Họa', 180000, 0, 0, 180000, 'tietkiem', 'Tiết kiệm', 'delivered')
  `).run()

  db.prepare(`
    INSERT INTO order_items (id, shop_order_id, shop_id, product_id, variant_id, product_name, product_slug, variant_name, variant_attributes, sku, image_url, unit_price, price, qty, line_total)
    VALUES (1, 1, 1, 1, 1, 'DEMO - Áo thun nam Cotton Compact', 'demo-ao-thun-mau', 'Tiêu chuẩn', '{}', 'SKU-1', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80', 180000, 180000, 1, 180000)
  `).run()

  db.prepare(`
    INSERT INTO payments (id, shop_order_id, method, status, amount)
    VALUES (1, 1, 'cod', 'paid', 180000)
  `).run()

  // 7. Payouts
  db.prepare(`INSERT INTO demo_seller_payouts (shop_id, balance, pending_balance, total_withdrawn) VALUES (1, 1000000, 250000, 0)`).run()
  db.prepare(`INSERT INTO demo_seller_payouts (shop_id, balance, pending_balance, total_withdrawn) VALUES (2, 1000000, 120000, 0)`).run()

  // 8. Vouchers
  db.prepare(`
    INSERT INTO vouchers (id, code, name, discount_amount, min_subtotal, starts_at, ends_at, usage_limit, per_user_limit)
    VALUES (1, 'NOVA20K', 'Voucher giảm 20.000₫ cho đơn từ 200k', 20000, 200000, '2026-01-01T00:00:00.000Z', '2028-12-31T23:59:59.000Z', 1000, 1)
  `).run()
}

/**
 * Thực thi câu lệnh SQL trên SQLite fallback
 */
export function executeLocalQuery(sql, values = []) {
  const db = getLocalDatabase()

  let cleanSql = sql
    .replace(/\bFOR\s+UPDATE\b/gi, '')
    .replace(/\bLOCK\s+IN\s+SHARE\s+MODE\b/gi, '')
    .replace(/DATE_ADD\([^)]+\)/gi, "datetime('now', '+15 minutes')")
    .replace(/UTC_TIMESTAMP\(\d*\)/gi, "datetime('now')")
    .trim()

  if (/information_schema\.columns/i.test(cleanSql)) {
    return [{ 1: 1 }]
  }
  if (/^SET\s+/i.test(cleanSql)) {
    return []
  }

  const normalizedValues = values.map((v) => {
    if (v instanceof Date) return v.toISOString()
    if (typeof v === 'boolean') return v ? 1 : 0
    if (v === undefined) return null
    return v
  })

  const isSelect = /^SELECT\b/i.test(cleanSql)

  try {
    const stmt = db.prepare(cleanSql)
    if (isSelect) {
      return stmt.all(...normalizedValues)
    } else {
      const res = stmt.run(...normalizedValues)
      return {
        insertId: Number(res.lastInsertRowid),
        affectedRows: res.changes,
        changedRows: res.changes,
      }
    }
  } catch (err) {
    console.error('[LocalDB Error] Event: QUERY_FAILED')
    throw err
  }
}

/**
 * Thực thi transaction trên SQLite fallback
 */
export async function executeLocalTransaction(operationFn) {
  const db = getLocalDatabase()
  db.exec('BEGIN TRANSACTION')
  try {
    const query = async (sql, values = []) => executeLocalQuery(sql, values)
    const result = await operationFn(query)
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/**
 * Kiểm tra readiness của SQLite fallback
 */
export function checkLocalReadiness() {
  return [{ result: 2 }]
}
