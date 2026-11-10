CREATE TABLE IF NOT EXISTS seller_identity_access_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shop_id BIGINT UNSIGNED NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_seller_identity_events_shop (shop_id, id),
  CONSTRAINT fk_seller_identity_events_shop FOREIGN KEY (shop_id) REFERENCES shops (id),
  CONSTRAINT fk_seller_identity_events_admin FOREIGN KEY (admin_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
