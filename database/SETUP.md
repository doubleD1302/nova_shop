# Khởi tạo database mới

`schema.sql` là schema đầy đủ cho database trống, gồm 33 bảng. Các thay đổi kiểm duyệt sản phẩm, khóa shop, báo cáo vi phạm, hậu mãi, vận chuyển và chat đã được gộp từ migration hiện có. Không chạy lại toàn bộ migration lịch sử sau khi nạp schema này vì nhiều cột và bảng đã có sẵn.

Đây là cách tạo database mới từ source, không khôi phục dữ liệu từng nhập trên database cũ. `seed.sql` có 3 tài khoản mẫu không có mật khẩu đăng nhập, 2 shop, 8 danh mục, 8 sản phẩm nháp, 9 SKU tồn kho bằng 0, 1 địa chỉ và 1 voucher. Không có đơn hàng hoặc admin mẫu. Đăng ký tài khoản mới qua ứng dụng; cấp admin riêng bằng công cụ `grant-admin` khi cần.

## Cấu hình và khởi tạo

Từ thư mục `data-api/`, chuẩn bị file môi trường riêng, ví dụ `.env.tidb`, với các biến `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL_ENABLED`, `DB_SSL_CA`. Dùng tài khoản quản trị cho bước tạo schema; không dùng tài khoản này để chạy ứng dụng. `DB_NAME` phải là database ứng dụng riêng, ví dụ `shopnova_dev`.

Với TiDB Cloud Starter, dùng username đầy đủ gồm tiền tố của instance. Bật TLS và chỉ định chứng chỉ CA bằng đường dẫn tuyệt đối. Trên Windows nên dùng dấu `/` trong đường dẫn để tránh dotenv diễn giải `\n` thành xuống dòng.

```powershell
$env:DOTENV_CONFIG_PATH = '.env.tidb'
npm run init:db -- --seed
Remove-Item Env:DOTENV_CONFIG_PATH
```

Bỏ `--seed` nếu chỉ muốn tạo bảng. Script từ chối database đã có bảng hoặc view. DDL không rollback toàn bộ khi có lỗi; không tự xóa database hoặc chạy lại script nếu chưa kiểm tra trạng thái.

Trên TiDB, script bật và xác nhận `tidb_enable_check_constraint=ON` trước khi tạo bảng; thao tác này cần quyền quản trị và áp dụng cho instance. Cột email dùng `utf8mb4_0900_ai_ci` vì TiDB 8.5 không chấp nhận `ascii_general_ci` khi bật hệ collation mới. Ứng dụng vẫn kiểm tra và chuẩn hóa email trước khi lưu.

## Chạy ứng dụng và kiểm tra

Tạo tài khoản runtime riêng, chỉ cấp `SELECT, INSERT, UPDATE, DELETE` trên database vừa tạo. Đưa thông tin tài khoản này vào `data-api/.env`; giữ tài khoản quản trị trong cấu hình riêng. Giữ nguyên `DATA_API_KEY` giữa Backend và Data API. Frontend gọi Backend và Backend gọi Data API qua HTTP như trước.

```powershell
npm run check:cloud
npm run smoke
npm start
```

`check:cloud` kiểm tra kết nối bằng lớp truy vấn Data API, toàn bộ bảng/cột, 37 CHECK, 60 khóa ngoại, quyền runtime, cùng kiểm tra âm cho giá SKU, khóa ngoại, username trùng và địa chỉ mặc định trùng. Các thao tác kiểm tra nằm trong transaction được rollback; cần có ít nhất một SKU để thử CHECK giá. Không dùng tài khoản root hoặc một tài khoản có quyền DDL để chạy bài này.

`check:db` cũ kiểm tra MySQL 8.4 và fixture tồn kho 10/8/5; không phù hợp với seed hiện tại hoặc TiDB. Dùng `check:cloud` cho database mới. Schema mới đã được tạo và kiểm tra trên TiDB 8.5.3; chưa chạy lại khởi tạo trên MySQL 8.4. Kiểm tra danh sách sản phẩm công khai có thể trả rỗng vì seed chỉ có sản phẩm nháp và chưa có đủ ảnh để xuất bản.

Các file môi trường, chứng chỉ, dump và bản backup cấu hình chỉ lưu riêng trên máy, không đưa vào Git hoặc ZIP source.

## Docker với TiDB

`compose.tidb.yml` chạy Backend và Data API nối cùng database TiDB, không tạo MySQL container hay chạy lại schema. Sao chép `docker/tidb.env.example` thành `.env.tidb.docker`, điền kết nối runtime, khóa dịch vụ/JWT và đường dẫn CA trên máy. Sau đó chạy từ root:

```powershell
docker compose --env-file .env.tidb.docker -f compose.tidb.yml up -d
```

Data API chỉ ở mạng Docker, Backend lắng nghe cổng 3000 trên loopback. File CA được mount riêng, các biến DB chỉ truyền cho Data API. Giữ các volume ảnh và dữ liệu ứng dụng khi dừng container; không thêm `-v` vào lệnh dừng nếu cần giữ dữ liệu. Cấu hình Docker cũ dùng MySQL container là môi trường riêng, không tự đồng bộ với TiDB.

## Hosting

`render.yaml` dùng `/etc/secrets/tidb-ca.pem`. Trên hosting phải cập nhật `DB_HOST`, `DB_PORT=4000`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` bằng cấu hình runtime TiDB, thêm Secret File đúng tên và cho phép địa chỉ outbound của hosting trong danh sách truy cập TiDB nếu đang giới hạn IP. Demo mặc định tắt; chỉ thêm ba biến mật khẩu và bật `DEMO_LOGIN_ENABLED` trên deployment trải nghiệm. Không đưa các biến này hoặc biến DB vào Vercel frontend. Việc sửa file cấu hình không tự cập nhật deployment đã chạy; cần cấu hình và deploy riêng sau khi source được duyệt.
