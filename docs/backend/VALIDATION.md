# Kiểm tra dữ liệu đầu vào

Các endpoint giỏ hàng nhận `qty` nguyên trong giới hạn; riêng cập nhật cho phép 0 để xóa. `selected`, `replaceQty`, `selectedOnly` phải là boolean; tham số query `selected` chỉ nhận `true` hoặc `false`. Giá trị sai trả `400 VALIDATION_ERROR` trước khi thay đổi dữ liệu. `shopId` khi chọn theo shop phải là ID dương hợp lệ.

Khi cập nhật vận đơn, `autoAdvanceStatus` chỉ nhận boolean. Yêu cầu trả hàng chỉ nhận `refundAmount` nguyên dương an toàn hoặc bỏ trường này để dùng giá trị mặc định của đơn. Khi sửa hồ sơ shop, `tagline`, `description`, `address` nhận chuỗi hoặc null. Tạo đơn yêu cầu số lượng là số nguyên JSON và các trường địa chỉ dạng chuỗi; không chuyển boolean hoặc object thành dữ liệu hợp lệ.

Chạy `node data-api/scripts/test-cart-validation.mjs` từ thư mục gốc để kiểm tra các giá trị sai và các trường hợp xóa hợp lệ. Test có HTTP trên ứng dụng kiểm tra với controller Backend/Data API và database giả lập; không thay thế kiểm thử trên database thật. Bộ kiểm tra này chưa bao phủ toàn bộ các endpoint hoặc mọi trường đầu vào.
