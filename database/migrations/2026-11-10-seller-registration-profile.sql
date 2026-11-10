CREATE TABLE IF NOT EXISTS seller_registration_profiles (
  shop_id BIGINT UNSIGNED NOT NULL,
  pickup_address VARCHAR(255) NOT NULL,
  province VARCHAR(120) NOT NULL,
  contact_email VARCHAR(254) NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  shipping_methods TEXT NOT NULL,
  business_type VARCHAR(20) NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  identity_encrypted TEXT NOT NULL,
  identity_last4 CHAR(4) NOT NULL,
  tax_code VARCHAR(20) NULL,
  invoice_email VARCHAR(254) NULL,
  agreed_at DATETIME(3) NOT NULL,
  PRIMARY KEY (shop_id),
  CONSTRAINT fk_seller_registration_shop FOREIGN KEY (shop_id) REFERENCES shops (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
