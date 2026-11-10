-- 1. Bảng lưu trữ cấu hình hệ thống runtime (bảo trì, tỷ lệ hoa hồng, phí sàn)
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(64) NOT NULL COMMENT 'Khóa cấu hình',
  setting_value TEXT NOT NULL COMMENT 'Giá trị cấu hình (chuỗi hoặc JSON)',
  description VARCHAR(255) NULL COMMENT 'Mô tả mục đích cấu hình',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật cuối',
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Cấu hình hệ thống runtime';

-- Khởi tạo giá trị mặc định cho cấu hình hệ thống
INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
('maintenance_mode', 'false', 'Chế độ bảo trì hệ thống (true/false)'),
('commission_rate', '5.0', 'Tỷ lệ hoa hồng sàn (%)'),
('platform_fee', '1000', 'Phí cố định trên mỗi đơn hàng sàn (VND)');

-- 2. Bổ sung shop_id cho bảng vouchers để hỗ trợ mã giảm giá riêng của từng gian hàng
-- Dùng procedure hoặc kiểm tra cột để không lỗi nếu cột đã tồn tại
DROP PROCEDURE IF EXISTS upgrade_vouchers_table;
DELIMITER $$
CREATE PROCEDURE upgrade_vouchers_table()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vouchers' AND COLUMN_NAME = 'shop_id'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN shop_id BIGINT UNSIGNED NULL AFTER id;
    ALTER TABLE vouchers ADD CONSTRAINT fk_vouchers_shop FOREIGN KEY (shop_id) REFERENCES shops (id);
    ALTER TABLE vouchers ADD KEY ix_vouchers_shop (shop_id, is_active);
  END IF;
END$$
DELIMITER ;
CALL upgrade_vouchers_table();
DROP PROCEDURE IF EXISTS upgrade_vouchers_table;

-- 3. Bảng chiến dịch marketing và flash sale
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính',
  name VARCHAR(150) NOT NULL COMMENT 'Tên chiến dịch',
  type ENUM('flash_sale', 'mega_sale', 'category_day') NOT NULL DEFAULT 'flash_sale' COMMENT 'Loại chiến dịch',
  description TEXT NULL COMMENT 'Mô tả chiến dịch',
  starts_at DATETIME(3) NOT NULL COMMENT 'Thời điểm bắt đầu',
  ends_at DATETIME(3) NOT NULL COMMENT 'Thời điểm kết thúc',
  banner_url VARCHAR(500) NULL COMMENT 'Banner chiến dịch',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Bật chiến dịch',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_campaigns_dates (is_active, starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Chiến dịch marketing và flash sale';

-- Dữ liệu mẫu ban đầu cho chiến dịch Flash Sale
INSERT IGNORE INTO marketing_campaigns (id, name, type, description, starts_at, ends_at, is_active) VALUES
(1, 'Flash Sale Giờ Vàng Mỗi Ngày', 'flash_sale', 'Đăng ký các sản phẩm hot giảm sâu từ 20% đến 50%', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 1),
(2, 'Mega Sale Cuối Tháng', 'mega_sale', 'Siêu hội giảm giá toàn sàn cho tất cả các ngành hàng', NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY), 1);

-- 4. Bảng đăng ký tham gia chiến dịch của người bán
CREATE TABLE IF NOT EXISTS campaign_registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính',
  campaign_id BIGINT UNSIGNED NOT NULL COMMENT 'ID chiến dịch',
  shop_id BIGINT UNSIGNED NOT NULL COMMENT 'ID shop tham gia',
  product_id BIGINT UNSIGNED NOT NULL COMMENT 'Sản phẩm đăng ký',
  discount_price DECIMAL(15,0) NOT NULL COMMENT 'Giá khuyến mãi cam kết',
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái duyệt',
  note VARCHAR(255) NULL COMMENT 'Ghi chú duyệt hoặc từ chối',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_campaign_product (campaign_id, product_id),
  KEY ix_camp_reg_shop (shop_id, status),
  CONSTRAINT fk_camp_reg_campaign FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns (id),
  CONSTRAINT fk_camp_reg_shop FOREIGN KEY (shop_id) REFERENCES shops (id),
  CONSTRAINT fk_camp_reg_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Đăng ký chiến dịch marketing của người bán';

-- 5. Bảng mua gói đẩy sản phẩm (Quảng cáo / Boost)
CREATE TABLE IF NOT EXISTS product_boosts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính',
  shop_id BIGINT UNSIGNED NOT NULL COMMENT 'ID shop sở hữu',
  product_id BIGINT UNSIGNED NOT NULL COMMENT 'Sản phẩm đẩy',
  package_type ENUM('basic_1d', 'standard_3d', 'premium_7d') NOT NULL COMMENT 'Gói đẩy sản phẩm',
  starts_at DATETIME(3) NOT NULL COMMENT 'Thời gian bắt đầu đẩy',
  ends_at DATETIME(3) NOT NULL COMMENT 'Thời gian kết thúc đẩy',
  status ENUM('active', 'expired') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái gói',
  cost_vnd DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Phí mua gói đẩy',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_product_boosts_status (product_id, status, ends_at),
  CONSTRAINT fk_product_boosts_shop FOREIGN KEY (shop_id) REFERENCES shops (id),
  CONSTRAINT fk_product_boosts_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Gói đẩy sản phẩm / quảng cáo của seller';
