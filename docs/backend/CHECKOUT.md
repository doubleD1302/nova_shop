# Hợp đồng API checkout

Các API công khai dùng tiền tố `/api/v1`. Số tiền là số nguyên VND. Các tính toán vận chuyển ở đây là bảng phí nội bộ MVP, chưa phải báo giá từ đơn vị vận chuyển.

## Ước tính phí cho một shop

`POST /api/v1/shipping/calculate` không yêu cầu đăng nhập. Body là `{ "subtotal": 100000 }`; `subtotal` là số nguyên không âm và mặc định là 0. API trả `data.estimated`, `data.note` và `data.options`: mỗi lựa chọn có `id`, `name`, `originalFee`, `discount`, `fee`, `isDefault`.

| `id` | Tên | Phí cơ bản mỗi shop |
|---|---|---:|
| `tietkiem` | Tiết Kiệm | 16.500 |
| `nhanh` | Hoả Tốc ShopNova | 32.000 |
| `hoatoc` | Nhanh | 22.000 |

Ước tính miễn phí nếu `subtotal` của shop từ 1.000.000 đồng. Các trường địa chỉ, cân nặng và `isMall` cũ không ảnh hưởng phí. API này không biết cờ miễn phí vận chuyển của sản phẩm, nên dùng API xem trước dưới đây để lấy tiền theo các sản phẩm thực tế. Đầu vào sai trả `400 VALIDATION_ERROR`.

## Xem trước đơn và kiểm tra voucher

`POST /api/v1/orders/preview` yêu cầu Bearer token. Ví dụ body:

```json
{
  "items": [{ "variantId": "1", "qty": 1 }],
  "shippingMethod": "tietkiem",
  "voucherCode": "NOVA20K"
}
```

`items` gồm 1–50 SKU khác nhau; `variantId` là ID dạng chuỗi số dương và `qty` là số nguyên từ 1 đến 99. `shippingMethod` dùng một trong các mã ở bảng trên. `voucherCode` không bắt buộc, tối đa 32 ký tự; mã được chuẩn hóa chữ hoa.

Response thành công có `data` gồm `subtotal`, `shippingFee`, `discountAmount`, `total`, `voucherCode` (chuỗi hoặc `null`) và `shops` (mỗi shop có `shopId`, `shopName`, `subtotal`, `shippingFee`). Server đọc giá, tồn kho, trạng thái sản phẩm và voucher từ dữ liệu hiện tại; phí tính riêng từng shop và bằng 0 nếu shop có sản phẩm miễn phí vận chuyển hoặc tổng tiền hàng của shop từ 1.000.000 đồng.

Kết quả chỉ mang tính xem trước: **không giữ hàng, không giữ lượt voucher và không tạo đơn**. Giá, tồn kho, phí và điều kiện voucher được kiểm tra lại khi tạo đơn. Số tiền hoặc điều kiện có thể thay đổi giữa hai lần gọi.

Lỗi nghiệp vụ: `400 VALIDATION_ERROR`, `400 VOUCHER_INVALID`, `400 ORDER_AMOUNT_INVALID`; `409 PRODUCT_UNAVAILABLE`, `409 INSUFFICIENT_STOCK`, `409 VOUCHER_UNAVAILABLE`. Lỗi có dạng `{ "success": false, "message": "...", "error": { "code": "..." } }`.

## Tạo đơn

`POST /api/v1/orders` yêu cầu Bearer token và header `Idempotency-Key` gồm 16–64 ký tự chữ, số, `_` hoặc `-`. Body gồm `items`, `shippingMethod`, `voucherCode` tùy chọn, `paymentMethod: "cod"`, `address` với `fullName`, `phone`, `province`, `detail` và tùy chọn `district`, `ward`, cùng `note` tùy chọn.

Server kiểm tra dữ liệu, giá, kho và voucher; tạo đơn, trừ kho, ghi nhận voucher trong transaction. Tổng tiền từ client không được dùng làm nguồn tính tiền. Dùng cùng khóa với cùng nội dung khi thử lại; nếu dùng cùng khóa cho nội dung khác, API trả `409 IDEMPOTENCY_CONFLICT`. Response thành công có `data.order` với `subtotal`, `shippingFee`, `discount`, `total` và thông tin đơn. Phương thức thanh toán hiện được chấp nhận là COD.
