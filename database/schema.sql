-- ShopNova: schema đề xuất v1, MySQL 8.4 / InnoDB / utf8mb4.
-- Chạy một lần trên database dev mới đã chọn; không tự xóa hoặc sửa schema cũ.
-- Đặt timezone UTC cả trong pool kết nối Data API.
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET SESSION time_zone = '+00:00';
SET SESSION sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';


-- Tài khoản người mua và người bán
CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính; API gửi dạng chuỗi',
  username VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Tên đăng nhập đã chuẩn hóa chữ thường',
  password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Hash mật khẩu; không trả qua API',
  full_name VARCHAR(120) NOT NULL COMMENT 'Họ tên hiển thị',
  email VARCHAR(254) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT 'Email duy nhất nếu có; chuẩn hóa trước lưu',
  phone VARCHAR(20) NULL COMMENT 'Số điện thoại dạng chuỗi',
  avatar_url VARCHAR(1024) NULL COMMENT 'URL ảnh đại diện',
  role ENUM('buyer','seller') NOT NULL DEFAULT 'buyer' COMMENT 'Seller vẫn có quyền mua hàng',
  status ENUM('active','blocked') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái tài khoản',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Tài khoản người mua và người bán';

-- Phiên đăng nhập để thu hồi refresh token
CREATE TABLE sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính',
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'Tài khoản sở hữu phiên',
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SHA-256 của refresh token ngẫu nhiên',
  expires_at DATETIME(3) NOT NULL COMMENT 'Hạn hết hiệu lực UTC',
  revoked_at DATETIME(3) NULL COMMENT 'Thời điểm thu hồi',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (token_hash),
  KEY ix_sessions_user_expiry (user_id, expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT ck_sessions_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Phiên đăng nhập để thu hồi refresh token';

-- Sổ địa chỉ giao hàng của tài khoản
CREATE TABLE addresses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính',
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'Chủ địa chỉ',
  recipient_name VARCHAR(120) NOT NULL COMMENT 'Tên người nhận',
  phone VARCHAR(20) NOT NULL COMMENT 'Điện thoại người nhận',
  province VARCHAR(120) NOT NULL COMMENT 'Tỉnh/thành phố',
  district VARCHAR(120) NULL COMMENT 'Quận/huyện theo dữ liệu hiện có; có thể bỏ trống',
  ward VARCHAR(120) NULL COMMENT 'Phường/xã',
  detail VARCHAR(255) NOT NULL COMMENT 'Số nhà, đường và chi tiết giao hàng',
  is_default BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Địa chỉ mặc định',
  deleted_at DATETIME(3) NULL COMMENT 'Xóa mềm địa chỉ',
  default_user_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN is_default = 1 AND deleted_at IS NULL THEN user_id ELSE NULL END) STORED COMMENT 'Cột kỹ thuật bảo đảm tối đa một địa chỉ mặc định; không ghi từ API',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_addresses_default (default_user_id),
  KEY ix_addresses_user (user_id, deleted_at),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT ck_addresses_default CHECK (is_default IN (0,1)),
  CONSTRAINT ck_addresses_deleted CHECK (deleted_at IS NULL OR is_default = 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Sổ địa chỉ giao hàng của tài khoản';

-- Gian hàng thuộc một seller
CREATE TABLE shops (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính',
  owner_id BIGINT UNSIGNED NOT NULL COMMENT 'Tài khoản sở hữu shop',
  slug VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Đường dẫn shop duy nhất',
  name VARCHAR(160) NOT NULL COMMENT 'Tên shop',
  logo_url VARCHAR(1024) NULL COMMENT 'Logo',
  banner_url VARCHAR(1024) NULL COMMENT 'Banner',
  tagline VARCHAR(255) NULL COMMENT 'Giới thiệu ngắn',
  description TEXT NULL COMMENT 'Giới thiệu chi tiết',
  province VARCHAR(120) NOT NULL COMMENT 'Nơi gửi hàng',
  address_detail VARCHAR(255) NULL COMMENT 'Địa chỉ shop',
  is_mall BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Nhãn shop chính hãng do hệ thống quản lý',
  status ENUM('active','suspended','closed') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái gian hàng',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_shops_owner (owner_id),
  UNIQUE KEY uq_shops_slug (slug),
  KEY ix_shops_status_created (status, created_at, id),
  CONSTRAINT fk_shops_owner FOREIGN KEY (owner_id) REFERENCES users (id),
  CONSTRAINT ck_shops_mall CHECK (is_mall IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Gian hàng thuộc một seller';

-- Danh mục, có thể có danh mục con
CREATE TABLE categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính',
  parent_id BIGINT UNSIGNED NULL COMMENT 'Danh mục cha; NULL là danh mục gốc',
  slug VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Slug duy nhất',
  name VARCHAR(160) NOT NULL COMMENT 'Tên danh mục',
  image_url VARCHAR(1024) NULL COMMENT 'Ảnh danh mục',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Thứ tự hiển thị',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Cho phép hiển thị',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug),
  KEY ix_categories_parent (parent_id, sort_order),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (id),
  CONSTRAINT ck_categories_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Danh mục, có thể có danh mục con';

-- Thông tin chung của sản phẩm, giá và kho nằm ở SKU
CREATE TABLE products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính',
  shop_id BIGINT UNSIGNED NOT NULL COMMENT 'Shop bán sản phẩm',
  category_id BIGINT UNSIGNED NOT NULL COMMENT 'Danh mục chính',
  slug VARCHAR(220) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Slug duy nhất',
  name VARCHAR(200) NOT NULL COMMENT 'Tên sản phẩm',
  description TEXT NULL COMMENT 'Mô tả',
  specs JSON NULL COMMENT 'Object thông số hiển thị; không chứa kho hay quyền truy cập',
  badges JSON NULL COMMENT 'Mảng nhãn hiển thị do hệ thống quản lý',
  status ENUM('draft','active','hidden','archived') NOT NULL DEFAULT 'draft' COMMENT 'Vòng đời sản phẩm',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Gợi ý nổi bật',
  is_flash_sale BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Nhãn flash sale; chưa là hệ thống campaign',
  free_shipping BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Chính sách miễn phí ship MVP',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  UNIQUE KEY uq_products_id_shop (id, shop_id),
  KEY ix_products_shop_status (shop_id, status, created_at, id),
  KEY ix_products_category_status (category_id, status, created_at, id),
  KEY ix_products_status_created (status, created_at, id),
  CONSTRAINT fk_products_shop FOREIGN KEY (shop_id) REFERENCES shops (id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT ck_products_specs CHECK (specs IS NULL OR JSON_TYPE(specs) = 'OBJECT'),
  CONSTRAINT ck_products_badges CHECK (badges IS NULL OR JSON_TYPE(badges) = 'ARRAY'),
  CONSTRAINT ck_products_flags CHECK (is_featured IN (0,1) AND is_flash_sale IN (0,1) AND free_shipping IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Thông tin chung của sản phẩm, giá và kho nằm ở SKU';

-- Ảnh sản phẩm theo thứ tự
CREATE TABLE product_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính',
  product_id BIGINT UNSIGNED NOT NULL COMMENT 'Sản phẩm',
  url VARCHAR(1024) NOT NULL COMMENT 'URL ảnh',
  alt_text VARCHAR(200) NULL COMMENT 'Mô tả thay thế',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Thứ tự; ảnh đầu là ảnh đại diện',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_images_position (product_id, sort_order),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Ảnh sản phẩm theo thứ tự';

-- SKU: mỗi cấu hình có giá và tồn kho riêng
CREATE TABLE product_variants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID biến thể gửi dưới dạng chuỗi',
  product_id BIGINT UNSIGNED NOT NULL COMMENT 'Sản phẩm',
  sku VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Mã kho duy nhất',
  variant_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Khóa thuộc tính đã chuẩn hóa; default cho SKU mặc định',
  name VARCHAR(160) NOT NULL COMMENT 'Tên lựa chọn hiển thị',
  attributes JSON NOT NULL COMMENT 'Object lựa chọn, ví dụ size/color',
  price DECIMAL(15,0) NOT NULL COMMENT 'Giá bán VND',
  original_price DECIMAL(15,0) NULL COMMENT 'Giá tham khảo trước giảm; NULL nếu không có',
  stock_qty INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Tồn kho thực; đã trừ lượng đặt hàng',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'SKU được bán',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_variants_sku (sku),
  UNIQUE KEY uq_variants_options (product_id, variant_key),
  UNIQUE KEY uq_variants_id_product (id, product_id),
  KEY ix_variants_product_active_price (product_id, is_active, price),
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT ck_variants_price CHECK (price > 0 AND (original_price IS NULL OR original_price >= price)),
  CONSTRAINT ck_variants_stock CHECK (stock_qty <= 2147483647),
  CONSTRAINT ck_variants_active CHECK (is_active IN (0,1)),
  CONSTRAINT ck_variants_attributes CHECK (JSON_TYPE(attributes) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='SKU: mỗi cấu hình có giá và tồn kho riêng';

-- Giỏ theo user, một dòng cho mỗi SKU
CREATE TABLE cart_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID dòng giỏ',
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'Chủ giỏ',
  variant_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU',
  qty SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Số lượng 1 đến 99',
  selected BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Dòng được chọn để thanh toán',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_items_user_variant (user_id, variant_id),
  KEY ix_cart_items_variant (variant_id),
  CONSTRAINT fk_cart_items_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_cart_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id),
  CONSTRAINT ck_cart_items_qty CHECK (qty BETWEEN 1 AND 99),
  CONSTRAINT ck_cart_items_selected CHECK (selected IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Giỏ theo user, một dòng cho mỗi SKU';

-- Voucher toàn sàn giảm một số tiền VND cố định
CREATE TABLE vouchers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Khóa chính',
  code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Mã chuẩn hóa chữ hoa',
  name VARCHAR(120) NOT NULL COMMENT 'Tên chương trình',
  discount_amount DECIMAL(15,0) NOT NULL COMMENT 'Số tiền giảm cố định',
  min_subtotal DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Giá trị hàng tối thiểu, chưa gồm ship',
  starts_at DATETIME(3) NOT NULL COMMENT 'Bắt đầu UTC',
  ends_at DATETIME(3) NOT NULL COMMENT 'Kết thúc UTC',
  usage_limit INT UNSIGNED NULL COMMENT 'Giới hạn toàn sàn; NULL là không giới hạn',
  per_user_limit SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Số lượt tối đa mỗi user',
  used_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Lượt chưa hoàn trả; cập nhật cùng transaction',
  is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Bật voucher',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_vouchers_code (code),
  CONSTRAINT ck_vouchers_amount CHECK (discount_amount > 0 AND min_subtotal >= 0),
  CONSTRAINT ck_vouchers_dates CHECK (ends_at > starts_at),
  CONSTRAINT ck_vouchers_limits CHECK (per_user_limit > 0 AND (usage_limit IS NULL OR usage_limit > 0) AND (usage_limit IS NULL OR used_count <= usage_limit)),
  CONSTRAINT ck_vouchers_active CHECK (is_active IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Voucher toàn sàn giảm một số tiền VND cố định';

-- Đơn tổng: một lần checkout của người mua
CREATE TABLE orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID đơn tổng',
  buyer_id BIGINT UNSIGNED NOT NULL COMMENT 'Người mua đã xác thực',
  code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Mã đơn để tra cứu',
  idempotency_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Khóa retry do client gửi, duy nhất theo buyer',
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'SHA-256 request đã chuẩn hóa, chống dùng lại key với nội dung khác',
  recipient_name VARCHAR(120) NOT NULL COMMENT 'Snapshot người nhận',
  recipient_phone VARCHAR(20) NOT NULL COMMENT 'Snapshot điện thoại',
  province VARCHAR(120) NOT NULL COMMENT 'Snapshot tỉnh/thành',
  district VARCHAR(120) NULL COMMENT 'Snapshot quận/huyện nếu có',
  ward VARCHAR(120) NULL COMMENT 'Snapshot phường/xã',
  address_detail VARCHAR(255) NOT NULL COMMENT 'Snapshot địa chỉ chi tiết',
  note VARCHAR(500) NULL COMMENT 'Ghi chú giao hàng',
  voucher_code VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT 'Snapshot mã voucher; NULL nếu không dùng',
  payment_method ENUM('cod','bank','momo','zalopay','card') NOT NULL DEFAULT 'cod' COMMENT 'Lựa chọn thanh toán; MVP chỉ bật COD',
  subtotal DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Tổng tiền hàng ban đầu',
  shipping_fee DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Tổng phí ship ban đầu',
  discount_amount DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Tổng giảm voucher ban đầu',
  total_amount DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Tổng tiền checkout ban đầu, giữ nguyên khi hủy một shop',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_code (code),
  UNIQUE KEY uq_orders_retry (buyer_id, idempotency_key),
  UNIQUE KEY uq_orders_id_buyer (id, buyer_id),
  KEY ix_orders_buyer_created (buyer_id, created_at, id),
  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users (id),
  CONSTRAINT ck_orders_money CHECK (subtotal >= 0 AND shipping_fee >= 0 AND discount_amount >= 0 AND discount_amount <= subtotal AND total_amount = subtotal + shipping_fee - discount_amount),
  CONSTRAINT ck_orders_voucher CHECK ((voucher_code IS NULL AND discount_amount = 0) OR (voucher_code IS NOT NULL AND discount_amount > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Đơn tổng: một lần checkout của người mua';

-- Phần đơn riêng của từng shop
CREATE TABLE shop_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID đơn con, seller thao tác trên ID này',
  order_id BIGINT UNSIGNED NOT NULL COMMENT 'Đơn tổng',
  shop_id BIGINT UNSIGNED NOT NULL COMMENT 'Shop xử lý',
  shop_name VARCHAR(160) NOT NULL COMMENT 'Snapshot tên shop',
  status ENUM('pending','confirmed','shipping','delivered','cancelled') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái giao hàng của riêng shop',
  subtotal DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Tiền hàng shop ban đầu',
  shipping_fee DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Phí ship shop ban đầu',
  discount_amount DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Voucher phân bổ cho shop ban đầu',
  total_amount DECIMAL(15,0) NOT NULL DEFAULT 0 COMMENT 'Tiền shop ban đầu',
  shipping_method VARCHAR(40) NOT NULL COMMENT 'Mã phương án vận chuyển đã chọn',
  shipping_name VARCHAR(120) NOT NULL COMMENT 'Snapshot tên vận chuyển',
  tracking_code VARCHAR(100) NULL COMMENT 'Mã vận đơn nếu có',
  cancel_reason VARCHAR(500) NULL COMMENT 'Lý do hủy',
  cancelled_at DATETIME(3) NULL COMMENT 'Thời điểm hủy',
  delivered_at DATETIME(3) NULL COMMENT 'Thời điểm nhận hàng',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_shop_orders_order_shop (order_id, shop_id),
  UNIQUE KEY uq_shop_orders_id_shop (id, shop_id),
  KEY ix_shop_orders_shop_status_created (shop_id, status, created_at, id),
  CONSTRAINT fk_shop_orders_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_shop_orders_shop FOREIGN KEY (shop_id) REFERENCES shops (id),
  CONSTRAINT ck_shop_orders_money CHECK (subtotal >= 0 AND shipping_fee >= 0 AND discount_amount >= 0 AND discount_amount <= subtotal AND total_amount = subtotal + shipping_fee - discount_amount),
  CONSTRAINT ck_shop_orders_cancel CHECK ((status = 'cancelled' AND cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL) OR (status <> 'cancelled' AND cancelled_at IS NULL AND cancel_reason IS NULL)),
  CONSTRAINT ck_shop_orders_delivered CHECK ((status = 'delivered' AND delivered_at IS NOT NULL) OR (status <> 'delivered' AND delivered_at IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Phần đơn riêng của từng shop';

-- Snapshot dòng hàng, thuộc đúng SKU và đúng shop
CREATE TABLE order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID dòng hàng đã mua',
  shop_order_id BIGINT UNSIGNED NOT NULL COMMENT 'Đơn con chứa dòng',
  shop_id BIGINT UNSIGNED NOT NULL COMMENT 'Cột đối chiếu shop, được bảo vệ bằng khóa ngoại ghép',
  product_id BIGINT UNSIGNED NOT NULL COMMENT 'Sản phẩm gốc',
  variant_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU gốc',
  product_name VARCHAR(200) NOT NULL COMMENT 'Snapshot tên sản phẩm',
  product_slug VARCHAR(220) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Snapshot slug khi mua',
  variant_name VARCHAR(160) NOT NULL COMMENT 'Snapshot tên lựa chọn',
  variant_attributes JSON NOT NULL COMMENT 'Snapshot thuộc tính SKU',
  sku VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Snapshot mã SKU',
  image_url VARCHAR(1024) NULL COMMENT 'Snapshot ảnh khi mua',
  unit_price DECIMAL(15,0) NOT NULL COMMENT 'Giá đơn vị lúc đặt',
  original_price DECIMAL(15,0) NULL COMMENT 'Giá tham khảo lúc đặt',
  qty SMALLINT UNSIGNED NOT NULL COMMENT 'Số lượng 1 đến 99',
  line_total DECIMAL(15,0) NOT NULL COMMENT 'unit_price nhân qty',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_items_shop_variant (shop_order_id, variant_id),
  UNIQUE KEY uq_order_items_id_product (id, product_id),
  UNIQUE KEY uq_order_items_id_variant (id, variant_id),
  KEY ix_order_items_shop (shop_order_id, shop_id),
  KEY ix_order_items_product_shop (product_id, shop_id),
  KEY ix_order_items_variant_product (variant_id, product_id),
  CONSTRAINT fk_order_items_shop FOREIGN KEY (shop_order_id, shop_id) REFERENCES shop_orders (id, shop_id),
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id, shop_id) REFERENCES products (id, shop_id),
  CONSTRAINT fk_order_items_variant FOREIGN KEY (variant_id, product_id) REFERENCES product_variants (id, product_id),
  CONSTRAINT ck_order_items_money CHECK (unit_price > 0 AND (original_price IS NULL OR original_price >= unit_price) AND line_total = unit_price * qty),
  CONSTRAINT ck_order_items_qty CHECK (qty BETWEEN 1 AND 99),
  CONSTRAINT ck_order_items_attributes CHECK (JSON_TYPE(variant_attributes) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Snapshot dòng hàng, thuộc đúng SKU và đúng shop';

-- Lịch sử chuyển trạng thái đơn con
CREATE TABLE order_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID sự kiện',
  shop_order_id BIGINT UNSIGNED NOT NULL COMMENT 'Đơn con',
  from_status ENUM('pending','confirmed','shipping','delivered','cancelled') NULL COMMENT 'Trạng thái trước; NULL khi tạo mới',
  to_status ENUM('pending','confirmed','shipping','delivered','cancelled') NOT NULL COMMENT 'Trạng thái sau',
  actor_id BIGINT UNSIGNED NULL COMMENT 'Tài khoản thực hiện; NULL nếu hệ thống',
  note VARCHAR(500) NULL COMMENT 'Ghi chú',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  PRIMARY KEY (id),
  KEY ix_order_events_shop_time (shop_order_id, created_at, id),
  CONSTRAINT fk_order_events_shop FOREIGN KEY (shop_order_id) REFERENCES shop_orders (id),
  CONSTRAINT fk_order_events_actor FOREIGN KEY (actor_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Lịch sử chuyển trạng thái đơn con';

-- Ghi nhận tiền COD theo từng đơn con
CREATE TABLE payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID thanh toán',
  shop_order_id BIGINT UNSIGNED NOT NULL COMMENT 'Đơn con thu tiền',
  method ENUM('cod','bank','momo','zalopay','card') NOT NULL DEFAULT 'cod' COMMENT 'MVP sử dụng cod',
  status ENUM('unpaid','paid','void') NOT NULL DEFAULT 'unpaid' COMMENT 'Chưa thu, đã thu hoặc hủy yêu cầu thu',
  amount DECIMAL(15,0) NOT NULL COMMENT 'Số tiền phải thu của đơn con',
  paid_at DATETIME(3) NULL COMMENT 'Thời điểm xác nhận thực nhận tiền',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_shop_order (shop_order_id),
  CONSTRAINT fk_payments_shop_order FOREIGN KEY (shop_order_id) REFERENCES shop_orders (id),
  CONSTRAINT ck_payments_amount CHECK (amount >= 0),
  CONSTRAINT ck_payments_paid_at CHECK ((status = 'paid' AND paid_at IS NOT NULL) OR (status <> 'paid' AND paid_at IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Ghi nhận tiền COD theo từng đơn con';

-- Lượt dùng voucher và việc hoàn trả lượt
CREATE TABLE voucher_uses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID lượt dùng',
  voucher_id BIGINT UNSIGNED NOT NULL COMMENT 'Voucher',
  order_id BIGINT UNSIGNED NOT NULL COMMENT 'Đơn tổng dùng voucher',
  buyer_id BIGINT UNSIGNED NOT NULL COMMENT 'Người mua đúng chủ đơn',
  discount_amount DECIMAL(15,0) NOT NULL COMMENT 'Snapshot tổng tiền giảm',
  state ENUM('applied','released') NOT NULL DEFAULT 'applied' COMMENT 'Lượt đang tính hoặc đã hoàn',
  released_at DATETIME(3) NULL COMMENT 'Thời điểm hoàn lượt',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_voucher_uses_order (order_id),
  KEY ix_voucher_uses_order_buyer (order_id, buyer_id),
  KEY ix_voucher_uses_user (voucher_id, buyer_id, state),
  CONSTRAINT fk_voucher_uses_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers (id),
  CONSTRAINT fk_voucher_uses_order FOREIGN KEY (order_id, buyer_id) REFERENCES orders (id, buyer_id),
  CONSTRAINT ck_voucher_uses_amount CHECK (discount_amount > 0),
  CONSTRAINT ck_voucher_uses_release CHECK ((state = 'released' AND released_at IS NOT NULL) OR (state = 'applied' AND released_at IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Lượt dùng voucher và việc hoàn trả lượt';

-- Sổ biến động kho để chống trừ hoặc hoàn kho lặp
CREATE TABLE stock_moves (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID biến động',
  variant_id BIGINT UNSIGNED NOT NULL COMMENT 'SKU',
  order_item_id BIGINT UNSIGNED NULL COMMENT 'Dòng mua nếu do đặt/hủy đơn',
  reason ENUM('sale','cancel','restock','adjust') NOT NULL COMMENT 'Bán, hủy, nhập thêm hoặc điều chỉnh',
  delta_qty INT NOT NULL COMMENT 'Lượng thay đổi, có dấu',
  actor_id BIGINT UNSIGNED NULL COMMENT 'Người thực hiện; NULL nếu hệ thống',
  note VARCHAR(255) NULL COMMENT 'Lý do',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_stock_moves_item_reason (order_item_id, reason),
  KEY ix_stock_moves_variant_time (variant_id, created_at, id),
  KEY ix_stock_moves_item_variant (order_item_id, variant_id),
  CONSTRAINT fk_stock_moves_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id),
  CONSTRAINT fk_stock_moves_item FOREIGN KEY (order_item_id, variant_id) REFERENCES order_items (id, variant_id),
  CONSTRAINT fk_stock_moves_actor FOREIGN KEY (actor_id) REFERENCES users (id),
  CONSTRAINT ck_stock_moves_delta CHECK (delta_qty <> 0 AND ((reason = 'sale' AND delta_qty < 0) OR (reason IN ('cancel','restock') AND delta_qty > 0) OR reason = 'adjust')),
  CONSTRAINT ck_stock_moves_reference CHECK ((reason IN ('sale','cancel') AND order_item_id IS NOT NULL) OR (reason IN ('restock','adjust') AND order_item_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Sổ biến động kho để chống trừ hoặc hoàn kho lặp';

-- Đánh giá của người đã mua, một đánh giá mỗi dòng đơn
CREATE TABLE reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID đánh giá',
  order_item_id BIGINT UNSIGNED NOT NULL COMMENT 'Dòng đã mua',
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'Người viết',
  product_id BIGINT UNSIGNED NOT NULL COMMENT 'Sản phẩm đúng dòng đã mua',
  rating TINYINT UNSIGNED NOT NULL COMMENT 'Sao từ 1 đến 5',
  comment TEXT NOT NULL COMMENT 'Nội dung đánh giá',
  status ENUM('visible','hidden') NOT NULL DEFAULT 'visible' COMMENT 'Hiển thị hoặc ẩn',
  seller_reply TEXT NULL COMMENT 'Phản hồi của shop',
  replied_by BIGINT UNSIGNED NULL COMMENT 'Seller phản hồi',
  replied_at DATETIME(3) NULL COMMENT 'Thời điểm phản hồi',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm cập nhật, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_reviews_order_item (order_item_id),
  KEY ix_reviews_item_product (order_item_id, product_id),
  KEY ix_reviews_product_status (product_id, status, created_at, id),
  CONSTRAINT fk_reviews_item FOREIGN KEY (order_item_id, product_id) REFERENCES order_items (id, product_id),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_reviews_reply_user FOREIGN KEY (replied_by) REFERENCES users (id),
  CONSTRAINT ck_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT ck_reviews_reply CHECK ((seller_reply IS NULL AND replied_by IS NULL AND replied_at IS NULL) OR (seller_reply IS NOT NULL AND replied_by IS NOT NULL AND replied_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Đánh giá của người đã mua, một đánh giá mỗi dòng đơn';

-- Ảnh đính kèm đánh giá
CREATE TABLE review_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID ảnh',
  review_id BIGINT UNSIGNED NOT NULL COMMENT 'Đánh giá',
  url VARCHAR(1024) NOT NULL COMMENT 'URL ảnh',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Thứ tự ảnh',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_images_position (review_id, sort_order),
  CONSTRAINT fk_review_images_review FOREIGN KEY (review_id) REFERENCES reviews (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Ảnh đính kèm đánh giá';

-- Lượt thích đánh giá, mỗi user tối đa một lượt
CREATE TABLE review_likes (
  review_id BIGINT UNSIGNED NOT NULL COMMENT 'Đánh giá',
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'Người thích',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  PRIMARY KEY (review_id, user_id),
  KEY ix_review_likes_user (user_id),
  CONSTRAINT fk_review_likes_review FOREIGN KEY (review_id) REFERENCES reviews (id),
  CONSTRAINT fk_review_likes_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Lượt thích đánh giá, mỗi user tối đa một lượt';

-- Shop mà tài khoản đang theo dõi
CREATE TABLE shop_follows (
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'Người theo dõi',
  shop_id BIGINT UNSIGNED NOT NULL COMMENT 'Shop được theo dõi',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  PRIMARY KEY (user_id, shop_id),
  KEY ix_shop_follows_shop (shop_id),
  CONSTRAINT fk_shop_follows_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_shop_follows_shop FOREIGN KEY (shop_id) REFERENCES shops (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Shop mà tài khoản đang theo dõi';

-- Sản phẩm yêu thích của từng tài khoản
CREATE TABLE product_favorites (
  user_id BIGINT UNSIGNED NOT NULL COMMENT 'Người lưu',
  product_id BIGINT UNSIGNED NOT NULL COMMENT 'Sản phẩm được lưu',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Thời điểm tạo, UTC',
  PRIMARY KEY (user_id, product_id),
  KEY ix_product_favorites_product (product_id),
  CONSTRAINT fk_product_favorites_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_product_favorites_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Sản phẩm yêu thích của từng tài khoản';
