# Ảnh đánh giá sản phẩm

Buyer đã đăng nhập upload ảnh bằng `POST /api/v1/uploads/images` với `purpose: "review"`. Ảnh phải đáp ứng chính sách tại `UPLOAD_IMAGES.md`; URL có dạng `/uploads/review-<userId>-<uuid>.<đuôi>`. Sau đó gửi `images` là mảng từ 0 đến 5 URL khác nhau trong `POST /api/v1/products/:productId/reviews`, cùng `orderItemId`, `rating` và `comment`. Thiếu `images` tương đương mảng rỗng để tương thích client cũ.

Backend kiểm tra từng URL thuộc user trong token, đúng mẫu và object tồn tại, từ 1 byte đến 2 MiB. Data API kiểm tra lại mẫu/owner, quyền mua và trạng thái `delivered`; review và `review_images` được lưu trong cùng transaction. Sai ảnh trả 400 `INVALID_REVIEW_IMAGES`, lỗi truy cập storage khác trả 503 `IMAGE_STORAGE_UNAVAILABLE`. Chỉ nguồn upload có purpose review mới được đính kèm; URL cũ hoặc user khác không hợp lệ. `GET /api/v1/products/:productId/reviews` trả `images` trong mỗi review.

Kiểm tra object là tại thời điểm tạo review, không bảo đảm object không bị xóa về sau. Upload thành công nhưng không gắn review có thể tạo object mồ côi; chưa có cơ chế dọn dẹp. Không hỗ trợ thêm/xóa ảnh sau khi đã gửi review trong contract này. Triển khai S3 cần quyền HeadObject và GetObject cho các key tương ứng.
