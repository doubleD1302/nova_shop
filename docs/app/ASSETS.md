# Icon và Nova trên Android

Ứng dụng người mua trong `app/` dùng cùng dấu Nova, minh họa và nét vẽ danh mục với web. Tên và slug danh mục vẫn từ API; ảnh sản phẩm, giá, tồn kho và luồng nghiệp vụ không đổi.

## Asset và component

- `app/assets/images/nova-mark.svg`, `nova-notes.svg`: bản SVG giống byte với `public/images/` của web.
- `app/assets/icons/`: 15 hình danh mục, lấy cùng path SVG trong `src/components/ui/Icons.jsx`. Slug/alias được ánh xạ tại `app/lib/widgets/common/category_icon.dart`; danh mục mới dùng icon lưới.
- `nova_assets.dart`: component dùng dấu Nova và minh họa trạng thái trống. Logo cửa hàng vẫn dùng asset riêng.
- `flutter_svg` hiển thị các SVG trực tiếp để giữ nét ở nhiều kích thước. Phiên bản và dependency liên quan được khóa trong `pubspec.lock`; không cần font icon hoặc dịch vụ ảnh cho các asset này.

Khi thay hình, cập nhật cả bản web và bản SVG tương ứng trong app. Không đặt tên danh mục hoặc dữ liệu sản phẩm vào SVG. Icon trang trí được loại khỏi cây semantics; nút thao tác có tooltip.

## Giao diện Nova

Header và tab Nova dùng chữ N trong khung hội thoại. Trạng thái trống, màu kem–nâu, tin nhắn, thẻ sản phẩm/đơn và ô nhập theo thiết kế web. Không dùng huy hiệu 24/7 hoặc trạng thái trực tuyến không có dữ liệu xác nhận; giao diện vẫn ghi rõ trợ lý sử dụng AI. Không chèn tin nhắn/câu hỏi mẫu.

Scaffold xử lý bàn phím, không cộng thêm `viewInsets.bottom` lần nữa. Nội dung trống cuộn được; danh mục và khối thông tin tự nới chiều cao khi tăng cỡ chữ. Gửi rỗng/đang chờ bị khóa. Lịch sử, phân trang, sản phẩm, đơn, giỏ, phản hồi, thông tin đã ghi nhớ và tạo cuộc trò chuyện mới giữ các endpoint cũ. `NovaAIScreen.httpClient` có thể nhận client thử; client do màn hình tự tạo được đóng khi dispose.

Không bổ sung tính năng nhập giọng nói cho Android trong thay đổi giao diện này.

## Kiểm tra và build

Từ `app/`:

```sh
flutter pub get
flutter test test/nova_ai_screen_test.dart test/category_assets_test.dart test/nova_logo_test.dart test/quick_links_section_test.dart test/website_sync_flash_search_test.dart
flutter analyze lib/screens/nova_ai/nova_ai_screen.dart lib/screens/main_screen.dart lib/widgets/common/nova_assets.dart lib/widgets/common/category_icon.dart lib/widgets/common/shopnova_app_bar.dart lib/widgets/home/category_grid.dart lib/widgets/home/commitment_strip.dart test/nova_ai_screen_test.dart test/category_assets_test.dart
flutter build apk --debug --dart-define=API_BASE_URL=https://novashop-api-952u.onrender.com
```

Widget test kiểm tra SVG, màn hình nhỏ/cỡ chữ lớn, bàn phím, trạng thái chờ/lỗi và thẻ dữ liệu. HTTP chat dùng mock; không coi đó là kiểm chứng mô hình hoặc thử trên điện thoại thật. APK debug dùng cho cài thử, không phải bản phát hành cửa hàng.
