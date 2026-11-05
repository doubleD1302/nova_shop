# Trạng thái yêu cầu trả hàng

Buyer chỉ tạo yêu cầu cho đơn con của mình đã giao. Với bảng `order_returns` đã được migration, Data API khóa đơn con trong transaction trước khi kiểm tra yêu cầu đang xử lý; hai request đồng thời không tạo hai yêu cầu `requested`/`approved` cho cùng đơn con.

Seller thuộc shop xử lý theo đường đi: `requested` → `approved` → `completed`, hoặc `requested` → `rejected`. Những chuyển trạng thái khác trả 400 `INVALID_TRANSITION`. `completed` chỉ là trạng thái yêu cầu, không chứng minh đã hoàn tiền qua đối tác. Backend yêu cầu quyền seller/admin; Data API kiểm tra owner.

Khi chưa có bảng `order_returns`, code cũ dùng bộ nhớ tiến trình làm dự phòng. Dữ liệu này không bền vững và không chia sẻ giữa các tiến trình; cần áp dụng migration `2026-10-30-returns-shipping-and-chat.sql` trước vận hành để lưu thật. Trường hợp dự phòng không được coi là lưu dữ liệu đảm bảo hoặc kiểm chứng cạnh tranh nhiều tiến trình.
