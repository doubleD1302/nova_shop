# ShopNova — Sàn Thương Mại Điện Tử Đa Người Bán

ShopNova là nền tảng thương mại điện tử đa người bán (Multi-vendor Marketplace), hỗ trợ trải nghiệm người dùng trên cả nền tảng Web (React) và Mobile App (Flutter), kết nối hệ thống dịch vụ Backend phân tầng và cơ sở dữ liệu MySQL 8.4.

---

## 1. Kiến Trúc Phân Tầng Hệ Thống (Architecture)

Hệ thống ShopNova tuân thủ mô hình phân tách trách nhiệm đa tầng (chi tiết tại [ARCHITECTURE.md](docs/backend/ARCHITECTURE.md)):

```text
┌──────────────────────────────────────────────┐
│       Giao diện Người dùng (Frontend)         │
│   • Web App: React 19 + Vite + Tailwind CSS  │
│   • Mobile App: Flutter (iOS / Android)      │
└──────────────────────┬───────────────────────┘
                       │
                       │ HTTP Public API (/api/v1/*)
                       ▼
┌──────────────────────────────────────────────┐
│       Máy chủ Nghiệp vụ (Backend API)        │
│   • Node.js 24 LTS + Express 5               │
│   • Xác thực Bearer JWT, phân quyền tài khoản│
│   • Rate Limiting bảo vệ brute-force         │
│   • Port mặc định: 3000                      │
└──────────────────────┬───────────────────────┘
                       │
                       │ HTTP Nội bộ (/internal/v1/*)
                       │ Header: x-service-key: DATA_API_KEY
                       │ Deadline cố định: 5000ms
                       ▼
┌──────────────────────────────────────────────┐
│       Dịch vụ Dữ liệu (Data API Nội bộ)      │
│   • Node.js + Express 5                      │
│   • Sequelize 6 + mysql2 pool management     │
│   • Quản lý connection lifecycle & timeout   │
│   • Hash bcrypt và bảo vệ timing attack      │
│   • Port mặc định: 3001                      │
└──────────────────────┬───────────────────────┘
                       │
                       │ TCP Socket (Sequelize Pool, UTC)
                       ▼
┌──────────────────────────────────────────────┐
│       Cơ sở Dữ liệu (MySQL Database)         │
│   • MySQL Server 8.4 LTS (InnoDB)            │
│   • Charset utf8mb4, Collation chuẩn Unicode │
│   • 22 bảng nghiệp vụ, ràng buộc khóa ngoại  │
│   • Port mặc định: 3306                      │
└──────────────────────────────────────────────┘
```

### Nguyên tắc vận hành cốt lõi:
1. **Frontend** chỉ giao tiếp với Backend qua các endpoint công khai `/api/v1/*`.
2. **Backend** chịu trách nhiệm xác thực người dùng, ủy quyền, kiểm tra giới hạn tần suất (Rate Limit) và xử lý nghiệp vụ; **Backend không kết nối trực tiếp MySQL**, không cài đặt Sequelize/mysql2 và không import mã nguồn từ Data API.
3. **Data API** là dịch vụ duy nhất giữ kết nối và truy vấn CSDL MySQL bằng Sequelize + driver `mysql2`. Mọi yêu cầu nội bộ bắt buộc phải kèm header bảo mật `x-service-key`.
4. **An toàn CSDL:** Data API chỉ mở các endpoint nghiệp vụ được chỉ định rõ; tuyệt đối không mở endpoint nhận câu lệnh SQL tùy ý.

---

## 2. Cấu Trúc Tổng Thể Dự Án

```text
nova_shop/
├── src/                         # Ứng dụng Web (React 19 + Vite 6 + Tailwind CSS v4)
├── app/                         # Ứng dụng Di Động (Flutter / Dart SDK ^3.13.3)
├── backend/                     # Máy chủ Backend API (Node.js + Express 5)
├── data-api/                    # Dịch vụ Data API nội bộ (Sequelize 6 + mysql2 -> MySQL 8.4)
├── database/                    # Thiết kế schema MySQL, seed mẫu và tài liệu CSDL
└── docs/                        # Tài liệu kỹ thuật dự án
    └── backend/
        ├── ARCHITECTURE.md      # Thiết kế kiến trúc phân tầng
        └── API_INVENTORY.md     # Danh mục và kế hoạch triển khai API
```

---

## 3. Công Nghệ Sử Dụng (Tech Stack)

### A. Web Frontend (`src/`)
- **Framework:** React 19 (`^19.1.0`), ReactDOM 19
- **Build Tool:** Vite 6 (`^6.3.5`), `@vitejs/plugin-react`
- **Styling:** Tailwind CSS v4 (`^4.1.8`), `@tailwindcss/vite`
- **Routing:** React Router DOM v7 (`^7.6.2`)
- **State Management:** React Context API (`AuthContext`, `CartContext`, `CatalogContext`, `OrderContext`, `ToastContext`)
- **Persistence:** LocalStorage qua `storage.js` (tiền tố `shopnova:`) kết hợp bộ dữ liệu mẫu tiếng Việt phong phú

### B. Mobile App (`app/`)
- **Framework:** Flutter (Dart SDK `^3.13.3` theo khai báo `pubspec.yaml`)
- **Nền tảng mục tiêu:** Android, iOS, Web, Windows, macOS, Linux
- **Thư viện chính:** `cupertino_icons`, `intl`
- **Cấu trúc:** Phân tách rõ ràng theo `screens/`, `widgets/`, `models/`, `theme/`, `data/`

### C. Backend Server (`backend/`)
- **Runtime:** Node.js (Mục tiêu: Node 24 LTS, tương thích Node 20+)
- **Framework:** Express 5 (`^5.0.1`), JavaScript ES Modules (`"type": "module"`)
- **Xác thực:** `jsonwebtoken` (JWT chuẩn HS256, hạn 15 phút)
- **Bảo mật & Tiện ích:** `helmet`, `cors`, `dotenv`
- **Bảo vệ Brute-force:** Rate Limiting in-memory quản lý concurrency và failed attempts, trả 429 `RATE_LIMITED` và `Retry-After`

### D. Data API Nội bộ (`data-api/`)
- **Runtime:** Node.js, Express 5
- **ORM & Driver:** Sequelize 6 (khai báo `^6.37.5`, khóa tại `6.37.8` theo `package-lock.json`) + `mysql2` (khai báo `^3.12.0`, khóa tại `3.24.5` theo `package-lock.json`)
- **Mã hóa:** `bcryptjs` (`3.0.3`) so sánh mật khẩu bất đồng bộ kèm dummy hash chống timing attack
- **Quản lý tài nguyên:** Pool Sequelize dùng chung, timeout độc lập từng request, thu hồi connection và socket an toàn khi quá hạn

### E. Cơ sở Dữ liệu (`database/`)
- **Hệ quản trị CSDL:** MySQL Server 8.4 LTS
- **Engine & Charset:** InnoDB, Charset `utf8mb4`, Collation `utf8mb4_0900_ai_ci`
- **Cấu trúc:** 22 bảng nghiệp vụ chuẩn hóa, ràng buộc CHECK, khóa ngoại composite chống nhầm shop/SKU, múi giờ UTC

---

## 4. Các Luồng Nghiệp Vụ Chính (Core Flows)

### A. Luồng Người Mua (Buyer Flow)
1. **Duyệt & Tìm kiếm:** Banner trang chủ, danh mục ngành hàng; tìm kiếm sản phẩm với bộ lọc khoảng giá, địa điểm, đánh giá sao.
2. **Chi tiết sản phẩm:** Xem hình ảnh, thông số kỹ thuật, đánh giá khách hàng, chọn biến thể/màu sắc/kích cỡ và số lượng.
3. **Giỏ hàng đa shop:** Sản phẩm được gom nhóm tự động theo từng shop bán hàng riêng biệt, hỗ trợ chọn sản phẩm thanh toán và áp mã giảm giá.
4. **Thanh toán & Đơn hàng:** Nhập địa chỉ nhận hàng, chọn phương thức thanh toán (COD, Chuyển khoản, Ví), theo dõi trạng thái đơn hàng (Chờ xác nhận, Đang giao, Đã giao, Đã hủy).

### B. Luồng Người Bán (Seller Flow - Kênh Người Bán `/nguoi-ban`)
1. **Dashboard:** Theo dõi doanh thu, số đơn chờ xử lý, cảnh báo tồn kho và sản phẩm bán chạy.
2. **Quản lý sản phẩm:** Xem danh sách, thêm mới và cập nhật giá, tồn kho, ảnh, mô tả sản phẩm.
3. **Quản lý đơn hàng:** Tiếp nhận và cập nhật trạng thái các đơn hàng thuộc shop của mình (không can thiệp vào đơn của shop khác).
4. **Cài đặt gian hàng:** Chỉnh sửa thông tin shop, logo, banner đại diện.

---

## 5. Hướng Dẫn Cài Đặt và Khởi Chạy Từng Thành Phần

Thứ tự chuẩn bị và khởi chạy khuyến nghị: **MySQL Database → Data API → Backend Server → Frontend Web / Mobile App**.

### 5.1. Thiết Lập Cơ Sở Dữ Liệu MySQL 8.4

1. **Khởi động MySQL Server 8.4:** Đảm bảo dịch vụ MySQL đang chạy trên cổng `3306`.
2. **Tạo Database phát triển:**
   ```sql
   CREATE DATABASE IF NOT EXISTS shopnova_dev
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_0900_ai_ci;
   ```
3. **Import Cấu trúc 22 Bảng (`database/schema.sql`) và Dữ liệu mẫu (`database/seed.sql`):**

   - **Cách 1: Sử dụng MySQL Client & Lệnh SOURCE (Khuyến nghị trên PowerShell & Terminal):**
     ```bash
     mysql -h 127.0.0.1 -P 3306 -u root -p --default-character-set=utf8mb4
     ```
     Sau khi đăng nhập:
     ```sql
     USE shopnova_dev;
     SOURCE database/schema.sql;
     SOURCE database/seed.sql;
     ```

   - **Cách 2: Sử dụng Command Prompt (CMD trên Windows):**
     ```cmd
     chcp 65001
     mysql -u root -p --default-character-set=utf8mb4 shopnova_dev < database\schema.sql
     mysql -u root -p --default-character-set=utf8mb4 shopnova_dev < database\seed.sql
     ```

4. **Tạo tài khoản chuyên dụng cho Data API:**
   - **Tài khoản runtime Data API (`shopnova_data_api`):** Ở giai đoạn hiện tại, Data API chỉ mở các endpoint đọc dữ liệu (`health`, `ready`, `verify-credentials`, `auth-profile`), do đó chỉ cần cấp quyền `SELECT`:
     ```sql
     CREATE USER IF NOT EXISTS 'shopnova_data_api'@'127.0.0.1' IDENTIFIED BY 'MatKhauDataApiCuaBan!';
     GRANT SELECT ON shopnova_dev.* TO 'shopnova_data_api'@'127.0.0.1';
     FLUSH PRIVILEGES;
     ```
   - **Tài khoản khởi tạo & nạp fixture (Bootstrap / Fixture):** Các thao tác tạo cấu trúc bảng (`database/schema.sql`), nạp seed dữ liệu mẫu (`database/seed.sql`) hoặc ghi fixture kiểm thử được thực hiện tách biệt bằng tài khoản quản trị (như `root`) hoặc tài khoản fixture chuyên dụng có quyền ghi (`INSERT, UPDATE, DELETE`), không dùng tài khoản runtime `shopnova_data_api`.

---

### 5.2. Cấu Hình và Khởi Chạy Data API (`data-api/`)

1. **Cài đặt thư viện phụ thuộc:**
   ```bash
   cd data-api
   npm install
   ```

2. **Cấu hình môi trường:**
   Tạo file `.env` từ `.env.example`:
   ```bash
   # Linux/macOS
   cp .env.example .env
   # Windows PowerShell
   Copy-Item .env.example .env
   ```
   Chỉnh sửa các thông số kết nối CSDL và Service Key trong `data-api/.env`:
   ```env
   HOST=127.0.0.1
   PORT=3001
   NODE_ENV=development
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=shopnova_dev
   DB_USER=shopnova_data_api
   DB_PASSWORD=MatKhauDataApiCuaBan!
   DATA_API_KEY=KhoaDichVuNoiBoCuaBan_ToiThieu32KyTu!
   DB_READINESS_TIMEOUT_MS=3000
   ```

3. **Chạy kiểm thử tự động:**
   ```bash
   npm run smoke          # Kiểm tra cấu hình và mã lỗi độc lập CSDL
   npm run check:timeout  # Kiểm tra timeout, deadline và thu hồi socket
   npm run check:db       # Kiểm tra kết nối MySQL 8.4 thật và dữ liệu seed
   ```

4. **Khởi chạy máy chủ:**
   ```bash
   npm run dev    # Chế độ phát triển (tự reload)
   # hoặc:
   npm start      # Chế độ bình thường
   ```
   Data API sẽ hoạt động tại `http://127.0.0.1:3001`.

---

### 5.3. Cấu Hình và Khởi Chạy Backend Server (`backend/`)

1. **Cài đặt thư viện phụ thuộc:**
   ```bash
   cd backend
   npm install
   ```

2. **Cấu hình môi trường:**
   Tạo file `.env` từ `.env.example`:
   ```bash
   # Linux/macOS
   cp .env.example .env
   # Windows PowerShell
   Copy-Item .env.example .env
   ```
   Chỉnh sửa các biến môi trường trong `backend/.env`:
   ```env
   PORT=3000
   NODE_ENV=development
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   DATA_API_URL=http://127.0.0.1:3001
   DATA_API_KEY=KhoaDichVuNoiBoCuaBan_ToiThieu32KyTu!
   JWT_SECRET=ChuoiBiMatKyJwtToiThieu32KyTuDocLapVoiApiKey!
   ```

   *Gợi ý sinh chuỗi bí mật an toàn:*
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Chạy kiểm thử tự động:**
   ```bash
   npm run smoke        # Kiểm tra validation cấu hình, liveness, CORS
   npm run check:ready  # Kiểm tra readiness chuỗi Backend -> Data API -> MySQL
   npm run check:auth   # Kiểm tra tích hợp đăng nhập, JWT claims, rate limit và phân quyền
   ```

4. **Khởi chạy máy chủ:**
   ```bash
   npm run dev    # Chế độ phát triển (tự reload)
   # hoặc:
   npm start      # Chế độ bình thường
   ```
   Backend Server sẽ hoạt động tại `http://127.0.0.1:3000`.

---

### 5.4. Khởi Chạy Web Frontend (`src/`)

1. **Cài đặt thư viện phụ thuộc tại thư mục gốc `nova_shop/`:**
   ```bash
   npm install
   ```

2. **Chạy máy chủ phát triển Vite:**
   ```bash
   npm run dev
   ```
   Ứng dụng Web hiển thị tại `http://localhost:5173`.

3. **Build kiểm tra:**
   ```bash
   npm run build
   ```

---

### 5.5. Khởi Chạy Mobile App (`app/`)

1. **Cài đặt thư viện phụ thuộc:**
   ```bash
   cd app
   flutter pub get
   ```

2. **Khởi chạy ứng dụng:**
   ```bash
   flutter run
   ```

---

## 6. Danh Mục Endpoint Hệ Thống & Xác Thực

### A. Endpoint Hệ Thống (Backend)
- `GET /api/v1/health`: Liveness check (HTTP 200 khi tiến trình Backend sống, độc lập với CSDL).
- `GET /api/v1/ready`: Readiness check (HTTP 200 khi toàn bộ chuỗi Backend → Data API → MySQL sẵn sàng).

### B. Endpoint Xác Thực & Tài Khoản (Backend)
- `POST /api/v1/auth/login`: Đăng nhập bằng `username` và `password`. Cấp JWT Bearer token hạn 15 phút. Được bảo vệ bởi Rate Limiter (tối đa 5 lần thử sai trong 1 phút).
- `GET /api/v1/auth/me`: Đọc thông tin tài khoản hiện tại qua header `Authorization: Bearer <token>`.

### C. Endpoint Nội Bộ (Data API — yêu cầu header `x-service-key`)
- `GET /internal/v1/health`: Kiểm tra tiến trình Data API.
- `GET /internal/v1/ready`: Kiểm tra kết nối MySQL với timeout `DB_READINESS_TIMEOUT_MS`.
- `POST /internal/v1/auth/verify-credentials`: Xác thực thông tin đăng nhập với bcrypt.
- `GET /internal/v1/users/:userId/auth-profile`: Đọc hồ sơ tài khoản phục vụ phân quyền thời gian thực.

---

## 7. Quy Chuẩn Xử Lý Lỗi và An Toàn Thông Tin

Tất cả các API tuân thủ envelope JSON thống nhất:

```json
{
  "success": false,
  "message": "Thông báo lỗi bằng tiếng Việt dễ hiểu cho người dùng.",
  "error": {
    "code": "MA_LOI_HE_THONG"
  }
}
```

- **Mã lỗi phổ biến:**
  - `BAD_JSON` (400): Body JSON không hợp lệ.
  - `INVALID_CREDENTIALS` (401): Tên đăng nhập hoặc mật khẩu không đúng.
  - `AUTH_REQUIRED` (401): Thiếu token xác thực.
  - `AUTH_INVALID` (401): Token không hợp lệ hoặc sai cấu trúc.
  - `AUTH_EXPIRED` (401): Token đã hết hạn 15 phút.
  - `FORBIDDEN` (403): Tài khoản không đủ quyền truy cập (vd: buyer gọi API của seller).
  - `RATE_LIMITED` (429): Quá giới hạn thử đăng nhập; kèm header `Retry-After: <giây>`.
  - `DATA_API_UNAVAILABLE` (503): Data API hoặc CSDL MySQL tạm thời không khả dụng.
  - `DATA_API_TIMEOUT` (504): Quá hạn thời gian phản hồi (deadline 5000ms).
- **An toàn thông tin:** Tuyệt đối không để lộ dữ liệu nhạy cảm (câu lệnh SQL, tham số truy vấn, stack trace, secret key, credential) ra log, phản hồi HTTP hay tài liệu công khai.
