# Nova AI - hợp đồng API

`POST /api/v1/ai/chat` nhận `message` dạng chuỗi không rỗng, tối đa 4.000 ký tự; `history` hoặc `context.history` là tối đa 20 phần tử `{ isUser: boolean, text: string }`, mỗi `text` tối đa 4.000 ký tự. Bearer token là tùy chọn với câu hỏi công khai; các câu hỏi riêng yêu cầu xác thực. Backend xác minh tài khoản và lấy quyền hiện tại từ Data API, không tin role hoặc userId do client gửi.

Body còn nhận ba trường tùy chọn: `conversationId` (chuỗi ID, hoặc trong `context`), `newConversation` (boolean) và `context.productId` (ID sản phẩm khách đang xem, để hỏi tiếp về đúng sản phẩm đó). Các trường này sai kiểu trả `400 VALIDATION_ERROR`.

Kết quả thành công có `success: true` và `data.reply`, `data.intent`. Kết quả danh sách riêng có `pagination: { page, total, hasMore }`. Tư vấn sản phẩm có thể kèm `products`, `poweredBy`, `catalogAvailable`, `catalogPartial`, `catalogPage`, `catalogHasMore`. `catalogAvailable: null` nghĩa là không có từ khóa tìm kiếm và chưa kiểm tra Data API; `catalogPartial: true` nghĩa là có truy vấn thành phần thất bại; `catalogHasMore: null` nghĩa là chưa xác định được. `poweredBy` là model trả lời thực tế, không chứng nhận tính chính xác.

Trạng thái lỗi: `400 VALIDATION_ERROR` hoặc `EMPTY_MESSAGE` cho input không hợp lệ; `401` khi cần đăng nhập hoặc token không hợp lệ; `403 FORBIDDEN` cho câu hỏi ngoài quyền; `503 DATA_API_UNAVAILABLE` khi các truy vấn danh mục đều thất bại; `503 AI_UNAVAILABLE` khi Gemini không phản hồi. Những lỗi Data API khác được ánh xạ theo HTTP client nội bộ.

Khách xem danh mục công khai; buyer đã đăng nhập xem đơn của chính tài khoản. Seller xem sản phẩm và đơn của shop thuộc tài khoản đã xác thực. Admin có thể hỏi thống kê và sáu nhóm danh sách: tài khoản, shop, sản phẩm, đơn, đánh giá và báo cáo. Từ khóa `trang N` chọn trang với tối đa 20 kết quả; có thể hỏi tiếp `trang N` khi lịch sử gần nhất còn câu hỏi gốc. Với nhóm hỗ trợ, admin có thể tìm chính xác theo `mã 25` hoặc `#25`, email, số điện thoại hay mã đơn. Bộ lọc được thực hiện tại Data API thay vì lọc trong 200–500 bản ghi gần nhất. Dữ liệu thay đổi giữa các trang có thể làm dịch chuyển kết quả.

Với sản phẩm công khai, Backend chọn tối đa ba từ khóa, truy vấn năm kết quả mỗi từ cho trang yêu cầu, gộp ID và gửi tối đa 15 kết quả của trang vào ngữ cảnh. Một sản phẩm có thể lặp lại ở các trang khác nhau vì mỗi từ khóa có tập kết quả riêng. Tìm theo từ khóa có thể không nhận ra mọi cách diễn đạt. Trạng thái, giá và quyền truy cập cuối cùng phải kiểm tra ở luồng nghiệp vụ gốc. Không dùng dữ liệu mẫu để lấp danh mục khi dịch vụ dữ liệu lỗi.

Chưa có đường truy vấn tất cả bảng hoặc trường: thanh toán, voucher, giỏ hàng và lịch sử kho chưa được nối vào trợ lý. Nhận biết chủ đề dựa trên cụm từ và có thể không nhận ra mọi câu hỏi. Mật khẩu, token và hash xác thực không được đưa vào ngữ cảnh. Chi tiết nội bộ: [Tra cứu admin Data API](../data-api/AI_ADMIN.md).

Backend ưu tiên `gemini-3.1-flash-lite` và tự động chuyển sang model dự phòng (`gemini-3.5-flash-lite`, `gemini-3.8-flash`) khi quá tải. Chỉ dẫn hệ thống tách khỏi câu hỏi và dữ liệu truy xuất, nhưng không thể bảo đảm tuyệt đối chống nội dung gây hiểu sai hay bịa đặt. Dữ liệu gửi tới Gemini phụ thuộc cấu hình và điều khoản của tài khoản API. Khi admin hỏi thông tin liên hệ, email và/hoặc số điện thoại có thể được gửi sang nhà cung cấp; thông tin không được đưa vào ngữ cảnh nếu câu hỏi không yêu cầu trường tương ứng.

## Lịch sử trò chuyện

Tài khoản đã đăng nhập có lịch sử lưu trong database qua Data API ([chi tiết](../data-api/AI_CHAT.md)); khách chưa đăng nhập không được lưu và `POST /ai/chat` không trả `conversationId` cho khách.

- `POST /ai/chat` với Bearer token: nếu có `conversationId` thì tiếp tục đúng cuộc trò chuyện đó (không thuộc tài khoản → `404 CONVERSATION_NOT_FOUND`); nếu không có thì tiếp tục cuộc gần nhất còn hoạt động trong 12 giờ, hoặc tạo cuộc mới; `newConversation: true` luôn tạo cuộc mới. Cuộc trò chuyện chỉ được tạo khi đã có câu trả lời, nên câu hỏi gặp lỗi `503` không để lại bản ghi rỗng.
- Ngữ cảnh gửi cho mô hình là tối đa 12 tin gần nhất đã lưu trên server; `history` do client gửi chỉ được dùng khi chưa có lịch sử lưu (khách, cuộc mới, hoặc lỗi tải lịch sử) và để hiểu câu `trang N`.
- Phản hồi thêm `data.conversationId` và `data.historySaved`. Lỗi khi lưu hoặc tải lịch sử không làm hỏng câu trả lời: `historySaved: false`.
- Tra cứu quản trị (dữ liệu tài khoản, đơn, shop của người khác) chỉ lưu dấu vết "không lưu nội dung"; câu hỏi và câu trả lời thật không ghi vào database. Hỏi đơn hàng, sản phẩm shop của chính mình được lưu bình thường.
- Mỗi tài khoản giữ 50 cuộc gần nhất (cuộc cũ hơn bị xóa khi tạo cuộc mới); mỗi cuộc tối đa 300 tin, đầy thì cuộc mới được mở tự động.

| Endpoint | Mô tả |
|---|---|
| `GET /api/v1/ai/conversations?limit=&offset=` | Danh sách cuộc trò chuyện (limit 1–50, mặc định 20). `data.conversations[]` gồm `id, title, messageCount, lastMessageAt, createdAt`; `data.pagination` gồm `limit, offset, total, hasMore`. |
| `GET /api/v1/ai/conversations/:id/messages?limit=&beforeId=` | Tối đa `limit` (1–100, mặc định 50) tin gần nhất, cũ → mới, kèm `hasMore`. `beforeId` là id tin cũ nhất đang có để tải trang cũ hơn. Mỗi tin có `id, role (user/assistant), content, intent, metadata, createdAt`; `metadata` của tin assistant có thể có `products`, `suggestions`, `pagination`, `catalog` để dựng lại giao diện. |
| `DELETE /api/v1/ai/conversations/:id` | Xóa cuộc trò chuyện và toàn bộ tin nhắn. |

Cả ba yêu cầu Bearer token (`401` nếu thiếu), `400 VALIDATION_ERROR` cho tham số sai và `404 CONVERSATION_NOT_FOUND` khi cuộc trò chuyện không tồn tại hoặc thuộc tài khoản khác. `DELETE /ai/brain/reset` chỉ đặt lại hồ sơ sở thích, không xóa lịch sử.

## Độ chính xác của dữ liệu

- Câu hỏi tìm sản phẩm được hiểu thêm khoảng giá (`dưới 300 nghìn`, `từ 200k đến 1,5 triệu`, `tầm 2tr5`), kiểu sắp xếp (`rẻ nhất`, `bán chạy`, `đánh giá cao`, `giảm giá`, `mới nhất`) và `freeship`; bộ lọc được Data API thực hiện qua `minPrice`, `maxPrice`, `sort`, `freeship`. Khi khách chọn sắp xếp rõ ràng, thứ tự đó được giữ thay vì xếp lại theo thói quen. Số trần dưới 1.000 không có đơn vị (ví dụ `size 40`) không bị hiểu là giá. Có bộ lọc nhưng không có tên sản phẩm (`có gì dưới 100k`) vẫn truy vấn theo bộ lọc.
- Câu nối tiếp không nêu tên sản phẩm (`gợi ý thêm`, `có mẫu rẻ hơn không`) dùng lại câu tìm sản phẩm gần nhất có tên sản phẩm cụ thể.
- Câu hỏi thuộc tính về sản phẩm vừa bàn (`giá bao nhiêu?`, `có màu đen không?`, `còn hàng không?`) nạp dữ liệu thật của tối đa 3 sản phẩm đó (lấy từ lịch sử đã lưu, hoặc `context.productId`), gồm biến thể màu/size, giá và tồn kho. Dữ liệu biến thể (tối đa 8 biến thể mỗi sản phẩm), shop, đánh giá và số đã bán cũng được gửi cho cả kết quả tìm kiếm. Nếu không xác định được sản phẩm đang bàn, mô hình được yêu cầu hỏi lại thay vì đoán.
- Lịch sử gửi cho Gemini theo từng lượt người dùng/mô hình; `temperature` 0,3 và `maxOutputTokens` 1024 để trả lời ổn định, không bị cắt giữa chừng. Chỉ dẫn yêu cầu số liệu lấy đúng từ dữ liệu và báo rõ khi danh sách rỗng.
- Hỏi đơn hàng của người mua không qua mô hình: trả trạng thái bằng tiếng Việt, tổng tiền, ngày đặt; hỏi theo mã (`NOVA…`) thì trả sản phẩm, đơn vị vận chuyển và cập nhật gần nhất, tìm trong 100 đơn gần nhất vì Data API chưa lọc theo mã; hỏi theo trạng thái (`đang giao`, `đã hủy`…) chỉ lọc trong trang đang xem.

Các kiểm tra dự án: `node scripts/test-ai-data.mjs`, `node scripts/test-ai-catalog.mjs`, `node scripts/test-ai-privacy.mjs`, `node scripts/test-ai-keys.mjs` và `node scripts/test-ai-history.mjs` tại `backend/`. Các bài trên giả lập dịch vụ phụ thuộc. Cần chạy migration `database/migrations/2026-11-20-ai-chat-history.sql` trên MySQL/TiDB trước khi dùng lịch sử; nếu chưa có bảng, Nova AI vẫn trả lời nhưng `historySaved` là `false`. `data-api/scripts/test-ai-admin-mysql.mjs` yêu cầu máy chủ thử cô lập có marker; cần ghi rõ loại database và môi trường khi báo kết quả.

## Giao diện web và app

Cả hai chỉ hiện lịch sử khi đã đăng nhập; khách thấy lời nhắc đăng nhập (web) hoặc không có nút lịch sử (app).

- Mở Nova: tải danh sách cuộc trò chuyện và tự mở lại cuộc gần nhất nếu còn trong 12 giờ, cùng quy tắc với Backend. Lượt gửi sau luôn kèm `context.conversationId`.
- "Cuộc trò chuyện mới" xóa màn hình và gửi `context.newConversation: true` ở lượt kế tiếp. Trên app, mục này không còn đặt lại ký ức của Nova; việc đó chuyển sang mục "Xóa ký ức của Nova".
- Lịch sử: mở lại (dựng lại thẻ sản phẩm từ `metadata.products`), xóa sau khi xác nhận, "Xem tin cũ hơn" khi `hasMore`. Nếu cuộc trò chuyện đã bị xóa ở nơi khác (`CONVERSATION_NOT_FOUND`), giao diện báo và lần gửi sau mở cuộc mới.
- Hỏi về sản phẩm đang xem: trang chi tiết sản phẩm (web: nút "Hỏi Nova về sản phẩm này" gửi sự kiện `open-nova-ai` kèm `productId`; app: nút Nova AI truyền `productId` vào `NovaAIScreen`) làm Nova gửi `context.productId` ở mọi tin cho tới khi khách bấm bỏ ngữ cảnh, và hiện dòng "Đang hỏi về…". Chỉ gửi khi ID là số nguyên dương như Backend yêu cầu (ID dữ liệu mẫu dạng `p01` bị bỏ qua, vì Backend từ chối cả yêu cầu nếu ID sai dạng). Web tự bỏ ngữ cảnh khi chuyển trang.
- Phân trang: `metadata.catalog` (`{ page, hasMore }`) của tin trả lời tìm sản phẩm cho phép app dựng lại nút "Xem trang N" khi mở lại cuộc trò chuyện (chỉ ở câu trả lời cuối). Web không hiển thị nút trang ở cả tin mới lẫn tin đã lưu.
