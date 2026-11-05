# Kiểm tra dữ liệu đầu vào

Các endpoint giỏ hàng nhận `qty` nguyên trong giới hạn; riêng cập nhật cho phép 0 để xóa. `selected`, `replaceQty`, `selectedOnly` phải là boolean; tham số query `selected` chỉ nhận `true` hoặc `false`. Giá trị sai trả `400 VALIDATION_ERROR` trước khi thay đổi dữ liệu. `shopId` khi chọn theo shop phải là ID dương hợp lệ.

Khi cập nhật vận đơn, `autoAdvanceStatus` chỉ nhận boolean. Yêu cầu trả hàng chỉ nhận `refundAmount` nguyên dương an toàn hoặc bỏ trường này để dùng giá trị mặc định của đơn. Khi sửa hồ sơ shop, `tagline`, `description`, `address` nhận chuỗi hoặc null. Tạo đơn yêu cầu số lượng là số nguyên JSON và các trường địa chỉ dạng chuỗi; không chuyển boolean hoặc object thành dữ liệu hợp lệ.

Đồng bộ giỏ yêu cầu danh sách tối đa 100 item hợp lệ, kiểm tra toàn bộ trước khi thay đổi và thực hiện các thay đổi trong một transaction. SKU hết hàng, sản phẩm hoặc shop chưa active được bỏ qua; lỗi cơ sở dữ liệu khiến transaction rollback. Giá và tồn kho sản phẩm seller phải là số JSON nguyên hợp lệ, không nhận boolean hoặc chuỗi số.

API tin nhắn kiểm tra `limit` từ 1 đến 100 và `offset` không âm trước khi đánh dấu đã đọc. Báo cáo kiểm tra `details` theo giới hạn 65535 byte UTF-8 và `evidenceUrl` tối đa 1024 ký tự.

Chạy `node data-api/scripts/test-cart-validation.mjs` từ thư mục gốc để kiểm tra các giá trị sai và các trường hợp xóa hợp lệ. Test có HTTP trên ứng dụng kiểm tra với controller Backend/Data API và database giả lập; không thay thế kiểm thử trên database thật. Bộ kiểm tra này chưa bao phủ toàn bộ các endpoint hoặc mọi trường đầu vào.

`node data-api/scripts/test-cart-sync-mysql.mjs` dùng MySQL 8 cục bộ riêng theo các biến `AVATAR_MYSQL_TEST=1`, `AVATAR_DB_PORT`, `AVATAR_DB_PASSWORD`, tùy chọn `AVATAR_DB_USER`; test tạo và xóa database riêng, không dùng DB dùng chung. `node data-api/scripts/test-chat-report-validation.mjs` kiểm tra HTTP Data API với DB giả lập. Chạy `node data-api/scripts/test-seller-product-validation.mjs` cho quy tắc sản phẩm seller.

Phân trang danh sách sản phẩm, shop, đơn và yêu cầu trả hàng: `limit` là số nguyên 1–100, `offset` là số nguyên không âm an toàn; input sai trả `400 VALIDATION_ERROR`. Riêng danh sách đơn buyer cho phép `limit=0` để chỉ lấy tổng kết. Không truyền trường sẽ dùng giá trị mặc định.

Bộ lọc catalog kiểm tra độ dài, kiểu, giá nguyên không âm, khoảng giá hợp lệ, rating/discount, cờ, danh sách ID và sort; sai trả 400. Hai đầu khoảng giá phải cùng thỏa trên một SKU hoạt động. Hỗ trợ `price-asc`/`price-desc` và hai tên tương ứng `price_asc`/`price_desc` của app.
