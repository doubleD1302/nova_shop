import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiConfig {
  static String? _customBaseUrl;
  static const String _overrideBaseUrl = String.fromEnvironment('API_BASE_URL');

  static const String usbLoopbackUrl = 'http://127.0.0.1:3000';
  static const String lanHostUrl = 'http://192.168.1.9:3000';
  static const String altLanHostUrl = 'http://192.168.1.11:3000';
  static const String emulatorUrl = 'http://10.0.2.2:3000';
  static const String productionUrl = 'https://novashop-api-952u.onrender.com';
  static const String localHostUrl = 'http://localhost:3000';

  static String get defaultBaseUrl {
    if (_overrideBaseUrl.isNotEmpty) {
      return _overrideBaseUrl.replaceAll(RegExp(r'/+$'), '');
    }
    return usbLoopbackUrl;
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

  static Future<String> autoDetectBaseUrl() async {
    if (_customBaseUrl != null) return _customBaseUrl!;

    final candidates = [
      usbLoopbackUrl,
      lanHostUrl,
      altLanHostUrl,
      emulatorUrl,
      productionUrl,
    ];

    for (final candidate in candidates) {
      try {
        final timeoutMs = candidate == productionUrl ? 3500 : 800;
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
