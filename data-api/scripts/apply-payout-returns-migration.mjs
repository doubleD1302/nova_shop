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
    console.log('=== BẮT ĐẦU ÁP DỤNG MIGRATION RETURNS, DISPUTES VÀ SELLER PAYOUT ===')

    // 1. Tạo bảng seller_bank_accounts
    console.log('-> 1. Tạo bảng seller_bank_accounts...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS seller_bank_accounts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID tài khoản ngân hàng',
        shop_id BIGINT UNSIGNED NOT NULL COMMENT 'Shop sở hữu',
        bank_name VARCHAR(100) NOT NULL COMMENT 'Tên ngân hàng (Vietcombank, MB, Techcombank...)',
        bank_code VARCHAR(20) NOT NULL COMMENT 'Mã ngân hàng (VCB, MB, TCB...)',
        account_number VARCHAR(50) NOT NULL COMMENT 'Số tài khoản ngân hàng',
        account_holder VARCHAR(150) NOT NULL COMMENT 'Tên chủ tài khoản',
        branch VARCHAR(150) NULL COMMENT 'Chi nhánh',
        is_verified BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Trạng thái xác minh',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uq_seller_bank_shop (shop_id),
        CONSTRAINT fk_seller_bank_shop FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Tài khoản ngân hàng nhận tiền chi trả của người bán';
    `)
    console.log('   ✓ Bảng seller_bank_accounts đã sẵn sàng.')

    // 2. Tạo bảng seller_payout_requests
    console.log('-> 2. Tạo bảng seller_payout_requests...')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS seller_payout_requests (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID lệnh chi trả',
        payout_code VARCHAR(64) NOT NULL UNIQUE COMMENT 'Mã định danh lệnh rút tiền',
        shop_id BIGINT UNSIGNED NOT NULL COMMENT 'Shop yêu cầu',
        bank_account_id BIGINT UNSIGNED NOT NULL COMMENT 'Tài khoản ngân hàng nhận tiền',
        amount DECIMAL(15,0) NOT NULL COMMENT 'Số tiền yêu cầu rút',
        fee DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Phí giao dịch rút tiền',
        net_amount DECIMAL(15,0) NOT NULL COMMENT 'Số tiền thực chuyển',
        status ENUM('pending', 'approved', 'processing', 'completed', 'rejected') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái lệnh chi trả',
        rejection_reason VARCHAR(255) NULL COMMENT 'Lý do từ chối nếu có',
        transaction_reference VARCHAR(100) NULL COMMENT 'Mã giao dịch ngân hàng / ủy nhiệm chi',
        admin_note VARCHAR(255) NULL COMMENT 'Ghi chú duyệt của quản trị viên',
        processed_at DATETIME(3) NULL COMMENT 'Thời điểm hoàn tất chi trả',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY ix_seller_payout_shop (shop_id, status),
        KEY ix_seller_payout_status (status, created_at),
        CONSTRAINT fk_seller_payout_shop FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE,
        CONSTRAINT fk_seller_payout_bank FOREIGN KEY (bank_account_id) REFERENCES seller_bank_accounts (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Lệnh rút tiền và chi trả doanh thu cho người bán';
    `)
    console.log('   ✓ Bảng seller_payout_requests đã sẵn sàng.')

    // 3. Cập nhật order_returns: bổ sung status 'disputed' và cột admin_note
    console.log('-> 3. Mở rộng ENUM status của order_returns hỗ trợ disputed...')
    await connection.query(`
      ALTER TABLE order_returns MODIFY COLUMN status ENUM('requested', 'approved', 'rejected', 'completed', 'cancelled', 'disputed') NOT NULL DEFAULT 'requested' COMMENT 'Trạng thái xử lý';
    `)
    console.log('   ✓ Đã cập nhật enum status của order_returns thành công.')

    console.log('-> 4. Kiểm tra cột admin_note trong order_returns...')
    const [retCols] = await connection.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_returns' AND COLUMN_NAME = 'admin_note'
    `, [config.DB_NAME])

    if (retCols.length === 0) {
      console.log('   Bổ sung cột admin_note vào order_returns...')
      await connection.query(`ALTER TABLE order_returns ADD COLUMN admin_note VARCHAR(500) NULL AFTER seller_note;`)
      console.log('   ✓ Đã thêm admin_note vào order_returns thành công!')
    } else {
      console.log('   ✓ Cột admin_note đã tồn tại trong order_returns.')
    }

    console.log('\n🎉 ÁP DỤNG TOÀN BỘ MIGRATION THÀNH CÔNG VÀO TI DB!')
  } catch (err) {
    console.error('❌ Lỗi khi áp dụng migration:', err)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

run()
