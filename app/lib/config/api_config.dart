
/**
 * Cấu hình endpoint API kết nối tới Backend ShopNova.
 *
 * Hướng dẫn chạy:
 * - Khi chạy máy ảo Android Emulator: dùng http://10.0.2.2:3000 (đại diện cho localhost của máy tính).
 * - Khi chạy iOS Simulator / macOS / Windows / Web: dùng http://localhost:3000.
 * - Khi kết nối tới Backend online (Render): dùng https://novashop-api.onrender.com (hoặc truyền qua --dart-define).
 */
class ApiConfig {
  /// Base URL Backend API mặc định
  /// Có thể ghi đè lúc build: flutter run --dart-define=API_BASE_URL=https://novashop-api.onrender.com
  static const String _overrideBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// URL Render đã deploy (hoạt động trực tiếp trên cả máy ảo lẫn điện thoại thật có internet)
  static const String productionUrl = 'https://novashop-api.onrender.com';

  /// URL cho Android Emulator kết nối local Backend port 3000
  static const String androidEmulatorUrl = 'http://10.0.2.2:3000';

  /// URL cho iOS Simulator hoặc Desktop local
  static const String localHostUrl = 'http://localhost:3000';

  /// Lấy Base URL phù hợp với môi trường đang chạy
  static String get baseUrl {
    if (_overrideBaseUrl.isNotEmpty) {
      return _overrideBaseUrl.replaceAll(RegExp(r'/+$'), '');
    }

    // Mặc định ưu tiên server Render online để chạy ngay không cần mở Backend local
    // Nếu muốn chuyển sang Backend local, bạn chỉ cần sửa giá trị dưới đây
    return productionUrl;
  }

  /// Thời gian chờ request tối đa (10 giây)
  static const Duration timeout = Duration(seconds: 10);
}
