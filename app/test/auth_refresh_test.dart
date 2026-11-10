import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/services/api_client.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/services/session_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('Đăng nhập không lưu mật khẩu và refresh để gọi API', () async {
    HttpOverrides.global = null;
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    ApiConfig.setBaseUrl('http://127.0.0.1:${server.port}');
    final user = {'id': '1', 'username': 'buyer', 'fullName': 'Buyer', 'role': 'buyer'};
    var refreshCount = 0;
    final revoked = <String>[];
    final refreshStarted = Completer<void>();
    final releaseRefresh = Completer<void>();
    server.listen((request) async {
      request.response.headers.contentType = ContentType.json;
      if (request.uri.path.endsWith('/login')) {
        await utf8.decoder.bind(request).join();
        request.response.write(jsonEncode({'success': true, 'data': {'token': 'old-access', 'refreshToken': 'old-refresh', 'user': user}}));
      } else if (request.uri.path.endsWith('/refresh')) {
        refreshCount++;
        final body = jsonDecode(await utf8.decoder.bind(request).join());
        expect(body['refreshToken'], refreshCount == 1 ? 'old-refresh' : 'new-refresh');
        if (refreshCount == 2) { refreshStarted.complete(); await releaseRefresh.future; }
        request.response.write(jsonEncode({'success': true, 'data': {'token': 'new-access', 'refreshToken': refreshCount == 1 ? 'new-refresh' : 'late-refresh', 'user': user}}));
      } else if (request.uri.path.endsWith('/logout')) {
        final body = jsonDecode(await utf8.decoder.bind(request).join());
        if (body['refreshToken'] is String) revoked.add(body['refreshToken']);
        request.response.write(jsonEncode({'success': true}));
      } else if (request.headers.value('authorization') == 'Bearer old-access') {
        request.response.statusCode = 401;
        request.response.write(jsonEncode({'success': false, 'error': {'code': 'AUTH_INVALID'}}));
      } else {
        request.response.write(jsonEncode({'success': true, 'data': {}}));
      }
      await request.response.close();
    });
    final auth = AuthService();
    try {
      await Future<void>.delayed(const Duration(milliseconds: 50));
      expect(await auth.login('buyer', 'private-test-password'), isTrue);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.containsKey(SessionStore.legacyCredentialsKey), isFalse);
      expect(prefs.containsKey(SessionStore.accessKey), isFalse);
      expect(prefs.containsKey(SessionStore.refreshKey), isFalse);
      expect((await ApiClient().get('/api/v1/protected')).success, isTrue);
      expect(refreshCount, 1);
      final secure = const FlutterSecureStorage();
      expect(await secure.read(key: SessionStore.accessKey), 'new-access');
      expect(await secure.read(key: SessionStore.refreshKey), 'new-refresh');
      final pendingRefresh = auth.refreshSession();
      await refreshStarted.future;
      auth.logout();
      releaseRefresh.complete();
      expect(await pendingRefresh, isFalse);
      expect(revoked, contains('late-refresh'));
      await Future<void>.delayed(const Duration(milliseconds: 30));
      expect(await secure.read(key: SessionStore.accessKey), isNull);
      expect(await secure.read(key: SessionStore.refreshKey), isNull);
    } finally {
      auth.logout();
      await Future<void>.delayed(const Duration(milliseconds: 30));
      ApiConfig.resetBaseUrl();
      await server.close(force: true);
    }
  });
}
