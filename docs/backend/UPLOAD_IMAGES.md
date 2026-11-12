# API tải ảnh

`POST /api/v1/uploads/images` yêu cầu Bearer token và JSON `{ "dataUrl": "data:image/png;base64,...", "purpose": "avatar" }`. Giá trị `purpose` có thể là `product`, `shop`, `review` hoặc `avatar`; `product` và `shop` yêu cầu vai trò seller hoặc admin. Mục đích không hợp lệ trả `400 INVALID_IMAGE_PURPOSE`; thiếu quyền trả `403 FORBIDDEN`.

API nhận JPEG, PNG, WebP; MIME khai báo phải khớp chữ ký byte và base64 chuẩn. Giới hạn sau giải mã: `product` và `shop` 5 MiB, `review` 2 MiB, `avatar` 1 MiB. Ảnh rỗng, sai định dạng, MIME không khớp hoặc quá giới hạn trả `400 INVALID_IMAGE`. Backend giải mã ảnh bằng sharp trước khi lưu; ảnh phải có một khung hình, rộng và cao không quá 4096 pixel, tổng không quá 16.000.000 pixel. Ảnh lỗi giải mã, nhiều khung hoặc vượt giới hạn trả `400 INVALID_IMAGE`. API lưu byte gốc, chưa resize hoặc chuyển WebP; ảnh đã lưu trước đây không được kiểm tra lại.

Client cũ có thể bỏ `purpose`: giữ giới hạn 5 MiB. Với ảnh không quá 1 MiB, server cấp URL avatar có gắn ID user. Ảnh trên 1 MiB vẫn upload được để tương thích client cũ nhưng không được gắn làm avatar mới. Chỉ ảnh được server đặt tên theo mẫu avatar của chính tài khoản được chấp nhận khi đổi avatar qua profile. Các avatar cũ và URL ngoài đã lưu có thể giữ nguyên, nhưng URL ngoài mới không được đặt qua profile; đăng nhập Google là luồng riêng. Đường dẫn đúng mẫu không chứng minh object còn tồn tại; cần kiểm tra khi hiển thị.

Với `purpose=review`, server cấp URL có gắn ID user, giới hạn 2 MiB. API tạo review nhận tối đa 5 URL loại này của chính người mua; Backend kiểm tra object tồn tại và kích thước trước khi gửi Data API, Data API lưu cùng review trong transaction. URL upload cũ không gắn chủ sở hữu không dùng để đính kèm review mới. Đọc ảnh qua URL công khai; API list review trả `images`. Storage có thể thay đổi sau khi kiểm tra, nên việc object tồn tại về sau không được đảm bảo. Không có chính sách xóa object mồ côi trong phạm vi này. Các URL tham chiếu ảnh Commons là luồng riêng và không được kiểm tra byte qua upload này.

Kiểm tra bằng `node scripts/test-upload-policy.mjs` trong `backend/` và `node scripts/test-avatar-policy.mjs` trong `data-api/`. Hai bài dùng mock cho dịch vụ phụ thuộc, không chứng minh MySQL hoặc object storage triển khai thật.

Kiểm tra tích hợp bằng `node data-api/scripts/test-avatar-mysql.mjs` từ root trên MySQL 8 cục bộ riêng. Cần đặt `AVATAR_MYSQL_TEST=1`, `AVATAR_DB_PORT`, `AVATAR_DB_PASSWORD`, tùy chọn `AVATAR_DB_USER` (mặc định `root`). Bài kiểm tra tự tạo rồi xóa database tên `shopnova_test_avatar_<timestamp>` và thư mục ảnh tạm; không dùng `.env` ứng dụng. Bài này chạy Backend → HTTP Data API → MySQL và phục vụ ảnh local; bài object storage dùng server S3 giả lập riêng.

## Ảnh sản phẩm và tương thích client

Ảnh sản phẩm mới cần upload với `purpose: "product"`; URL có dạng `/uploads/product-<userId>-<uuid>.<đuôi>`. Backend kiểm tra object tồn tại, là file và không quá 5 MiB trước khi lưu sản phẩm; Data API kiểm tra URL mới thuộc user đang sửa. Ảnh UUID cũ không mang owner chỉ được giữ lại trên đúng sản phẩm đã có ảnh đó; không được dùng cho sản phẩm khác. URL avatar do cùng seller tải theo client cũ vẫn được chấp nhận trong giai đoạn tương thích. Không tự xóa ảnh mồ côi.

Web seller gửi `purpose: "product"` khi tải ảnh sản phẩm. Các client cũ không gửi `purpose` vẫn cần cập nhật: ảnh trên 1 MiB của luồng cũ không có owner nên không được dùng làm ảnh sản phẩm mới. Ảnh cũ bị mất object sẽ cần tải lại trước khi lưu sản phẩm. Kiểm tra object chỉ phản ánh thời điểm lưu; object có thể bị xóa về sau.

## Tích hợp Cloudflare R2 (S3-compatible Object Storage)

Backend hỗ trợ lưu trữ đám mây S3/Cloudflare R2 qua AWS SDK v3 (`@aws-sdk/client-s3`). Cấu hình môi trường trong `backend/.env`:

- `UPLOAD_STORAGE=s3`
- `S3_BUCKET=shopnova-media`
- `S3_REGION=auto`
- `S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com`
- `S3_ACCESS_KEY_ID=<access_key_id>`
- `S3_SECRET_ACCESS_KEY=<secret_access_key>`
- `S3_FORCE_PATH_STYLE=false`

Kiểm tra kết nối và tính sẵn sàng của Object Storage bằng script:
`node backend/scripts/test-cloudflare-r2.mjs`

## Kiểm tra và khôi phục ảnh bị thiếu

Danh sách sản phẩm và file ảnh được lưu ở hai nơi khác nhau. URL còn trong database không chứng minh file còn trong bucket. Tương tự, `s3Ready` trong `/api/v1/ready` chỉ kiểm tra sự hiện diện của cấu hình; cần đọc một ảnh thật để xác nhận quyền truy cập kho ảnh.

Khi ảnh không hiển thị:

1. Đọc danh sách sản phẩm qua Backend với `fullImages=true`, phân trang bằng `limit` và `offset`. Kiểm tra từng URL ảnh, gồm các ảnh phụ và logo/banner shop dùng chung file.
2. Đối chiếu URL lỗi với đúng key trong bucket. Nếu object tồn tại nhưng Backend không đọc được, kiểm tra cấu hình và quyền R2 trên môi trường đang chạy. Nếu object không tồn tại, cần khôi phục file; thay khóa không tạo lại ảnh đã mất.
3. Tìm bản sao hoặc nguồn ảnh đã ghi nhận cho đúng sản phẩm. Đối chiếu mã/tên sản phẩm và thứ tự ảnh; kiểm tra MIME, khả năng giải mã, kích thước và checksum trước khi lưu. Không lấy ảnh sản phẩm khác để lấp chỗ trống.
4. Khôi phục file thiếu vào đúng key đang được tham chiếu. Với R2, dùng `PutObject` cùng `If-None-Match: *` để chỉ tạo object chưa có. Nếu nhận 412, object đã tồn tại: giữ nguyên và kiểm tra lại, không chuyển sang ghi đè. Xem [conditional operations của R2](https://developers.cloudflare.com/r2/api/s3/conditional-operations/).
5. Đọc lại ảnh qua Backend và domain web, xác nhận HTTP 200, Content-Type ảnh và nội dung khớp checksum đã chuẩn bị. Kiểm tra đủ ảnh của các sản phẩm liên quan, sau đó tải lại trang với cache bị vô hiệu hóa nếu trình duyệt còn giữ kết quả lỗi.

Giữ bản sao ảnh và bảng đối chiếu URL/key/nguồn/checksum trong nơi lưu trữ phù hợp. Không đưa credential, database dump hoặc bộ ảnh người dùng vào Git hay ZIP source. Thay đổi cấu hình kho ảnh không tự sao chép file từ filesystem hoặc bucket cũ.
