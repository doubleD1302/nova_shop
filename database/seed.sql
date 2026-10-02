-- Dữ liệu minh họa dev; chạy một lần sau schema.sql trên database trống.
-- Mật khẩu là hash của giá trị ngẫu nhiên không lưu lại. Không có tài khoản demo đăng nhập sẵn.
-- Dữ liệu được viết riêng cho thiết kế, không phải dump hay mật khẩu mock của project.
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET SESSION time_zone = '+00:00';
START TRANSACTION;

INSERT INTO users (id, username, password_hash, full_name, email, role) VALUES
  (1, 'demo_buyer', '$2b$12$6UhiH4VfZJ6rizVzQAiavOfmUCiyfYRc5vKxbDNtb/V.eqgFCR54a', 'Người mua mẫu', 'buyer@example.test', 'buyer'),
  (2, 'demo_seller_a', '$2b$12$Wk4oS3AEjsy..Pjewq7zU.OIUO..vcSQuwuH8FKI45DVv5oVWnIfW', 'Người bán mẫu A', 'seller-a@example.test', 'seller'),
  (3, 'demo_seller_b', '$2b$12$756p7jO1GIta077P8pZYDO2a4VJjYQ.g1OrXMvHh/LAsrughJXABe', 'Người bán mẫu B', 'seller-b@example.test', 'seller');

INSERT INTO addresses (id, user_id, recipient_name, phone, province, ward, detail, is_default)
VALUES (1, 1, 'Người mua mẫu', '0900000000', 'TP. Hồ Chí Minh', 'Phường mẫu', 'Địa chỉ minh họa', TRUE);

INSERT INTO shops (id, owner_id, slug, name, province) VALUES
  (1, 2, 'shop-mau-a', 'Shop mẫu A', 'TP. Hồ Chí Minh'),
  (2, 3, 'shop-mau-b', 'Shop mẫu B', 'Hà Nội');

INSERT INTO categories (id, slug, name, sort_order) VALUES
  (1, 'thoi-trang-nam', 'Thời trang nam', 1),
  (2, 'dien-thoai', 'Điện thoại và phụ kiện', 2);

INSERT INTO products (id, shop_id, category_id, slug, name, description, specs, badges, status, is_featured) VALUES
  (1, 1, 1, 'ao-thun-mau', 'Áo thun mẫu', 'Sản phẩm dev có hai SKU.', JSON_OBJECT('Chất liệu','Cotton'), JSON_ARRAY(), 'active', TRUE),
  (2, 2, 2, 'cu-sac-mau', 'Củ sạc mẫu', 'Sản phẩm dev có SKU mặc định.', JSON_OBJECT('Công suất','65W'), JSON_ARRAY(), 'active', TRUE);

INSERT INTO product_variants (id, product_id, sku, variant_key, name, attributes, price, original_price, stock_qty) VALUES
  (1, 1, 'DEMO-AO-M', 'size=m', 'Size M', JSON_OBJECT('size','M'), 180000, 220000, 10),
  (2, 1, 'DEMO-AO-L', 'size=l', 'Size L', JSON_OBJECT('size','L'), 180000, 220000, 8),
  (3, 2, 'DEMO-SAC-DEFAULT', 'default', 'Mặc định', JSON_OBJECT(), 350000, NULL, 5);

INSERT INTO stock_moves (variant_id, reason, delta_qty, actor_id, note) VALUES
  (1, 'restock', 10, 2, 'Kho ban đầu dev'),
  (2, 'restock', 8, 2, 'Kho ban đầu dev'),
  (3, 'restock', 5, 3, 'Kho ban đầu dev');

INSERT INTO cart_items (user_id, variant_id, qty, selected) VALUES
  (1, 1, 1, TRUE), (1, 3, 1, TRUE);

INSERT INTO vouchers (id, code, name, discount_amount, min_subtotal, starts_at, ends_at, usage_limit, per_user_limit)
VALUES (1, 'NOVA20K', 'Voucher dev giảm 20.000 VND', 20000, 500000, '2026-01-01 00:00:00', '2028-01-01 00:00:00', 1000, 1);

COMMIT;
