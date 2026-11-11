-- Migration: Bổ sung Quản lý Khiếu nại/Trả hàng nâng cao, Trọng tài Admin, Tài khoản Ngân hàng và Chi trả Doanh thu Seller
-- Ngày tạo: 11/11/2026

-- 1. Tạo bảng lưu thông tin tài khoản ngân hàng của Seller
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

-- 2. Tạo bảng lưu lệnh rút tiền và chi trả doanh thu cho Seller
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

-- 3. Mở rộng ENUM status của order_returns hỗ trợ trạng thái disputed (tranh chấp)
ALTER TABLE order_returns MODIFY COLUMN status ENUM('requested', 'approved', 'rejected', 'completed', 'cancelled', 'disputed') NOT NULL DEFAULT 'requested' COMMENT 'Trạng thái xử lý';

-- 4. Bổ sung cột ghi chú phán quyết của Admin khi giải quyết tranh chấp trả hàng
ALTER TABLE order_returns ADD COLUMN admin_note VARCHAR(500) NULL AFTER seller_note;
