import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/services/api_client.dart';
import 'package:shopnova/services/session_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Chuyển token cũ sang kho bảo mật và xóa mật khẩu cũ', () async {
    SharedPreferences.setMockInitialValues({
      SessionStore.accessKey: 'old-access', SessionStore.refreshKey: 'old-refresh',
      SessionStore.legacyCredentialsKey: 'old-password-record',
    });
    FlutterSecureStorage.setMockInitialValues({});
    final store = SessionStore();
    expect(await store.read(SessionStore.accessKey), 'old-access');
    expect(await store.read(SessionStore.refreshKey), 'old-refresh');
    await store.removeLegacyCredentials();
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.containsKey(SessionStore.accessKey), isFalse);
    expect(prefs.containsKey(SessionStore.refreshKey), isFalse);
    expect(prefs.containsKey(SessionStore.legacyCredentialsKey), isFalse);
    expect(await const FlutterSecureStorage().read(key: SessionStore.accessKey), 'old-access');
  });

  test('Làm mới token một lần khi nhiều request bị từ chối', () async {
    HttpOverrides.global = null;
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    ApiConfig.setBaseUrl('http://127.0.0.1:${server.port}');
    final client = ApiClient();
    await client.saveToken('expired-token');
    var refreshes = 0;
    client.sessionRefresher = () async {
      refreshes++;
      await Future<void>.delayed(const Duration(milliseconds: 80));
      await client.saveToken('new-token');
      return true;
    };
    server.listen((request) async {
      request.response.headers.contentType = ContentType.json;
      if (request.headers.value('authorization') == 'Bearer expired-token') {
        request.response.statusCode = 401;
        request.response.write(jsonEncode({'success': false, 'error': {'code': 'AUTH_EXPIRED'}}));
      } else {
        request.response.write(jsonEncode({'success': true, 'data': {}}));
      }
      await request.response.close();
    });
    try {
      final responses = await Future.wait([client.get('/a'), client.get('/b')]);
      expect(responses.every((response) => response.success), isTrue);
      expect(refreshes, 1);
    } finally {
      client.sessionRefresher = null;
      await client.clearToken();
      ApiConfig.resetBaseUrl();
      await server.close(force: true);
    }
  });
}
