# Kiến Trúc Hệ Thống ShopNova (System Architecture)

> **Tài liệu chuẩn hóa kiến trúc giao tiếp, cấu trúc mã nguồn và quy ước kỹ thuật**  
> *Áp dụng cho dự án ShopNova Backend và các giai đoạn phát triển tiếp theo*

---

## 1. Sơ Đồ Kiến Trúc Giao Tiếp Tổng Thể

Hệ thống ShopNova tuân thủ mô hình phân tách tầng nghiêm ngặt (Decoupled Multi-tier Architecture):

```text
┌────────────────────────────────────────────────────────┐
│               Frontend Web (React 19)                  │
│             Mobile App (Flutter / Dart)                │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP API (Public: /api/v1/*)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Backend Server                       │
│              (Node.js + Express 5)                     │
│  - Tiếp nhận request từ frontend                       │
│  - Xác thực người dùng (JWT / Cookie)                  │
│  - Kiểm tra quyền hạn (Buyer / Seller / Admin)         │
│  - Xử lý nghiệp vụ (tính giá, voucher, chia đơn shop)  │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP API Nội bộ (/internal/v1/* + Service Key)
                            │ Gọi qua data.client.js tập trung
                            ▼
┌────────────────────────────────────────────────────────┐
│                  Data API Nội Bộ                       │
│           (Thiết kế: Node.js + Express)                │
│  - Xác thực Service Key từ Backend                     │
│  - Quản lý kết nối ORM Sequelize 6 + mysql2           │
│  - Đảm bảo tính toàn vẹn Transaction (ACID)            │
│  - Không hỗ trợ endpoint chạy SQL tùy ý                │
└───────────────────────────┬────────────────────────────┘
                            │ Giao thức MySQL
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Cơ Sở Dữ Liệu MySQL                    │
│     (Users, Shops, Products, Orders, Categories...)    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Giải Thích Chi Tiết Từng Tầng

1. **Tầng Frontend (Web React & Mobile Flutter):**
   - Đóng vai trò giao diện người dùng (UI/UX).
   - **Chỉ giao tiếp với Backend Server** thông qua các endpoint công khai có tiền tố `/api/v1/*`.
   - Tuyệt đối không gọi trực tiếp Data API hay kết nối trực tiếp đến MySQL Database.
   - Không được phép tự tính toán và quyết định số tiền thanh toán cuối cùng.

2. **Tầng Backend Server (`backend/`):**
   - Đóng vai trò cổng tiếp nhận (API Gateway) kiêm xử lý toàn bộ logic nghiệp vụ (Business Logic).
   - Xác thực danh tính người dùng và phân quyền (RBAC): Đảm bảo Người bán (Seller) chỉ được can thiệp vào sản phẩm và đơn hàng thuộc gian hàng của mình.
   - **Không kết nối trực tiếp với MySQL:** Mọi thao tác đọc/ghi dữ liệu đều thông qua một HTTP Client tập trung (`clients/data.client.js`) gọi sang Data API nội bộ.

3. **Tầng Data API Nội Bộ (`data-api/` - *Mới là thiết kế, chưa triển khai ở BE-001A*):**
   - Là dịch vụ nội bộ (Microservice phụ trách dữ liệu) nằm trong mạng riêng hoặc chỉ mở cổng cho Backend Server.
   - Cung cấp các endpoint nội bộ với tiền tố `/internal/v1/*`, bắt buộc phải có Service Key hợp lệ đi kèm header.
   - **Độc quyền sở hữu kết nối MySQL** thông qua Sequelize 6 và driver `mysql2`.
   - **Bảo vệ dữ liệu & Truy vấn an toàn:** Áp dụng kiểm tra tính hợp lệ dữ liệu đầu vào (validation) nghiêm ngặt và thực hiện truy vấn an toàn (parameterized queries / ORM mapping của Sequelize) qua Data API. Không cung cấp bất kỳ endpoint nào nhận câu lệnh SQL tùy ý.

4. **Tầng Cơ Sở Dữ Liệu (MySQL Database):**
   - Lưu trữ dữ liệu quan hệ bền vững của toàn sàn: người dùng, shop, danh mục, sản phẩm, giỏ hàng, đơn hàng...

---

## 3. Bảng Nhiệm Vụ Của Các Thư Mục

### A. Cấu trúc thư mục của `backend/` (Hiện tại và Mở rộng)

| Thư mục / File | Trách nhiệm | Trạng thái |
| :--- | :--- | :--- |
| `src/app.js` | Tạo instance Express, cấu hình middleware bảo mật (Helmet), CORS, parse JSON, gắn router và bộ xử lý lỗi. Không gọi `app.listen()`. | **Đã có** |
| `src/server.js` | Điểm khởi động máy chủ (gọi `app.listen()`), xử lý lỗi xung đột cổng (`EADDRINUSE`) và tắt an toàn (graceful shutdown). | **Đã có** |
| `src/config/` | Chứa cấu hình nạp và kiểm tra tính hợp lệ của biến môi trường (`env.js`). | **Đã có** |
| `src/middlewares/` | Chứa các middleware dùng chung: bắt 404 (`not-found.middleware.js`), xử lý lỗi tập trung (`error.middleware.js`), xác thực (`auth.middleware.js` - *chưa triển khai*). | **Đã có khung** |
| `src/routes/` | Khai báo các endpoint công khai `/api/v1/*` (`health.routes.js` đã có; `product.routes.js` - *chưa triển khai*...). | **Đã có khung** |
| `src/controllers/` | Tiếp nhận request từ route, validate dữ liệu đầu vào, gọi service và trả response chuẩn JSON (`health.controller.js` đã có...). | **Đã có khung** |
| `src/services/` | Nơi tập trung toàn bộ nghiệp vụ: tính giá, kiểm tra voucher, chia tách đơn con đa shop (`product.service.js`, `order.service.js`...). | *Bổ sung khi có nghiệp vụ* |
| `src/clients/` | Chứa HTTP Client gọi dịch vụ nội bộ (`data.client.js`), có cấu hình timeout và xử lý ngắt kết nối. | *Bổ sung khi có nghiệp vụ* |
| `scripts/` | Chứa các script kiểm thử tự động độc lập (`smoke-test.mjs`). | **Đã có** |

### B. Cấu trúc dự kiến của Data API (`data-api/` - *Thiết kế kế hoạch*)
- `package.json`: Quản lý dependencies riêng (`express`, `sequelize`, `mysql2`, `dotenv`).
- `config/`: Cấu hình kết nối MySQL và khóa xác thực Service Key.
- `routes/`: Định tuyến các endpoint nội bộ `/internal/v1/*`.
- `controllers/`: Tiếp nhận gọi từ Backend, xử lý truy vấn dữ liệu.
- `models/`: Định nghĩa các Sequelize Models (`User`, `Shop`, `Product`, `Order`...) và quan hệ giữa các bảng (Associations).

---

## 4. Quy Tắc Đặt Tên File (File Naming Conventions)

Để mã nguồn đồng nhất, dễ đọc và dễ bàn giao cho thực tập sinh, quy ước đặt tên bắt buộc như sau:

1. **Dùng chữ thường toàn bộ (lowercase), phân tách bằng dấu chấm `.`:**
   - Cú pháp: `<tên_nghiệp_vụ>.<vai_trò>.js`
2. **Tên nghiệp vụ luôn dùng danh từ số ít (singular):**
   - Đúng: `product.routes.js`, `order.controller.js`, `shop.service.js`.
   - Sai: `products.routes.js`, `ordersController.js`.
3. **Quy ước chi tiết theo vai trò:**
   - Routes: `<nghiệp_vụ>.routes.js` (ví dụ: `health.routes.js` đã triển khai; `product.routes.js` - *chưa triển khai*).
   - Controllers: `<nghiệp_vụ>.controller.js` (ví dụ: `health.controller.js` đã triển khai; `product.controller.js` - *chưa triển khai*).
   - Services: `<nghiệp_vụ>.service.js` (ví dụ: `product.service.js`, `order.service.js` - *chưa triển khai*).
   - Middlewares: `<chức_năng>.middleware.js` (ví dụ: `not-found.middleware.js`, `error.middleware.js` đã triển khai; `auth.middleware.js` - *chưa triển khai*).
   - Clients: `<dịch_vụ>.client.js` (ví dụ: `data.client.js` - *chưa triển khai*).
   - Cấu hình: Đặt tên trực tiếp, rõ nghĩa (ví dụ: `env.js`, `database.js`).
4. **Cấm đặt tên chung chung:** Tuyệt đối không đặt các tên vô nghĩa như `helper1.js`, `common2.js`, `manager.js`, `util.js`.
5. **Không tạo sẵn file/thư mục rỗng:** Chỉ tạo khi có code chức năng cụ thể. LƯU Ý RÕ: Trong giai đoạn hiện tại, `auth.middleware.js` và `product.routes.js` CHƯA ĐƯỢC TRIỂN KHAI, chỉ nêu tên như ví dụ quy ước.

---

## 5. Ví Dụ Luồng Xử Lý Mẫu: "Lấy Danh Sách Sản Phẩm"

Dưới đây là từng bước request đi qua các tầng trong hệ sinh thái ShopNova:

1. **Bước 1 (Frontend):** Người dùng vào trang tìm kiếm, Web React gửi yêu cầu:  
   `GET http://localhost:3000/api/v1/products?keyword=tai-nghe&page=1`
2. **Bước 2 (Backend App & Route):** `app.js` chuyển request đến `product.routes.js`.
3. **Bước 3 (Backend Controller):** `product.controller.js` nhận request, bóc tách `keyword` và `page`, gọi hàm `productService.getProducts({ keyword, page })`.
4. **Bước 4 (Backend Service):** `product.service.js` chuẩn hóa từ khóa và gọi HTTP Client tập trung:  
   `dataClient.get('/internal/v1/products', { params: { keyword, page } })`.
5. **Bước 5 (Data API Endpoint):** Data API nhận request tại `/internal/v1/products`, kiểm tra Service Key trong header.
6. **Bước 6 (Data API & MySQL):** Data API dùng Model Sequelize `Product.findAndCountAll(...)` để truy vấn bảng `products` trong cơ sở dữ liệu MySQL.
7. **Bước 7 (Data API Response):** Data API đóng gói danh sách sản phẩm và trả kết quả JSON về cho Backend qua HTTP nội bộ.
8. **Bước 8 (Backend Xử lý & Phản hồi):** `product.service.js` nhận kết quả, có thể bổ sung thêm tính toán (nếu cần), chuyển về cho `product.controller.js`. Controller trả về HTTP 200 cho Frontend React.
9. **Bước 9 (Hiển thị UI):** Frontend nhận dữ liệu JSON sạch và hiển thị danh sách sản phẩm lên giao diện người dùng.

---

## 6. Phân Biệt Giữa Hiện Trạng Và Thiết Kế Đề Xuất

| Thành phần | Hiện trạng trong mã nguồn | Thiết kế tương lai (Planned) |
| :--- | :--- | :--- |
| **Backend Express Server** | Đã dựng xong khung cơ bản với `app.js`, `server.js`, `env.js`, `not-found.middleware.js`, `error.middleware.js`. | Mở rộng thêm `services/` và `clients/`. |
| **API Hoạt động** | Duy nhất `GET /api/v1/health` (HTTP 200). | Toàn bộ 8 nhóm API nghiệp vụ trong `API_INVENTORY.md`. |
| **Data API Nội Bộ** | **Chưa triển khai** (mới là bản vẽ thiết kế kiến trúc). | Triển khai độc lập trong thư mục `data-api/` với cổng và package riêng. |
| **Cơ sở dữ liệu MySQL** | **Chưa kết nối**, chưa cài Sequelize hay mysql2. | Tạo Schema, migrations, seed dữ liệu mẫu và kết nối thông qua Data API. |
| **Dữ liệu Frontend** | Vẫn đang dùng mock data tiếng Việt và `localStorage`. | Chuyển dần sang gọi Backend API `/api/v1/*`. |

---

## 7. Các Nguyên Tắc Bắt Buộc Cho Các Vòng Triển Khai Sau

1. **Quy tắc Tiền tố URL (URL Prefix):**
   - Endpoint phục vụ Frontend: Bắt buộc dùng tiền tố `/api/v1/...`.
   - Endpoint nội bộ Data API: Bắt buộc dùng tiền tố `/internal/v1/...`.
2. **Bảo mật Service-to-Service:**
   - Data API chỉ chấp nhận request mang theo Service Key (Secret Token) hợp lệ trong header (ví dụ `x-service-key`).
   - Khóa này chỉ được lưu trong biến môi trường của máy chủ Backend, tuyệt đối không gửi ra Frontend hay trình duyệt của người dùng.
3. **HTTP Client Ổn Định (`data.client.js`):**
   - Client gọi nội bộ phải cấu hình `timeout` phù hợp (ví dụ: 5000ms).
   - Có cơ chế bắt lỗi khi Data API bị sập hoặc quá tải để trả về thông báo lỗi thân thiện cho người dùng, tránh treo request.
4. **Bảo toàn Transaction cho Đơn Hàng Đa Shop (ACID Transactions):**
   - Một giỏ hàng chứa sản phẩm của nhiều shop: Thao tác tạo đơn hàng cha, tạo các đơn hàng con theo shop và trừ số lượng tồn kho của từng sản phẩm phải được thực hiện trong **cùng một Transaction** tại Data API.
   - Nếu bất kỳ bước nào thất bại, toàn bộ thao tác phải được Rollback ngay lập tức để không phát sinh đơn hàng dở dang hay mất mát số liệu tồn kho.
