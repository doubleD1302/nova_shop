-- Chạy một lần trước khi triển khai API duyệt shop; không đổi trạng thái shop cũ.
-- Nối trạng thái mới ở cuối ENUM để giữ thứ tự các giá trị cũ.
ALTER TABLE shops
  MODIFY COLUMN status ENUM('active','suspended','closed','pending','rejected') NOT NULL DEFAULT 'pending',
  ADD COLUMN approval_version INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN rejection_reason VARCHAR(1000) NULL;

CREATE TABLE shop_approval_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shop_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  action ENUM('submitted','approved','rejected') NOT NULL,
  profile_version INT UNSIGNED NOT NULL,
  reason VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_shop_approval_events_shop (shop_id, id),
  CONSTRAINT fk_shop_approval_event_shop FOREIGN KEY (shop_id) REFERENCES shops (id),
  CONSTRAINT fk_shop_approval_event_actor FOREIGN KEY (actor_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Lịch sử duyệt gian hàng';
