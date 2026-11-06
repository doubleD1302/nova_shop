# Nova AI - hợp đồng API

`POST /api/v1/ai/chat` nhận `message` dạng chuỗi không rỗng, tối đa 4.000 ký tự; `history` hoặc `context.history` là tối đa 20 phần tử `{ isUser: boolean, text: string }`, mỗi `text` tối đa 4.000 ký tự. Bearer token là tùy chọn với câu hỏi công khai; các câu hỏi riêng yêu cầu xác thực. Backend xác minh tài khoản và lấy quyền hiện tại từ Data API, không tin role hoặc userId do client gửi.

Kết quả thành công có `success: true` và `data.reply`, `data.intent`. Tư vấn sản phẩm có thể kèm `products`, `poweredBy`, `catalogAvailable` và `catalogPartial`. `catalogAvailable: null` nghĩa là câu hỏi không có từ khóa tìm kiếm và chưa kiểm tra Data API; `catalogPartial: true` nghĩa là có truy vấn thành phần thất bại. `poweredBy` là model trả lời thực tế. Các trường này không chứng nhận tính chính xác của nội dung do model tạo.

Trạng thái lỗi: `400 VALIDATION_ERROR` hoặc `EMPTY_MESSAGE` cho input không hợp lệ; `401` khi cần đăng nhập hoặc token không hợp lệ; `403 FORBIDDEN` cho câu hỏi ngoài quyền; `503 DATA_API_UNAVAILABLE` khi các truy vấn danh mục đều thất bại; `503 AI_UNAVAILABLE` khi Gemini không phản hồi. Những lỗi Data API khác được ánh xạ theo HTTP client nội bộ.

Khách xem danh mục công khai; buyer đã đăng nhập xem tối đa năm đơn gần đây của chính tài khoản. Seller xem dữ liệu sản phẩm và đơn của shop thuộc tài khoản đã xác thực. Admin có thể hỏi thống kê và một số danh sách quản trị. Admin có thể tìm theo `mã 25` hoặc `#25`, email, số điện thoại trong phạm vi kết quả endpoint nội bộ trả về; mỗi lượt đưa tối đa 20 bản ghi vào ngữ cảnh. API hiện có giới hạn tối đa 200 đơn hoặc 500 bản ghi tùy loại, do đó chưa thể tra cứu đầy đủ toàn bộ dữ liệu. Cách xác định chủ đề dựa trên các cụm từ và có thể không nhận ra mọi cách hỏi.

Với sản phẩm, Backend chọn tối đa ba từ khóa, truy vấn tối đa 50 kết quả công khai mỗi từ và gộp các ID. Cách này có thể bỏ sót sản phẩm ngoài các trang kết quả hoặc theo cách diễn đạt khác. Trạng thái, giá và quyền truy cập cuối cùng vẫn phải kiểm tra trong luồng nghiệp vụ gốc. Không dùng dữ liệu mẫu để lấp danh mục khi dịch vụ dữ liệu lỗi.

Backend dùng duy nhất `gemini-3.1-flash-lite`. Chỉ dẫn hệ thống tách khỏi câu hỏi và dữ liệu truy xuất, nhưng không thể bảo đảm tuyệt đối chống nội dung gây hiểu sai hay bịa đặt. Dữ liệu gửi tới Gemini phụ thuộc cấu hình và điều khoản của tài khoản API. Khi admin hỏi thông tin liên hệ, email và/hoặc số điện thoại có thể được gửi sang nhà cung cấp; thông tin không được đưa vào ngữ cảnh nếu câu hỏi không yêu cầu trường tương ứng.

Các kiểm tra dự án: `node scripts/test-ai-data.mjs`, `node scripts/test-ai-catalog.mjs`, `node scripts/test-ai-privacy.mjs` và `node scripts/test-ai-keys.mjs` tại `backend/`. Các bài trên giả lập dịch vụ phụ thuộc, không chứng minh MySQL hoặc hệ thống triển khai thật.
