# Vận đơn

`PATCH /api/v1/seller/orders/:shopOrderId/tracking` yêu cầu seller của shop, mã vận đơn tối đa 100 ký tự và đơn vị vận chuyển tối đa 60 ký tự. Chỉ trạng thái `confirmed` tự chuyển sang `shipping` khi `autoAdvanceStatus` là `true`. Mã vận đơn, thay đổi trạng thái, lịch sử đơn và mốc tracking được ghi cùng transaction; nếu ghi mốc lỗi, toàn bộ cập nhật được rollback.

`GET /api/v1/orders/:orderId/tracking` chỉ trả các phần đơn thuộc buyer hoặc seller tương ứng. Mốc `manifest_created` ghi nhận thao tác nội bộ, không chứng minh đối tác đã nhận hàng. Chưa có tích hợp hoặc xác thực trạng thái từ hãng vận chuyển; không coi timeline tự sinh là hành trình thực tế.

Test: `node data-api/scripts/test-postsales-mysql.mjs` với `POSTSALES_TEST=1`, `POSTSALES_DB_PORT`, `POSTSALES_DB_PASSWORD`; chỉ chạy MySQL cục bộ riêng. Nếu thiếu bảng `shipment_trackings`, ghi vận đơn không thành công thay vì âm thầm xác nhận lưu mốc tạm.
