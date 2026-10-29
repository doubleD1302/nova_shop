# Triển khai ShopNova với Vercel, Render và Aiven

## Hiện trạng

Frontend React/Vite được build thành các file trong `dist/`. Đăng nhập, đăng ký, danh mục, gian hàng, sản phẩm, giỏ hàng và đơn hàng gọi Backend HTTP API; Backend chuyển tiếp nghiệp vụ tới Data API và MySQL. Data API xác thực bằng service key và là tầng duy nhất truy vấn database.

Tài khoản mật khẩu/Google, gian hàng, sản phẩm, giá/tồn kho, Flash Sale, trạng thái duyệt, đánh giá và đơn hàng được lưu trong MySQL; ứng dụng không chạy schema hoặc seed khi khởi động. Backend xác minh Firebase ID token bằng Firebase Admin trước khi tạo hoặc đọc tài khoản Google. MySQL phải là dịch vụ có ổ đĩa bền vững. Ảnh người bán được lưu riêng: local mặc định dùng `backend/uploads`, còn Render được cấu hình dùng object storage S3-compatible vì filesystem của Render Free là tạm thời. Giỏ hàng, lượt theo dõi và thông báo là dữ liệu theo trình duyệt trong `localStorage`, không phải nguồn dữ liệu giao dịch.

Trong môi trường phát triển, để `VITE_API_BASE_URL` trống. Vite chuyển tiếp `/api/*` và `/uploads/*` tới Backend `http://127.0.0.1:3000`. Trên Vercel, các rewrite chuyển hai nhóm đường dẫn này đến Backend Render `https://novashop-api.onrender.com`; để `VITE_API_BASE_URL` trống khi dùng service tên mặc định này. Nếu Backend được triển khai ở domain khác, đặt `VITE_API_BASE_URL` thành origin HTTPS đó trong môi trường build Vercel.

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
| Environment | Để `VITE_API_BASE_URL` trống cho service Render mặc định, hoặc đặt thành `https://<backend-origin>` nếu dùng domain Backend riêng |

`vercel.json` chuyển `/api/*` và `/uploads/*` đến Backend Render trước, sau đó rewrite các route còn lại về `index.html` để mở trực tiếp hoặc tải lại `/gio-hang`, `/dang-nhap`, `/san-pham/...` bằng React Router.

Không nhập `DB_PASSWORD`, `DATA_API_KEY`, `JWT_SECRET` hoặc chứng chỉ MySQL vào Vercel frontend. Với rewrite mặc định, frontend không cần biến môi trường API. Chỉ đặt `VITE_API_BASE_URL` khi dùng domain Backend riêng; đây là origin công khai của Backend.

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
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON Service Account của cùng Firebase project; secret chỉ cấu hình ở Backend |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | Thông tin MySQL Aiven hiện có |
| `DB_USER`, `DB_PASSWORD` | Tài khoản runtime có quyền phù hợp trên Aiven |
| `DB_SSL_ENABLED` | `true` |
| `DB_SSL_CA` | `/etc/secrets/aiven-ca.pem` |
| `UPLOAD_STORAGE` | `s3` |
| `S3_ENDPOINT` | Endpoint S3-compatible; để trống nếu dùng AWS S3 chuẩn |
| `S3_REGION` | Region nhà cung cấp (mặc định `us-east-1`) |
| `S3_BUCKET` | Bucket đã tạo trước |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Credentials giới hạn quyền đọc/ghi object trong bucket |
| `S3_FORCE_PATH_STYLE` | `true` nếu nhà cung cấp yêu cầu path-style (thường dùng với MinIO) |

Render cấp `PORT` cho Backend. Script cố định `DATA_API_URL` thành `http://127.0.0.1:3001`; nếu cần đổi cổng nội bộ, đặt `DATA_API_PORT` khác `PORT`. Không tạo thêm Data API public web service.

Trong **Environment → Secret Files**, thêm file tên `aiven-ca.pem` với nội dung chứng chỉ CA do Aiven cấp. File phải có trước khi Data API khởi động thành công. Không đưa file này hay `.env` thật vào Git. Bản deploy đầu có thể lỗi nếu tạo Blueprint trước khi thêm CA; thêm file rồi deploy lại.

Tạo bucket bền vững trước khi deploy. Không cần bật public access: Backend nhận ảnh và phục vụ lại qua `/uploads/<id>`. Cấu hình endpoint, region, bucket và credentials trong Render Environment; credentials chỉ cần quyền `GetObject` và `PutObject` trên bucket ứng dụng. Khi `UPLOAD_STORAGE=s3` mà thiếu cấu hình bắt buộc, Backend sẽ dừng với thông báo cấu hình thay vì âm thầm ghi vào filesystem tạm.

Để bật đăng nhập Google, tạo Service Account cho đúng Firebase project ở Firebase Console, cung cấp JSON đó qua `FIREBASE_SERVICE_ACCOUNT_JSON` trong Backend Environment/Render Secret. Không thêm JSON vào frontend, repository hoặc log. Trên database hiện có, chạy một lần `database/migrations/2026-10-22-add-firebase-uid-to-users.sql` bằng tài khoản schema owner trước khi deploy phiên bản Data API mới; migration chỉ thêm cột UID nullable cùng unique index, không sửa hoặc xóa tài khoản cũ. Tài khoản runtime không cần quyền DDL. Nếu email Google đã gắn với tài khoản mật khẩu, hệ thống yêu cầu dùng luồng đăng nhập hiện có thay vì tự liên kết hai danh tính.

Giữ database và schema MySQL hiện có. Không import lại schema/seed, không tạo database thay thế để deploy. `DB_HOST` phải trỏ tới MySQL bền vững (ví dụ dịch vụ MySQL hiện có trên Aiven), không phải filesystem hoặc database cục bộ của Render. Cấp cho tài khoản runtime Data API các quyền `SELECT, INSERT, UPDATE, DELETE` trên database ứng dụng; không cấp quyền DDL. Nếu Aiven đang giới hạn IP truy cập, cho phép đúng địa chỉ outbound của dịch vụ Render.

Render Free không cung cấp Persistent Disk; không đặt `UPLOAD_DIR` vào một đường dẫn local để thay thế object storage. Các file JSON legacy trong `backend/data/` cũng chỉ là nguồn chuyển tài khoản cũ khi đăng nhập, không phải nơi lưu tài khoản mới.

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
