# Hợp đồng API Xác thực Backend (Auth Contract - Backend)

Tài liệu này định nghĩa giao diện API công khai của dịch vụ `shopnova-backend` cho phạm vi **BE-003A** (Đăng nhập, lấy thông tin tài khoản và nền tảng phân quyền buyer/seller).

## 1. Nguyên tắc chung

- **Tiền tố đường dẫn**: `/api/v1/auth`
- **Định dạng dữ liệu**: `application/json; charset=utf-8`
- **Thời hạn Access Token**: 15 phút (900 giây).
- **Thuật toán JWT**: `HS256`, ký bởi `JWT_SECRET` (bắt buộc sinh từ ít nhất 32 byte ngẫu nhiên độc lập bằng crypto, mã hóa hex/base64).
- **JWT Claims bắt buộc và Thẩm định chặt chẽ**:
  - `iss`: `shopnova-backend`
  - `aud`: `shopnova-clients`
  - `sub`: Bắt buộc là chuỗi số nguyên dương chuẩn trong phạm vi `BIGINT UNSIGNED` (từ `1` đến `18446744073709551615`), biểu thức chính quy `/^[1-9]\d*$/`. Tuyệt đối không chứa khoảng trắng, không có số 0 ở đầu, không ký tự lạ. Token có `sub` không chuẩn bị từ chối với HTTP 401 `AUTH_INVALID` ngay lập tức mà **không gọi sang Data API upstream**.
  - `role`: Vai trò người dùng (`buyer` hoặc `seller`) tại thời điểm phát hành (Backend không tin cậy `role` trong token mà luôn tra cứu quyền mới nhất từ Data API tại thời điểm xử lý request).
  - `iat`: Thời điểm phát hành (epoch seconds, số nguyên dương).
  - `exp`: Thời điểm hết hạn (`iat + 900`, số nguyên dương).
  - `clockTolerance`: Cho phép sai lệch đồng hồ tối đa 60 giây (`CLOCK_SKEW_TOLERANCE_SECONDS = 60`). Token có `exp - iat` chênh lệch quá 60 giây so với 900 giây bị từ chối HTTP 401 `AUTH_INVALID`.
- **Phân quyền vai trò**:
  - `buyer`: Người mua hàng thông thường.
  - `seller`: Người bán hàng (có gian hàng `shops`). `seller` kế thừa toàn bộ quyền của `buyer` (vẫn có thể mua hàng bình thường). `buyer` bị chặn hoàn toàn khi truy cập tài nguyên yêu cầu quyền `seller` với HTTP 403 `FORBIDDEN`.
- **Bảo vệ thông tin người dùng (Whitelist & Contract Enforcement)**:
  - Backend thẩm định chặt chẽ dữ liệu hồ sơ người dùng trả về từ Data API: `id` (chuỗi `BIGINT UNSIGNED` chuẩn, không parse qua `Number`), `username`, `fullName`, `email`, `phone`, `avatarUrl`, `role` (`buyer`|`seller`), `status` (`active`|`blocked`), `shopId` (chuỗi `BIGINT UNSIGNED` hoặc `null`).
  - Buyer bắt buộc có `shopId === null`; Seller bắt buộc có `shopId` hợp lệ.
  - Bất kỳ phản hồi nào từ Data API trái với hợp đồng (thiếu trường, sai kiểu, `user.id` không khớp với ID yêu cầu) đều bị từ chối với HTTP 502 `DATA_API_BAD_RESPONSE`.
- **Xử lý an toàn lỗi Upstream**:
  - Tuyệt đối không chuyển tiếp `json.message` từ Data API ra API công khai; mã 400 từ Data API được chuẩn hóa thành message tiếng Việt cố định `"Dữ liệu yêu cầu không hợp lệ."`.
  - Phân biệt rõ lỗi xác thực dịch vụ nội bộ (Data API trả 401 `SERVICE_UNAUTHORIZED` -> Backend trả HTTP 502 `DATA_API_AUTH_FAILED`) với lỗi xác thực người dùng (HTTP 401 `INVALID_CREDENTIALS`).
  - Lỗi database không sẵn sàng hoặc timeout từ Data API (HTTP 503 `DATABASE_UNAVAILABLE`) được ánh xạ thành HTTP 503 `DATA_API_UNAVAILABLE`.
  - Toàn bộ marker nhạy cảm (SQL, stack trace, parameters) của Data API tuyệt đối không được phép rò rỉ ra response hoặc log Backend.
- **Xác thực trạng thái thời gian thực**:
  - Sau khi xác minh chữ ký và claim của JWT, Backend gọi Data API để kiểm tra trạng thái (`status`) và vai trò (`role`) hiện tại của người dùng. Tài khoản bị khóa (`blocked`) hoặc không còn tồn tại sẽ bị từ chối ngay lập tức với HTTP 401 `AUTH_INVALID`.

---

## 2. Danh sách Endpoints

### 2.1. Đăng nhập hệ thống

- **Endpoint**: `POST /api/v1/auth/login`
- **Xác thực**: Không yêu cầu (Public).
- **Giới hạn tần suất**: Áp dụng `Rate Limiter` (5 lần thử thất bại liên tiếp trong 60 giây). Khi vi phạm trả HTTP `429 Too Many Requests` kèm header `Retry-After`.

#### Request Body:
```json
{
  "username": "buyer_demo",
  "password": "SecretPassword123!"
}
```
*Ghi chú*:
- `username`: Bắt buộc, chuỗi không rỗng, tự động chuẩn hóa về chữ thường (lowercase) và cắt khoảng trắng đầu/cuối trước khi xử lý.
- `password`: Bắt buộc, chuỗi không rỗng, giữ nguyên vẹn ký tự (không trim, không cắt gọt). Tối đa 72 bytes UTF-8 (theo giới hạn an toàn của thuật toán bcrypt).
- Không chấp nhận hoặc sử dụng `role`, `userId`, `shopId` từ request client để cấp quyền.

#### Phản hồi thành công (HTTP 200 OK):
```json
{
  "success": true,
  "message": "Đăng nhập thành công.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "1",
      "username": "buyer_demo",
      "fullName": "Nguyen Van A",
      "email": "buyer@example.com",
      "phone": "0901234567",
      "avatarUrl": null,
      "role": "buyer",
      "shopId": null
    }
  }
}
```

#### Phản hồi thất bại:
- **HTTP 400 Bad Request** (Dữ liệu gửi lên sai cấu trúc hoặc rỗng):
  ```json
  {
    "success": false,
    "message": "Tên đăng nhập và mật khẩu là bắt buộc.",
    "error": {
      "code": "VALIDATION_ERROR"
    }
  }
  ```
- **HTTP 401 Unauthorized** (Sai tài khoản, sai mật khẩu, hoặc tài khoản bị khóa `blocked`):
  *(Thông báo cố định, không phân biệt nguyên nhân để chống dò quét tài khoản)*:
  ```json
  {
    "success": false,
    "message": "Tên đăng nhập hoặc mật khẩu không hợp lệ.",
    "error": {
      "code": "INVALID_CREDENTIALS"
    }
  }
  ```
- **HTTP 429 Too Many Requests** (Vượt quá số lần thử đăng nhập):
  *(Header: `Retry-After: <số giây>`)*
  ```json
  {
    "success": false,
    "message": "Quá nhiều lần thử đăng nhập thất bại. Vui lòng thử lại sau.",
    "error": {
      "code": "RATE_LIMITED"
    }
  }
  ```

---

### 2.2. Lấy hồ sơ tài khoản hiện tại

- **Endpoint**: `GET /api/v1/auth/me`
- **Xác thực**: Bắt buộc Bearer JWT qua header `Authorization: Bearer <token>`.

#### Headers:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Phản hồi thành công (HTTP 200 OK):
```json
{
  "success": true,
  "message": "Lấy thông tin tài khoản thành công.",
  "data": {
    "user": {
      "id": "1",
      "username": "buyer_demo",
      "fullName": "Nguyen Van A",
      "email": "buyer@example.com",
      "phone": "0901234567",
      "avatarUrl": null,
      "role": "buyer",
      "shopId": null
    }
  }
}
```

#### Phản hồi thất bại:
- **HTTP 401 Unauthorized** (Thiếu header xác thực):
  ```json
  {
    "success": false,
    "message": "Yêu cầu bắt buộc phải có token xác thực.",
    "error": {
      "code": "AUTH_REQUIRED"
    }
  }
  ```
- **HTTP 401 Unauthorized** (Token hết hạn 15 phút):
  ```json
  {
    "success": false,
    "message": "Token xác thực đã hết hạn hiệu lực.",
    "error": {
      "code": "AUTH_EXPIRED"
    }
  }
  ```
- **HTTP 401 Unauthorized** (Token sai chữ ký, sai định dạng, tài khoản bị khóa hoặc không tồn tại):
  ```json
  {
    "success": false,
    "message": "Token xác thực không hợp lệ.",
    "error": {
      "code": "AUTH_INVALID"
    }
  }
  ```

---

### 2.3. Mã lỗi phân quyền tài nguyên (Role-based Authorization)

Khi client truy cập vào các route nội bộ bảo vệ bởi middleware phân quyền:
- **HTTP 403 Forbidden** (Không đủ quyền hạn):
  ```json
  {
    "success": false,
    "message": "Bạn không có quyền thực hiện thao tác này.",
    "error": {
      "code": "FORBIDDEN"
    }
  }
  ```
