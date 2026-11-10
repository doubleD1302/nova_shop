# Nâng cấp SQLite local

SQLite chỉ dùng khi cố ý bật fallback ngoài production. Script dưới đây phục vụ database tạo từ bản local cũ; nó không kết nối MySQL và không được tự chạy trên database dùng chung.

Dừng tiến trình đang sử dụng file. Từ `data-api/` chạy:

```sh
node scripts/upgrade-local-db.mjs <duong-dan-file-sqlite>
```

Script tạo bản sao nhất quán `<file>.before-upgrade` bằng `VACUUM INTO`, dừng nếu bản sao đã tồn tại, rồi thêm các cột thiếu trong transaction. `cart_items.qty` được chuyển từ `quantity`; `order_items.unit_price` và `line_total` được tính từ giá và số lượng đã lưu. Các thông tin lịch sử không suy ra chắc chắn để `NULL`; cần đối chiếu dữ liệu trước khi sử dụng chúng. Script không tái dựng constraint, index hay giả định dữ liệu cho các cột cũ. Khi Data API khởi động, các bảng mới còn thiếu được tạo theo định nghĩa SQLite local.

Nếu có sự cố, giữ lại cả hai file để kiểm tra. Khi đã dừng dịch vụ và xác định bản sao đúng, có thể phục hồi từ bản sao bằng quy trình sao lưu của môi trường. Không thay file database đang mở.

`node scripts/test-upgrade-local.mjs` kiểm tra trên file tạm: giữ dữ liệu, sao lưu và từ chối ghi đè backup. Không phải kiểm thử MySQL.
