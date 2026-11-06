# Thanh toán online và cước ShopNova

## Trạng thái

Backend có mã tạo liên kết VNPay/MoMo và nhận IPN, nhưng mặc định tắt bằng `PAYMENT_GATEWAYS_ENABLED=false`.
Chỉ bật sau khi có tài khoản đối tác, chạy migration `2026-11-06-online-payments.sql` trên môi trường đã xác định,
đăng ký callback và kiểm thử sandbox với hai cổng. Không coi test chữ ký bằng dữ liệu giả là giao dịch thật.
Không có tự động hoàn tiền hoặc đối soát định kỳ; đơn đã thanh toán bị chặn hủy trực tiếp và cần quy trình hoàn tiền riêng.
Giao dịch không rõ kết quả được ghi `review` hoặc chặn tạo lượt mới để tránh thu hai lần.

## API

| Method/path | Quyền | Tác dụng |
|---|---|---|
| `POST /api/v1/orders` | Buyer | Tạo đơn COD, MoMo hoặc VNPay. Trả 503 cho cổng chưa bật/cấu hình. Tiền được tính trên Data API. |
| `POST /api/v1/orders/:orderId/payment-session` | Chủ đơn | Tạo hoặc dùng lại lượt thanh toán còn hạn, trả `paymentUrl` và số tiền. |
| `GET /api/v1/orders/:orderId/payment-status` | Chủ đơn | Đọc trạng thái thanh toán từ database. |
| `GET /api/v1/payments/vnpay/ipn` | VNPay | Kiểm tra HMAC SHA-512, mã đối tác, tham chiếu, số tiền và mã giao dịch; trả `RspCode`. |
| `POST /api/v1/payments/momo/ipn` | MoMo | Kiểm tra HMAC SHA-256 và dữ liệu giao dịch; trả HTTP 204 sau khi ghi nhận. |
| `GET /api/v1/admin/payments/review-queue` | Admin | Liệt kê giao dịch cần đối chiếu thủ công hoặc hết hạn chưa có kết quả. |

Thông báo từ gateway được xác minh ở Backend rồi mới chuyển vào Data API bằng service key. Data API đối chiếu
tham chiếu, phương thức, số tiền và trạng thái trong transaction; callback lặp với cùng giao dịch không thu thêm.
Redirect của trình duyệt chỉ để hiển thị; không đánh dấu `paid`. Seller không thể xác nhận đơn online chưa `paid`.

Các biến môi trường mẫu nằm trong `backend/.env.example`. `VNPAY_PAYMENT_URL` và `MOMO_API_URL` phải là URL
do đối tác cung cấp; production yêu cầu HTTPS. Bí mật chỉ đặt trong môi trường Backend.
MoMo yêu cầu thời gian chờ tối thiểu 30 giây cho API khởi tạo; timeout của ứng dụng gọi API này cần lớn hơn 35 giây.

## Cước vận chuyển

Data API tính cước cho từng shop từ tỉnh gửi của shop, tỉnh nhận của đơn, khối lượng ước tính theo danh mục,
và giờ đặt theo `Asia/Ho_Chi_Minh`. Khoảng cách là **dải ước tính**: cùng tỉnh 20 km, cùng miền 250 km,
hai miền kề nhau 700 km, Bắc–Nam hoặc nơi chưa nhận diện 1500 km. Công thức gốc:

`12.000 + 15 × km ước tính + 2.500 × số kg làm tròn lên + phụ phí thời tiết` (VND),
nhân hệ số dịch vụ 1 / 1,4 / 1,8 rồi làm tròn lên 1.000 VND. Gói nhanh và hỏa tốc thêm 2.000 VND
ngoài 18:00–06:00. Miễn phí khi shop có sản phẩm miễn ship hoặc tiền hàng shop đạt 1.000.000 VND.
Đây là giá của ShopNova, không phải giá hay vận đơn SPX.

Nếu cấu hình khóa thương mại `WEATHER_API_KEY` ở Data API, ứng dụng lấy mưa/gió hiện tại từ
Open-Meteo tại điểm đại diện mỗi miền, lưu cache 10 phút, cộng 2.000 hoặc 5.000 VND khi có rủi ro.
Thiếu khóa hoặc dịch vụ dự báo lỗi thì không có phụ phí thời tiết. Điểm đại diện miền chỉ là ước tính;
không phản ánh chính xác thời tiết tại địa chỉ giao hàng. Open-Meteo yêu cầu gói thương mại cho ứng dụng thương mại
và ghi nguồn dữ liệu theo giấy phép của họ.

Frontend cần gọi preview/quote và hiển thị số tiền server trả về trước khi đặt đơn; giá cố định đang viết trong web
có thể khác. Checkout luôn tính lại phí, giá và voucher trong transaction từ dữ liệu server.

Tài liệu đối tác: [VNPay](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html),
[MoMo tạo thanh toán](https://developers.momo.vn/v3/vi/docs/payment/api/wallet/onetime/),
[MoMo IPN](https://developers.momo.vn/v3/docs/payment/api/result-handling/notification/),
[Open-Meteo thương mại](https://open-meteo.com/en/pricing).
