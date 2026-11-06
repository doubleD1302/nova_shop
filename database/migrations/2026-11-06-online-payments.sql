-- Apply once after checking existing orders/payment schema; keep current COD rows intact.
ALTER TABLE orders MODIFY payment_method ENUM('cod','bank','momo','vnpay','zalopay','card') NOT NULL DEFAULT 'cod';
ALTER TABLE payments MODIFY method ENUM('cod','bank','momo','vnpay','zalopay','card') NOT NULL DEFAULT 'cod';

CREATE TABLE payment_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  provider ENUM('momo','vnpay') NOT NULL,
  reference VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount DECIMAL(15,0) NOT NULL,
  status ENUM('pending','paid','failed','review') NOT NULL DEFAULT 'pending',
  provider_transaction_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NULL,
  result_code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3) NOT NULL,
  processed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_attempts_reference (reference),
  UNIQUE KEY uq_payment_attempts_provider_transaction (provider, provider_transaction_id),
  KEY ix_payment_attempts_order_created (order_id, created_at, id),
  CONSTRAINT fk_payment_attempts_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT ck_payment_attempts_amount CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
