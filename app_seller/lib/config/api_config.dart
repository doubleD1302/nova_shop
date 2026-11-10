import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiConfig {
  static String? _customBaseUrl;
  static const String _overrideBaseUrl = String.fromEnvironment('API_BASE_URL');

  static const String productionUrl = 'https://novashop-api-952u.onrender.com';
  static const String usbLoopbackUrl = 'http://127.0.0.1:3000';
  static const String lanHostUrl = 'http://10.39.18.75:3000';
  static const String altLanHostUrl = 'http://192.168.1.9:3000';
  static const String emulatorUrl = 'http://10.0.2.2:3000';
  static const String localHostUrl = 'http://localhost:3000';

  static String get defaultBaseUrl {
    if (_overrideBaseUrl.isNotEmpty) {
      return _overrideBaseUrl.replaceAll(RegExp(r'/+$'), '');
    }
    return productionUrl;
  }

  static String get baseUrl => _customBaseUrl ?? defaultBaseUrl;

  static void setBaseUrl(String url) {
    _customBaseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
  }

  static void resetBaseUrl() {
    _customBaseUrl = null;
  }

  static String url(String path) {
    final cleanPath = path.startsWith('/') ? path : '/$path';
    return '$baseUrl$cleanPath';
  }

  static String resolveImageUrl(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final cleanPath = path.startsWith('/') ? path : '/$path';
    return '$baseUrl$cleanPath';
  }

  static Future<String> autoDetectBaseUrl() async {
    if (_customBaseUrl != null) return _customBaseUrl!;

    final candidates = [
      usbLoopbackUrl, // Khi cắm cáp USB (adb reverse), ưu tiên kết nối máy chủ phát triển cục bộ ngay lập tức
      productionUrl,  // Khi không cắm cáp USB, tự động kết nối máy chủ Cloud Render đồng bộ với website
      lanHostUrl,
      altLanHostUrl,
      emulatorUrl,
    ];

    for (final candidate in candidates) {
      try {
        final timeoutMs = candidate == productionUrl ? 5000 : 1500;
        final res = await http
            .get(Uri.parse('$candidate/api/v1/health'))
            .timeout(Duration(milliseconds: timeoutMs));
        if (res.statusCode == 200) {
          _customBaseUrl = candidate;
          debugPrint('[ApiConfig] Kết nối thành công máy chủ thực: $candidate');
          return candidate;
        }
      } catch (_) {}
    }

    return defaultBaseUrl;
  }
}
