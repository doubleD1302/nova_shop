# Thuộc tính theo ngành hàng — dự thảo

Tài liệu thiết kế ban đầu. Phiên bản minh họa hiện đã được triển khai trong source cho một số danh mục; xem `CATEGORY_ATTRIBUTES.md`. Các lựa chọn bên dưới tiếp tục là định hướng cần thống nhất trước khi vận hành chính thức hoặc chuyển đổi dữ liệu cũ.

## Hiện trạng source

- `categories` là cây danh mục; `products.category_id` chọn một danh mục. `products.specs` là JSON object tùy chọn, dùng nhãn hiển thị làm key; catalog chuyển thành mảng `{ label, value }`. Không có định nghĩa thuộc tính theo danh mục trong schema hiện tại.
- Seller tạo/sửa sản phẩm bằng `categoryId` là slug; Data API chỉ kiểm tra danh mục hoạt động. Luồng ghi hiện tại không nhận hoặc cập nhật `specs`; sửa sản phẩm có thể đổi danh mục mà giữ nguyên `specs` cũ.
- `product_variants.attributes` là lựa chọn SKU, khác thông số chung `specs`. Luồng seller hiện tạo SKU mặc định và khi sửa cập nhật giá/kho SKU hoạt động đầu tiên; đơn hàng lưu snapshot thuộc tính SKU. Không tự chuyển đổi thông số sang SKU hoặc thay lịch sử đơn.
- Chưa khảo sát dữ liệu MySQL thực tế. Không thể suy ra số sản phẩm, chất lượng giá trị, tính đầy đủ hay khả năng chuyển đổi chỉ từ schema và seed.

## Đề xuất để thống nhất

1. Định nghĩa thuộc tính bằng mã ổn định, nhãn, kiểu (`text`, `number`, `boolean`, `single_choice`, `multi_choice`), đơn vị và quy tắc giới hạn; lựa chọn có mã ổn định và nhãn riêng. Quy định chính xác độ dài, khoảng số, đơn vị, chuẩn hóa và danh sách giá trị theo từng ngành hàng trước khi phát hành.
2. Gắn định nghĩa với danh mục và phiên bản; cần quyết định danh mục cha có kế thừa xuống con hay không, cách xử lý trùng mã, thứ tự hiển thị, danh mục được phép bán và ai có quyền chỉnh cấu hình. Không đổi nghĩa mã đã phát hành; bổ sung phiên bản khi thay quy tắc.
3. Phân biệt thông số sản phẩm với thuộc tính tạo SKU. Thông số có thể đề xuất lưu theo mã và phiên bản định nghĩa; SKU, giá, tồn kho và snapshot đơn tiếp tục có vòng đời riêng. Tên bảng, khóa và migration chỉ chốt sau khi database review; không mặc định JSON hiện tại đủ cho lọc/index.
4. Đề xuất response tương lai trả mã, nhãn, kiểu, đơn vị và giá trị đã xác thực; phải giữ tương thích response `specs` `{ label, value }` cho client hiện có trong giai đoạn chuyển tiếp. Phiên bản minh họa đã có API đọc định nghĩa và ghi/đọc thuộc tính riêng; contract chính thức cần tiếp tục thống nhất cùng web/app.

## Sản phẩm cũ và thay đổi danh mục

- Trước migration, thống kê chỉ đọc theo danh mục: số sản phẩm, `specs` null/rỗng, key và kiểu giá trị, giá trị không map được, SKU và sản phẩm có lịch sử đơn. Thực hiện trên môi trường được phép; không ghi dữ liệu thật vào tài liệu hoặc ZIP.
- Đề xuất giữ nguyên `specs` cũ và khả năng đọc/bán; không tự suy đoán giá trị, không ẩn hoặc buộc sửa hàng loạt. Lập bảng ánh xạ có người duyệt; chuyển đổi thử trên bản sao test, báo số thành công/thất bại, có backup, đối soát và kế hoạch rollback trước migration thật.
- Cần thống nhất khi nào bắt buộc thuộc tính: sản phẩm mới, sản phẩm cũ khi sửa hay chỉ khi đăng bán. Trong giai đoạn chuyển tiếp nên cho phép sản phẩm cũ thiếu trường và hiển thị giá trị cũ, tránh chặn chỉnh sửa unrelated; thời điểm áp dụng bắt buộc cần quyết định rõ.
- Khi đổi danh mục, cần chính sách xem trước giá trị tương thích, giữ riêng hoặc yêu cầu người bán xác nhận các giá trị không tương thích; không xóa âm thầm. Quyết định việc ảnh hưởng duyệt sản phẩm và trạng thái bán trước khi thiết kế API.
- Đổi định nghĩa về sau cần phiên bản, quy tắc tương thích, kiểm kê sản phẩm bị ảnh hưởng và chuyển đổi có kiểm soát. Không sửa SKU đã có lịch sử mua hoặc snapshot đơn hàng.

## Điều kiện cho task triển khai tiếp theo

Có danh sách thuộc tính và giá trị được duyệt cho ngành hàng đầu tiên, quy tắc kế thừa/phiên bản, chính sách sản phẩm cũ và đổi danh mục, contract public/nội bộ và kế hoạch migration/rollback đã thống nhất. Sau đó mới triển khai API, validation ở Backend và Data API, kiểm tra tương thích và migration trên MySQL test riêng.
