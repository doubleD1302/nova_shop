# Quản trị chiến dịch marketing và duyệt đăng ký của shop

Trước đây shop đăng ký sản phẩm vào chiến dịch (`POST /api/v1/seller/marketing/campaigns/register`) nhưng không có API nào để quản trị viên tạo chiến dịch hay duyệt đăng ký, nên mọi đăng ký dừng mãi ở `pending`. Tài liệu này mô tả các API admin bổ sung. Chúng dùng bảng `marketing_campaigns` và `campaign_registrations`. Phần duyệt và quản lý chiến dịch không cần đổi schema; phần **áp giá khuyến mãi** cần migration `database/migrations/2026-11-19-campaign-price-apply.sql` (xem "Áp giá khuyến mãi").

Tất cả endpoint yêu cầu đăng nhập với vai trò `admin`; quản trị viên lấy từ token, `userId` do client gửi bị bỏ qua. Data API kiểm tra lại tài khoản là admin đang hoạt động. Phản hồi thành công có dạng `{ "success": true, "data": ... }`, lỗi có dạng `{ "success": false, "message": "...", "error": { "code": "..." } }`.

## Chiến dịch

`GET /api/v1/admin/campaigns?limit=&offset=` liệt kê mọi chiến dịch (cả đã tắt hoặc đã kết thúc), mới nhất trước. Mỗi dòng: `id`, `name`, `type`, `description`, `startsAt`, `endsAt`, `bannerUrl`, `isActive` và `registrations` (`pending`, `approved`, `rejected`). Dữ liệu: `{ items, total, limit, offset }` (`limit` mặc định 50, tối đa 100).

`POST /api/v1/admin/campaigns` tạo chiến dịch (mặc định bật), trả 201.

| Trường | Quy tắc |
|---|---|
| `name` | Bắt buộc, 1–150 ký tự sau khi cắt khoảng trắng |
| `type` | Bắt buộc: `flash_sale`, `mega_sale`, `category_day` |
| `startsAt`, `endsAt` | Bắt buộc, ISO 8601 **có múi giờ** (`2026-12-01T00:00:00Z` hoặc `+07:00`); `endsAt` phải sau `startsAt` |
| `description` | Tùy chọn, tối đa 2000 ký tự |
| `bannerUrl` | Tùy chọn, tối đa 500 ký tự, chỉ `/uploads/...` hoặc `https://...` |
| `isActive` | Tùy chọn, `true`/`false` |

`PATCH /api/v1/admin/campaigns/:campaignId` sửa các trường trên (chỉ gửi trường cần đổi, ít nhất một trường). Khoảng thời gian được kiểm tra lại với giá trị đang lưu. Tắt chiến dịch (`isActive: false`) làm nó biến mất khỏi danh sách shop có thể đăng ký (`GET /seller/marketing/campaigns`). Trường lạ bị từ chối (400).

## Đăng ký của shop

`GET /api/v1/admin/campaign-registrations?campaignId=&status=&limit=&offset=` liệt kê đăng ký của mọi shop, đơn đang chờ lên đầu. `status` là `pending`, `approved` hoặc `rejected`. Mỗi dòng gồm tên chiến dịch, tên shop, tên sản phẩm, `currentPrice` (giá thấp nhất của các biến thể đang bán, `null` nếu không có), `discountPrice` shop cam kết, `status`, `note`.

`PATCH /api/v1/admin/campaign-registrations/:registrationId` với `{ "status": "approved" | "rejected", "note": "..." }`. Từ chối bắt buộc có `note` (tối đa 255 ký tự). Chủ shop nhận thông báo trong ứng dụng (liên kết tới `/nguoi-ban/quang-cao?tab=programs`); lỗi gửi thông báo không làm hỏng kết quả duyệt.

| Mã | Trường hợp |
|---|---|
| 400 `VALIDATION_ERROR` | Trạng thái lạ, thiếu lý do khi từ chối, id hoặc bộ lọc sai |
| 403 `ADMIN_REQUIRED` | Tài khoản không phải admin đang hoạt động |
| 404 `REGISTRATION_NOT_FOUND`, `CAMPAIGN_NOT_FOUND` | Không có bản ghi |
| 409 `REGISTRATION_ALREADY_REVIEWED` | Đăng ký đã được duyệt hoặc từ chối; không đổi lại |
| 409 `CAMPAIGN_ENDED` | Duyệt khi chiến dịch đã kết thúc hoặc đang tắt (từ chối vẫn được) |
| 409 `PRODUCT_NOT_ELIGIBLE` | Duyệt khi sản phẩm không còn `active` hoặc chưa được kiểm duyệt |

## Áp giá khuyến mãi

Duyệt đăng ký chưa đổi giá ngay. Việc áp và hoàn giá do `syncCampaignPrices` (`data-api/src/utils/campaign-pricing.js`) thực hiện. Hàm này chạy ngay sau khi admin duyệt đăng ký hoặc sửa chiến dịch (lỗi đồng bộ không làm hỏng thao tác admin) và định kỳ mỗi 5 phút qua job `sync-campaign-prices` (Backend gọi `POST /internal/v1/jobs/sync-campaign-prices`; admin chạy tay được bằng `POST /api/v1/admin/jobs/run` với `{ "jobName": "sync-campaign-prices" }`). Hàm idempotent nên chạy nhiều nơi không áp hai lần.

**Áp giá** khi đăng ký `approved`, chiến dịch đang bật và đang chạy (`startsAt <= bây giờ < endsAt`), sản phẩm đang `active` và đã kiểm duyệt:
- Mỗi biến thể đang bán có giá **cao hơn** `discountPrice` được hạ xuống `discountPrice`. Biến thể có giá thấp hơn hoặc bằng giữ nguyên.
- Giá cũ thành giá gạch ngang (`original_price`); nếu biến thể đã có giá gạch ngang thì giữ giá đó. Trang chủ và trang Flash Sale vì thế hiển thị % giảm.
- Chiến dịch `flash_sale` còn bật `products.is_flash_sale` nếu đang tắt. Không biến thể nào được hạ giá thì không bật Flash Sale.
- Giá gốc lưu trong `campaign_registrations.price_snapshot`, thời điểm áp/hoàn lưu ở `applied_at`, `reverted_at`.

**Hoàn giá** khi chiến dịch bị tắt hoặc hết hạn: trả giá và giá gạch ngang từ snapshot, **chỉ cho biến thể còn đúng giá khuyến mãi** (nếu shop đã tự đổi giá trong lúc chiến dịch chạy thì giữ giá shop đặt). Flash Sale chỉ tắt nếu chiến dịch là bên đã bật nó và không còn đăng ký flash_sale nào khác đang áp cho sản phẩm. Bật lại chiến dịch đã tắt (khi còn hạn) thì đăng ký được áp lại.

Quy tắc khác: một sản phẩm chỉ chịu **một** đăng ký đang áp giá; đăng ký thứ hai chờ đến khi đăng ký trước được hoàn giá. Đơn đã đặt giữ giá lúc đặt; giỏ hàng và checkout dùng giá biến thể hiện tại.

**Triển khai:** chạy migration trước, sau đó mới deploy code. Chưa có cột `applied_at` thì `syncCampaignPrices` trả `{ skipped: true, reason: "MIGRATION_PENDING" }` và không đổi giá (duyệt đăng ký vẫn hoạt động). Migration chạy một lần bằng tài khoản có quyền ALTER; tài khoản runtime của Data API không có quyền này. Môi trường dev đã chạy migration; production và các môi trường khác phải chạy riêng.

## Giới hạn

- Biến thể thêm mới sau khi áp giá không được hạ giá; biến thể bị shop xóa rồi tạo lại (đổi id) sẽ không được hoàn giá.
- Shop sửa sản phẩm đang khuyến mãi vẫn có thể đặt lại giá; khi đó hệ thống không áp lại cho đến lần đăng ký sau.
- `registerCampaign` của shop chỉ kiểm tra chiến dịch đang bật, chưa kiểm tra đã kết thúc; đăng ký vào chiến dịch đã hết hạn vẫn tạo được hồ sơ `pending` (admin chỉ từ chối được).
- Chưa có API xóa chiến dịch; dùng `isActive: false`.
- Chưa kiểm thử đồng thời (hai tiến trình đồng bộ cùng lúc).

## Kiểm tra

`node data-api/scripts/test-admin-campaigns.mjs` (9 kiểm tra, database giả lập), `node data-api/scripts/test-campaign-pricing.mjs` (12 kiểm tra áp/hoàn giá, database giả lập có trạng thái) và `npm --prefix backend run test:seller-center` (phần "Admin: chiến dịch marketing", Data API giả lập). Các truy vấn đọc (danh sách chiến dịch, danh sách đăng ký, truy vấn khóa dòng khi duyệt, không có `FOR UPDATE`) đã chạy trên TiDB dev ngày 19/11/2026 không lỗi SQL; dev có 2 chiến dịch và chưa có đăng ký nào. Câu lệnh ghi (`INSERT`, `UPDATE`) chưa chạy trên database thật; chưa phải MySQL 8; chưa thử hai quản trị viên duyệt cùng một đăng ký song song.
- Ngày 19/11/2026 migration `2026-11-19-campaign-price-apply.sql` đã áp dụng vào TiDB dev `shopnova_dev` bằng tài khoản quản trị (3 cột mới, chưa có đăng ký nào). Sau đó đã thử đầu cuối trên TiDB dev bằng một chiến dịch `flash_sale` tạm và đăng ký tạm: áp giá (180.000 → 90.000, giá gạch ngang 220.000 giữ nguyên, bật Flash Sale), chạy lại không áp lần hai, rồi cho chiến dịch hết hạn thì giá và Flash Sale trở về đúng ban đầu. Chiến dịch, đăng ký tạm đã xóa và giá sản phẩm khôi phục. Đây là TiDB, chưa phải MySQL 8, và chưa thử qua giao diện admin hay cron thật.
