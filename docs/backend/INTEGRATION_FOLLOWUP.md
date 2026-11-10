# Các tích hợp cần nhà cung cấp

ShopNova chưa chọn đối tác vận chuyển và chi trả. Cước hiện tính nội bộ; cần chọn hãng, sandbox, hợp đồng, xác thực webhook, chống lặp và đối soát trước khi kết nối thật. API chi trả demo không chuyển tiền; cần thiết kế sổ cái, hoàn tiền và trạng thái với đối tác được chọn.

VNPay/MoMo có code ký và IPN, mặc định tắt. Test chữ ký dùng khóa giả, không gọi cổng thật. Cần kiểm thử sandbox, callback lặp/chậm, chữ ký, số tiền và đối soát trước khi bật.
