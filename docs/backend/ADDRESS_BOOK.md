# Địa chỉ giao hàng

Các API yêu cầu access token. Backend lấy tài khoản từ token và gọi Data API; client không gửi mã người dùng.

- `GET /api/v1/addresses`: trả `data.addresses`.
- `POST /api/v1/addresses`: tạo địa chỉ, trả `data.address` và HTTP 201.
- `PUT /api/v1/addresses/:id`: thay thông tin địa chỉ thuộc tài khoản, trả `data.address`.
- `DELETE /api/v1/addresses/:id`: xóa mềm địa chỉ thuộc tài khoản.

POST và PUT nhận `fullName`, `phone`, `province`, `detail` là chuỗi bắt buộc; `district`, `ward` là chuỗi tùy chọn. `isDefault` là boolean tùy chọn. Khi gửi `true`, địa chỉ đó trở thành mặc định; khi tạo địa chỉ đầu tiên, hệ thống tự chọn làm mặc định. Xóa địa chỉ mặc định sẽ chọn địa chỉ còn lại có ID lớn nhất. Không thể sửa hoặc xóa địa chỉ của tài khoản khác.

`PUT /api/v1/auth/profile` tiếp tục sửa địa chỉ mặc định hiện tại. App cần tích hợp API này để các địa chỉ bổ sung đồng bộ giữa thiết bị; app hiện vẫn lưu một phần danh sách trên thiết bị.

Kiểm tra Data API bằng `node scripts/test-addresses.mjs` trong `data-api/`; bài kiểm tra tạo SQLite riêng trong thư mục tạm, không kiểm tra MySQL.
