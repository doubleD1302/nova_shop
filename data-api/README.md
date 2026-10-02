# ShopNova Data API

Dịch vụ Data API nội bộ phụ trách truy vấn và thao tác cơ sở dữ liệu MySQL của sàn thương mại điện tử ShopNova.

---

## 1. Vị trí trong kiến trúc hệ thống

```text
Frontend (React Web / Flutter App)
       │
       │ HTTP API (/api/v1/*)
       ▼
Backend Express (Port 3000)
       │
       │ HTTP Nội bộ (/internal/v1/*)
       │ Header: x-service-key: DATA_API_KEY
       │ Timeout: 5000ms
       ▼
Data API Express (Port 3001)
       │
       │ Sequelize 6 + mysql2 (UTC, Pool: max 5, min 0, acquire: 3000ms)
       ▼
MySQL 8.4 Server (Port 3306)
```

- **Mục đích:** Đóng vai trò tầng truy xuất dữ liệu độc lập, tách biệt Backend nghiệp vụ khỏi kết nối trực tiếp vào CSDL MySQL.
- **Bảo mật dịch vụ:** Mọi endpoint `/internal/v1/*` bắt buộc phải kèm header `x-service-key` khớp với `DATA_API_KEY`.
- **An toàn CSDL:** Chỉ mở các endpoint nghiệp vụ cố định đã được thiết kế; tuyệt đối không mở endpoint nhận câu lệnh SQL tùy ý.
- **Trạng thái:** Các endpoint hệ thống (`health`, `ready`) đã **implemented** và kiểm chứng toàn diện (hoàn thiện quyền sở hữu connection theo vòng đời và thu hồi các kết nối pool đang khởi tạo trong DB-002-R4); client Backend (`backend/src/clients/data.client.js`) đã kết nối và bổ sung readiness cho Backend trong DB-003; các endpoint nghiệp vụ (catalog, shops, orders...) vẫn ở trạng thái **planned** (sẽ triển khai từ BE-003 / BE-004).

---

## 2. Cấu hình môi trường và Thư viện phụ thuộc

### 2.1 Phiên bản Dependency thực tế (Khóa theo `package-lock.json`)
- `sequelize`: **6.37.8** (Sequelize ORM v6)
- `mysql2`: **3.24.5** (MySQL driver hiệu năng cao cho Node.js)
- `express`: **5.2.1** (Express framework v5)
- `dotenv`: **16.6.1**
- `helmet`: **8.3.0**

### 2.2 Cấu hình môi trường
Tạo file `.env` tại thư mục gốc của `data-api/` (tham khảo mẫu tại `.env.example`):

```env
# Cấu hình máy chủ Data API
HOST=127.0.0.1
PORT=3001
NODE_ENV=development

# Cấu hình kết nối MySQL Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=shopnova_dev
DB_USER=shopnova_data_api
DB_PASSWORD=

# Khóa xác thực dịch vụ nội bộ (giữa Backend và Data API)
DATA_API_KEY=

# Ngân sách thời gian kiểm tra readiness CSDL (ms)
# Mặc định: 3000ms. Giá trị hợp lệ: 200ms - 4999ms.
# Bắt buộc < 5000ms để đảm bảo Data API trả lỗi 503 DATABASE_UNAVAILABLE trước khi Backend chạm trần timeout 5000ms.
DB_READINESS_TIMEOUT_MS=3000
```

> **Lưu ý bảo mật:**
> - Tuyệt đối không commit file `.env` thật lên Git. File này đã được khai báo trong `.gitignore`.
> - Các biến `DB_PASSWORD` và `DATA_API_KEY` là bắt buộc. Hệ thống chặn các chuỗi rỗng, chuỗi chỉ chứa khoảng trắng hoặc các placeholder mẫu như `your_db_password_here`, `your_service_key_here`.
> - Biến `DB_READINESS_TIMEOUT_MS` nếu cấu hình `>= 5000` sẽ bị validator từ chối ngay lập tức lúc khởi động.
> - Khi thiếu hoặc sai cấu hình, tiến trình dừng ngay lập tức và chỉ in tên biến môi trường bị lỗi, tuyệt đối không in giá trị secret ra màn hình/log.

---

## 3. Cài đặt và khởi chạy trên Windows

### 3.1 Cài đặt thư viện phụ thuộc

Từ thư mục `data-api/`:

```cmd
npm ci
```
*(Hoặc `npm install` nếu chưa có `package-lock.json`).*

### 3.2 Khởi động chế độ phát triển (Auto-reload)

```cmd
npm run dev
```

### 3.3 Khởi động chế độ tiêu chuẩn

```cmd
npm start
```

### 3.4 Dừng dịch vụ an toàn (Graceful Shutdown)

- Nhấn tổ hợp phím `Ctrl + C` trong cửa sổ dòng lệnh.
- Hệ thống sẽ chặn các kết nối mới, hoàn tất các yêu cầu HTTP đang xử lý, đóng pool kết nối Sequelize và giải phóng tài nguyên trước khi thoát tiến trình.

---

## 4. Các endpoint hệ thống và cơ chế xử lý lỗi

Mọi yêu cầu đến các route `/internal/v1/*` bắt buộc phải kèm header:
`x-service-key: <DATA_API_KEY>`

| Method | Endpoint | Xác thực | Mục đích | Phản hồi chuẩn |
|---|---|---|---|---|
| `GET` | `/internal/v1/health` | Bắt buộc `x-service-key` | Kiểm tra tiến trình Data API (Liveness). Không truy vấn CSDL. Vẫn trả 200 ngay cả khi MySQL ngắt kết nối. | `200 OK`<br>`{ "success": true, "message": "...", "data": { "service": "shopnova-data-api", "status": "ok" } }` |
| `GET` | `/internal/v1/ready` | Bắt buộc `x-service-key` | Kiểm tra kết nối CSDL MySQL (Readiness) với ngân sách thời gian `DB_READINESS_TIMEOUT_MS` (3000ms). | `200 OK` khi CSDL sẵn sàng (`"database": "connected"`).<br>`503 Service Unavailable` khi CSDL lỗi/timeout (`error.code: "DATABASE_UNAVAILABLE"`). |

### Cơ chế Quản lý Quyền Sở Hữu Connection & Deadline Khởi Tạo Pool (DB-002-R4):
1. **Quản lý quyền sở hữu socket/connection theo vòng đời thực tế (`socketDescriptors`):**
   - Phân biệt 4 trạng thái rõ ràng: `INITIALIZING` (đang mở TCP/handshake/SET time_zone), `IDLE` (khỏe và rảnh rỗi trong pool), `IN_USE` (được một request cụ thể sử dụng độc quyền), `DESTROYED` (đã đóng).
   - Tách rời ngữ cảnh AsyncLocalStorage lúc tạo socket khỏi quyền sở hữu connection thực tế. Khi pool cấp connection cho Request B, nó được gỡ khỏi session cũ trước khi gắn cho B (`desc.currentSession = sessionB`). Khi release về pool, xóa quyền sở hữu của request (`currentSession = null`, `state = 'IDLE'`). Callback/timer cũ không thể hủy connection đã chuyển giao cho request khác.
2. **Deadline khởi tạo độc lập cho mọi socket mới:** Gán `initTimer` độc lập ngay khi `net.connect()`, bao trùm toàn bộ giai đoạn TCP, handshake và câu lệnh `SET time_zone`. Giải phóng timer và chuyển sang `IDLE` ngay khi hook `afterConnect` chạy xong. Khi quá hạn, socket lập tức bị hủy để giải phóng slot cho pool.
3. **Thu hồi hàng đợi acquire (`_pendingAcquires`) và socket bỏ rơi:**
   - Khi một request timeout, `session.deferred` lập tức bị loại bỏ khỏi `pool._pendingAcquires` và `reject()` để ngăn pool tự bổ sung connection mới vô tận sau khi request đã chết. Hủy các socket `INITIALIZING` bị bỏ rơi nếu không còn request nào khác đang đợi.
   - *Lưu ý kỹ thuật:* Pool kết nối thực tế trong Sequelize 6 là `sequelize-pool` (không phải `generic-pool`). Cơ chế dọn dẹp hàng đợi readiness đang tương tác với API nội bộ `_pendingAcquires` của `sequelize-pool`. Do đó, cần giữ nguyên lockfile (`package-lock.json`) và bắt buộc chạy lại toàn bộ test regression (`check:timeout`) trước khi nâng cấp các dependency liên quan.
4. **Ngân sách Master Deadline duy nhất bao trùm toàn bộ:** Một master timer `deadline = Date.now() + timeoutMs` bao trùm toàn bộ chuỗi: acquire từ pool, query ping và release connection. Query ping lấy thời gian còn lại (`remainingTime = Math.max(50, deadline - Date.now())`), không bị cộng dồn.
5. **Giữ nguyên một Sequelize/Pool dùng chung:** Cố định `databaseVersion: '8.4.4'`, không hủy toàn bộ pool hoặc tạo pool riêng mỗi request, đảm bảo phục hồi ngay về `200 OK` trên cùng một tiến trình khi transport hoạt động bình thường trở lại.

### Quy chuẩn mã lỗi hệ thống:
- `400 BAD_JSON`: JSON body sai cú pháp.
- `401 SERVICE_UNAUTHORIZED`: Yêu cầu thiếu hoặc sai header `x-service-key`.
- `404 NOT_FOUND`: Đường dẫn không tồn tại.
- `413 BODY_TOO_LARGE`: Payload vượt quá giới hạn 1MB.
- `500 INTERNAL_SERVER_ERROR`: Lỗi máy chủ không xác định (tuyệt đối không in SQL, stack, parameters hay credential ra response/log; chỉ in mã sự kiện cố định an toàn).
- `503 DATABASE_UNAVAILABLE`: CSDL MySQL không kết nối được hoặc timeout khi kiểm tra readiness.

---

## 5. Kiểm tra tự động

### 5.1 Kiểm tra Smoke Test (Chạy độc lập, không cần CSDL thật)

Kiểm tra định tuyến, xác thực `x-service-key`, mã lỗi 400, 401, 404, 413, bảo mật lỗi 500 (marker nhạy cảm trong `message`, `sql`, `parameters`, `stack`, `cause` không bị lộ) và toàn bộ validation của cấu hình môi trường:

```cmd
npm run smoke
```

### 5.2 Kiểm tra Timeout & Phục hồi trên Production Process (Mock Transport)

Khởi chạy tiến trình `src/server.js` production cô lập bằng `process.execPath`, gửi HTTP thật tới `/internal/v1/ready`.
Mock MySQL Server kiểm soát 10 kịch bản (55 assertions PASS):
1. Cổng đóng -> Phản hồi 503 DATABASE_UNAVAILABLE ngay lập tức.
2. Thiếu handshake -> Timeout đúng hạn, ngắt socket, trả 503, thu hồi socket ngay sau lỗi.
3. Treo `SET time_zone` -> Timeout đúng hạn, thu hồi socket, trả 503.
4. Acquire chậm rồi ping treo -> Ping lấy ngân sách còn lại, tổng thời gian không vượt quá timeout, trả 503.
5. Ping treo trên connection đã active trong pool -> Timeout đúng hạn, thu hồi connection, trả 503.
6. **[Regression 1] Chuyển giao ownership thứ tự 1:** Conn 1 chậm (auth 450ms), Conn 2 nhanh (10ms) cấp cho Request A. A treo ở ping. Conn 1 sau đó cấp cho B. A timeout 503 và chỉ hủy Conn 2; Request B nhận 200 OK trong ngân sách riêng.
7. **[Regression 2] Chuyển giao ownership thứ tự 2:** Conn 1 nhanh cấp cho A, Conn 2 chậm cấp cho B. A timeout 503; B nhận 200 OK.
8. **Bảo toàn connection khỏe trong pool khi có lỗi mở connection khác:** Connection khỏe vẫn nguyên vẹn và phục vụ ngay request tiếp theo (200 OK).
9. **[Regression 3] 6 requests đồng thời treo SET time_zone trên pool rỗng:** Lặp 3 vòng lỗi và phục hồi 200 trên CÙNG TIẾN TRÌNH; xác nhận 0 socket rò rỉ và slot pool được thu hồi hoàn toàn.
10. **Phục hồi hoàn toàn về 200 OK trên CÙNG một tiến trình:** Sau khi toàn bộ các bài test hoàn tất.

*(Ghi chú kỹ thuật: Các test trên mock server mô phỏng tầng transport/TCP để kiểm chứng cơ chế thu hồi socket, deadline và chuyển giao ownership, không được coi là bằng chứng xác nhận dữ liệu của MySQL thật).*

```cmd
npm run check:timeout
```

### 5.3 Kiểm tra kết nối CSDL MySQL 8.4 thật và Service Production

Khởi chạy tiến trình `src/server.js` production thật, kiểm tra tài khoản `shopnova_data_api`, phiên bản MySQL 8.4.x, đối chiếu chính xác dữ liệu seed trên 3 bảng nghiệp vụ hiện có (`categories`, `products`, `product_variants`) theo SKU/ID, và kiểm chứng các kịch bản HTTP Readiness khi MySQL hoạt động (200 OK) và khi cổng MySQL đóng (503 DATABASE_UNAVAILABLE).
- **Phạm vi kiểm tra seed:** Hiện tại `check:db` đối chiếu chính xác dữ liệu seed trên 3 bảng nghiệp vụ (`categories`, `products`, `product_variants`); không coi đây là kiểm chứng toàn vẹn cả 22 bảng trong schema khi chưa có bài kiểm thử tương ứng cho 19 bảng còn lại.
- **Mock Query Hang test (Phần 0):** Trả lời `SET time_zone` bình thường, chỉ cố tình im lặng khi client gửi đúng `SELECT VERSION()`; assertion xác nhận SQL mục tiêu đã tới mock; đóng `mockSequelize` an toàn trong khối `finally`.
- **Cơ chế deadline truy vấn thực tế:** Gọi trực tiếp `conn.query({ sql, timeout: remainingTime })` xuống driver `mysql2` và hủy socket nếu quá hạn, khắc phục việc Sequelize MySQL dialect nuốt mất `options.timeout`.
- **Quản lý tiến trình con an toàn:** Chờ sự kiện `exit`/`close` thực sự, kiểm tra `exitCode` và `signalCode`, loại bỏ hoàn toàn việc gọi `onExit` qua timer.

```cmd
npm run check:db
```
