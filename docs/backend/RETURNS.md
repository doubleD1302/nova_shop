# Trạng thái yêu cầu trả hàng

Buyer chỉ tạo yêu cầu cho đơn con của mình đã giao. Với bảng `order_returns` đã được migration, Data API khóa đơn con trong transaction trước khi kiểm tra yêu cầu đang xử lý; hai request đồng thời không tạo hai yêu cầu `requested`/`approved` cho cùng đơn con.

Seller thuộc shop xử lý theo đường đi: `requested` → `approved` → `completed`, hoặc `requested` → `rejected`. Những chuyển trạng thái khác trả 400 `INVALID_TRANSITION`. `completed` chỉ là trạng thái yêu cầu, không chứng minh đã hoàn tiền qua đối tác. Backend yêu cầu quyền seller/admin; Data API kiểm tra owner.

Khi thiếu bảng `order_returns`, API trả 503 `DATA_STORAGE_UNAVAILABLE`; không báo đã lưu vào bộ nhớ tạm. Cần áp dụng migration `2026-10-30-returns-shipping-and-chat.sql` trước vận hành. Dữ liệu từng nằm trong bộ nhớ của tiến trình cũ không tự được chuyển sang database.
