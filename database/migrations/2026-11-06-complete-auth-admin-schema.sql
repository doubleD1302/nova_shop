-- Bổ sung các phần schema còn thiếu trên database ứng dụng đã triển khai.
-- Chạy một lần sau khi xử lý số điện thoại trùng; không chạy lại schema.sql/seed.sql.

ALTER TABLE users
  ADD COLUMN firebase_uid VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL
    COMMENT 'UID Firebase đã xác minh; NULL với tài khoản mật khẩu' AFTER password_hash,
  ADD UNIQUE KEY uq_users_firebase_uid (firebase_uid),
  ADD UNIQUE KEY uq_users_phone (phone);

ALTER TABLE shops
  ADD COLUMN suspension_reason VARCHAR(1000) NULL AFTER status,
  ADD COLUMN suspended_by BIGINT UNSIGNED NULL AFTER suspension_reason,
  ADD COLUMN suspended_at DATETIME(3) NULL AFTER suspended_by,
  ADD CONSTRAINT fk_shops_suspended_by FOREIGN KEY (suspended_by)
    REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE products
  ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') NULL DEFAULT NULL AFTER status,
  ADD COLUMN rejection_reason VARCHAR(1000) NULL AFTER approval_status,
  ADD COLUMN reviewed_by BIGINT UNSIGNED NULL AFTER rejection_reason,
  ADD COLUMN reviewed_at DATETIME(3) NULL AFTER reviewed_by,
  ADD CONSTRAINT fk_products_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id);

-- Sản phẩm cũ giữ NULL; sản phẩm tạo sau migration mặc định chờ duyệt.
ALTER TABLE products
  MODIFY COLUMN approval_status ENUM('pending', 'approved', 'rejected') NULL DEFAULT 'pending';

CREATE TABLE abuse_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_id BIGINT UNSIGNED NOT NULL,
  target_type ENUM('shop','product','user','review') NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  shop_id BIGINT UNSIGNED NULL,
  reason VARCHAR(2000) NOT NULL,
  details TEXT NULL,
  evidence_url VARCHAR(1024) NULL,
  status ENUM('open','investigating','confirmed_violation','dismissed','resolved') NOT NULL DEFAULT 'open',
  resolved_by BIGINT UNSIGNED NULL,
  resolved_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_abuse_reports_status_created (status, created_at, id),
  KEY ix_abuse_reports_target (target_type, target_id),
  KEY ix_abuse_reports_reporter (reporter_id, created_at),
  KEY ix_abuse_reports_shop (shop_id),
  CONSTRAINT fk_abuse_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users (id),
  CONSTRAINT fk_abuse_reports_resolver FOREIGN KEY (resolved_by) REFERENCES users (id),
  CONSTRAINT fk_abuse_reports_shop FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE shop_violations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shop_id BIGINT UNSIGNED NOT NULL,
  report_id BIGINT UNSIGNED NULL,
  violation_number INT UNSIGNED NOT NULL DEFAULT 1,
  violation_type VARCHAR(100) NOT NULL DEFAULT 'counterfeit',
  reason VARCHAR(2000) NOT NULL,
  action_taken ENUM('warning_email', 'shop_suspended') NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  email_sent_to VARCHAR(255) NULL,
  email_status ENUM('not_configured', 'sending', 'sent', 'failed') NOT NULL DEFAULT 'not_configured',
  email_sent_at DATETIME(3) NULL,
  email_error TEXT NULL,
  email_content TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_shop_report_violation (report_id),
  KEY ix_shop_violations_shop (shop_id, created_at),
  CONSTRAINT fk_shop_violations_shop FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_violations_admin FOREIGN KEY (admin_id) REFERENCES users (id),
  CONSTRAINT fk_shop_violations_report FOREIGN KEY (report_id) REFERENCES abuse_reports (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
