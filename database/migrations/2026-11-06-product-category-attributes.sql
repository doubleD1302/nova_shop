-- Thuộc tính ngành hàng phiên bản mẫu, lưu độc lập với specs cũ và SKU.
CREATE TABLE product_category_attributes (
  product_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  definition_version SMALLINT UNSIGNED NOT NULL,
  attribute_values JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (product_id),
  KEY ix_product_category_attributes_category (category_id),
  CONSTRAINT fk_product_category_attributes_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_product_category_attributes_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT ck_product_category_attributes_object CHECK (JSON_TYPE(attribute_values) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
