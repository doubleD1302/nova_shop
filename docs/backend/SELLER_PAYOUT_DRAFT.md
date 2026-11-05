# Hồ sơ nhận tiền seller — tài liệu chuẩn bị thiết kế

Trạng thái: **chưa thống nhất; chưa triển khai**. Cần quyết định đường đi của tiền và quy trình đối soát trước khi chốt mô hình hồ sơ, API, schema hoặc thu thập dữ liệu. Các nội dung dưới đây là phương án thảo luận, không phải quy trình đang vận hành.

## Hiện trạng từ source

- Checkout chỉ nhận `paymentMethod: "cod"`. Data API tạo một `payments` trạng thái `unpaid` cho mỗi `shop_orders`, với số tiền bằng tổng đơn con; hủy đơn chưa thu có thể chuyển khoản này thành `void`. Các phương thức khác trong enum chưa chứng minh tích hợp thanh toán.
- `shop_orders.status` mô tả vòng đời giao hàng. `delivered` không chứng minh người mua đã trả tiền, tiền đã được đối soát hay seller đã được trả. Trong source hiện tại chưa thấy thao tác xác nhận thu COD hoặc luồng đối soát/chi trả; `payments` không phải sổ chi trả seller.
- API trả hàng hiện ghi nhận yêu cầu, số tiền đề xuất và trạng thái xử lý; chưa có bằng chứng xử lý chuyển tiền hoàn thực tế. Không suy ra `completed` là giao dịch hoàn tiền đã thành công.
- Phí giao hàng và voucher đã được tính vào tổng đơn con, nhưng chưa có quy tắc về phí sàn, nguồn tài trợ voucher, đối soát COD hay số thực trả seller. Không được lấy trực tiếp `shop_orders.total_amount` làm số tiền chi trả.

## Cần thống nhất trước

1. **Dòng tiền:** Ai thu COD, ai nắm tiền, ai trả seller? Nếu đơn vị vận chuyển trả trực tiếp seller, xác định sàn có thực sự cần hồ sơ nhận tiền hay chỉ cần đối chiếu bằng chứng. Nếu đơn vị vận chuyển trả sàn rồi sàn trả seller, xác định bên thực hiện và phương thức chi trả. Thanh toán online cần quy trình riêng, chưa coi là đã hỗ trợ.
2. **Đối soát:** Nguồn chứng từ và mã đối chiếu đáng tin cậy, bên cung cấp, kỳ đối soát, quyền xác nhận, xử lý lệch/thiếu/trùng và thời điểm coi tiền đã thực nhận. Làm rõ chi trả thủ công hay qua đối tác, thời gian giữ tiền và điều kiện đủ để chi trả.
3. **Số tiền seller:** Thống nhất từng thành phần, bên chịu phí vận chuyển, phí sàn, voucher, hoàn tiền, điều chỉnh, thuế nếu có; cách phân bổ, làm tròn, số âm, kỳ chốt và xử lý trả hàng hoặc khiếu nại sau khi đã chi. Chỉ tính theo quy tắc đã duyệt và chứng từ; không dùng số do client gửi.
4. **Dữ liệu và vận hành:** Xác định có cần hồ sơ nhận tiền trong ShopNova hay dùng thông tin do đối tác quản lý; ai xác minh chủ sở hữu, quy trình đổi thông tin, phê duyệt, xử lý sai người nhận và yêu cầu bảo vệ dữ liệu. Không thu thập thông tin ngân hàng hoặc KYC trước khi quy trình sử dụng và bảo vệ được phê duyệt.

## Phác thảo có điều kiện

Nếu sàn phải chi trả, dự kiến hồ sơ gắn với shop và có vòng đời riêng với thông tin shop công khai. Chỉ thiết kế trường dữ liệu sau khi xác định phương thức và đối tác: ưu tiên tham chiếu do đối tác cấp nếu phù hợp. Các trạng thái xác minh, ngưng sử dụng và thay đổi hồ sơ, quyền owner, xác thực lại và phê duyệt cần thống nhất; thay đổi hồ sơ không được làm thay đổi thông tin gắn với giao dịch đã duyệt.

Đối soát và chi trả cần tách khỏi hồ sơ: lưu chứng từ/nguồn đối soát, các khoản tính và điều chỉnh, đợt thanh toán và kết quả chi trả theo lịch sử bất biến phù hợp. Mỗi lần chi phải tham chiếu phiên bản hồ sơ đã duyệt, có mã thao tác duy nhất để chống chi trùng; trạng thái yêu cầu, đang xử lý, thành công, thất bại và chưa rõ kết quả cần phân biệt. Không tự thử lại khi kết quả chuyển tiền chưa rõ: đối chiếu với đối tác trước. Chốt mô hình transaction, xử lý đồng thời, hủy/hoàn và đối soát lại trước khi code.

Nếu sàn không chi trả, chưa có cơ sở tạo hồ sơ nhận tiền nội bộ; thiết kế dữ liệu đối soát tối thiểu theo thỏa thuận với đơn vị thực hiện, không sao chép dữ liệu nhạy cảm không cần thiết.

## Bảo vệ dữ liệu cần chốt trước triển khai

Xác định mục đích và thời hạn lưu, thông báo cho seller, phân quyền tối thiểu, mã hóa khi truyền và lưu, quản lý/luân chuyển khóa, che dữ liệu khi hiển thị, audit truy cập/thay đổi, xóa hoặc lưu theo thời hạn, quy trình sự cố và quyền truy cập của đối tác. Không ghi dữ liệu nhạy cảm trong log, URL, test fixture, ZIP hoặc phản hồi công khai. Tài liệu này không xác nhận giải pháp đã đáp ứng yêu cầu pháp lý; nhóm phụ trách cần xem xét theo mô hình vận hành và địa bàn thực tế.

## Điều kiện cho task tiếp theo

Có quyết định được duyệt về dòng tiền, đối soát, cách tính, xử lý hoàn/tranh chấp, nhà cung cấp và quy trình bảo vệ dữ liệu; có người chịu trách nhiệm nghiệp vụ và database. Sau đó mới thiết kế contract Backend/Data API, schema và migration, quyền truy cập, kế hoạch chuyển đổi dữ liệu và kiểm thử trên môi trường riêng. Các API và chức năng này hiện đều **planned**.
