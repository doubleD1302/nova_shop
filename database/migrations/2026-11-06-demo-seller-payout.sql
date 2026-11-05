-- Dữ liệu minh họa tách biệt khỏi đơn hàng và tiền thật.
CREATE TABLE demo_seller_payouts (
  shop_id BIGINT UNSIGNED NOT NULL,
  balance BIGINT UNSIGNED NOT NULL DEFAULT 1000000,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (shop_id),
  CONSTRAINT fk_demo_payout_shop FOREIGN KEY (shop_id) REFERENCES shops (id),
  CONSTRAINT ck_demo_payout_balance CHECK (balance <= 1000000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE demo_payout_withdrawals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shop_id BIGINT UNSIGNED NOT NULL,
  request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount BIGINT UNSIGNED NOT NULL,
  balance_after BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_demo_payout_request (shop_id, request_key),
  CONSTRAINT fk_demo_withdrawal_shop FOREIGN KEY (shop_id) REFERENCES demo_seller_payouts (shop_id),
  CONSTRAINT ck_demo_withdrawal_amount CHECK (amount > 0 AND amount <= 1000000 AND balance_after <= 1000000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
