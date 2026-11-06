# Thuộc tính ngành hàng minh họa

Bộ định nghĩa phiên bản 1 là dữ liệu ví dụ của đồ án; các trường đều không bắt buộc và có thể thay đổi theo quyết định sản phẩm trong phiên bản mới. Danh mục chưa có định nghĩa được trả danh sách rỗng. Không thay đổi ý nghĩa các mã của phiên bản đã lưu.

- `GET /api/v1/categories/:categorySlug/attributes`: danh sách mã, nhãn, kiểu, giới hạn và version. Danh mục phải tồn tại và hoạt động.
- `POST /api/v1/seller/products` hoặc `PUT /api/v1/seller/products/:id`: có thể gửi `categoryAttributes: { "version": 1, "values": { "brand": "Ví dụ", "material": "Cotton" } }`. Trường được phép tùy danh mục; mã lạ, sai kiểu, giá trị quá giới hạn hoặc version khác 1 trả 400 `INVALID_CATEGORY_ATTRIBUTES`. Không gửi thì giữ nguyên; gửi `values: {}` là xác nhận xóa các giá trị đã lưu.
- `GET /api/v1/seller/products/:id/category-attributes`: seller xem dữ liệu sản phẩm thuộc shop của mình. `GET /api/v1/products/:id/category-attributes`: xem dữ liệu sản phẩm công khai đủ điều kiện hiển thị.
- Nếu đổi danh mục sản phẩm đã có bản ghi thuộc tính, phải gửi `categoryAttributes` hợp lệ của danh mục mới; thiếu trường trả 409 `CATEGORY_ATTRIBUTES_CONFIRM_REQUIRED`. Phải xác nhận `values: {}` nếu muốn bỏ các giá trị cũ. Seller khác không đọc/sửa được sản phẩm.

Các giá trị được lưu riêng tại `product_category_attributes`; không tự thay đổi `products.specs`, SKU hoặc lịch sử đơn. Sản phẩm cũ chưa có bản ghi vẫn hoạt động và trả `values: {}`. Không tự suy đoán hay chuyển đổi dữ liệu cũ. Trước khi bật code trên môi trường hiện có phải chạy migration `database/migrations/2026-11-06-product-category-attributes.sql`; triển khai và rollback schema cần kế hoạch riêng, tránh xóa bảng khi đã có dữ liệu.

Kiểm thử `node data-api/scripts/test-category-attributes-mysql.mjs` trên MySQL 8 cục bộ riêng với `CATEGORY_TEST=1`, `CATEGORY_DB_PORT`, `CATEGORY_DB_PASSWORD`; tùy chọn `CATEGORY_DB_USER`. Test tạo và xóa database test riêng, không dùng database ứng dụng. Frontend và runtime triển khai chưa nằm trong phạm vi này.

Với schema cũ chưa có các cột kiểm duyệt sản phẩm và lý do khóa shop, luồng seller vẫn đọc/sửa sản phẩm đúng owner, tạo sản phẩm mới ở trạng thái draft, và trả `approvalStatus: null` thay vì tự khẳng định đã duyệt. Khả năng kiểm duyệt đầy đủ vẫn cần migration kiểm duyệt riêng; cần rà trạng thái và dữ liệu trước khi áp dụng.

Khi seller lưu thay đổi sản phẩm, sản phẩm về `draft` (hoặc giữ `hidden` nếu yêu cầu ẩn) và `approvalStatus: pending` nếu schema có kiểm duyệt; thông tin duyệt cũ được xóa. Với schema cũ chưa có cột duyệt, sản phẩm cũng về draft và cần migration kiểm duyệt trước khi có thể duyệt lại. Việc cập nhật giá hoặc tồn kho qua endpoint lưu sản phẩm này cũng cần duyệt lại.
