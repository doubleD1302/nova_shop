# Triển khai ShopNova với Vercel, Render và Aiven

## Hiện trạng

Frontend React/Vite được build thành các file trong `dist/`, có thể phục vụ trên Vercel và gọi HTTP API. Backend hiện có health, readiness, đăng nhập và đọc tài khoản. Data API xác thực bằng service key và truy vấn MySQL qua Sequelize/mysql2.

**Frontend hiện chưa gọi Backend:** `AuthContext`, `CatalogContext`, `CartContext` và `OrderContext` đang dùng dữ liệu mẫu và localStorage. Deploy các dịch vụ không tự chuyển những màn hình này sang dữ liệu MySQL. API sản phẩm, giỏ hàng, đăng ký và đơn hàng vẫn chưa được triển khai. Bản public dùng MySQL cho toàn bộ nghiệp vụ cần các API đó và phần tích hợp frontend tương ứng.

```text
Trình duyệt → Vercel (frontend)
           → Render (Backend public)
                    → HTTP localhost (Data API nội bộ)
                       → TLS (MySQL Aiven)
```

`scripts/host.mjs` chạy Backend và Data API thành hai tiến trình trên một dịch vụ Render. Data API chỉ lắng nghe `127.0.0.1`; Backend gọi nó qua HTTP. Chỉ Backend đọc JWT secret; các biến `DB_*` được loại khỏi môi trường tiến trình Backend. Khi một tiến trình dừng ngoài dự kiến, tiến trình còn lại cũng được dừng.

## 1. Frontend trên Vercel

Trong Vercel, chọn **Add New → Project** và import repository dự án. Với repository có `package.json`, `src/`, `backend/` ở root, chọn Root Directory `.`; không chọn `backend/`.

| Thiết lập | Giá trị |
|---|---|
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

`vercel.json` đã có rewrite về `index.html` để mở trực tiếp hoặc tải lại `/gio-hang`, `/dang-nhap`, `/san-pham/...` bằng React Router.

Vercel chỉ cần source frontend và cấu hình build. Không nhập `DB_PASSWORD`, `DATA_API_KEY`, `JWT_SECRET` hoặc chứng chỉ MySQL vào Vercel frontend hay biến `VITE_*`. Chưa có biến URL API được frontend sử dụng; cần bổ sung trong tác vụ tích hợp API.

Lưu domain production thực tế mà Vercel cấp để cấu hình CORS cho Backend. Preview domain khác production domain; chỉ bổ sung đúng origin preview cần kiểm tra, không dùng wildcard.

## 2. Backend và Data API trên Render

Tạo **New → Web Service**, kết nối repository và chọn:

| Thiết lập | Giá trị |
|---|---|
| Language | Node |
| Root Directory | `.` |
| Region | Singapore |
| Instance Type | Free |
| Build Command | `npm --prefix backend ci --omit=dev && npm --prefix data-api ci --omit=dev` |
| Start Command | `npm run start:hosting` |
| Health Check Path | `/api/v1/ready` |
| Auto-Deploy | Off |

Cũng có thể dùng `render.yaml` qua **New → Blueprint**. Blueprint sẽ sinh ngẫu nhiên `DATA_API_KEY` và `JWT_SECRET`, rồi yêu cầu nhập các biến còn thiếu. Khi tạo thủ công, sinh hai secret độc lập ít nhất 32 ký tự; lưu trong Environment của Render.

| Biến Render | Giá trị |
|---|---|
| `NODE_VERSION` | `24.12.0` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | Origin HTTPS production thực tế của Vercel |
| `DATA_API_KEY` | Secret dịch vụ, dùng chung giữa hai tiến trình |
| `JWT_SECRET` | Secret khác service key, ít nhất 32 ký tự |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | Thông tin MySQL Aiven hiện có |
| `DB_USER`, `DB_PASSWORD` | Tài khoản runtime có quyền phù hợp trên Aiven |
| `DB_SSL_ENABLED` | `true` |
| `DB_SSL_CA` | `/etc/secrets/aiven-ca.pem` |

Render cấp `PORT` cho Backend. Script cố định `DATA_API_URL` thành `http://127.0.0.1:3001`; nếu cần đổi cổng nội bộ, đặt `DATA_API_PORT` khác `PORT`. Không tạo thêm Data API public web service.

Trong **Environment → Secret Files**, thêm file tên `aiven-ca.pem` với nội dung chứng chỉ CA do Aiven cấp. File phải có trước khi Data API khởi động thành công. Không đưa file này hay `.env` thật vào Git. Bản deploy đầu có thể lỗi nếu tạo Blueprint trước khi thêm CA; thêm file rồi deploy lại.

Giữ database và schema Aiven hiện có. Không import lại schema/seed, không tạo database thay thế để deploy. Nếu Aiven đang giới hạn IP truy cập, cho phép đúng địa chỉ outbound của dịch vụ Render.

## 3. Kiểm tra

Chạy từ root repository:

```bash
npm run build
npm run check:hosting
```

`check:hosting` dùng cổng ngẫu nhiên và cấu hình MySQL giả trên localhost. Nó kiểm tra hai tiến trình khởi động, Data API yêu cầu khóa, đường dẫn nội bộ không xuất hiện ở Backend public, readiness trả lỗi khi MySQL không sẵn sàng và Backend được dừng khi Data API lỗi cổng. Kiểm tra này không chứng minh MySQL Aiven đã hoạt động trên Render.

Sau deploy, kiểm tra URL Backend thực tế:

- `GET /api/v1/health`: HTTP 200 xác nhận Backend đang chạy.
- `GET /api/v1/ready`: HTTP 200 xác nhận Backend → HTTP Data API → MySQL thật hoạt động.
- `GET /internal/v1/health` trên domain Backend: HTTP 404.
- Kiểm tra đăng nhập qua `/api/v1/auth/login` bằng tài khoản database dành cho kiểm tra; không ghi password hoặc token vào log.
- Mở trực tiếp `/gio-hang` trên domain Vercel để kiểm tra rewrite.

Rate limiter Backend hiện dùng `req.ip` với cấu hình Express mặc định. Khi chạy sau proxy Render, IP có thể là IP proxy, khiến nhiều người dùng chia sẻ hạn mức đăng nhập. Cần kiểm chứng và cấu hình trust proxy theo topology thực tế trước khi phục vụ nhiều người dùng; không bật tin mọi forwarded header.

## Giới hạn gói miễn phí

Vercel Hobby dành cho dự án cá nhân phi thương mại, phù hợp bản thực tập/demo. Render Free ngủ sau 15 phút không có request; lần gọi API tiếp theo có thể mất khoảng một phút để khởi động. Giao diện Vercel tải độc lập, nhưng thao tác gọi API vẫn chịu thời gian chờ đó. Render cấp 750 giờ instance mỗi workspace mỗi tháng và có giới hạn băng thông/build. Chạy hai tiến trình trong cùng một instance giúp giữ Data API nội bộ.

Gói và hạn mức Aiven phụ thuộc dịch vụ đã chọn trong tài khoản; kiểm tra trang Billing của dịch vụ hiện có. Không suy ra database hiện tại miễn phí chỉ từ tên nhà cung cấp.

Tài liệu nhà cung cấp:

- [Vite trên Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Render Free](https://render.com/docs/free)
- [Render Blueprint](https://render.com/docs/blueprint-spec)
- [Secret files trên Render](https://render.com/docs/configure-environment-variables)
