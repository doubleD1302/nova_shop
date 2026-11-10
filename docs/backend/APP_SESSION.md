# Phiên đăng nhập app buyer

Access và refresh token được chuyển từ SharedPreferences sang kho bảo mật hệ điều hành. Khi khôi phục phiên, app xóa bản ghi mật khẩu cũ; đăng nhập và đăng ký không lưu lại mật khẩu. Chỉ xóa token cũ sau khi ghi sang kho bảo mật thành công.

Khi Backend trả 401 AUTH_EXPIRED hoặc AUTH_INVALID, API client dùng một lần refresh chung cho các request đồng thời rồi thử lại request đã bị từ chối xác thực. Không tự dò sang Backend khác sau lỗi mạng khi có token. Gửi đánh giá không tự lặp khi không nhận phản hồi; lỗi kiểm tra quyền được hiển thị và nội dung nhập được giữ lại.

Các test Flutter dùng kho bảo mật giả và HTTP cục bộ; cần kiểm tra Android/iOS thật, nâng cấp APK và refresh với Backend thật trước release. Khi kho bảo mật không khả dụng có thể cần đăng nhập lại.

Phiên được vô hiệu ngay khi đăng xuất/đổi tài khoản; các thao tác ghi/xóa kho bảo mật được tuần tự hóa. Android tắt sao lưu ứng dụng qua `allowBackup=false`; cần xác nhận tác động sao lưu và thử nâng cấp APK thật. iOS/macOS có cấu hình entitlement cho Keychain; cần kiểm tra ký và chạy trên thiết bị tương ứng.

Nếu phản hồi refresh đến sau khi phiên đã đổi, app cố gắng thu hồi refresh token mới tại Backend ban đầu. Đây là cơ chế best effort: mất phản hồi, mất mạng hoặc app bị dừng vẫn có thể để token còn hiệu lực; backend chưa có cơ chế thu hồi toàn bộ chuỗi phiên (session family).
