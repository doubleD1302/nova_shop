# Vận hành khóa và truy cập giấy tờ người bán

## Truy cập có ghi nhận

Sau khi áp dụng migration `2026-11-10-seller-identity-access-events.sql` trên môi trường đã xác định, admin đang hoạt động gọi `POST /api/v1/admin/shops/:shopId/identity-access` với `{ "reason": "lý do kiểm tra" }` (10–500 ký tự). Chỉ trả số giấy tờ sau khi Data API ghi thành công sự kiện trong cùng transaction. Phản hồi đặt `Cache-Control: no-store`; không ghi giấy tờ vào log. Người dùng thường bị từ chối. `GET /api/v1/admin/shops/:shopId/identity-access-events` trả tối đa 100 sự kiện gần nhất cho admin. Lý do có thể nhạy cảm; không đưa thêm dữ liệu giấy tờ vào lý do.

Tính năng này không xác minh giấy tờ hay thuế với cơ quan/đối tác. Cần quyết định chính sách cấp quyền admin, lưu giữ nhật ký và rà soát truy cập trước khi triển khai môi trường thật.

## Xoay khóa

`SELLER_IDENTITY_KEY` là khóa mới đang dùng để mã hóa. `SELLER_IDENTITY_PREVIOUS_KEYS` gồm các khóa cũ mã hóa base64 phân cách bằng dấu phẩy. Luôn sao lưu an toàn tất cả khóa cần giải mã bản sao lưu database. Không đưa khóa vào Git, log hoặc ZIP.

1. Sao lưu database và khóa cũ; thử khôi phục trên môi trường test. Chuẩn bị khóa mới độc lập.
2. Triển khai code hỗ trợ danh sách khóa cũ trước. Sau đó phối hợp triển khai toàn bộ Data API instance với **cùng khóa mới** và đưa khóa hiện tại vào danh sách khóa cũ; giữ khóa cũ cho bản sao lưu. Không chạy xoay nếu còn instance ghi bằng khóa cũ.
3. Tắt `ALLOW_LOCAL_DB_FALLBACK`, xác nhận đúng database, và từ `data-api/` chạy `node scripts/rotate-seller-identity.mjs --check`. Chỉ số `oldCount` cho biết số hồ sơ cần chuyển; công cụ không in giấy tờ hoặc khóa.
4. Khi các điều kiện trên được thỏa mãn, chạy `node scripts/rotate-seller-identity.mjs --apply`. Mỗi hồ sơ được khóa và chuyển trong transaction riêng; lỗi dừng đợt, các hồ sơ đã chuyển vẫn đọc được bằng cấu hình hai khóa và có thể chạy lại.
5. Khi không còn instance dùng khóa cũ, kiểm tra lại bằng `--check` trong khoảng không có ghi đồng thời. Chỉ gỡ khóa cũ khỏi cấu hình chạy khi `oldCount` bằng 0 và đã kiểm tra backup/khôi phục. Giữ khóa cũ an toàn cho các bản sao lưu trước khi xoay.

Chưa áp dụng migration này, chưa xoay khóa thật, chưa kiểm thử đồng thời trên MySQL/TiDB hoặc thực hiện trên Render. Kiểm thử hiện tại dùng SQLite và khóa giả cô lập.
