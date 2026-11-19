# Kênh Người Bán: Tài chính, Quảng cáo, Chăm sóc khách hàng

Tài liệu mô tả API Backend cho ba nhóm menu của Kênh Người Bán. Tất cả endpoint dưới đây yêu cầu đăng nhập với vai trò `seller` (hoặc `admin` có gian hàng). Gian hàng luôn lấy từ tài khoản đã xác thực; `shopId` do client gửi bị bỏ qua.

## Hiện trạng theo từng mục menu

| Nhóm | Mục menu | Endpoint | Trạng thái |
|---|---|---|---|
| Tài chính | Tổng quan doanh thu | `GET /api/v1/seller/reports/revenue` (+ `/export`) | implemented (có từ trước) |
| Tài chính | Lịch sử giao dịch | `GET /api/v1/seller/finance/transactions` | **implemented** |
| Tài chính | Số dư và thanh toán | `GET /api/v1/seller/payout/balance`, `bank-account`, `request`, `history` | implemented (có từ trước) |
| Quảng cáo | Công cụ quảng bá | `POST /api/v1/seller/marketing/boost`, `GET .../boosts` | implemented; **bổ sung kiểm tra** |
| Quảng cáo | Chương trình tiếp thị | `GET /api/v1/seller/marketing/campaigns`, `POST .../campaigns/register`, `GET .../registrations` | implemented (có từ trước) |
| Quảng cáo | Theo dõi hiệu quả | `GET /api/v1/seller/marketing/analytics` | **implemented** |
| Chăm sóc khách hàng | Tin nhắn | `/api/v1/chat/conversations*` | implemented (có từ trước) |
| Chăm sóc khách hàng | Đánh giá sản phẩm | `GET /api/v1/seller/reviews`, `POST /api/v1/seller/reviews/:reviewId/reply` | **implemented** |
| Chăm sóc khách hàng | Hỗ trợ và khiếu nại | `GET /api/v1/seller/returns?status=...`, `PATCH .../returns/:returnId/status` | implemented; **lọc được `disputed`** |

Web hiện vẫn mở hộp thoại "đang hoàn thiện" cho các mục này (`SellerLayout.jsx`); việc nối giao diện chưa thuộc phạm vi tài liệu này.

Phản hồi thành công có dạng `{ "success": true, "data": ... }`. Lỗi có dạng `{ "success": false, "message": "...", "error": { "code": "..." } }`.

## Lịch sử giao dịch

`GET /api/v1/seller/finance/transactions`

| Query | Mô tả |
|---|---|
| `type` | Tùy chọn: `order_income`, `refund`, `payout`. Bỏ trống để lấy cả ba. |
| `startDate`, `endDate` | Tùy chọn, ISO 8601. `endDate` chỉ có ngày (`2026-11-19`) nghĩa là hết ngày đó (UTC). |
| `limit`, `offset` | Mặc định 50 và 0; `limit` tối đa 100; `limit + offset` tối đa 1000. |

Mỗi dòng: `id`, `type`, `reference` (mã đơn hoặc mã lệnh rút), `description`, `amount`, `status`, `occurredAt`.

- `order_income`: tiền đơn đã giao/hoàn tất, `amount` dương, tính theo ngày giao. `status` là `available` (đã qua 7 ngày giữ tiền hoặc đơn `completed`, không có yêu cầu trả hàng đang mở) hoặc `escrow`.
- `refund`: trả hàng đã `completed`, `amount` âm, tính theo thời điểm cập nhật.
- `payout`: lệnh rút tiền (trừ lệnh bị từ chối), `amount` âm, `status` là trạng thái lệnh rút.

Dữ liệu: `{ items, total, limit, offset }`. Lỗi: 400 `VALIDATION_ERROR` (bộ lọc sai hoặc vượt cửa sổ 1000 dòng), 404 `SHOP_NOT_FOUND`, 503 `DATA_STORAGE_UNAVAILABLE` khi bảng chưa có.

Số tiền dùng cùng cách tính với `GET /seller/payout/balance` để hai màn hình khớp nhau (xem phần Giới hạn).

## Theo dõi hiệu quả quảng cáo

`GET /api/v1/seller/marketing/analytics?startDate=&endDate=` (khoảng ngày lọc theo thời điểm mua gói / đăng ký chiến dịch).

Dữ liệu:

- `summary`: `totalBoosts`, `activeBoosts`, `totalSpend`, `ordersDuringBoost`, `unitsDuringBoost`, `revenueDuringBoost`, `revenueToSpendRatio` (`null` khi chưa chi).
- `registrations`: số hồ sơ chiến dịch theo `pending`, `approved`, `rejected` và `total`.
- `boosts`: từng gói đẩy (tối đa 200, `truncated` báo bị cắt) kèm `costVnd`, đơn, số lượng và doanh thu của sản phẩm trong thời gian gói chạy.

Doanh thu/đơn là của sản phẩm trong thời gian gói chạy (bỏ đơn hủy), không chứng minh do quảng cáo mang lại. Hệ thống chưa ghi nhận lượt xem hay lượt nhấp nên báo cáo không có hai số này.

## Đánh giá sản phẩm

`GET /api/v1/seller/reviews`: bộ lọc `rating` (1–5), `replied` (`true`/`false`), `productId`, `limit`, `offset`. Chỉ trả đánh giá đang hiển thị. Dữ liệu: `items` (kèm ảnh, `sellerReply`, `repliedAt`), `total`, `limit`, `offset` và `summary` (`totalReviews`, `averageRating`, `unreplied`, `byRating`) tính trên toàn bộ đánh giá của shop.

`POST /api/v1/seller/reviews/:reviewId/reply` với `{ "reply": "..." }` (1–1000 ký tự sau khi cắt khoảng trắng).

| Mã | Trường hợp |
|---|---|
| 201 | Đã lưu phản hồi, người mua nhận thông báo trong ứng dụng |
| 400 `VALIDATION_ERROR` | Nội dung rỗng/quá dài hoặc mã đánh giá sai |
| 403 `FORBIDDEN` | Tài khoản không phải chủ gian hàng |
| 404 `REVIEW_NOT_FOUND` | Không có, đã bị ẩn hoặc thuộc shop khác (không phân biệt để không lộ dữ liệu) |
| 409 `REVIEW_ALREADY_REPLIED` | Mỗi đánh giá chỉ trả lời một lần; chưa có API sửa/xóa phản hồi |

## Thay đổi với API có sẵn

- `POST /api/v1/seller/marketing/boost`: chỉ sản phẩm đang bán và đã duyệt mới mua được (400 `PRODUCT_NOT_ELIGIBLE`); sản phẩm đang có gói còn hiệu lực trả 409 `BOOST_ALREADY_ACTIVE`. Việc kiểm tra và ghi nằm trong một transaction có khóa dòng sản phẩm.
- `GET /api/v1/seller/returns`: `status` nhận thêm `disputed` để seller xem các yêu cầu người mua đã khiếu nại.

## Giới hạn và điểm cần quyết định

- **Công thức tiền chưa thống nhất.** `payout/balance` cộng `total_amount` của đơn (gồm phí vận chuyển, chưa trừ hoa hồng). `reports/revenue` trừ hoa hồng trên `subtotal - discount` và chỉ tính đơn `delivered`. `SELLER_PAYOUT_DRAFT.md` đề xuất không tính phí vận chuyển. Lịch sử giao dịch bám theo `payout/balance`; công thức cần được chốt ở một bước nghiệp vụ riêng trước khi đổi.
- **Phí gói đẩy chưa trừ vào số dư.** `product_boosts.cost_vnd` chỉ được ghi nhận; không xuất hiện trong lịch sử giao dịch hoặc số dư cho tới khi có quy tắc thanh toán quảng cáo.
- Không có lượt xem/lượt nhấp (xem trên). Gói đẩy của cùng sản phẩm không được chồng nhau từ nay, nhưng dữ liệu cũ có thể chồng và làm doanh thu ở `summary` bị tính lặp.
- Lịch sử giao dịch gộp ba nguồn trong bộ nhớ nên giới hạn 1000 dòng gần nhất cho mỗi truy vấn.

## Kiểm tra

- `npm --prefix data-api run test:seller-center` (22 kiểm tra) và `npm --prefix backend run test:seller-center` (13 kiểm tra) dùng database/Data API giả lập: kiểm tra validation, phân quyền, hình dạng dữ liệu và việc bỏ qua `shopId` từ client.
- Chưa chạy các truy vấn SQL mới trên MySQL/TiDB thật; tên bảng và cột đã đối chiếu với `database/schema.sql`. Cần chạy trên MySQL 8 trước khi coi là đã kiểm chứng đầu cuối.
