# Duyệt hồ sơ gian hàng

Shop mới từ đăng ký seller hoặc `POST /api/v1/auth/seller-shop` có trạng thái `pending`. Tài khoản vẫn mang role seller để đọc/sửa hồ sơ; role này không chứng minh shop được bán hàng. API mở shop trả thêm `data.shopStatus`; gọi lại không tạo shop hoặc lịch sử trùng. Đăng ký seller trả token như cũ; client đọc trạng thái qua API hồ sơ seller.

| API Backend | Quyền | Hành vi |
|---|---|---|
| `GET /api/v1/seller/shop` | Seller/admin sở hữu shop | Trả `data.shop`, gồm `status`, `approvalVersion`, `rejectionReason`; đọc được cả shop chưa active |
| `PUT /api/v1/seller/shop` | Chủ shop | Sửa hồ sơ pending/rejected/active; pending hoặc rejected tăng phiên bản sau mỗi lần lưu |
| `POST /api/v1/seller/shop/resubmit` | Chủ shop | Chỉ chuyển rejected → pending, xóa lý do và tăng phiên bản |
| `GET /api/v1/admin/shops` | Admin | Danh sách có hồ sơ, trạng thái và phiên bản để duyệt |
| `PATCH /api/v1/admin/shops/:id/approval` | Admin | Nhận `{ approvalStatus: "approved" hoặc "rejected", approvalVersion, rejectionReason }` |
| `GET /api/v1/admin/shops/:id/approval-events` | Admin | Trả `data.events`: tối đa 200 sự kiện mới nhất |

Admin phải gửi đúng `approvalVersion` vừa đọc. Lý do từ chối bắt buộc dài 3–1000 ký tự sau trim. Chỉ shop pending được duyệt: approved chuyển thành active, rejected chuyển thành rejected. Phiên bản cũ hoặc trạng thái không phù hợp trả `409 SHOP_APPROVAL_CONFLICT`; input sai trả `400 VALIDATION_ERROR`; thiếu phiên/token sai trả 401; sai quyền trả 403. Gửi lại shop không rejected trả `409 SHOP_NOT_REJECTED`.

Kiểm tra phiên bản, khóa shop, đổi trạng thái và ghi sự kiện chạy trong cùng transaction. Hai yêu cầu duyệt cùng phiên bản chỉ có một yêu cầu thành công. Mỗi sự kiện lưu actor, hành động, phiên bản, lý do và thời điểm; không lưu snapshot toàn bộ hồ sơ cũ. Hồ sơ đã active được sửa như trước, không tự chuyển về pending.

Đường đổi trạng thái quản trị cũ và chế tài vi phạm không được chuyển pending/rejected sang suspended/closed rồi mở khóa để bỏ qua duyệt (`SHOP_REQUIRES_APPROVAL`). Shop chưa active bị ẩn khỏi danh sách và chi tiết public; không tạo chat mới, đăng/sửa sản phẩm, thêm giỏ, preview hoặc tạo đơn. Các điều kiện sản phẩm/giỏ/đơn kiểm tra trạng thái shop phía Data API, kể cả client gọi thẳng Backend. Quyền đọc/xử lý đơn cũ của shop đã hoạt động vẫn dùng quy tắc hiện có.

API nội bộ tương ứng nằm dưới `/internal/v1/users/:userId/seller-shop`, `/resubmit`, `/admin/shops/:shopId/approval` và `/approval-events`. Mọi route yêu cầu service key; Backend lấy owner/actor từ phiên đã xác thực. API duyệt và lịch sử cũng kiểm tra actor là Admin active tại Data API, không tin role trong body.

## Database và triển khai

Chạy một lần `database/migrations/2026-11-04-shop-approval.sql` trước khi triển khai API. Migration thêm pending/rejected ở cuối ENUM, đặt default pending, thêm `approval_version`, `rejection_reason` và bảng `shop_approval_events`. Các shop active/suspended/closed hiện có giữ nguyên trạng thái, phiên bản mặc định 1 và không tạo lịch sử duyệt giả. Schema mới đã chứa thay đổi này, không chạy migration lần nữa sau khi khởi tạo từ schema mới. Seed demo ghi active rõ ràng.

ALTER TABLE của MySQL có implicit commit: sao lưu và lên lịch triển khai theo môi trường; file không tự rollback hoặc chạy lặp. Kiểm tra schema từng môi trường trước khi áp dụng; nếu đã có các cột và bảng này thì không chạy lại migration. Các cột từ migration trước, như suspension và duyệt sản phẩm, vẫn là điều kiện của API hiện có; schema gốc chưa hợp nhất toàn bộ migration lịch sử.

Kiểm thử từ root: `node data-api/scripts/test-shop-approval-mysql.mjs`. Cần MySQL 8 cục bộ riêng và các biến `SHOP_APPROVAL_TEST=1`, `SHOP_APPROVAL_DB_PORT`, `SHOP_APPROVAL_DB_PASSWORD`, tùy chọn `SHOP_APPROVAL_DB_USER` (root mặc định). Script tạo rồi xóa database `shopnova_test_approval_<timestamp>`; kiểm tra migration giữ shop cũ và các luồng HTTP qua Backend/Data API. Không chạy trên database dùng chung.

Web và Flutter cần dùng API hồ sơ seller cho shop chưa active, hiển thị trạng thái/lý do, sửa hồ sơ và gửi lại. Phía Admin cần màn hình duyệt dùng phiên bản vừa đọc, xử lý 409 bằng tải lại; danh sách lịch sử có giới hạn 200. Phần giao diện chưa được thay đổi trong chức năng Backend này.
