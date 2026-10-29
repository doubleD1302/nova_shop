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

INSERT INTO shops (id, owner_id, slug, name, tagline, description, province) VALUES
  (1, 2, 'shop-mau-a', 'DEMO - Shop mẫu A', 'DỮ LIỆU DEMO', 'Gian hàng minh họa để thử nghiệm giao diện. Không phải người bán thật.', 'TP. Hồ Chí Minh'),
  (2, 3, 'shop-mau-b', 'DEMO - Shop mẫu B', 'DỮ LIỆU DEMO', 'Gian hàng minh họa để thử nghiệm giao diện. Không phải người bán thật.', 'Hà Nội');

INSERT INTO categories (id, slug, name, sort_order) VALUES
  (1, 'thoi-trang-nam', 'Thời trang nam', 1),
  (2, 'dien-thoai', 'Điện thoại và phụ kiện', 2),
  (3, 'thoi-trang-nu', 'Thời trang nữ', 3),
  (4, 'giay-dep', 'Giày dép', 4),
  (5, 'tui-xach', 'Túi xách', 5),
  (6, 'my-pham', 'Mỹ phẩm', 6),
  (7, 'nha-cua-doi-song', 'Nhà cửa & đời sống', 7),
  (8, 'phu-kien-cong-nghe', 'Phụ kiện công nghệ', 8);

INSERT INTO products (id, shop_id, category_id, slug, name, description, specs, badges, status, is_featured) VALUES
  (1, 1, 1, 'demo-ao-thun-mau', 'DEMO - Áo thun mẫu', 'Sản phẩm minh họa trong dữ liệu demo; chưa được đăng bán.', JSON_OBJECT('Chất liệu','Cotton'), JSON_ARRAY(), 'draft', FALSE),
  (2, 2, 2, 'demo-cu-sac-mau', 'DEMO - Củ sạc mẫu', 'Sản phẩm minh họa trong dữ liệu demo; chưa được đăng bán.', JSON_OBJECT('Công suất','65W'), JSON_ARRAY(), 'draft', FALSE),
  (3, 1, 4, 'demo-giay-sneaker', 'DEMO - Giày sneaker', 'DEMO - Chưa hoàn thiện bộ 4 ảnh; sản phẩm chưa được đăng bán.', JSON_OBJECT('Loại','Sneaker'), JSON_ARRAY(), 'draft', FALSE),
  (4, 2, 5, 'demo-tui-vai', 'DEMO - Túi vải', 'DEMO - Chưa hoàn thiện bộ 4 ảnh; sản phẩm chưa được đăng bán.', JSON_OBJECT('Chất liệu','Vải'), JSON_ARRAY(), 'draft', FALSE),
  (5, 1, 6, 'demo-kem-duong', 'DEMO - Kem dưỡng da', 'DEMO - Chưa hoàn thiện bộ 4 ảnh; sản phẩm chưa được đăng bán.', JSON_OBJECT('Dung tích','50 ml'), JSON_ARRAY(), 'draft', FALSE),
  (6, 2, 7, 'demo-den-ban', 'DEMO - Đèn bàn', 'DEMO - Chưa hoàn thiện bộ 4 ảnh; sản phẩm chưa được đăng bán.', JSON_OBJECT('Loại','Đèn LED'), JSON_ARRAY(), 'draft', FALSE),
  (7, 1, 8, 'demo-tai-nghe', 'DEMO - Tai nghe có dây', 'DEMO - Chưa hoàn thiện bộ 4 ảnh; sản phẩm chưa được đăng bán.', JSON_OBJECT('Kết nối','Có dây'), JSON_ARRAY(), 'draft', FALSE),
  (8, 2, 3, 'demo-ao-khoac-nu', 'DEMO - Áo khoác nữ', 'DEMO - Chưa hoàn thiện bộ 4 ảnh; sản phẩm chưa được đăng bán.', JSON_OBJECT('Chất liệu','Cotton'), JSON_ARRAY(), 'draft', FALSE);

INSERT INTO product_variants (id, product_id, sku, variant_key, name, attributes, price, original_price, stock_qty) VALUES
  (1, 1, 'DEMO-AO-M', 'size=m', 'Size M', JSON_OBJECT('size','M'), 180000, 220000, 0),
  (2, 1, 'DEMO-AO-L', 'size=l', 'Size L', JSON_OBJECT('size','L'), 180000, 220000, 0),
  (3, 2, 'DEMO-SAC-DEFAULT', 'default', 'Mặc định', JSON_OBJECT(), 350000, NULL, 0),
  (4, 3, 'DEMO-SNEAKER-DEFAULT', 'default', 'Mặc định', JSON_OBJECT(), 450000, NULL, 0),
  (5, 4, 'DEMO-TUI-DEFAULT', 'default', 'Mặc định', JSON_OBJECT(), 120000, NULL, 0),
  (6, 5, 'DEMO-KEM-DEFAULT', 'default', '50 ml', JSON_OBJECT(), 230000, NULL, 0),
  (7, 6, 'DEMO-DEN-DEFAULT', 'default', 'Mặc định', JSON_OBJECT(), 310000, NULL, 0),
  (8, 7, 'DEMO-TAI-NGHE-DEFAULT', 'default', 'Mặc định', JSON_OBJECT(), 90000, NULL, 0),
  (9, 8, 'DEMO-AO-KHOAC-DEFAULT', 'default', 'Mặc định', JSON_OBJECT(), 520000, NULL, 0);

INSERT INTO vouchers (id, code, name, discount_amount, min_subtotal, starts_at, ends_at, usage_limit, per_user_limit)
VALUES (1, 'NOVA20K', 'Voucher dev giảm 20.000 VND', 20000, 500000, '2026-01-01 00:00:00', '2028-01-01 00:00:00', 1000, 1);

COMMIT;
