import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/services/session_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('Seller registration keeps profile and stores the returned session securely', () async {
    HttpOverrides.global = null;
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    ApiConfig.setBaseUrl('http://127.0.0.1:${server.port}');
    final requests = <String, Map<String, dynamic>>{};
    server.listen((request) async {
      request.response.headers.contentType = ContentType.json;
      final raw = await utf8.decoder.bind(request).join();
      if (request.uri.path.endsWith('/register') || request.uri.path.endsWith('/seller-shop')) {
        requests[request.uri.path] = jsonDecode(raw) as Map<String, dynamic>;
        request.response.write(jsonEncode({'success': true, 'data': {
          'token': 'access', 'refreshToken': 'refresh', 'shopStatus': 'pending',
          'user': {'id': '1', 'username': 'buyer', 'fullName': 'Buyer', 'role': 'seller'},
        }}));
      } else {
        request.response.write(jsonEncode({'success': true, 'data': {}}));
      }
      await request.response.close();
    });
    final auth = AuthService();
    try {
      await Future<void>.delayed(const Duration(milliseconds: 30));
      final profile = {'province': 'Hà Nội', 'shippingMethods': ['standard']};
      expect(await auth.register(username: 'buyer', password: 'test-password', fullName: 'Buyer', role: 'seller', shopName: 'Shop', sellerProfile: profile), isTrue);
      expect(requests['/api/v1/auth/register']?['sellerProfile'], profile);
      expect(await auth.registerSellerShop(shopName: 'Shop', tagline: 'Mới', sellerProfile: profile), isTrue);
      expect(requests['/api/v1/auth/seller-shop']?['sellerProfile'], profile);
      expect(requests['/api/v1/auth/seller-shop']?['shopTagline'], 'Mới');
      expect(await const FlutterSecureStorage().read(key: SessionStore.refreshKey), 'refresh');
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.containsKey(SessionStore.legacyCredentialsKey), isFalse);
    } finally {
      await auth.logout();
      ApiConfig.resetBaseUrl();
      await server.close(force: true);
    }
  });
}
