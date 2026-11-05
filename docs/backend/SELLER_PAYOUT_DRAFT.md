# Thiết kế hồ sơ nhận tiền seller

Trạng thái: **thiết kế dự kiến, chưa triển khai**. ShopNova chọn mô hình COD, đối soát qua sàn và chi trả qua đối tác. Không tạo API, migration hay thu thập thông tin ngân hàng/KYC trong giai đoạn này. Tham khảo cách Shopee ghi nhận số dư và trả về tài khoản liên kết tại [điều khoản Shopee](https://help.shopee.vn/portal/4/article/77243) và [hướng dẫn rút tiền](https://help.shopee.vn/portal/4/article/79510); các chính sách và con số bên dưới là lựa chọn riêng của ShopNova, không mô tả hệ thống nội bộ Shopee.

## Hiện trạng

Checkout chỉ nhận `cod`; Data API tạo `payments` trạng thái `unpaid` theo từng `shop_orders`, hủy đơn chưa thu có thể chuyển thành `void`. `delivered` chỉ phản ánh giao hàng, không chứng minh thu COD, đối soát hoặc chi trả. Chưa thấy thao tác xác nhận thu COD, đối soát hoặc chi trả seller trong source. `payments` không phải sổ số dư seller. API trả hàng ghi trạng thái và số tiền yêu cầu; `completed` chưa chứng minh chuyển tiền hoàn thực tế. Các phương thức online trong enum chưa được tích hợp.

## Lựa chọn nghiệp vụ

1. Đơn vị vận chuyển thu COD từ buyer và chuyển khoản thu cho ShopNova hoặc đối tác được ShopNova chỉ định theo hợp đồng. Đối tác chi trả được chọn sau sẽ chuyển tiền vào tài khoản nhận tiền đã xác minh của seller; không để đơn vị vận chuyển trả thẳng seller trong mô hình này.
2. Đối soát mỗi ngày làm việc: nhập chứng từ từ đơn vị vận chuyển và đối chiếu mã vận đơn, đơn con, tiền COD, các khoản khấu trừ và chứng từ tiền thực nhận. Bản ghi thiếu, trùng hoặc lệch bị giữ để xử lý thủ công có phân quyền, không tự đánh dấu khớp. Nhân viên xử lý và người duyệt là hai người khác nhau; mọi điều chỉnh có lý do và chứng từ.
3. Một khoản bán hàng chỉ chuyển sang khả dụng khi đã đối soát thành công, nguồn tiền thực sự đã nhận đủ, đơn giao thành công ít nhất **7 ngày** và không có yêu cầu trả hàng/tranh chấp đang xử lý hoặc lệnh giữ hợp lệ. Mốc 7 ngày là lựa chọn thiết kế ban đầu của ShopNova, phải tương thích chính sách trả hàng thực tế trước khi đưa vào vận hành; không dùng `delivered` đơn lẻ làm bằng chứng thu tiền.
4. Seller yêu cầu rút thủ công toàn bộ hoặc một phần số dư khả dụng; xử lý theo ngày làm việc qua đối tác. Không hứa thời gian hoàn tất, không rút tự động trong MVP. Tiền được chuyển sang trạng thái giữ cho lệnh rút ngay khi yêu cầu hợp lệ; không cho hai lệnh cùng tiêu một khoản. Xác nhận thành công chỉ dựa trên kết quả đáng tin cậy từ đối tác sau đối soát. Thất bại đã xác nhận thì hoàn khoản giữ về khả dụng; kết quả chưa rõ phải giữ nguyên và tra soát, không tự gửi lại.
5. Đơn bị tranh chấp hoặc trả hàng trước khi giải ngân: giữ phần liên quan cho tới khi xử lý có chứng từ. Sau khi đã chi trả, ghi khoản điều chỉnh riêng có lý do và quyền duyệt; không sửa lịch sử, không tự thu hồi tiền hoặc trừ vượt số dư khả dụng. Nợ còn lại cần quy trình xử lý riêng, không tự coi là đã thu.

## Tính tiền và đối soát

Quy ước đề xuất MVP cho mỗi đơn con: tiền được ghi nhận cho seller = tiền hàng `subtotal` trừ phần voucher phân bổ vào đơn con mà seller chịu, trừ khoản hoàn tiền hàng đã được xác nhận và khoản điều chỉnh hợp lệ. Với MVP này toàn bộ voucher được phân bổ vào đơn con do seller chịu, phí sàn và phí giao dịch bằng 0; phí giao hàng buyer trả thuộc bên vận chuyển, không cộng vào tiền seller. Mỗi khoản khấu trừ phải được ghi riêng, có nguồn và phiên bản quy tắc tại thời điểm tính. Đây là chính sách chọn cho thiết kế, chưa phải hành vi hiện có hoặc cam kết phí khi vận hành.

Ví dụ tiền hàng 100.000đ, voucher seller chịu 10.000đ, phí giao buyer trả 16.500đ: COD phải thu 106.500đ; nếu vận chuyển giữ đúng 16.500đ và chuyển 90.000đ cho sàn, khoản seller dự kiến là 90.000đ trước hoàn/điều chỉnh. Đối soát phải ghi nhận cả COD, khoản vận chuyển giữ và tiền sàn thực nhận; không nhầm tổng COD với tiền nhận thực tế. Nếu hợp đồng vận chuyển thu phí hoặc chuyển khoản khác ví dụ này, đưa vào ngoại lệ chờ xử lý, không tự suy diễn.

Tiền tính bằng số nguyên VND, các phép cộng/trừ kiểm tra giới hạn an toàn. Đối soát theo chứng từ và ID ổn định, không nhận số tiền chi trả từ client. Khoản hoàn sau chi, đối soát sai hoặc voucher được điều chỉnh tạo bút toán bù; không cập nhật âm thầm bút toán cũ. Ghi rõ số dự kiến, bị giữ, khả dụng, đang rút và đã chi; số này là sổ công nợ nội bộ, không tự coi là ví điện tử hay tiền đã được đối tác giữ hộ.

## Hồ sơ nhận tiền dự kiến

Mỗi shop có tối đa một hồ sơ đang hoạt động; hồ sơ thuộc shop và có phiên bản bất biến cho từng lần thay đổi. Phiên bản gồm ID nội bộ, ID shop, loại phương thức `bank_transfer`, mã tham chiếu đích do đối tác cấp, thông tin hiển thị đã che do đối tác cung cấp, trạng thái, thời điểm và người thao tác. Không định nghĩa hay thu thập số tài khoản, giấy tờ KYC, ảnh giấy tờ hoặc dữ liệu gốc trong ShopNova ở giai đoạn này. Mã tham chiếu và thông tin che vẫn được coi là dữ liệu cần bảo vệ.

Trạng thái dự kiến: `pending_verification` → `active` khi đối tác xác minh và hệ thống kiểm tra kết quả; xác minh thất bại → `rejected`. Phiên bản đang dùng có thể thành `disabled` khi bị khóa hoặc thay thế. Chỉ một phiên bản `active` mỗi shop; thay thông tin tạo phiên bản mới, xác thực lại seller và xác minh với đối tác trước khi kích hoạt. Lệnh rút đã tạo tham chiếu phiên bản đã chốt; không chuyển sang đích mới giữa chừng. Seller chỉ xem/tạo yêu cầu cho shop do token xác thực sở hữu; Data API kiểm tra lại phạm vi shop. Nhân viên chỉ có quyền cần thiết; hành động xác minh/khóa phải có audit.

Đối tác phải có luồng nhập và xác minh riêng, cung cấp tham chiếu và kết quả xác minh đáng tin cậy. Trước khi thu thập bất kỳ dữ liệu ngân hàng/KYC nào, phải có quy trình sử dụng và bảo vệ dữ liệu được duyệt, hợp đồng và cơ chế kiểm tra đối tác. Nếu đối tác không hỗ trợ mô hình tham chiếu này, dừng và thiết kế lại trước khi thu thập; không thay bằng tự lưu dữ liệu gốc.

## Thiết kế kỹ thuật cho task sau

- Backend xác thực seller và quyền, Data API chịu trách nhiệm kiểm tra owner, transaction và lưu dữ liệu; chỉ Data API kết nối MySQL. Endpoint công khai/nội bộ, chi tiết request/response và migration đều **planned**, cần thiết kế theo đối tác được chọn.
- Tách hồ sơ/phiên bản, chứng từ đối soát, bút toán công nợ và yêu cầu chi trả. Mỗi nguồn chứng từ và mỗi sự kiện tài chính có khóa duy nhất; sửa bằng bút toán đối ứng. Trong một transaction, khóa số dư shop, kiểm tra khoản khả dụng, ghi giữ tiền và tạo lệnh có idempotency key; không gọi đối tác trong transaction DB. Worker gửi lệnh sau commit bằng mã idempotency của đối tác; xác thực callback, kiểm tra trùng và đối chiếu kết quả trước khi ghi trạng thái. Nếu đối tác không đảm bảo idempotency, không tự retry lệnh có kết quả chưa rõ.
- Khóa hồ sơ, thay phiên bản, ghi sổ và xử lý chi trả đồng thời phải được kiểm tra cạnh tranh; đối chiếu hàng ngày giữa sổ, chứng từ và đối tác. Test cần bao gồm owner khác, chứng từ thiếu/trùng/lệch, chi trùng, callback lặp/sai, timeout chưa rõ, thất bại hoàn giữ, trả hàng và điều chỉnh sau chi.
- Dữ liệu hiện tại không đủ chứng minh tiền đã thu hay seller đã được trả. Đơn cũ không tự sinh số dư; chỉ ghi nhận sau đối soát từng đơn với chứng từ hợp lệ, có kế hoạch chuyển đổi và kiểm tra trên MySQL test riêng. Không thay đổi số liệu đơn/payment cũ để suy ra thanh toán.

## Điều kiện triển khai

Trước khi vận hành cần đối tác vận chuyển và chi trả, hợp đồng và bằng chứng nhận tiền, chính sách trả hàng/giữ tiền/hoàn được duyệt, quy trình xử lý lệch và tranh chấp, quản lý vai trò, bảo vệ dữ liệu, thời hạn lưu, audit, ứng phó sự cố và đánh giá pháp lý phù hợp. Thiết lập mã hóa khi truyền và lưu, quản lý khóa, che thông tin, giới hạn truy cập; không ghi dữ liệu nhạy cảm vào log, URL, test hoặc ZIP. Chưa có các điều kiện này nên không được bật luồng nhận hoặc chuyển tiền thật.
