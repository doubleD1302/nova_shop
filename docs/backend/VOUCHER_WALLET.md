# Ví voucher

Backend cung cấp `GET /api/v1/vouchers/wallet?page=1` và `POST /api/v1/vouchers/wallet` cho người đã đăng nhập. Danh tính lấy từ access token; không nhận userId từ client. POST nhận `{ "code": "NOVA20K" }`, chuẩn hóa chữ hoa, trả `{ code, saved }`; lưu lại mã đã có là thao tác lặp an toàn (`saved: false`). Mã không tồn tại, chưa bắt đầu, hết hạn, bị tắt hoặc hết lượt toàn sàn trả 404 `VOUCHER_UNAVAILABLE`. Input sai trả 400, thiếu token trả 401.

GET trả `data.items`, `page`, `hasMore`, mỗi trang 20 mã. Mỗi mã có id dạng chuỗi, code, name, discountAmount, minSubtotal, startsAt, endsAt, savedAt và status: `available`, `upcoming`, `expired`, `inactive`, `used`, `exhausted`. `available` chưa đảm bảo đủ subtotal; preview/checkout vẫn tính lại và kiểm tra điều kiện trong database. Các trạng thái được tính tại lúc đọc; đơn hủy có thể hoàn lượt. Không hỗ trợ voucher shop, voucher phần trăm, xóa khỏi ví hay cấp voucher cá nhân trong phạm vi này.

Data API: `GET /internal/v1/vouchers/wallet?userId=...&page=...` và `POST /internal/v1/vouchers/wallet` với service key, userId và code chuẩn hóa. Migration `database/migrations/2026-11-06-voucher-wallet.sql` phải được áp dụng trước khi chạy API trên database hiện hữu. Không tự chạy trên database dùng chung. Migration chỉ tạo bảng mới và không thay đổi voucher hoặc lượt dùng sẵn có.
