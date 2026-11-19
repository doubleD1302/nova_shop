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

Web đã nối giao diện cho các mục menu trên: Tài chính (`/nguoi-ban/tai-chinh`), Quảng cáo (`/nguoi-ban/quang-cao`), CSKH (`/nguoi-ban/cskh`) và Dữ liệu (`/nguoi-ban/du-lieu`); mỗi trang chia tab bằng `?tab=`. Mục "Dữ liệu" dùng `GET /seller/dashboard` và `GET /seller/reports/inventory`. Các mục Khuyến mãi (Chương trình khuyến mãi, Flash Sale) và Shop của tôi (cài đặt vận chuyển, địa chỉ lấy hàng) vẫn hiện hộp thoại "đang hoàn thiện" trên web. Backend đã có API cài đặt vận chuyển/địa chỉ lấy hàng (xem phần dưới); web chưa nối. App Flutter chưa thuộc phạm vi này.

Phản hồi thành công có dạng `{ "success": true, "data": ... }`. Lỗi có dạng `{ "success": false, "message": "...", "error": { "code": "..." } }`.

## Lịch sử giao dịch

`GET /api/v1/seller/finance/transactions`

| Query | Mô tả |
|---|---|
| `type` | Tùy chọn: `order_income`, `refund`, `payout`. Bỏ trống để lấy cả ba. |
| `startDate`, `endDate` | Tùy chọn, ISO 8601. Chỉ có ngày (`2026-11-19`) thì `endDate` nghĩa là hết ngày đó (UTC). Có phần giờ thì bắt buộc kèm múi giờ (`Z` hoặc `+07:00`, nhớ mã hóa `+` thành `%2B`); thiếu múi giờ trả 400. |
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

- `summary`: `totalBoosts`, `activeBoosts`, `totalSpend`, `ordersDuringBoost`, `unitsDuringBoost`, `revenueDuringBoost`, `revenueToSpendRatio` (`null` khi chưa chi). Tính trên toàn bộ gói trong khoảng ngày, mỗi dòng hàng đếm một lần.
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
| 409 `REVIEW_ALREADY_REPLIED` | Mỗi đánh giá chỉ trả lời một lần; muốn đổi thì sửa hoặc xóa phản hồi (bên dưới) |

`PATCH /api/v1/seller/reviews/:reviewId/reply` với `{ "reply": "..." }` (cùng quy tắc 1–1000 ký tự) sửa phản hồi đã gửi, trả 200 với `sellerReply` mới và `repliedAt` là thời điểm lưu gần nhất (chưa có cột riêng lưu thời điểm gửi lần đầu). Không gửi lại thông báo cho người mua.

`DELETE /api/v1/seller/reviews/:reviewId/reply` xóa phản hồi, đánh giá quay về chưa phản hồi (`sellerReply` và `repliedAt` là `null`) và có thể trả lời lại bằng `POST`. Không có thông báo.

Hai endpoint này dùng chung các mã lỗi 400, 403, 404 ở trên; thêm 409 `REVIEW_NOT_REPLIED` khi đánh giá chưa có phản hồi. Gian hàng và người thao tác lấy từ token.

## Cài đặt vận chuyển và địa chỉ lấy hàng

Đọc cài đặt hiện tại bằng `GET /api/v1/seller/shop/registration` (`data.profile.shippingMethods`, `pickupAddress`, `province`).

`PATCH /api/v1/seller/shop/shipping` sửa nhanh cho gian hàng **đang hoạt động**, không phải duyệt lại và không đổi `approvalVersion`. Body chứa ít nhất một trong ba trường, trường lạ bị từ chối:

| Trường | Quy tắc |
|---|---|
| `shippingMethods` | Mảng không rỗng, không trùng, mỗi phần tử là `nhanh`, `tietkiem` hoặc `hoatoc` |
| `pickupAddress` | Chuỗi 1–255 ký tự sau khi cắt khoảng trắng |
| `province` | Chuỗi 1–120 ký tự sau khi cắt khoảng trắng |

Phản hồi 200: `data` là cài đặt sau khi lưu (`pickupAddress`, `province`, `shippingMethods`). Đổi `pickupAddress` hoặc `province` cũng cập nhật địa chỉ hiển thị của shop (`shops.address_detail`, `shops.province`). Gian hàng được xác định từ token. Checkout tạo sau đó dùng cài đặt mới; đơn đã tạo giữ nguyên.

| Mã | Trường hợp |
|---|---|
| 400 `VALIDATION_ERROR` | Body rỗng, trường lạ, sai kiểu, trùng hoặc quá dài |
| 404 `SHOP_NOT_FOUND`, `SELLER_PROFILE_NOT_FOUND` | Chưa có gian hàng hoặc chưa có hồ sơ người bán |
| 409 `SHOP_PROFILE_PENDING` | Shop đang chờ duyệt hoặc bị từ chối; sửa qua `PUT /seller/shop/registration` rồi gửi lại |
| 409 `SHOP_NOT_ACTIVE` | Shop bị tạm khóa hoặc đã đóng |

Kiểm thử: `data-api/scripts/test-shop-shipping.mjs` (SQLite tạm) và `backend/scripts/test-seller-center.mjs` (Data API giả lập); chưa chạy trên MySQL/TiDB thật.

## Thay đổi với API có sẵn

- `POST /api/v1/seller/marketing/boost`: chỉ sản phẩm đang bán và đã duyệt mới mua được (400 `PRODUCT_NOT_ELIGIBLE`); sản phẩm đang có gói còn hiệu lực trả 409 `BOOST_ALREADY_ACTIVE`. Việc kiểm tra và ghi nằm trong một transaction có khóa dòng sản phẩm.
- `GET /api/v1/seller/returns`: `status` nhận thêm `disputed` để seller xem các yêu cầu người mua đã khiếu nại.

## Giới hạn và điểm cần quyết định

- **Công thức tiền chưa thống nhất.** `payout/balance` cộng `total_amount` của đơn (gồm phí vận chuyển, chưa trừ hoa hồng). `reports/revenue` trừ hoa hồng trên `subtotal - discount` và chỉ tính đơn `delivered`. `SELLER_PAYOUT_DRAFT.md` đề xuất không tính phí vận chuyển. Lịch sử giao dịch bám theo `payout/balance`; công thức cần được chốt ở một bước nghiệp vụ riêng trước khi đổi.
- **Phí gói đẩy chưa trừ vào số dư.** `product_boosts.cost_vnd` chỉ được ghi nhận; không xuất hiện trong lịch sử giao dịch hoặc số dư cho tới khi có quy tắc thanh toán quảng cáo.
- Không có lượt xem/lượt nhấp (xem trên). `summary` được tính bằng truy vấn riêng nên mỗi dòng hàng chỉ đếm một lần; vì vậy tổng đơn/doanh thu của các gói trong `boosts` có thể lớn hơn `summary` khi các gói chạy chồng nhau. Số gói và chi phí trong `summary` tính trên toàn bộ gói, không bị giới hạn 200 của danh sách.
- Lịch sử giao dịch gộp ba nguồn trong bộ nhớ nên giới hạn 1000 dòng gần nhất cho mỗi truy vấn.

## Kiểm tra

- `npm --prefix data-api run test:seller-center` (25 kiểm tra) và `npm --prefix backend run test:seller-center` (14 kiểm tra) dùng database/Data API giả lập: kiểm tra validation, phân quyền, hình dạng dữ liệu và việc bỏ qua `shopId` từ client.
- Ngày 19/11/2026, các truy vấn đọc (giao dịch, hiệu quả quảng cáo, đánh giá, trả hàng `disputed`) đã chạy trên database dev TiDB, không lỗi SQL. Với một shop có 31 đơn đã giao/hoàn tất, số dư khả dụng tính từ lịch sử giao dịch khớp đúng với `payout/balance`. Các câu lệnh ghi và khóa (`FOR UPDATE`, `INSERT product_boosts`, `UPDATE reviews`) chỉ được kiểm tra bằng `EXPLAIN`, chưa thực thi. Database dev chưa có hoàn tiền, rút tiền, gói đẩy hay đánh giá nên các nhánh đó chưa được thử với dữ liệu thật.
- Đây là TiDB, chưa phải MySQL 8, và chưa có test hai request song song (trả lời cùng một đánh giá, mua gói đẩy cùng sản phẩm). Cần thử trên MySQL 8 trước khi coi là kiểm chứng đầu cuối.
