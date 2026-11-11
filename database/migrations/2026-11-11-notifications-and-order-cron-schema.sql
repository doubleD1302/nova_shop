-- ====================================================================
-- Migration: Hệ thống Thông báo thời gian thực & Tự động hóa Cron Jobs
-- Ngày tạo: 11/11/2026
-- Mô tả:
-- 1. Bảng notifications (thông báo in-app)
-- 2. Bảng user_device_tokens (FCM/Web Push tokens)
-- 3. Cập nhật shop_orders hỗ trợ trạng thái completed và completed_at
-- 4. Cập nhật vouchers hỗ trợ cột status (active, inactive, expired)
-- ====================================================================

-- 1. BẢNG THÔNG BÁO TRONG ỨNG DỤNG (In-app Notifications)
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

-- 2. BẢNG THIẾT BỊ ĐĂNG KÝ NHẬN THÔNG BÁO ĐẨY (FCM / Web Push Tokens)
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

-- 3. CẬP NHẬT SHOP_ORDERS HỖ TRỢ TRẠNG THÁI COMPLETED & COMPLETED_AT
-- Mở rộng ENUM status của shop_orders
ALTER TABLE shop_orders MODIFY COLUMN status ENUM('pending','confirmed','shipping','delivered','completed','cancelled') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái giao hàng của riêng shop';

-- 4. BỔ SUNG CỘT COMPLETED_AT CHO SHOP_ORDERS NẾU CHƯA CÓ
DROP PROCEDURE IF EXISTS upgrade_shop_orders_completed;
DELIMITER $$
CREATE PROCEDURE upgrade_shop_orders_completed()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shop_orders' AND COLUMN_NAME = 'completed_at'
  ) THEN
    ALTER TABLE shop_orders ADD COLUMN completed_at DATETIME(3) NULL AFTER delivered_at;
  END IF;
END$$
DELIMITER ;
CALL upgrade_shop_orders_completed();
DROP PROCEDURE IF EXISTS upgrade_shop_orders_completed;

-- 5. BỔ SUNG CỘT STATUS CHO BẢNG VOUCHERS NẾU CHƯA CÓ
DROP PROCEDURE IF EXISTS upgrade_vouchers_status_col;
DELIMITER $$
CREATE PROCEDURE upgrade_vouchers_status_col()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vouchers' AND COLUMN_NAME = 'status'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN status ENUM('active', 'inactive', 'expired') NOT NULL DEFAULT 'active' AFTER is_active;
    ALTER TABLE vouchers ADD KEY ix_vouchers_status (status);
  END IF;
END$$
DELIMITER ;
CALL upgrade_vouchers_status_col();
DROP PROCEDURE IF EXISTS upgrade_vouchers_status_col;

-- 6. CẬP NHẬT RÀNG BUỘC CHECK CK_SHOP_ORDERS_DELIVERED
ALTER TABLE shop_orders DROP CHECK ck_shop_orders_delivered;
ALTER TABLE shop_orders ADD CONSTRAINT ck_shop_orders_delivered
CHECK (((status IN ('delivered', 'completed') AND delivered_at IS NOT NULL) OR (status NOT IN ('delivered', 'completed') AND delivered_at IS NULL)));

-- 7. CẬP NHẬT ENUM CHO ORDER_EVENTS
ALTER TABLE order_events
MODIFY COLUMN from_status ENUM('pending','confirmed','shipping','delivered','completed','cancelled') NULL COMMENT 'Trạng thái trước; NULL khi tạo mới',
MODIFY COLUMN to_status ENUM('pending','confirmed','shipping','delivered','completed','cancelled') NOT NULL COMMENT 'Trạng thái sau';
