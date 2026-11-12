# Biểu tượng và giao diện Nova

## Bộ biểu tượng

`src/components/ui/Icons.jsx` chứa SVG 24 × 24, nét 1.8, đầu và góc nét bo tròn. Icon dùng `currentColor`, không cần thư viện hoặc font icon. Dùng kích thước 16–20 px cho thao tác và 24–28 px cho danh mục. Nút chỉ có icon cần `aria-label`; hình trang trí dùng `alt=""` hoặc `aria-hidden`.

`CategoryIcon.jsx` ánh xạ slug API và các alias hiện có sang cùng bộ biểu tượng. Slug chưa có icon riêng dùng biểu tượng lưới. Trang chủ và phần khám phá dùng chung component này; tên, đường dẫn và số lượng sản phẩm vẫn lấy từ catalog API. Không thay ảnh sản phẩm bằng biểu tượng.

## Asset Nova

| File | Công dụng |
| --- | --- |
| `public/images/nova-mark.svg` | Chữ N trong khung hội thoại, dùng ở header, nút mở chat và đầu câu trả lời. ViewBox 48 × 48, hiển thị từ 20 đến 48 px. |
| `public/images/nova-notes.svg` | Minh họa trạng thái chưa có tin nhắn, gồm thẻ sản phẩm và ghi chú. ViewBox 240 × 164. |

Các hình được vẽ bằng SVG trong source, không cần dịch vụ tạo ảnh hoặc tải font ngoài. Màu chính: nâu `#80513B`, đất nung `#BD6E49`, nền kem `#FFFCF7`, đường viền `#E6D5C2`; xanh `#547653` dùng cho trạng thái đã thực hiện. Logo cửa hàng vẫn là asset riêng.

## Giao diện trò chuyện

`NovaAiCopilot.jsx` dùng chung cho cửa sổ nổi và `/nova-ai`. Kiểu hiển thị nằm ở nhóm `.nova-*` trong `src/index.css`. Cửa sổ nổi bị giới hạn theo chiều cao viewport; trang riêng ẩn sidebar trên màn hình nhỏ. `MainLayout.jsx` không gắn thêm cửa sổ nổi khi đang ở trang Nova.

Khi mới mở, khung chat hiển thị minh họa và hướng dẫn nhập, không chèn tin nhắn giả. Giao diện ghi rõ Nova sử dụng AI; không dùng trạng thái trực tuyến hoặc nhãn thời gian phục vụ không có dữ liệu xác nhận. Nút gửi bị khóa khi rỗng/đang gửi; phản hồi, sản phẩm, ngân sách và thông tin đơn tiếp tục dùng contract API hiện có. Escape đóng cửa sổ nổi và trả focus về nút mở.

Kiểm tra thay đổi bằng `npm run build`, sau đó kiểm tra desktop/mobile: mở từ header và nút nổi, nhập/gửi, trạng thái chờ/lỗi, sản phẩm, phản hồi hữu ích và trang Nova riêng. Phản hồi HTTP giả lập chỉ kiểm tra giao diện, không chứng minh chất lượng câu trả lời của mô hình. Giọng nói phụ thuộc trình duyệt và quyền microphone.
