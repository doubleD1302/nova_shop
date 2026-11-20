# Lịch sử trò chuyện Nova AI (Data API)

Các endpoint nội bộ dưới `/internal/v1/ai/conversations`, yêu cầu `x-service-key` như mọi route `/internal/v1`. Backend xác thực người dùng rồi gửi `userId`; mọi truy vấn ràng buộc `user_id`, nên cuộc trò chuyện của tài khoản khác luôn trả `404 CONVERSATION_NOT_FOUND` (không tiết lộ là có tồn tại). Hợp đồng công khai cho web/app nằm ở [Nova AI API](../backend/NOVA_AI.md). Trạng thái: `implemented`.

## Bảng

`database/migrations/2026-11-20-ai-chat-history.sql` (và `database/schema.sql` cho bản dựng mới) tạo hai bảng, chạy lại nhiều lần không lỗi và không sửa bảng cũ. Bản SQLite dự phòng khi MySQL không khả dụng (`src/config/local-db.js`) có bảng tương ứng.

| Bảng | Cột chính |
|---|---|
| `ai_conversations` | `user_id` (FK users, xóa theo tài khoản), `title` (≤120), `message_count`, `last_message_at`, `created_at`, `updated_at`; index `(user_id, last_message_at)` |
| `ai_messages` | `conversation_id` (FK, xóa theo cuộc trò chuyện), `role` (`user`/`assistant`), `content`, `intent`, `metadata` (JSON), `created_at`; index `(conversation_id, id)` |

Thời gian lưu UTC. ID trả về dưới dạng chuỗi.

## Endpoint

| Method và path | Request | Kết quả |
|---|---|---|
| `GET /ai/conversations` | query `userId`, `limit` (1–50, mặc định 20), `offset` | `data.conversations[]`, `total`, `limit`, `offset`; mới nhất trước |
| `POST /ai/conversations` | body `{ userId, title }` | `201`, `data.conversation`. Tiêu đề được gọn khoảng trắng và cắt 120 ký tự. Sau khi tạo, các cuộc từ thứ 51 trở đi của tài khoản (theo `last_message_at`) bị xóa cùng tin nhắn |
| `GET /ai/conversations/:id/messages` | query `userId`, `limit` (1–100, mặc định 50), `beforeId` | `data.conversation`, `data.messages[]` cũ → mới, `data.hasMore` |
| `POST /ai/conversations/:id/messages` | body `{ userId, messages: [{ role, content, intent?, metadata? }] }`, 1–4 tin | `201`, `data.conversation`, `data.messageIds`. Lưu trong một transaction và cập nhật `message_count`, `last_message_at` |
| `DELETE /ai/conversations/:id` | query `userId` | `data.deleted: true`; xóa tin nhắn rồi cuộc trò chuyện trong một transaction |

Giới hạn: `content` của `user` ≤ 4.000 ký tự, của `assistant` ≤ 8.000; `intent` ≤ 50 ký tự; `metadata` là object JSON ≤ 16 KB; tối đa 300 tin mỗi cuộc (vượt thì `409 CONVERSATION_FULL`, không lưu tin nào). Dữ liệu sai trả `400 VALIDATION_ERROR`. Lỗi database theo middleware chung.

## Lưu ý

- Data API không tự quyết định có lưu hay không; Backend chỉ gửi những gì được phép lưu (không gửi nội dung tra cứu quản trị).
- `message_count` và `last_message_at` được cập nhật trong cùng transaction với việc thêm tin; đọc danh sách và đọc tin là hai truy vấn riêng nên có thể lệch nhẹ khi đang có tin mới.
- Tin nhắn không được mã hóa ở mức ứng dụng; người có quyền truy cập database đọc được nội dung. Không đưa mật khẩu hay token vào tin nhắn.

## Kiểm tra

`node scripts/test-ai-chat.mjs` tại `data-api/` chạy các câu SQL của controller trên SQLite trong bộ nhớ (không cần MySQL, không đụng database dev). Bài này kiểm tra hợp đồng, chủ sở hữu, giới hạn số tin/số cuộc và việc xóa kèm tin nhắn, **không** chứng nhận cú pháp trên MySQL/TiDB thật: cần chạy migration trên môi trường dev/test đã xác định rồi thử một lượt lưu/đọc/xóa trước khi dùng thật.

## Kết quả trên TiDB dev

Ngày 20/11/2026 migration `2026-11-20-ai-chat-history.sql` đã áp dụng vào TiDB dev `shopnova_dev` (TiDB v8.5.3 serverless, chưa phải MySQL 8) bằng tài khoản quản trị; hai bảng và hai khóa ngoại được tạo, `users.id` là `bigint unsigned` nên khớp. Sau đó chạy chính code Data API trên database này với một cuộc trò chuyện tạm của một tài khoản buyer có sẵn: tạo, lưu hai tin (cột JSON `metadata` đọc lại đúng), đọc, liệt kê, tài khoản khác nhận 404, xóa. Bản ghi tạm đã xóa hết.

Ghi đồng thời cùng một cuộc trò chuyện (20/11/2026, cuộc tạm đã xóa): 12 yêu cầu song song chỉ có 6 yêu cầu thành công (201), 6 yêu cầu còn lại trả `503` do hết thời gian chờ kết nối khi các yêu cầu xếp hàng theo khóa dòng `FOR UPDATE` (pool tối đa 5 kết nối, thời hạn mỗi truy vấn dưới 5 giây, TiDB ở xa). Dữ liệu không hỏng: số tin đúng bằng số yêu cầu thành công, mỗi cặp hỏi - đáp nằm liền nhau; ở ngưỡng 300 tin (đặt `message_count` = 296 rồi ghi 6 yêu cầu song song) có 2 yêu cầu thành công và 4 trả `409 CONVERSATION_FULL`, tổng đúng 300. Một người dùng gửi tuần tự không gặp tình huống này; nếu có, Backend trả `historySaved: false` thay vì lỗi.

Chạy thật Backend → Data API → TiDB dev → Gemini (`gemini-3.1-flash-lite`) với một buyer có sẵn và cuộc trò chuyện tạm (đã xóa): lưu 6 tin, câu hỏi nối tiếp "Giá bao nhiêu?", "Có màu đen không?" được trả lời bằng dữ liệu thật của sản phẩm vừa bàn (giá, tồn kho, biến thể). Lần chạy này phát hiện "tai nghe" khớp nhầm danh mục "Công nghệ" và đã sửa. Chưa thử qua giao diện với dữ liệu thật hay trên thiết bị.
