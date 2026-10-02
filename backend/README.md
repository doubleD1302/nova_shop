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
- **Trạng thái hiện tại (Hoàn thành DB-003 / BE-002B2):**
  - Đã hoàn thành nền tảng máy chủ Express 5, chuẩn hóa quy ước tên file, cấu hình biến môi trường, bảo mật CORS/Helmet, middleware xử lý lỗi an toàn.
  - Đã hoàn thành HTTP client tại `src/clients/data.client.js` kết nối Data API nội bộ qua built-in `fetch` Node.js với deadline 5000ms bao quát toàn bộ request/body, giới hạn 1MiB và mapping mã lỗi an toàn.
  - Đã triển khai `GET /api/v1/ready` phản ánh trạng thái sẵn sàng của cả Backend, Data API và cơ sở dữ liệu MySQL.
  - Giữ `GET /api/v1/health` làm liveness độc lập (vẫn trả 200 khi Data API hoặc MySQL ngừng hoạt động).
  - Chưa triển khai auth người dùng, catalog, giỏ hàng, đơn hàng (các endpoint nghiệp vụ vẫn ở trạng thái `planned`).

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
```

### Quy tắc kiểm tra cấu hình:
- `PORT`: Bắt buộc là số nguyên hợp lệ trong khoảng 1–65535 (mặc định 3000).
- `DATA_API_URL`: Base URL của dịch vụ Data API, không chứa `/internal/v1`. Chỉ chấp nhận giao thức `http:` hoặc `https:`, không chứa thông tin xác thực (`user:pass`), query string hoặc fragment.
- `DATA_API_KEY`: Bắt buộc, từ chối chuỗi rỗng, toàn khoảng trắng hoặc placeholder mẫu trong danh sách cấm (như `your_service_key_here`, `your_data_api_key_here`, `your_secret_key_here`, `change_me`, `secret`, `password`).
- **An toàn thông tin:** Thông báo lỗi cấu hình chỉ nêu tên biến môi trường bị lỗi và lý do cố định, tuyệt đối không in giá trị URL, credentials, query, fragment hoặc secret ra log/stdout/stderr.
- Hỗ trợ `DOTENV_CONFIG_PATH` để chỉ định file cấu hình khi kiểm thử cô lập. Backend vẫn có thể khởi động khi cấu hình hợp lệ dù Data API đang tắt.

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
- **Kết quả thành công (HTTP 200):**
  ```json
  {
    "success": true,
    "message": "Backend sẵn sàng.",
    "data": {
      "service": "shopnova-backend",
      "status": "ready",
      "dataApi": "connected",
      "database": "connected"
    }
  }
  ```

### 6.3. Bảng Mapping Mã Lỗi Readiness:

| Tình huống thực tế | HTTP Backend | `error.code` | Ghi chú |
| :--- | :---: | :--- | :--- |
| Data API ready trả 503 `DATABASE_UNAVAILABLE` với envelope hợp lệ | **503** | `DATA_API_UNAVAILABLE` | Cơ sở dữ liệu MySQL không sẵn sàng |
| Không kết nối được Data API (port đóng, lỗi mạng, từ chối kết nối) | **503** | `DATA_API_UNAVAILABLE` | Dịch vụ Data API chưa bật hoặc không truy cập được |
| Hết deadline 5000ms (Data API không trả headers hoặc treo body stream) | **504** | `DATA_API_TIMEOUT` | Ngân sách cố định 5000ms bao phủ kết nối, headers, stream body và parse JSON |
| Data API trả 401 do sai service key | **502** | `DATA_API_AUTH_FAILED` | Lỗi cấu hình xác thực dịch vụ nội bộ; **không** trả public 401 |
| Redirect, HTTP status ngoài contract, JSON sai cú pháp, envelope sai hoặc body > 1MiB | **502** | `DATA_API_BAD_RESPONSE` | Dữ liệu Data API trả về không hợp lệ |

> **Bảo mật phản hồi lỗi:** Tất cả response lỗi tuân thủ format `{ "success": false, "message": "...", "error": { "code": "..." } }` với message tiếng Việt cố định. Tuyệt đối không để lộ dữ liệu nội bộ, thông điệp lỗi upstream, stack trace hoặc secret key ra ngoài API công khai.

---

## 7. Chạy Kiểm Thử Tự Động

Dự án cung cấp 2 bộ kịch bản kiểm thử tự động độc lập, không phụ thuộc framework bên ngoài:

### 7.1. Smoke Test Môi Trường & Cơ Bản (`npm run smoke`):
```bash
npm run smoke
```
Kiểm tra nhanh 42 assertions:
- Xác thực hợp lệ và từ chối các giá trị sai của `PORT`, `DATA_API_URL` (giao thức, credentials, query string, fragment, `/internal/v1`) và `DATA_API_KEY` (rỗng, khoảng trắng, placeholder).
- Regression test bảo vệ an toàn log: URL sai cú pháp chứa username/password giả, marker trong query/fragment, URL có credentials nhưng đúng cú pháp đều bị từ chối và tuyệt đối không in marker hay nguyên giá trị URL ra stdout/stderr.
- Liveness check `GET /api/v1/health` (HTTP 200).
- Xử lý 404 `NOT_FOUND` và 400 `BAD_JSON`.
- Kiểm tra chính sách CORS (cho phép đúng origin, từ chối origin lạ, chấp nhận non-browser request).

### 7.2. Kiểm Thử Tích Hợp Toàn Diện (`npm run check:ready` hoặc `npm run check`):
```bash
npm run check:ready
```
Kiểm thử trực tiếp trên tiến trình `backend/src/server.js` thực tế với 56 assertions:
1. **Môi trường thật (MySQL 8.4 + Data API production + Backend production):**
   - MySQL đang chạy: Backend ready trả 200 đầy đủ envelope và dữ liệu.
   - MySQL tắt (DB port đóng): Backend health trả 200, Backend ready trả 503 `DATA_API_UNAVAILABLE`.
   - Data API tắt (Data API port đóng): Backend health trả 200, Backend ready trả 503 `DATA_API_UNAVAILABLE`.
2. **Xác thực dịch vụ nội bộ:**
   - Cung cấp sai `DATA_API_KEY`: Data API trả 401 -> Backend mapping thành 502 `DATA_API_AUTH_FAILED` (không trả public 401).
3. **Kiểm tra Deadline 5000ms:**
   - Upstream không gửi HTTP headers: Hết 5000ms trả đúng 504 `DATA_API_TIMEOUT`.
   - Upstream gửi HTTP headers rồi treo truyền streaming body: Vẫn dừng đúng hạn 5000ms và trả 504 `DATA_API_TIMEOUT`.
4. **Thẩm định Envelope & Giới hạn Body:**
   - Upstream trả JSON hỏng cú pháp, thiếu `success`, thiếu `data`, sai `service`, sai `database status`, trả redirect 302, mã lỗi 500 hoặc body vượt quá 1MiB: Đều trả về 502 `DATA_API_BAD_RESPONSE`.
5. **Khả năng tự phục hồi (Self-Healing):**
   - Sau chuỗi request gặp lỗi hoặc timeout, request hợp lệ tiếp theo trên **cùng tiến trình Backend** vẫn thành công 200 OK bình thường.
6. **Bảo mật Secret Marker & Dữ liệu Upstream Nhạy Cảm:**
   - Kiểm tra Mock Data API thực sự chạy nhánh HTTP 500 với body chứa marker nhạy cảm trong message, error, sql, parameters, stack, cause.
   - Backend phản hồi 502 `DATA_API_BAD_RESPONSE`, tuyệt đối không rò rỉ bất kỳ marker nào hay `DATA_API_KEY` ra response body, stdout hoặc stderr.
   - Request khỏe tiếp theo trên cùng tiến trình Backend phục hồi thành công 200 OK.

---

## 8. Cấu Trúc Mã Nguồn & Vòng Đời Của Một Request

### Cấu trúc thư mục:
```text
backend/
├── .env.example                          # File mẫu cấu hình môi trường (bổ sung DATA_API_URL, DATA_API_KEY)
├── .gitignore                            # Bỏ qua node_modules và file .env thật
├── package.json                          # Quản lý script và dependencies
├── package-lock.json                     # Khóa phiên bản chính xác của các thư viện
├── README.md                             # Hướng dẫn này
├── scripts/
│   ├── smoke-test.mjs                    # Script kiểm thử smoke và validation cấu hình
│   └── test-integration-ready.mjs        # Script kiểm thử tích hợp readiness toàn diện
└── src/
    ├── app.js                            # Tạo và cấu hình Express, middleware, routes
    ├── server.js                         # Điểm khởi chạy (gọi app.listen), xử lý lỗi cổng và tắt server
    ├── config/
    │   └── env.js                        # Đọc và kiểm tra hợp lệ các biến môi trường (PORT, DATA_API_URL, DATA_API_KEY)
    ├── controllers/
    │   ├── health.controller.js          # Hàm xử lý liveness check (/api/v1/health)
    │   └── ready.controller.js           # Hàm xử lý readiness check (/api/v1/ready)
    ├── clients/
    │   └── data.client.js                # HTTP Client gọi Data API (/internal/v1/health, /internal/v1/ready)
    ├── middlewares/
    │   ├── error.middleware.js           # Bắt và định dạng lỗi an toàn (400, 413, 500, log mã sự kiện)
    │   └── not-found.middleware.js       # Bắt các URL không tồn tại (404)
    ├── routes/
    │   └── health.routes.js              # Khai báo đường dẫn API /api/v1/health và /api/v1/ready
    └── services/                         # (Bổ sung khi có nghiệp vụ) Xử lý business logic
```

### Vòng đời của một Request Readiness (`GET /api/v1/ready`):
1. **Request tới:** Client gửi HTTP request đến `GET /api/v1/ready`.
2. **Middleware:** `helmet()`, `cors()`, `express.json()` xử lý tầng HTTP đầu vào.
3. **Routing:** `health.routes.js` chuyển tiếp đến `ready.controller.js`.
4. **Controller & Client:** `ready.controller.js` gọi `fetchDataApiReady()` từ `clients/data.client.js`.
5. **Giao tiếp Data API:**
   - Tạo `AbortController` với deadline cố định 5000ms.
   - Gửi HTTP request đến Data API kèm `x-service-key`.
   - Đọc streaming response body (giới hạn tối đa 1MiB).
   - Kiểm tra HTTP status và cấu trúc JSON envelope.
6. **Trả phản hồi:** Trả về kết quả JSON chuẩn hoặc chuyển lỗi qua `next(err)` cho `error.middleware.js` mapping thành 502/503/504.

---

## 9. Lưu Ý Về CORS và Bảo Mật

- **CORS là gì?** CORS (Cross-Origin Resource Sharing) là cơ chế bảo mật do **trình duyệt web** thực thi để ngăn chặn một trang web độc hại gọi trộm API từ domain khác.
- **Bảo mật dịch vụ nội bộ:** Giao tiếp giữa Backend và Data API được bảo vệ bằng `x-service-key` trong mạng nội bộ. Client phía ngoài không thể gọi trực tiếp Data API và không được cấp khóa dịch vụ này.

---

## 10. Các Lỗi Thường Gặp & Cách Xử Lý

1. **Backend báo lỗi `Lỗi cấu hình môi trường: DATA_API_URL không hợp lệ`:**
   - *Nguyên nhân:* Giá trị `DATA_API_URL` trong `.env` bị thiếu, sai giao thức, chứa user:pass, query string, fragment hoặc chứa đuôi `/internal/v1`.
   - *Khắc phục:* Sửa thành base URL hợp lệ, ví dụ: `DATA_API_URL=http://127.0.0.1:3001`.
2. **Backend báo lỗi `Lỗi cấu hình môi trường: DATA_API_KEY là bắt buộc`:**
   - *Nguyên nhân:* `DATA_API_KEY` trong `.env` bị để trống hoặc dùng chuỗi placeholder mẫu trong danh sách cấm.
   - *Khắc phục:* Thiết lập khóa dịch vụ bí mật giống với `DATA_API_KEY` của Data API.
3. **Gọi `/api/v1/ready` trả về HTTP 503 `DATA_API_UNAVAILABLE`:**
   - *Nguyên nhân:* Tiến trình `data-api` chưa được bật, hoặc MySQL server tại cổng 3306 đang tắt.
   - *Khắc phục:* Khởi động MySQL server và khởi chạy Data API (`cd data-api && npm start`).
4. **Gọi `/api/v1/ready` trả về HTTP 502 `DATA_API_AUTH_FAILED`:**
   - *Nguyên nhân:* `DATA_API_KEY` trong `backend/.env` không khớp với `DATA_API_KEY` trong `data-api/.env`.
   - *Khắc phục:* Đồng bộ khóa dịch vụ giữa hai file cấu hình.

---

## 11. Kế Hoạch Cho Tác Vụ Tiếp Theo (BE-003)

Sau khi hoàn thành DB-003 (nối Backend với Data API qua HTTP và bổ sung readiness), tác vụ tiếp theo là **BE-003**:
- Triển khai xác thực người dùng (Authentication) và phân quyền (Authorization) cho buyer và seller.
- Cấp phát và thẩm định JWT / Session token tại tầng Backend.
- Tiếp tục duy trì nguyên tắc kiến trúc: Backend xử lý auth/business, Data API quản lý dữ liệu và transaction MySQL.
