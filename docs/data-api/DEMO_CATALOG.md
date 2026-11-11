# Gian hàng và sản phẩm mẫu

Bộ dữ liệu học tập bổ sung ba ngành hàng trước đây chưa có trong database: `me-be`, `bach-hoa`, `the-thao`. Mỗi shop có 50 sản phẩm riêng biệt, mỗi sản phẩm có bốn ảnh, một SKU mặc định, giá nguyên VND và tồn kho khởi tạo 100. Không tạo đơn hàng, lượt bán hoặc đánh giá giả.

| Danh mục | Shop | Tên đăng nhập | Slug shop |
| --- | --- | --- | --- |
| Mẹ & Bé yêu | Mây Nhỏ Mẹ & Bé | `shopmebe` | `may-nho-me-be` |
| Bách hóa Online | An Nhiên Bách Hóa | `shopbachhoa` | `an-nhien-bach-hoa` |
| Thể thao & Du lịch | Năng Động Sports | `shopthethao` | `nang-dong-sports` |

## Chuẩn bị

Chạy Backend và Data API với cùng database MySQL/TiDB dev/test. Backend phải cấu hình kho ảnh dùng chung nếu web/app hoặc các máy khác cũng truy cập dữ liệu. Khi dùng Backend đã triển khai, đặt `CATALOG_BACKEND_URL` trỏ tới chính Backend đó để ảnh được tải lên đúng kho mà website/app đang đọc. Cùng database không có nghĩa là hai Backend dùng cùng kho ảnh. Script không dùng SQLite fallback, không đổi schema và từ chối môi trường production của tiến trình seed.

Từ thư mục `data-api/`, đặt biến môi trường trong PowerShell:

```powershell
$env:CATALOG_SEED_ENABLED = 'true'
$env:CATALOG_SEED_DB = 'shopnova_dev'
$env:CATALOG_BACKEND_URL = 'http://127.0.0.1:3000'
$env:CATALOG_SEED_PASSWORD = Read-Host 'Mật khẩu chung cho ba shop mẫu'
npm run seed:catalog
```

`CATALOG_SEED_DB` phải khớp chính xác `DB_NAME`. Mật khẩu cần ít nhất tám ký tự, tối đa 72 byte và được hash bằng bcrypt. Không ghi mật khẩu thật vào source, file ZIP hoặc tài liệu dùng chung. Database cần có một quản trị viên đang hoạt động để ghi nhận khởi tạo shop/sản phẩm mẫu. Đây là dữ liệu seed được đặt trạng thái `active`/`approved` để dùng ngay; luồng đăng sản phẩm thông thường của seller vẫn phải qua kiểm duyệt.

## Cách hoạt động và chạy lại

- Danh sách cố định nằm trong `data-api/seeders/catalog.json`, gồm tên, giá mẫu, thương hiệu, mã nguồn và bốn URL ảnh của từng sản phẩm. Nguồn tham khảo: [Con Cưng](https://concung.com/) và [Decathlon Việt Nam](https://www.decathlon.vn/). Ảnh và tên thương hiệu giữ nguồn tham khảo; bộ dữ liệu không xác nhận quyền tái sử dụng cho mục đích thương mại.
- Script trong Data API tạo tài khoản, danh mục, shop và sản phẩm bằng kết nối Sequelize/mysql2 hiện có. Web/app đọc dữ liệu qua HTTP Backend → HTTP Data API như các sản phẩm khác.
- Web hiển thị danh mục cache trong lúc chờ, sau đó nạp danh mục từ API khi mở trang. Các ngành hàng mới trong database được cập nhật vào menu và bộ lọc thay vì bị giữ ở danh sách mẫu.
- Ảnh được tải và kiểm tra bằng API upload có xác thực của Backend, sau đó lưu trong kho ảnh hiện có. Database lưu đường dẫn `/uploads/product-...`; mỗi ảnh gắn đúng tài khoản seller và dùng được khi chỉnh sửa sản phẩm. Nguồn gốc ảnh được giữ trong manifest; không gán giấy phép tự do cho ảnh từ nhà bán lẻ.
- Mỗi sản phẩm được ghi cùng SKU và đủ bốn ảnh trong một transaction. Lỗi giữa chừng không để lại sản phẩm chỉ có một phần ảnh. Các sản phẩm đã hoàn tất vẫn được giữ nếu một sản phẩm sau đó lỗi.
- Trước khi upload và ghi sản phẩm mới, script so hash của cả bốn file để chặn ảnh trùng nội dung dù URL khác nhau. API upload kiểm tra file ảnh giải mã được và giới hạn kích thước.
- Có thể chạy lại với cùng mật khẩu. Script giữ nguyên sản phẩm có slug đã tạo và không đặt lại giá, tồn kho hoặc mật khẩu. Xung đột tài khoản/shop/slug dừng quá trình thay vì ghi đè. Không chạy đồng thời nhiều tiến trình seed.
- `data-api/data/catalog-uploads.json` là checkpoint local, bị Git ignore. File chỉ lưu URL ảnh đã upload, không lưu mật khẩu hoặc token. Giữ file này nếu seed bị gián đoạn; lần chạy sau kiểm tra ảnh đã có trước khi dùng lại. Nếu checkpoint thuộc môi trường khác, giữ riêng file cũ trước khi seed cho môi trường mới.
- Đổi database hoặc kho ảnh cần cấu hình lại môi trường và chạy seed tại đó. Việc commit source không tự đồng bộ dữ liệu sang database khác. File ZIP source không chứa database dump hoặc file `.env`.

## Kiểm tra dữ liệu thật

Từ root dự án, giữ các biến `CATALOG_BACKEND_URL` và `CATALOG_SEED_PASSWORD`:

```powershell
node backend/scripts/test-catalog.mjs
```

Kiểm tra gọi Backend thật: đăng nhập từng seller, shop hoạt động, danh mục có sản phẩm, danh sách public/seller khớp nhau, 50 tên riêng biệt mỗi shop, giá đúng manifest, SKU có tồn kho và đầy đủ 600 ảnh có thể tải và giải mã. Kiểm tra cũng xác nhận seller không đọc được chi tiết quản lý sản phẩm của shop khác. Script không đặt hàng hoặc sửa sản phẩm; các phiên đăng nhập kiểm tra được đăng xuất sau khi dùng.

Giá và tồn kho là dữ liệu thực hành. Việc dữ liệu được API đọc đúng không thay thế kiểm thử giao diện web/Flutter trên thiết bị.
