import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/**
 * Cấu hình endpoint API kết nối tới Backend ShopNova.
 *
 * Hướng dẫn chạy:
 * - Khi chạy máy ảo Android Emulator: dùng http://10.0.2.2:3000 (đại diện cho localhost của máy tính).
 * - Khi chạy iOS Simulator / macOS / Windows / Web: dùng http://localhost:3000.
 * - Khi kết nối tới Backend online (Render): dùng https://novashop-api-952u.onrender.com (hoặc truyền qua --dart-define).
 */
class ApiConfig {
  static String? _customBaseUrl;

  /// Cho phép ghi đè lúc build: flutter run --dart-define=API_BASE_URL=https://novashop-api-952u.onrender.com
  static const String _overrideBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// Địa chỉ Backend Production Online trên Render:
  static const String productionUrl = 'https://novashop-api-952u.onrender.com';

  /// Địa chỉ IP máy tính trong mạng Wi-Fi LAN:
  static const String lanHostUrl = 'http://192.168.1.9:3000';
  static const String altLanHostUrl = 'http://192.168.1.11:3000';

  /// Địa chỉ loopback khi cắm cáp USB và chạy adb reverse:
  static const String usbLoopbackUrl = 'http://127.0.0.1:3000';

  /// Địa chỉ dành cho máy ảo Android Emulator kết nối local Backend port 3000:
  static const String emulatorUrl = 'http://10.0.2.2:3000';

  /// Địa chỉ loopback chuẩn cho desktop / simulator:
  static const String localHostUrl = 'http://localhost:3000';

  /// Cấu hình địa chỉ máy chủ mặc định
  static String get defaultBaseUrl {
    if (_overrideBaseUrl.isNotEmpty) {
      return _overrideBaseUrl.replaceAll(RegExp(r'/+$'), '');
    }
    return usbLoopbackUrl;
  }

  /// Base URL hiện tại đang sử dụng
  static String get baseUrl => _customBaseUrl ?? defaultBaseUrl;

  /// Thiết lập Base URL tùy chỉnh
  static void setBaseUrl(String url) {
    _customBaseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
  }

  /// Đặt lại Base URL về mặc định
  static void resetBaseUrl() {
    _customBaseUrl = null;
  }

  /// Chuyển đổi đường dẫn ảnh tương đối (ví dụ: /uploads/...) thành URL đầy đủ
  static String resolveImageUrl(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final cleanPath = path.startsWith('/') ? path : '/$path';
    return '$baseUrl$cleanPath';
  }

  /// Thời gian chờ request tối đa (10 giây)
  static const Duration timeout = Duration(seconds: 10);

  /// Tự động dò tìm địa chỉ máy chủ đang hoạt động:
  /// - Kiểm tra nhanh kết nối USB nội bộ (nếu đang cắm cáp debug)
  /// - Kiểm tra nhanh LAN máy tính
  /// - Backend Online Render (cho phép truy cập độc lập không phụ thuộc máy tính)
  /// - Máy ảo Android Emulator
  static Future<String> autoDetectBaseUrl() async {
    if (_customBaseUrl != null) return _customBaseUrl!;

    if (kIsWeb) {
      _customBaseUrl = productionUrl;
      return productionUrl;
    }

    final candidates = [
      usbLoopbackUrl, // Cáp USB adb reverse (http://127.0.0.1:3000)
      lanHostUrl,     // Wi-Fi LAN (http://192.168.1.9:3000)
      altLanHostUrl,  // Wi-Fi LAN phụ (http://192.168.1.11:3000)
      emulatorUrl,    // Máy ảo Android (http://10.0.2.2:3000)
      productionUrl,  // Backend Render Online
    ];

    for (final url in candidates) {
      try {
        final timeoutMs = url == productionUrl ? 4000 : 1200;
        final res = await http
            .get(Uri.parse('$url/api/v1/health'))
            .timeout(Duration(milliseconds: timeoutMs));
        if (res.statusCode == 200) {
          _customBaseUrl = url;
          debugPrint('[ApiConfig] Đã kết nối tự động thành công tới máy chủ: $url');
          return url;
        }
      } catch (_) {}
    }

    return defaultBaseUrl;
  }

  // --- Endpoints danh mục và nghiệp vụ ---
  static String get healthUrl => '$baseUrl/api/v1/health';
  static String get readyUrl => '$baseUrl/api/v1/ready';
  static String get loginUrl => '$baseUrl/api/v1/auth/login';
  static String get googleLoginUrl => '$baseUrl/api/v1/auth/google';
  static String get demoAccountsUrl => '$baseUrl/api/v1/auth/demo-accounts';
  static String get registerUrl => '$baseUrl/api/v1/auth/register';
  static String get refreshUrl => '$baseUrl/api/v1/auth/refresh';
  static String get logoutUrl => '$baseUrl/api/v1/auth/logout';
  static String get meUrl => '$baseUrl/api/v1/auth/me';
  static String get sellerShopUrl => '$baseUrl/api/v1/auth/seller-shop';
  static String get categoriesUrl => '$baseUrl/api/v1/categories';
  static String get productsUrl => '$baseUrl/api/v1/products';
  static String get shopsUrl => '$baseUrl/api/v1/shops';
  static String productDetailUrl(String id) => '$baseUrl/api/v1/products/$id';
  static String shopDetailUrl(String id) => '$baseUrl/api/v1/shops/$id';
  static String get cartUrl => '$baseUrl/api/v1/cart';
  static String get cartItemsUrl => '$baseUrl/api/v1/cart/items';
  static String get cartSyncUrl => '$baseUrl/api/v1/cart/sync';
  static String get cartSelectionUrl => '$baseUrl/api/v1/cart/selection';
  static String cartItemUrl(String itemId) => '$baseUrl/api/v1/cart/items/$itemId';
  static String get ordersUrl => '$baseUrl/api/v1/orders';
  static String get shippingCalculateUrl => '$baseUrl/api/v1/shipping/calculate';
  static String get updateProfileUrl => '$baseUrl/api/v1/auth/profile';
  static String get changePasswordUrl => '$baseUrl/api/v1/auth/change-password';
  static String get vouchersUrl => '$baseUrl/api/v1/vouchers';
  static String get chatConversationsUrl => '$baseUrl/api/v1/chat/conversations';
  static String get aiBrainProfileUrl => '$baseUrl/api/v1/ai/brain/profile';
  static String get aiBrainFeedbackUrl => '$baseUrl/api/v1/ai/brain/feedback';
  static String get aiBrainResetUrl => '$baseUrl/api/v1/ai/brain/reset';
}
