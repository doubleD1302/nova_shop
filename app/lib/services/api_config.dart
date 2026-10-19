import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;
import 'package:http/http.dart' as http;

class ApiConfig {
  static String? _customBaseUrl;

  /// Địa chỉ Backend Production Online trên Render:
  /// Giúp app chạy trên điện thoại thật mọi lúc mọi nơi (4G, Wi-Fi ngoài, không cần cắm cáp USB vào máy tính)
  static const String productionUrl = 'https://novashop-api-952u.onrender.com';

  /// Địa chỉ IP máy tính trong mạng Wi-Fi LAN:
  /// Cho phép điện thoại hoạt động qua mạng Wi-Fi nội bộ chung với máy tính
  static const String lanHostUrl = 'http://192.168.1.11:3000';

  /// Địa chỉ loopback khi cắm cáp USB và chạy adb reverse:
  static const String usbLoopbackUrl = 'http://127.0.0.1:3000';

  /// Địa chỉ dành cho máy ảo Android Emulator:
  static const String emulatorUrl = 'http://10.0.2.2:3000';

  /// Cấu hình địa chỉ máy chủ mặc định:
  /// Mặc định trỏ về Render productionUrl để điện thoại khi rút cáp USB hoặc dùng mạng 4G/Wi-Fi
  /// đều kết nối thành công ngay lập tức!
  static String get defaultBaseUrl => productionUrl;

  static String get baseUrl => _customBaseUrl ?? defaultBaseUrl;

  static void setBaseUrl(String url) {
    _customBaseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
  }

  static void resetBaseUrl() {
    _customBaseUrl = null;
  }

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
      productionUrl,  // Backend Online Render (truy cập độc lập qua Wi-Fi / 4G không cần cắm cáp USB)
      usbLoopbackUrl, // Kiểm tra qua cáp USB (nếu có adb reverse)
      lanHostUrl,     // Kiểm tra qua Wi-Fi máy tính
      emulatorUrl,    // Kiểm tra máy ảo
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

  // Endpoints
  static String get healthUrl => '$baseUrl/api/v1/health';
  static String get readyUrl => '$baseUrl/api/v1/ready';
  static String get loginUrl => '$baseUrl/api/v1/auth/login';
  static String get registerUrl => '$baseUrl/api/v1/auth/register';
  static String get meUrl => '$baseUrl/api/v1/auth/me';
  static String get categoriesUrl => '$baseUrl/api/v1/categories';
  static String get productsUrl => '$baseUrl/api/v1/products';
  static String get bannersUrl => '$baseUrl/api/v1/banners';
  static String get shopsUrl => '$baseUrl/api/v1/shops';
  static String productDetailUrl(String id) => '$baseUrl/api/v1/products/$id';
  static String shopDetailUrl(String id) => '$baseUrl/api/v1/shops/$id';
  static String get cartUrl => '$baseUrl/api/v1/cart';
  static String cartItemUrl(String variantId) => '$baseUrl/api/v1/cart/$variantId';
  static String get ordersUrl => '$baseUrl/api/v1/orders';
  static String orderDetailUrl(String id) => '$baseUrl/api/v1/orders/$id';
  static String get updateProfileUrl => '$baseUrl/api/v1/auth/profile';
  static String get changePasswordUrl => '$baseUrl/api/v1/auth/change-password';
  static String get userStatsUrl => '$baseUrl/api/v1/auth/stats';
}
