# Tra cứu admin cho Nova AI

`GET /internal/v1/ai/admin/search` là endpoint nội bộ, yêu cầu `x-service-key` như các route `/internal/v1`. Query bắt buộc `actorId` là ID tài khoản; `resource` chỉ nhận `users`, `shops`, `products`, `orders`, `reviews`, `reports`. Backend phải xác thực quyền trước khi gọi; Data API kiểm tra lại actor đang là admin hoạt động và ràng buộc kiểm tra này trong câu truy vấn.

Các bộ lọc tùy chọn là `id`, `email`, `phone` và `code`. `id` là ID nguyên dương dạng chuỗi. `email` chỉ hỗ trợ users/shops; `phone` hỗ trợ users/shops/orders; `code` chỉ hỗ trợ orders. Có thể kết hợp các bộ lọc được hỗ trợ. Giá trị đi qua tham số truy vấn SQL, không nhận tên bảng, cột hoặc SQL tùy ý. `limit` mặc định 20, tối đa 50; `offset` là số nguyên không âm an toàn. API trả `data.items`, `data.total`, `data.limit`, `data.offset`, `data.hasMore`; ID được trả dưới dạng chuỗi. Với orders, mỗi dòng là một đơn shop và một đơn tổng có thể gồm nhiều dòng. Tổng và các dòng đọc bằng hai truy vấn riêng nên có thể thay đổi khi dữ liệu bị sửa đồng thời.

API chỉ đọc các trường đã cho phép, không trả password hash, token hay phiên đăng nhập. Phản hồi `400 VALIDATION_ERROR` cho tham số sai, `403 FORBIDDEN` khi actor không phải admin hoạt động; lỗi kết nối database theo middleware chung. Các route quản trị cũ và giới hạn mặc định của chúng không đổi.

`scripts/test-ai-admin.mjs` kiểm tra với query giả lập. `scripts/test-ai-admin-mysql.mjs` tạo dữ liệu tổng hợp trong database mới trên máy chủ cô lập có marker ở thư mục tạm; script từ chối chạy nếu datadir thực tế khác thư mục thử được chỉ định. Kiểm tra này không dùng database ứng dụng và không xóa hay sửa schema hiện có.
