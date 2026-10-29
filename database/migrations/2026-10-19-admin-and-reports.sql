ALTER TABLE users
  MODIFY role ENUM('buyer','seller','admin') NOT NULL DEFAULT 'buyer';

CREATE TABLE IF NOT EXISTS abuse_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_id BIGINT UNSIGNED NOT NULL,
  target_type ENUM('shop','product','user','review') NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(2000) NOT NULL,
  status ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
  resolved_by BIGINT UNSIGNED NULL,
  resolved_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_abuse_reports_status_created (status, created_at, id),
  KEY ix_abuse_reports_target (target_type, target_id),
  KEY ix_abuse_reports_reporter (reporter_id, created_at),
  CONSTRAINT fk_abuse_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users (id),
  CONSTRAINT fk_abuse_reports_resolver FOREIGN KEY (resolved_by) REFERENCES users (id),
  CONSTRAINT ck_abuse_reports_resolution CHECK ((status = 'open' AND resolved_by IS NULL AND resolved_at IS NULL) OR (status <> 'open' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Báo cáo vi phạm do người dùng gửi';

-- Tạo admin có chủ đích, sau khi xác định tài khoản cần cấp quyền:
-- UPDATE users SET role = 'admin' WHERE username = 'approved_admin_username';
