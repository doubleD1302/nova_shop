# Nhận tiền minh họa cho đồ án

Luồng này chỉ là **demo**, không kết nối ngân hàng, đối tác, đơn hàng hay COD, không xác nhận hoặc chuyển tiền thật. Hai bảng `demo_seller_payouts` và `demo_payout_withdrawals` tách khỏi dữ liệu tài chính. API bị vô hiệu ở `NODE_ENV=production` tại Backend và Data API. Các số và trạng thái trả về đều ghi `mode: demo`, trạng thái rút `simulated`.

Các route yêu cầu token seller/admin, Data API kiểm tra lại chủ shop và shop hoạt động:

- `GET /api/v1/seller/demo-payout`: đọc trạng thái, nhãn tài khoản giả, số dư ảo và tối đa 50 yêu cầu gần nhất. Trước khởi tạo trả `ready: false`, `balance: null`.
- `POST /api/v1/seller/demo-payout/setup`: khởi tạo một lần số dư **1.000.000 VND ảo** cho shop, không nhận thông tin ngân hàng hoặc KYC. Gọi lại giữ nguyên số dư và trả `created: false`.
- `POST /api/v1/seller/demo-payout/withdrawals`: body `{ "amount": 100000 }` là số nguyên từ 1 đến 1.000.000, header `Idempotency-Key` 16–64 ký tự ASCII chữ, số, `_`, `-`. Transaction khóa shop và số dư, ghi yêu cầu mô phỏng và trừ số dư ảo. Cùng khóa và số tiền trả kết quả cũ; cùng khóa khác số tiền hoặc số dư không đủ trả 409. Không có callback và không gửi yêu cầu đến bên ngoài.

Trước khi chạy với database hiện hữu cần migration `database/migrations/2026-11-06-demo-seller-payout.sql`. Không dùng dữ liệu demo để đối soát hoặc tính tiền thật; thiết kế vận hành thật vẫn là task riêng tại `SELLER_PAYOUT_DRAFT.md`.

Test MySQL cô lập: `node data-api/scripts/test-demo-payout-mysql.mjs` với `DEMO_PAYOUT_TEST=1`, `DEMO_PAYOUT_DB_PORT`, `DEMO_PAYOUT_DB_PASSWORD`; tùy chọn `DEMO_PAYOUT_DB_USER`. Test tắt production: `node data-api/scripts/test-demo-payout-production.mjs`. Không chạy test trên database dùng chung.
