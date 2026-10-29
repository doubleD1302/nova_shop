-- Migration: Shop Violations, Email Warnings, and Suspensions
-- Date: 2026-10-29

CREATE TABLE IF NOT EXISTS shop_violations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shop_id BIGINT UNSIGNED NOT NULL COMMENT 'Shop vi phạm',
  report_id BIGINT UNSIGNED NULL COMMENT 'Hồ sơ báo cáo liên kết (nếu có)',
  violation_number INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Lần vi phạm: 1, 2,...',
  violation_type VARCHAR(100) NOT NULL DEFAULT 'counterfeit' COMMENT 'Loại vi phạm (hàng giả, vi phạm chính sách)',
  reason VARCHAR(2000) NOT NULL COMMENT 'Lý do vi phạm cụ thể',
  action_taken ENUM('warning_email', 'shop_suspended') NOT NULL COMMENT 'Chế tài áp dụng',
  admin_id BIGINT UNSIGNED NOT NULL COMMENT 'Admin phê duyệt xử lý',
  email_sent_to VARCHAR(255) NULL COMMENT 'Email nhận thông báo của chủ shop',
  email_status ENUM('not_configured', 'sending', 'sent', 'failed') NOT NULL DEFAULT 'not_configured' COMMENT 'Trạng thái gửi email',
  email_sent_at DATETIME(3) NULL COMMENT 'Thời điểm email được máy chủ SMTP chấp nhận gửi',
  email_error TEXT NULL COMMENT 'Chi tiết lỗi nếu gửi thất bại',
  email_content TEXT NULL COMMENT 'Nội dung email cảnh cáo/khóa shop',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_shop_report_violation (report_id),
  KEY ix_shop_violations_shop (shop_id, created_at),
  CONSTRAINT fk_shop_violations_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_violations_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_shop_violations_report FOREIGN KEY (report_id) REFERENCES abuse_reports(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử vi phạm và cảnh cáo gian hàng';
