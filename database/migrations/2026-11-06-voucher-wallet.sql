-- Lưu voucher theo người dùng; không thay đổi lượt sử dụng checkout.
CREATE TABLE voucher_wallet (
  user_id BIGINT UNSIGNED NOT NULL,
  voucher_id BIGINT UNSIGNED NOT NULL,
  saved_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, voucher_id),
  KEY ix_voucher_wallet_order (user_id, saved_at, voucher_id),
  CONSTRAINT fk_voucher_wallet_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_voucher_wallet_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
