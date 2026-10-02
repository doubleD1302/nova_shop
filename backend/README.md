# ShopNova — Backend API

Tài liệu kỹ thuật hướng dẫn cấu hình, khởi chạy và phát triển dịch vụ Backend cho sàn thương mại điện tử ShopNova.

---

## 1. Kiến Trúc Hệ Thống & Giới Hạn Hiện Tại

Hệ thống ShopNova tuân thủ mô hình giao tiếp phân tầng (Xem chi tiết tại [ARCHITECTURE.md](../docs/backend/ARCHITECTURE.md)):

```text
Frontend (Web / App) ──(HTTP /api/v1/*)──> Backend ──(HTTP /internal/v1/*)──> Data API ──(Sequelize)──> MySQL
```

- **Frontend:** Chỉ gọi Backend qua HTTP API `/api/v1/*`.
- **Backend:** Tiếp nhận request từ frontend, xác thực người dùng, kiểm tra quyền hạn, xử lý nghiệp vụ. Backend **không kết nối trực tiếp MySQL**, không cài đặt Sequelize/mysql2, mà giao tiếp với Data API nội bộ qua HTTP client tập trung (`clients/data.client.js`).
- **Data API nội bộ:** Độc quyền phụ trách kết nối MySQL bằng Sequelize + mysql2, bảo vệ dữ liệu với transaction và không hỗ trợ endpoint chạy SQL tùy ý.
- **Trạng thái hiện tại (Hoàn thành BE-003A — Xác thực & Phân quyền Buyer/Seller):**
  - Đã hoàn thành nền tảng máy chủ Express 5, chuẩn hóa quy ước tên file, cấu hình biến môi trường, bảo mật CORS/Helmet, middleware xử lý lỗi an toàn.
  - Đã hoàn thành HTTP client tại `src/clients/data.client.js` kết nối Data API nội bộ qua built-in `fetch` Node.js với deadline 5000ms bao quát toàn bộ request/body, giới hạn 1MiB và mapping mã lỗi an toàn.
  - Đã triển khai `GET /api/v1/ready` phản ánh trạng thái sẵn sàng của cả Backend, Data API và cơ sở dữ liệu MySQL.
  - Giữ `GET /api/v1/health` làm liveness độc lập (vẫn trả 200 khi Data API hoặc MySQL ngừng hoạt động).
  - Đã triển khai xác thực tài khoản và phân quyền người dùng (BE-003A):
    - `POST /api/v1/auth/login`: Xác thực username/password, bảo vệ bằng Rate Limiting (in-memory, 429 `RATE_LIMITED`, `Retry-After`), phát hành JWT Bearer HS256 (hạn 15 phút).
    - `GET /api/v1/auth/me`: Đọc hồ sơ tài khoản hiện tại từ Data API qua token đã xác minh.
    - Middleware `authenticate` thẩm định JWT (signature, algorithm allowlist, issuer, audience, sub, exp) và tra cứu trạng thái/vai trò người dùng thời gian thực từ Data API; từ chối người dùng đã bị khóa (`blocked`) hoặc không tồn tại.
    - Middleware `requireRole` phân quyền tài khoản (seller kế thừa quyền mua hàng của buyer; buyer bị chặn khi truy cập chức năng yêu cầu quyền seller).
  - Chưa triển khai đăng ký tài khoản, refresh token, server-side logout, đổi mật khẩu, catalog, giỏ hàng, đơn hàng (các endpoint này được dành cho các vòng tiếp theo).

---

## 2. Yêu Cầu Môi Trường (Prerequisites)

- **Node.js:** Mục tiêu là Node.js 24 LTS (phiên bản máy thực tế đã kiểm thử: `v24.12.0`).
- **npm:** Đi kèm Node (phiên bản thực tế: `11.6.2`).

Kiểm tra trên máy tính của bạn bằng cách mở terminal:
```bash
node -v
npm -v
```

---

## 3. Cài Đặt Dependencies

Di chuyển vào thư mục `backend/` trước khi thao tác:
```bash
cd backend
npm install
```

Các thư viện đã được cài đặt:
- `express`: Framework tạo máy chủ web HTTP (phiên bản major 5).
- `cors`: Cho phép ứng dụng Frontend (React Vite trên cổng 5173) gửi yêu cầu sang Backend.
- `dotenv`: Đọc cấu hình từ file `.env` vào `process.env`.
- `helmet`: Tự động bổ sung các HTTP Header bảo mật chống các lỗ hổng web phổ biến.
- `jsonwebtoken`: Thư viện chuẩn ký và xác minh JSON Web Token (HS256) an toàn.

---

## 4. Cấu Hình Môi Trường (.env)

Hệ thống có file cấu hình mẫu là `.env.example`. Bạn cần tạo file cấu hình thật `.env` từ file mẫu này.

### Trên Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

### Trên macOS hoặc Linux:
```bash
cp .env.example .env
```

### Nội dung cấu hình mẫu (.env.example):
```env
# Cổng chạy ứng dụng Backend (từ 1 đến 65535)
PORT=3000

# Môi trường chạy (development | test | production)
NODE_ENV=development

# Danh sách địa chỉ Frontend được phép truy cập (phân tách bởi dấu phẩy)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Base URL của dịch vụ Data API nội bộ (chỉ http/https, không chứa username/password, query hoặc fragment, không chứa /internal/v1)
DATA_API_URL=http://127.0.0.1:3001

# Khóa xác thực dịch vụ nội bộ (bắt buộc, không được để trống hoặc placeholder)
DATA_API_KEY=

# Chuỗi bí mật ký JSON Web Token HS256 (bắt buộc, tối thiểu 32 ký tự ngẫu nhiên, độc lập với DATA_API_KEY)
JWT_SECRET=
```

### Quy tắc kiểm tra cấu hình:
- `PORT`: Bắt buộc là số nguyên hợp lệ trong khoảng 1–65535 (mặc định 3000).
- `DATA_API_URL`: Base URL của dịch vụ Data API, không chứa `/internal/v1`. Chỉ chấp nhận giao thức `http:` hoặc `https:`, không chứa thông tin xác thực (`user:pass`), query string hoặc fragment.
- `DATA_API_KEY`: Bắt buộc, từ chối chuỗi rỗng, toàn khoảng trắng hoặc placeholder mẫu trong danh sách cấm (như `your_service_key_here`, `your_data_api_key_here`, `your_secret_key_here`, `change_me`, `secret`, `password`).
- `JWT_SECRET`: Bắt buộc, chuỗi bí mật có độ dài tối thiểu 32 ký tự, độc lập với `DATA_API_KEY`, từ chối chuỗi rỗng, khoảng trắng hoặc placeholder mẫu.
- **An toàn thông tin:** Thông báo lỗi cấu hình chỉ nêu tên biến môi trường bị lỗi và lý do cố định, tuyệt đối không in giá trị URL, credentials, query, fragment hoặc secret ra log/stdout/stderr.
- Hỗ trợ `DOTENV_CONFIG_PATH` để chỉ định file cấu hình khi kiểm thử cô lập. Backend vẫn có thể khởi động khi cấu hình hợp lệ dù Data API đang tắt.

### Hướng dẫn sinh khóa bí mật an toàn (JWT_SECRET & DATA_API_KEY):
- Chuỗi `JWT_SECRET` bắt buộc phải sinh ngẫu nhiên từ ít nhất 32 byte entropy độc lập bằng module `crypto` của Node.js, mã hóa hex (64 ký tự) hoặc base64:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Tuyệt đối không tái sử dụng `DATA_API_KEY` làm `JWT_SECRET`.
- Tuyệt đối không lưu mật khẩu thật hoặc secret production vào source code, file mẫu `.env.example`, Git hay file ZIP bàn giao.

### Lưu ý về Rate Limiting và Triển khai Reverse Proxy:
- Rate limiter sử dụng `req.ip` do Express xác định trực tiếp từ kết nối mạng (hoặc `req.socket.remoteAddress`), tuyệt đối không đọc trực tiếp header `X-Forwarded-For` do client gửi lên.
- Trong môi trường triển khai có Reverse Proxy (như Nginx, AWS ALB, Cloudflare), cần kích hoạt cấu hình `trust proxy` cụ thể cho Express:
  ```javascript
  // Ví dụ cấu hình trong src/app.js khi chạy sau proxy nội bộ:
  app.set('trust proxy', 'loopback') // Chỉ tin proxy local
  // Hoặc dải subnet của Reverse Proxy tin cậy:
  app.set('trust proxy', '10.0.0.0/8')
  ```
- **Cảnh báo an toàn:** Tuyệt đối không sử dụng `app.set('trust proxy', true)` vì điều này sẽ khiến ứng dụng tin tưởng mọi proxy giả mạo từ internet, dẫn tới nguy cơ bị bypass Rate Limiter bằng header `X-Forwarded-For` ngẫu nhiên.

---

## 5. Hướng Dẫn Khởi Chạy Server

Tất cả các lệnh dưới đây đều thực thi bên trong thư mục `backend/`:

### Chế độ phát triển (Tự reload khi sửa code):
```bash
npm run dev
```
*(Sử dụng tính năng `node --watch` nguyên bản của Node.js, không cần cài thêm nodemon)*

### Chế độ bình thường:
```bash
npm start
```

Khi server khởi chạy thành công, console sẽ hiển thị:
```text
[ShopNova Backend] Server đang chạy tại http://localhost:3000
[ShopNova Backend] Môi trường: development
[ShopNova Backend] Health check: http://localhost:3000/api/v1/health
[ShopNova Backend] Readiness check: http://localhost:3000/api/v1/ready
```

---

## 6. Kiểm Tra API Hệ Thống

### 6.1. Liveness Check (`GET /api/v1/health`)
- **Mục đích:** Kiểm tra tiến trình Backend còn sống.
- **Hành vi:** Độc lập với Data API và MySQL; vẫn trả HTTP 200 ngay cả khi Data API hoặc MySQL ngừng hoạt động.
- **Ví dụ kiểm tra:**
  ```bash
  curl.exe http://localhost:3000/api/v1/health
  ```
- **Kết quả trả về (HTTP 200):**
  ```json
  {
    "success": true,
    "message": "Backend đang hoạt động.",
    "data": {
      "service": "shopnova-backend",
      "status": "ok"
    }
  }
  ```

### 6.2. Readiness Check (`GET /api/v1/ready`)
- **Mục đích:** Kiểm tra Backend đã sẵn sàng phục vụ và toàn bộ chuỗi phụ thuộc (Data API, MySQL) hoạt động bình thường.
- **Hành vi:** Backend gọi Data API `GET /internal/v1/ready` kèm header `x-service-key`.
- **Ví dụ kiểm tra:**
  ```bash
  curl.exe http://localhost:3000/api/v1/ready
  ```
- **Kết quả thành công### 6.3. Đăng Nhập & Cấp Token (`POST /api/v1/auth/login`)
- **Mục đích:** Xác thực tài khoản bằng username và password; cấp phát JWT Bearer token có hạn 15 phút.
- **Bảo vệ:** Rate Limiting in-memory (tối đa 5 lần thử sai trong 1 phút trên cùng IP; trả HTTP 429 `RATE_LIMITED` kèm header `Retry-After`).
- **Body:** `{ "username": "...", "password": "..." }`.
- **Validation:** Username được chuẩn hóa chữ thường; từ chối password > 72 byte UTF-8; không nhận các field quyền tự khai (`role`, `userId`, `shopId`).
- **Phản hồi thành công (HTTP 200):**
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
        "username": "buyer_test",
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
- **Lỗi xác thực sai (HTTP 401):**
  Trả về `INVALID_CREDENTIALS` cố định: `"Tên đăng nhập hoặc mật khẩu không hợp lệ."` bất kể username không tồn tại, sai mật khẩu hay tài khoản bị khóa (`blocked`), chống rò rỉ thông tin người dùng.

### 6.4. Đọc Thông Tin Tài Khoản Hiện Tại (`GET /api/v1/auth/me`)
- **Mục đích:** Đọc hồ sơ tài khoản hiện tại qua Bearer token.
- **Header:** `Authorization: Bearer <token>`.
- **Phản hồi thành công (HTTP 200):**
  ```json
  {
    "success": true,
    "message": "Lấy thông tin tài khoản thành công.",
    "data": {
      "user": {
        "id": "1",
        "username": "buyer_test",
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

### 6.5. Bảng Mapping Mã Lỗi Hệ Thống & Xác Thực:

| Tình huống thực tế | HTTP Backend | `error.code` | Ghi chú |
| :--- | :---: | :--- | :--- |
| Sai username, mật khẩu sai, hoặc tài khoản `blocked` | **401** | `INVALID_CREDENTIALS` | Thông điệp chung, không lộ lý do cụ thể |
| Thiếu header Authorization hoặc sai cú pháp `Bearer <token>` | **401** | `AUTH_REQUIRED` | Bắt buộc phải có token hợp lệ |
| Token sai signature, sai issuer/audience, sai thuật toán, thiếu sub | **401** | `AUTH_INVALID` | Token không hợp lệ |
| Token đã quá thời hạn 15 phút (900 giây) | **401** | `AUTH_EXPIRED` | Token đã hết hạn, cần đăng nhập lại |
| Tài khoản không đủ quyền hạn (vd: buyer gọi API của seller) | **403** | `FORBIDDEN` | Phân quyền vai trò người dùng |
| Vượt quá giới hạn thử đăng nhập (Rate limit) | **429** | `RATE_LIMITED` | Kèm header `Retry-After: <giây>` |
| Data API ready trả 503 `DATABASE_UNAVAILABLE` với envelope hợp lệ | **503** | `DATA_API_UNAVAILABLE` | Cơ sở dữ liệu MySQL không sẵn sàng |
| Không kết nối được Data API (port đóng, lỗi mạng, từ chối kết nối) | **503** | `DATA_API_UNAVAILABLE` | Dịch vụ Data API chưa bật hoặc không truy cập được |
| Hết deadline 5000ms (Data API không trả headers hoặc treo body stream) | **504** | `DATA_API_TIMEOUT` | Ngân sách cố định 5000ms bao phủ kết nối, headers, stream body và parse JSON |
| Data API trả 401 do sai service key | **502** | `DATA_API_AUTH_FAILED` | Lỗi cấu hình xác thực dịch vụ nội bộ; **không** trả public 401 |
| Redirect, HTTP status ngoài contract, JSON sai cú pháp, envelope sai hoặc body > 1MiB | **502** | `DATA_API_BAD_RESPONSE` | Dữ liệu Data API trả về không hợp lệ |

> **Bảo mật phản hồi lỗi:** Tất cả response lỗi tuân thủ format `{ "success": false, "message": "...", "error": { "code": "..." } }` với message tiếng Việt cố định. Tuyệt đối không để lộ dữ liệu nội bộ, thông điệp lỗi upstream, stack trace hoặc secret key ra ngoài API công khai.

---

## 7. Chạy Kiểm Thử Tự Động

Dự án cung cấp 3 bộ kịch bản kiểm thử tự động độc lập, không phụ thuộc framework bên ngoài:

### 7.1. Smoke Test Môi Trường & Cơ Bản (`npm run smoke`):
```bash
npm run smoke
```
Kiểm tra nhanh 56 assertions:
- Xác thực hợp lệ và từ chối các giá trị sai của `PORT`, `DATA_API_URL` (giao thức, credentials, query string, fragment, `/internal/v1`), `DATA_API_KEY` (rỗng, khoảng trắng, placeholder) và `JWT_SECRET` (rỗng, ngắn hơn 32 ký tự, placeholder).
- Regression test bảo vệ an toàn log: URL sai cú pháp chứa credentials giả, marker trong query/fragment bị từ chối và tuyệt đối không in secret ra stdout/stderr.
- Liveness check `GET /api/v1/health` (HTTP 200).
- Xử lý 404 `NOT_FOUND` và 400 `BAD_JSON`.
- Kiểm tra chính sách CORS.

### 7.2. Kiểm Thử Tích Hợp Readiness Toàn Diện (`npm run check:ready` hoặc `npm run check`):
```bash
npm run check:ready
```
Kiểm thử trực tiếp trên tiến trình `backend/src/server.js` thực tế với 56 assertions:
- Readiness chuỗi đầy đủ: MySQL -> Data API -> Backend (200 OK).
- Ngắt kết nối MySQL / Data API (503 DATA_API_UNAVAILABLE).
- Sai khóa dịch vụ nội bộ `DATA_API_KEY` (502 DATA_API_AUTH_FAILED).
- Kiểm tra Deadline 5000ms và streaming timeout (504 DATA_API_TIMEOUT).
- Thẩm định envelope và giới hạn kích thước body 1MiB (502 DATA_API_BAD_RESPONSE).
- Khả năng tự phục hồi và bảo mật thông tin lỗi upstream.

### 7.3. Hướng Dẫn Thiết Lập Database Test Riêng (`shopnova_auth_test`):
Để bảo vệ an toàn dữ liệu và giữ nguyên vẹn chỉ số `AUTO_INCREMENT` của `shopnova_dev`, kịch bản test xác thực bắt buộc chạy trên một database test riêng (`shopnova_auth_test`).

1. **Tạo database test từ schema gốc (không sửa database dev):**
   ```sql
   CREATE DATABASE IF NOT EXISTS shopnova_auth_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. **Nạp các bảng từ `database/schema.sql`:**
   ```powershell
   Get-Content ../database/schema.sql | mysql -u root -p shopnova_auth_test
   ```
3. **Cấp quyền tài khoản theo nguyên tắc tối thiểu:**
   - Tài khoản writer dùng setup fixture (`shopnova_fixture`): Cấp quyền ghi trên database test.
   - Tài khoản Data API (`shopnova_data_api`): Chỉ cấp quyền `SELECT` trên database test.
   ```sql
   GRANT ALL PRIVILEGES ON shopnova_auth_test.* TO 'shopnova_fixture'@'127.0.0.1';
   GRANT SELECT ON shopnova_auth_test.* TO 'shopnova_data_api'@'127.0.0.1';
   FLUSH PRIVILEGES;
   ```

### 7.4. Kiểm Thử Tích Hợp Xác Thực & Phân Quyền (`npm run check:auth`):
Để chạy kiểm thử xác thực, bắt buộc cung cấp mật khẩu tài khoản writer test qua biến môi trường. Script tuyệt đối không hardcode mật khẩu và sẽ **dừng lại ngay trước mọi thao tác ghi nếu cấu hình trỏ vào `shopnova_dev`**:

```powershell
$env:TEST_FIXTURE_PASSWORD="<mat-khau-shopnova_fixture>"
npm run check:auth
```

Kiểm thử toàn diện xác thực và phân quyền BE-003A-R1 với 128 assertions (94 MySQL thật + 34 Mock Contract):
1. **Kiểm tra chặt chẽ hồ sơ Data API (Contract Enforcement):**
   - Thẩm định toàn bộ trường hồ sơ user (`id`, `username`, `fullName`, `email`, `phone`, `avatarUrl`, `role`, `status`, `shopId`).
   - `id` và `shopId` bắt buộc là chuỗi số nguyên dương chuẩn dạng `BIGINT UNSIGNED`, không parse qua `Number` để tránh mất độ chính xác.
   - Buyer bắt buộc có `shopId === null`; Seller bắt buộc có `shopId` hợp lệ dạng chuỗi.
   - Hồ sơ thiếu trường, sai kiểu, vai trò lạ (`superadmin`), trạng thái lạ (`pending`) hoặc `user.id` không khớp với ID yêu cầu đều trả về HTTP 502 `DATA_API_BAD_RESPONSE`.
   - Tuyệt đối không chuyển tiếp `json.message` từ Data API ra API công khai; mã 400 từ Data API được chuẩn hóa thành message tiếng Việt cố định `"Dữ liệu yêu cầu không hợp lệ."`.
2. **Thẩm định JWT Claims & Sub Chuẩn:**
   - Thẩm định `sub` trước khi gọi Data API: Bắt buộc là chuỗi số nguyên dương chuẩn (`/^[1-9]\d*$/`), không khoảng trắng, không số 0 ở đầu, không ký tự lạ và không vượt $2^{64}-1$.
   - Token có `sub` không hợp lệ bị từ chối với HTTP 401 `AUTH_INVALID` ngay lập tức mà **không gọi sang Data API upstream**.
   - Kiểm tra `iat` và `exp` là số nguyên dương, thời hạn access token chuẩn 900 giây với dung sai lệch đồng hồ (`clockTolerance`) tối đa 60 giây.
   - Không sử dụng `role` trong token để thay thế vai trò thực tế; luôn tra cứu trạng thái và vai trò mới nhất từ Data API tại thời điểm xử lý request.
3. **Phân quyền và Kế thừa vai trò:**
   - Middleware `requireRole` bảo đảm: Người bán (`seller`) kế thừa đầy đủ quyền của người mua (`buyer`); người mua bị từ chối truy cập chức năng người bán với HTTP 403 `FORBIDDEN`.
4. **Rate Limiting An Toàn & Chống Bypass:**
   - Giới hạn 5 lần thử đăng nhập sai trong 60 giây; vượt ngưỡng trả HTTP 429 `RATE_LIMITED` kèm header `Retry-After`.
   - Cơ chế xác định IP từ kết nối TCP ngăn chặn hoàn toàn việc bypass bằng cách thay đổi liên tục header `X-Forwarded-For`.
   - Giới hạn tối đa 10.000 bản ghi trong bộ nhớ với cơ chế dọn dẹp định kỳ và eviction chống tấn công cạn kiệt RAM.
   - Chỉ tính số lần thử sai khi phản hồi HTTP 400 hoặc 401; không phạt người dùng khi hệ thống gặp sự cố máy chủ (500, 502, 503, 504).
   - Đăng nhập thành công (HTTP 200) xóa ngay bộ đếm cho IP đó.
5. **Xử lý Timeout & Sự cố Cơ sở dữ liệu:**
   - Chuẩn hóa các lỗi timeout (SELECT treo, acquire timeout, lỗi kết nối) từ Data API thành HTTP 503 `DATABASE_UNAVAILABLE`; Backend ánh xạ thành HTTP 503 `DATA_API_UNAVAILABLE`.
   - Phân biệt rõ lỗi xác thực dịch vụ nội bộ (401 `SERVICE_UNAUTHORIZED` từ Data API -> HTTP 502 `DATA_API_AUTH_FAILED` của Backend) với lỗi đăng nhập sai (HTTP 401 `INVALID_CREDENTIALS`).
   - Kiểm tra và đảm bảo không có sensitive marker (SQL, stack trace, parameters) bị rò rỉ ra response hay log.
6. **Cô lập dữ liệu tuyệt đối:**
   - Toàn bộ thao tác ghi fixture chỉ thực thi trên `shopnova_auth_test`.
   - Tự động đối chiếu `AUTO_INCREMENT` và số lượng bản ghi của `shopnova_dev.users` trước và sau khi chạy test để chứng minh `shopnova_dev` hoàn toàn không bị ảnh hưởng.

---

## 8. Cấu Trúc Mã Nguồn & Vòng Đời Của Một Request

### Cấu trúc thư mục:
```text
backend/
├── .env.example                          # File mẫu cấu hình môi trường (DATA_API_URL, DATA_API_KEY, JWT_SECRET)
├── .gitignore                            # Bỏ qua node_modules và file .env thật
├── package.json                          # Quản lý script và dependencies
├── package-lock.json                     # Khóa phiên bản chính xác của các thư viện
├── README.md                             # Hướng dẫn này
├── scripts/
│   ├── smoke-test.mjs                    # Script kiểm thử smoke và validation cấu hình
│   ├── test-integration-ready.mjs        # Script kiểm thử tích hợp readiness toàn diện
│   └── test-integration-auth.mjs         # Script kiểm thử tích hợp auth và phân quyền toàn diện
└── src/
    ├── app.js                            # Tạo và cấu hình Express, middleware, routes
    ├── server.js                         # Điểm khởi chạy (gọi app.listen), xử lý lỗi cổng và tắt server
    ├── config/
    │   └── env.js                        # Đọc và kiểm tra hợp lệ các biến môi trường (PORT, DATA_API_URL, DATA_API_KEY, JWT_SECRET)
    ├── controllers/
    │   ├── auth.controller.js            # Xử lý đăng nhập (/api/v1/auth/login) và thông tin cá nhân (/api/v1/auth/me)
    │   ├── health.controller.js          # Hàm xử lý liveness check (/api/v1/health)
    │   └── ready.controller.js           # Hàm xử lý readiness check (/api/v1/ready)
    ├── clients/
    │   └── data.client.js                # HTTP Client gọi Data API (health, ready, verifyCredentials, getUserAuthProfile)
    ├── middlewares/
    │   ├── auth.middleware.js            # Thẩm định Bearer JWT (authenticate) và kiểm tra role (requireRole)
    │   ├── error.middleware.js           # Bắt và định dạng lỗi an toàn (400, 401, 403, 413, 500, 502, 503, 504)
    │   ├── not-found.middleware.js       # Bắt các URL không tồn tại (404)
    │   └── rate-limit.middleware.js      # Giới hạn tần suất thử đăng nhập in-memory (429 RATE_LIMITED)
    ├── routes/
    │   ├── auth.routes.js                # Khai báo đường dẫn API /api/v1/auth/*
    │   └── health.routes.js              # Khai báo đường dẫn API /api/v1/health và /api/v1/ready
    └── services/                         # (Bổ sung khi có nghiệp vụ) Xử lý business logic
```

### Vòng đời của một Request Xác Thực (`POST /api/v1/auth/login`):
1. **Request tới:** Client gửi POST body `{ "username", "password" }`.
2. **Middleware:** `helmet()`, `cors()`, `express.json()`.
3. **Rate Limiting:** `authRateLimiter` kiểm tra số lần thử sai theo IP.
4. **Validation:** Controller kiểm tra kiểu dữ liệu, chuẩn hóa username, kiểm tra độ dài password (tối đa 72 bytes).
5. **Giao tiếp Data API:** Gọi `verifyCredentials(username, password)` qua `data.client.js` với timeout 5000ms.
6. **Data API phản hồi:** So sánh bcrypt hash bằng dummy hash chống timing attack. Nếu hợp lệ, trả hồ sơ người dùng.
7. **Phát hành JWT:** Backend ký JWT HS256 với issuer `shopnova-backend`, audience `shopnova-clients`, subject `userId`, hạn 15 phút.
8. **Trả phản hồi:** Trả JSON envelope kèm `token`, `tokenType: "Bearer"`, `expiresIn: 900` và whitelist thông tin người dùng.

---

## 9. Lưu Ý Về CORS và Bảo Mật

- **CORS:** Cấu hình cho phép ứng dụng Frontend (React Vite trên cổng 5173) gọi API an toàn.
- **Bảo mật dịch vụ nội bộ:** Giao tiếp Backend -> Data API được bảo vệ bằng header `x-service-key`. Client ngoài không thể truy cập trực tiếp Data API.
- **Bảo mật JWT:** Chuỗi ký `JWT_SECRET` được lưu độc lập tại Backend, không chia sẻ cho Data API hay Frontend; token có hạn ngắn 15 phút.

---

## 10. Các Lỗi Thường Gặp & Cách Xử Lý

1. **Backend báo lỗi `Lỗi cấu hình môi trường: JWT_SECRET là bắt buộc...`:**
   - *Nguyên nhân:* Biến `JWT_SECRET` trong `.env` chưa có, bị để trống hoặc ngắn hơn 32 ký tự.
   - *Khắc phục:* Điền chuỗi ngẫu nhiên có độ dài ít nhất 32 ký tự vào `JWT_SECRET` trong `backend/.env`.
2. **Gọi API bị từ chối 401 `INVALID_CREDENTIALS`:**
   - *Nguyên nhân:* Username hoặc password không chính xác, hoặc tài khoản đã bị khóa (`blocked`).
3. **Gọi `/api/v1/auth/me` trả về 401 `AUTH_EXPIRED`:**
   - *Nguyên nhân:* Access token đã vượt quá hạn 15 phút.
   - *Khắc phục:* Thực hiện đăng nhập lại để nhận token mới.
4. **Gọi API bị chặn 429 `RATE_LIMITED`:**
   - *Nguyên nhân:* Đăng nhập sai quá 5 lần trong 1 phút từ cùng một IP.
   - *Khắc phục:* Chờ hết thời gian quy định trong header `Retry-After` trước khi thử lại.

---

## 11. Kế Hoạch Cho Tác Vụ Tiếp Theo (BE-003B)

Sau khi hoàn thành BE-003A (đăng nhập, lấy thông tin cá nhân và phân quyền buyer/seller cơ sở):
- **BE-003B:**
  - Triển khai đăng ký tài khoản mới cho Buyer.
  - Cơ chế Refresh Token an toàn và thu hồi phiên đăng xuất phía server.
  - Đổi mật khẩu tài khoản và cập nhật thông tin cá nhân.
  - Tích hợp kết nối đăng nhập từ giao diện React Web và Flutter App.
