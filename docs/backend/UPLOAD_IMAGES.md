# API tải ảnh

`POST /api/v1/uploads/images` yêu cầu Bearer token và JSON `{ "dataUrl": "data:image/png;base64,...", "purpose": "avatar" }`. Giá trị `purpose` có thể là `product`, `shop`, `review` hoặc `avatar`; `product` và `shop` yêu cầu vai trò seller hoặc admin. Mục đích không hợp lệ trả `400 INVALID_IMAGE_PURPOSE`; thiếu quyền trả `403 FORBIDDEN`.

API nhận JPEG, PNG, WebP; MIME khai báo phải khớp chữ ký byte và base64 chuẩn. Giới hạn sau giải mã: `product` và `shop` 5 MiB, `review` 2 MiB, `avatar` 1 MiB. Ảnh rỗng, sai định dạng, MIME không khớp hoặc quá giới hạn trả `400 INVALID_IMAGE`. Kiểm tra chữ ký không thay thế giải mã và xác thực toàn bộ cấu trúc ảnh; API chưa resize hoặc chuyển WebP.

Client cũ có thể bỏ `purpose`: giữ giới hạn 5 MiB. Với ảnh không quá 1 MiB, server cấp URL avatar có gắn ID user. Ảnh trên 1 MiB vẫn upload được để tương thích client cũ nhưng không được gắn làm avatar mới. Chỉ ảnh được server đặt tên theo mẫu avatar của chính tài khoản được chấp nhận khi đổi avatar qua profile. Các avatar cũ và URL ngoài đã lưu có thể giữ nguyên, nhưng URL ngoài mới không được đặt qua profile; đăng nhập Google là luồng riêng. Đường dẫn đúng mẫu không chứng minh object còn tồn tại; cần kiểm tra khi hiển thị.

`review` chỉ áp dụng giới hạn tại request upload có mục đích này. API review hiện chưa hỗ trợ ảnh, nên chưa có cơ chế ràng buộc ảnh theo mục đích tại bước lưu review; không coi giới hạn 2 MiB là bảo vệ đầu-cuối. Các client cần gửi `purpose` và cần bổ sung ràng buộc khi tính năng ảnh review được thiết kế. Các URL tham chiếu ảnh Commons là luồng riêng và không được kiểm tra byte qua upload này.

Kiểm tra bằng `node scripts/test-upload-policy.mjs` trong `backend/` và `node scripts/test-avatar-policy.mjs` trong `data-api/`. Hai bài dùng mock cho dịch vụ phụ thuộc, không chứng minh MySQL hoặc object storage triển khai thật.

Kiểm tra tích hợp bằng `node data-api/scripts/test-avatar-mysql.mjs` từ root trên MySQL 8 cục bộ riêng. Cần đặt `AVATAR_MYSQL_TEST=1`, `AVATAR_DB_PORT`, `AVATAR_DB_PASSWORD`, tùy chọn `AVATAR_DB_USER` (mặc định `root`). Bài kiểm tra tự tạo rồi xóa database tên `shopnova_test_avatar_<timestamp>` và thư mục ảnh tạm; không dùng `.env` ứng dụng. Bài này chạy Backend → HTTP Data API → MySQL và phục vụ ảnh local; bài object storage dùng server S3 giả lập riêng.
