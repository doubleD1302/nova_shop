import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.tidb')
dotenv.config({ path: envPath })

const config = process.env

async function run() {
  console.log(`Đang kết nối TiDB Cloud với tài khoản quản trị: ${config.DB_USER}...`)
  const connection = await mysql.createConnection({
    host: config.DB_HOST,
    port: Number(config.DB_PORT),
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    connectTimeout: 20000,
    multipleStatements: true,
    ...(config.DB_SSL_ENABLED === 'true' ? {
      ssl: { ca: fs.readFileSync(config.DB_SSL_CA), rejectUnauthorized: true, verifyIdentity: true },
    } : {}),
  })

  try {
    console.log('=== BẮT ĐẦU ÁP DỤNG MIGRATION THÔNG BÁO VÀ CRON JOBS ===')

    // 1. Tạo bảng notifications
    console.log('-> 1. Tạo bảng notifications...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID thông báo',
        user_id BIGINT UNSIGNED NOT NULL COMMENT 'Người nhận thông báo',
        title VARCHAR(255) NOT NULL COMMENT 'Tiêu đề thông báo',
        content TEXT NOT NULL COMMENT 'Nội dung chi tiết thông báo',
        type VARCHAR(50) NOT NULL DEFAULT 'system' COMMENT 'Loại: order, chat, promotion, system, voucher',
        link VARCHAR(255) NULL COMMENT 'Link điều hướng trên web/app',
        is_read BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Trạng thái đã đọc',
        read_at DATETIME(3) NULL COMMENT 'Thời điểm đọc',
        metadata JSON NULL COMMENT 'Dữ liệu phụ trợ JSON (orderId, shopId, v.v.)',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo UTC',
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật UTC',
        PRIMARY KEY (id),
        KEY ix_notifications_user_read_created (user_id, is_read, created_at),
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Thông báo in-app cho người dùng';
    `)
    console.log('   ✓ Bảng notifications đã sẵn sàng.')

    // 2. Tạo bảng user_device_tokens
    console.log('-> 2. Tạo bảng user_device_tokens...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_device_tokens (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID khóa chính',
        user_id BIGINT UNSIGNED NOT NULL COMMENT 'ID người dùng',
        token VARCHAR(500) NOT NULL COMMENT 'FCM token hoặc Web Push token',
        device_type ENUM('web', 'android', 'ios') NOT NULL DEFAULT 'web' COMMENT 'Loại thiết bị',
        last_used_at DATETIME(3) NULL COMMENT 'Thời gian dùng gần nhất',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_user_device_token (user_id, token),
        KEY ix_device_tokens_user (user_id),
        CONSTRAINT fk_device_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='FCM device tokens cho Push Notification';
    `)
    console.log('   ✓ Bảng user_device_tokens đã sẵn sàng.')

    // 3. Cập nhật shop_orders status enum
    console.log('-> 3. Mở rộng ENUM status của shop_orders hỗ trợ completed...')
    await connection.query(`
      ALTER TABLE shop_orders MODIFY COLUMN status ENUM('pending','confirmed','shipping','delivered','completed','cancelled') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái giao hàng của riêng shop';
    `)
    console.log('   ✓ Đã cập nhật enum status của shop_orders thành công.')

    // 4. Bổ sung completed_at cho shop_orders
    console.log('-> 4. Kiểm tra cột completed_at trong shop_orders...')
    const [shopCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'completed_at'
    `, [config.DB_NAME])

    if (shopCols.length === 0) {
      console.log('   Bổ sung cột completed_at vào shop_orders...')
      await connection.query(`ALTER TABLE shop_orders ADD COLUMN completed_at DATETIME(3) NULL AFTER delivered_at;`)
      console.log('   ✓ Đã thêm completed_at thành công!')
    } else {
      console.log('   ✓ Cột completed_at đã tồn tại.')
    }

    // 5. Bổ sung status cho vouchers
    console.log('-> 5. Kiểm tra cột status trong vouchers...')
    const [voucherCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'vouchers' AND COLUMN_NAME = 'status'
    `, [config.DB_NAME])

    if (voucherCols.length === 0) {
      console.log('   Bổ sung cột status vào vouchers...')
      await connection.query(`ALTER TABLE vouchers ADD COLUMN status ENUM('active', 'inactive', 'expired') NOT NULL DEFAULT 'active' AFTER is_active;`)
      await connection.query(`ALTER TABLE vouchers ADD KEY ix_vouchers_status (status);`)
      console.log('   ✓ Đã thêm cột status vào vouchers thành công!')
    } else {
      console.log('   ✓ Cột status đã tồn tại trong vouchers.')
    }

    // 6. Cập nhật CHECK constraint ck_shop_orders_delivered hỗ trợ trạng thái completed
    console.log('-> 6. Cập nhật CHECK constraint ck_shop_orders_delivered hỗ trợ completed...')
    try {
      await connection.query('ALTER TABLE shop_orders DROP CHECK ck_shop_orders_delivered;')
    } catch {}
    await connection.query(`
      ALTER TABLE shop_orders ADD CONSTRAINT ck_shop_orders_delivered
      CHECK (((status IN ('delivered', 'completed') AND delivered_at IS NOT NULL) OR (status NOT IN ('delivered', 'completed') AND delivered_at IS NULL)));
    `)
    console.log('   ✓ Đã cập nhật ràng buộc CHECK ck_shop_orders_delivered thành công!')

    // 7. Cập nhật ENUM của order_events hỗ trợ completed
    console.log('-> 7. Cập nhật ENUM của order_events hỗ trợ completed...')
    await connection.query(`
      ALTER TABLE order_events
      MODIFY COLUMN from_status ENUM('pending','confirmed','shipping','delivered','completed','cancelled') NULL COMMENT 'Trạng thái trước; NULL khi tạo mới',
      MODIFY COLUMN to_status ENUM('pending','confirmed','shipping','delivered','completed','cancelled') NOT NULL COMMENT 'Trạng thái sau';
    `)
    console.log('   ✓ Đã cập nhật ENUM order_events thành công!')

    console.log('\n🎉 ÁP DỤNG TOÀN BỘ MIGRATION THÀNH CÔNG VÀO TI DB!')
  } catch (err) {
    console.error('❌ Lỗi khi áp dụng migration:', err)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

run()
