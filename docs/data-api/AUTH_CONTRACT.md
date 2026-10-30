# Hợp đồng API Xác thực Dữ liệu Nội bộ (Auth Contract - Data API)

Tài liệu này định nghĩa giao diện API nội bộ của dịch vụ `shopnova-data-api` cho phạm vi **BE-003A** và **BE-003B** (Quản lý phiên đăng nhập `sessions`, Refresh Token Rotation và Đổi mật khẩu).

## 1. Nguyên tắc chung

- **Tiền tố đường dẫn**: `/internal/v1`
- **Xác thực dịch vụ**: Bắt buộc mọi yêu cầu phải có header `x-service-key` khớp chính xác với `DATA_API_KEY`. Nếu sai hoặc thiếu, trả về HTTP `401 Unauthorized` với mã lỗi `SERVICE_UNAUTHORIZED`.
- **Bảo mật mật khẩu**:
  - `password_hash` được lưu trữ bằng `bcrypt` (cost factor 12) trên MySQL.
  - Tuyệt đối không trả `password_hash` qua bất kỳ phản hồi HTTP nào và không ghi ra log.
  - So sánh mật khẩu bằng hàm so sánh bất đồng bộ `bcrypt.compare`.
  - Giới hạn mật khẩu đầu vào tối đa 72 bytes UTF-8; từ chối ngay nếu vượt giới hạn.
  - Nếu `username` không tồn tại trong hệ thống, thực hiện so sánh với dummy hash bcrypt hợp lệ để ngăn chặn tấn công kênh phụ (timing side-channel attack).
- **Quản lý Phiên đăng nhập (`sessions`) - BE-003B**:
  - Bảng `sessions` lưu trữ hash SHA-256 (`token_hash CHAR(64)`), thời điểm hết hạn (`expires_at DATETIME(3)`), thời điểm thu hồi (`revoked_at DATETIME(3) NULL`).
  - Hỗ trợ Refresh Token Rotation: vô hiệu hóa token cũ và lưu token mới.
  - Phát hiện tái sử dụng token đã thu hồi (Token Reuse Detection) và hỗ trợ thu hồi toàn bộ phiên của user khi phát hiện rủi ro bảo mật hoặc khi đổi mật khẩu.
- **Độc lập và an toàn tài nguyên**:
  - Mọi câu truy vấn vào MySQL đều có deadline hữu hạn và quản lý quyền sở hữu kết nối độc lập.
  - Timeout của một request không được phép hủy kết nối hoặc làm gián đoạn các request khác.
  - Chuẩn hóa lỗi không kết nối được, acquire timeout và query timeout thành mã lỗi `503 DATABASE_UNAVAILABLE` (không trả 500 cho các lỗi cơ sở dữ liệu tạm thời không sẵn sàng).
  - Không biến các lỗi lập trình (TypeError, ReferenceError) hoặc lỗi cú pháp SQL thành 503 (vẫn trả 500 `INTERNAL_SERVER_ERROR`).
- **Chuẩn hóa ID và kiểu dữ liệu**:
  - Khóa chính `users.id` và `shops.id` trong cơ sở dữ liệu là `BIGINT UNSIGNED`. Data API luôn trả về dưới dạng chuỗi (`String`), tuyệt đối không chuyển đổi qua kiểu `Number` trong JavaScript để tránh làm tròn hoặc mất độ chính xác đối với các ID lớn vượt $2^{53}-1$.

---

## 2. Danh sách Endpoints

### 2.1. Xác minh thông tin đăng nhập (Verify Credentials)

- **Endpoint**: `POST /internal/v1/auth/verify-credentials`
- **Xác thực**: Bắt buộc header `x-service-key`.

#### Request Headers:
```http
x-service-key: <DATA_API_KEY>
Content-Type: application/json
```

#### Request Body:
```json
{
  "username": "buyer_demo",
  "password": "SecretPassword123!"
}
```

#### Phản hồi thành công (HTTP 200 OK):
Khi thông tin đăng nhập chính xác và trạng thái tài khoản là `active`:
```json
{
  "success": true,
  "message": "Xác thực thông tin đăng nhập thành công.",
  "data": {
    "user": {
      "id": "1",
      "username": "buyer_demo",
      "fullName": "Nguyen Van A",
      "email": "buyer@example.com",
      "phone": "0901234567",
      "avatarUrl": null,
      "role": "buyer",
      "status": "active",
      "shopId": null
    }
  }
}
```

#### Phản hồi thất bại:
- **HTTP 401 Unauthorized** (Tài khoản không tồn tại, mật khẩu sai, hoặc tài khoản `blocked`):
  ```json
  {
    "success": false,
    "message": "Tên đăng nhập hoặc mật khẩu không hợp lệ.",
    "error": {
      "code": "INVALID_CREDENTIALS"
    }
  }
  ```
- **HTTP 401 Unauthorized** (Sai hoặc thiếu khóa xác thực dịch vụ `x-service-key`):
  ```json
  {
    "success": false,
    "message": "Yêu cầu bị từ chối: khóa xác thực dịch vụ nội bộ không hợp lệ.",
    "error": {
      "code": "SERVICE_UNAUTHORIZED"
    }
  }
  ```
- **HTTP 400 Bad Request** (Thiếu hoặc sai kiểu dữ liệu body):
  ```json
  {
    "success": false,
    "message": "Dữ liệu yêu cầu không hợp lệ.",
    "error": {
      "code": "VALIDATION_ERROR"
    }
  }
  ```

---

### 2.2. Lấy hồ sơ xác thực tài khoản (Get User Auth Profile)

- **Endpoint**: `GET /internal/v1/users/:userId/auth-profile`
- **Xác thực**: Bắt buộc header `x-service-key`.
- **Tham số URL**: `userId` (chuỗi số nguyên đại diện cho khóa chính `users.id`).

#### Request Headers:
```http
x-service-key: <DATA_API_KEY>
```

#### Phản hồi thành công (HTTP 200 OK):
Khi tìm thấy người dùng trong cơ sở dữ liệu (kể cả khi trạng thái là `blocked`):
```json
{
  "success": true,
  "message": "Lấy hồ sơ xác thực thành công.",
  "data": {
    "user": {
      "id": "1",
      "username": "buyer_demo",
      "fullName": "Nguyen Van A",
      "email": "buyer@example.com",
      "phone": "0901234567",
      "avatarUrl": null,
      "role": "buyer",
      "status": "active",
      "shopId": null
    }
  }
}
```

#### Phản hồi thất bại:
- **HTTP 404 Not Found** (Người dùng không tồn tại):
  ```json
  {
    "success": false,
    "message": "Không tìm thấy người dùng.",
    "error": {
      "code": "USER_NOT_FOUND"
    }
  }
  ```
- **HTTP 400 Bad Request** (`userId` không phải là chuỗi số nguyên hợp lệ):
  ```json
  {
    "success": false,
    "message": "Mã định danh người dùng không hợp lệ.",
    "error": {
      "code": "INVALID_PARAMS"
    }
  }
  ```

---

### 2.3. Tạo phiên đăng nhập mới (Create Session - BE-003B)

- **Endpoint**: `POST /internal/v1/auth/sessions`
- **Xác thực**: Bắt buộc header `x-service-key`.

#### Request Body:
```json
{
  "userId": "1",
  "tokenHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "expiresAt": "2026-11-06T12:00:00.000Z"
}
```

#### Phản hồi thành công (HTTP 201 Created):
```json
{
  "success": true,
  "message": "Tạo phiên đăng nhập thành công."
}
```

---

### 2.4. Làm mới phiên đăng nhập (Refresh Session - BE-003B)

- **Endpoint**: `POST /internal/v1/auth/sessions/refresh`
- **Xác thực**: Bắt buộc header `x-service-key`.

#### Request Body:
```json
{
  "tokenHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "newRefreshTokenHash": "d8e8fca2dc0f896fd7cb4cb0031ba249",
  "newExpiresAt": "2026-11-06T12:00:00.000Z"
}
```

#### Phản hồi thành công (HTTP 200 OK):
```json
{
  "success": true,
  "message": "Làm mới phiên thành công.",
  "data": {
    "user": {
      "id": "1",
      "username": "buyer_demo",
      "fullName": "Nguyen Van A",
      "email": "buyer@example.com",
      "phone": "0901234567",
      "avatarUrl": null,
      "role": "buyer",
      "status": "active",
      "shopId": null
    }
  }
}
```

#### Phản hồi thất bại:
- **HTTP 401 Unauthorized** (Session không tồn tại hoặc đã hết hạn):
  ```json
  {
    "success": false,
    "message": "Phiên đăng nhập không tồn tại hoặc đã hết hạn.",
    "error": {
      "code": "SESSION_EXPIRED"
    }
  }
  ```
- **HTTP 401 Unauthorized** (Token đã bị thu hồi trước đó - phát hiện tái sử dụng):
  ```json
  {
    "success": false,
    "message": "Phiên đăng nhập đã bị thu hồi trước đó.",
    "error": {
      "code": "SESSION_REVOKED"
    }
  }
  ```

---

### 2.5. Thu hồi một phiên đăng nhập (Revoke Session - BE-003B)

- **Endpoint**: `POST /internal/v1/auth/sessions/revoke`
- **Xác thực**: Bắt buộc header `x-service-key`.

#### Request Body:
```json
{
  "tokenHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

#### Phản hồi thành công (HTTP 200 OK):
```json
{
  "success": true,
  "message": "Thu hồi phiên đăng nhập thành công."
}
```

---

### 2.6. Thu hồi toàn bộ phiên của người dùng (Revoke All User Sessions - BE-003B)

- **Endpoint**: `POST /internal/v1/auth/sessions/revoke-all`
- **Xác thực**: Bắt buộc header `x-service-key`.

#### Request Body:
```json
{
  "userId": "1"
}
```

#### Phản hồi thành công (HTTP 200 OK):
```json
{
  "success": true,
  "message": "Thu hồi toàn bộ phiên đăng nhập của người dùng thành công."
}
```

---

### 2.7. Đổi mật khẩu tài khoản (Change Password - BE-003B)

- **Endpoint**: `POST /internal/v1/users/:userId/change-password`
- **Xác thực**: Bắt buộc header `x-service-key`.

#### Request Body:
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

#### Phản hồi thành công (HTTP 200 OK):
```json
{
  "success": true,
  "message": "Đổi mật khẩu thành công và đã thu hồi các phiên đăng nhập cũ."
}
```

#### Phản hồi thất bại:
- **HTTP 401 Unauthorized** (Mật khẩu hiện tại không chính xác):
  ```json
  {
    "success": false,
    "message": "Mật khẩu hiện tại không chính xác.",
    "error": {
      "code": "INVALID_CREDENTIALS"
    }
  }
  ```
- **HTTP 404 Not Found** (Người dùng không tồn tại):
  ```json
  {
    "success": false,
    "message": "Người dùng không tồn tại.",
    "error": {
      "code": "USER_NOT_FOUND"
    }
  }
  ```
