# Hồ sơ đăng ký gian hàng

Hồ sơ được nhận tùy chọn qua `POST /api/v1/auth/register` với role `seller`, hoặc `POST /api/v1/auth/seller-shop` khi tài khoản đã đăng nhập. Client cũ vẫn có thể tạo shop chờ duyệt; admin chỉ có thể duyệt sau khi người bán bổ sung hồ sơ. Web đăng ký mới gửi đủ hồ sơ trong cùng request tạo gian hàng.

`sellerProfile` gồm `pickupAddress`, `province`, `contactEmail`, `contactPhone`, `shippingMethods` (mảng chứa `nhanh`, `tietkiem`, `hoatoc`), `businessType` (`personal`, `household`, `enterprise`), `ownerName`, `idCard` (9–12 chữ số), `taxCode` và `invoiceEmail` (có thể để trống), `agreeTerms: true`. Khi có hồ sơ, tạo user/shop và lưu hồ sơ cùng transaction Data API. Hồ sơ không hợp lệ trả 400; thiếu khóa mã hóa trả 503 trước khi ghi.

Chủ shop xem `GET /api/v1/seller/shop/registration` và có thể thay toàn bộ hồ sơ bằng `PUT` khi shop chờ duyệt hoặc bị từ chối. Bản sửa tăng `approvalVersion`; nếu thiếu hồ sơ, phê duyệt trả `409 SHOP_PROFILE_REQUIRED`; sau khi bị từ chối, seller vẫn cần gọi API gửi lại hồ sơ. Admin xem `GET /api/v1/admin/shops/:shopId/registration`. Phản hồi hồ sơ thông thường chỉ có bốn số cuối giấy tờ, không trả số đầy đủ hoặc ciphertext; danh sách shop công khai không chứa hồ sơ này.

## Cấu hình và database

- Trên database MySQL thử nghiệm đã xác định, áp dụng `database/migrations/2026-11-10-seller-registration-profile.sql` trước khi dùng hồ sơ mới. Schema mới khởi tạo đã có bảng tương ứng. Chưa chạy migration tự động lên môi trường dùng chung.
- Data API cần `SELLER_IDENTITY_KEY`: khóa bí mật 32 byte được mã hóa base64. Tạo và lưu khóa bằng cơ chế quản lý secret của môi trường; không đưa khóa vào Git hoặc ZIP. Dùng khóa ổn định giữa các lần khởi động và sao lưu khóa an toàn. Mất hoặc thay khóa mà không có quy trình chuyển đổi sẽ khiến dữ liệu giấy tờ cũ không thể giải mã bằng khóa mới. Có API quản trị đọc giấy tờ với lý do bắt buộc và ghi nhật ký; có công cụ xoay khóa từng hồ sơ. Xem `SELLER_IDENTITY_OPERATIONS.md` trước khi sử dụng.
- Không coi cơ chế mã hóa là xác minh danh tính. Chưa tích hợp dịch vụ kiểm tra giấy tờ hoặc thuế.

Kiểm tra `node scripts/test-seller-profile.mjs` tại `data-api/` và `node scripts/test-seller-address-http.mjs` tại `backend/`. Các test này dùng SQLite tạm; không thay thế test MySQL thật.

Phương thức vận chuyển: preview và tạo đơn chỉ chấp nhận phương thức được shop có hồ sơ bật; shop cũ chưa có hồ sơ tiếp tục dùng các phương thức hiện có. Hồ sơ vận chuyển sai định dạng sẽ bị từ chối.
