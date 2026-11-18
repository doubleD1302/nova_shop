# Migration kiểm duyệt sản phẩm

Migration `database/migrations/2026-10-23-product-approval.sql` dành cho database **chưa có** cột kiểm duyệt. Migration thêm cột với `approval_status = NULL` cho toàn bộ sản phẩm có sẵn, giữ nguyên `products.status`, không tự ghi `reviewed_at` hay người duyệt. Sau đó default cho sản phẩm mới là `pending`. `NULL` biểu thị chưa có bằng chứng duyệt; API catalog tiếp tục hiển thị sản phẩm cũ đang active, không mô tả chúng là approved. Seller sửa sản phẩm sẽ đưa về draft/pending và cần admin duyệt thật.

Không chạy lại migration trên database đã có các cột: cần kiểm kê và xác định nguồn gốc dữ liệu trước khi xây dựng migration sửa riêng. Đặc biệt bản cũ của migration từng tự gán approved và thời gian duyệt cho sản phẩm active; không thể phân biệt kết quả tự gán với kiểm duyệt thật chỉ từ các cột này. Không tự đặt lại dữ liệu lịch sử hoặc xóa bằng chứng. Kiểm thử và đối chiếu trên MySQL test riêng, sao lưu theo quy trình vận hành trước khi triển khai. Rollback xóa các cột và dữ liệu kiểm duyệt, chỉ thực hiện theo kế hoạch được duyệt; DDL MySQL có thể tự commit nên không dựa vào transaction để rollback toàn bộ migration.

## Duyệt sản phẩm

`GET /api/v1/admin/products` trả thêm `reviewVersion` cho từng sản phẩm. Admin gửi lại chuỗi này trong body của `PATCH /api/v1/admin/products/:id/approval` cùng `approvalStatus` và `rejectionReason` khi từ chối. Bản web và ứng dụng Admin cần được cập nhật đồng thời với API để gửi field bắt buộc này.

- API trả `409 PRODUCT_APPROVAL_CONFLICT` nếu sản phẩm đã thay đổi. Tải lại danh sách và xem nội dung mới trước khi duyệt.
- API trả `409 PRODUCT_ARCHIVED` cho sản phẩm đã lưu trữ, và `409 PRODUCT_NOT_READY` nếu sản phẩm thiếu ảnh hoặc SKU, hoặc gian hàng hay chủ gian hàng đã ngừng hoạt động.
- Sản phẩm đã ẩn giữ trạng thái ẩn sau khi duyệt. Từ chối sản phẩm sẽ dừng bán và tắt Flash Sale. Giỏ hàng, xem trước đơn và đặt hàng kiểm tra cả trạng thái duyệt để xử lý dữ liệu cũ.
