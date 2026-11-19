# Quản trị chiến dịch marketing và duyệt đăng ký của shop

Trước đây shop đăng ký sản phẩm vào chiến dịch (`POST /api/v1/seller/marketing/campaigns/register`) nhưng không có API nào để quản trị viên tạo chiến dịch hay duyệt đăng ký, nên mọi đăng ký dừng mãi ở `pending`. Tài liệu này mô tả các API admin bổ sung. Chúng dùng bảng `marketing_campaigns` và `campaign_registrations` có sẵn, **không đổi schema**.

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

## Giới hạn

- **Duyệt đăng ký chưa tự đổi giá hay bật Flash Sale.** API chỉ ghi `status` và `note`. `discount_price` mà shop cam kết chưa được áp vào biến thể, và `products.is_flash_sale` vẫn do quản trị bật riêng qua `PATCH /admin/products/:id/flash-sale`. Áp giá khi chiến dịch bắt đầu và hoàn giá khi kết thúc cần cách lưu giá gốc (thêm cột trên `campaign_registrations`, đổi schema) và quy tắc cho sản phẩm nhiều biến thể; cần quyết định riêng.
- `registerCampaign` của shop chỉ kiểm tra chiến dịch đang bật, chưa kiểm tra đã kết thúc; đăng ký vào chiến dịch đã hết hạn vẫn tạo được hồ sơ `pending` (admin sẽ không duyệt được, chỉ từ chối).
- Chưa có API xóa chiến dịch; dùng `isActive: false`.

## Kiểm tra

`node data-api/scripts/test-admin-campaigns.mjs` (9 kiểm tra, database giả lập) và `npm --prefix backend run test:seller-center` (phần "Admin: chiến dịch marketing", Data API giả lập). Các truy vấn đọc (danh sách chiến dịch, danh sách đăng ký, truy vấn khóa dòng khi duyệt, không có `FOR UPDATE`) đã chạy trên TiDB dev ngày 19/11/2026 không lỗi SQL; dev có 2 chiến dịch và chưa có đăng ký nào. Câu lệnh ghi (`INSERT`, `UPDATE`) chưa chạy trên database thật; chưa phải MySQL 8; chưa thử hai quản trị viên duyệt cùng một đăng ký song song.
