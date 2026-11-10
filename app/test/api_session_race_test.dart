import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/services/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final client = ApiClient();
  late HttpServer server;
  setUp(() async {
    HttpOverrides.global = null;
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    await client.clearToken();
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    ApiConfig.setBaseUrl('http://127.0.0.1:${server.port}');
    await client.saveToken('old-token');
  });
  tearDown(() async {
    client.sessionRefresher = null;
    await client.clearToken();
    await server.close(force: true);
    ApiConfig.resetBaseUrl();
  });

  test(
    'A late 401 reuses the refreshed token without a second refresh',
    () async {
      final bothOld = Completer<void>(), refreshed = Completer<void>();
      var oldRequests = 0, refreshes = 0, retries = 0;
      client.sessionRefresher = () async {
        refreshes++;
        await client.saveToken('new-token');
        refreshed.complete();
        return true;
      };
      server.listen((request) async {
        request.response.headers.contentType = ContentType.json;
        if (request.headers.value('authorization') == 'Bearer old-token') {
          if (++oldRequests == 2) bothOld.complete();
          await bothOld.future;
          if (request.uri.path == '/late') await refreshed.future;
          request.response.statusCode = 401;
          request.response.write(
            jsonEncode({
              'success': false,
              'error': {'code': 'AUTH_EXPIRED'},
            }),
          );
        } else {
          expect(request.headers.value('authorization'), 'Bearer new-token');
          retries++;
          request.response.write(jsonEncode({'success': true, 'data': {}}));
        }
        await request.response.close();
      });
      final results = await Future.wait([
        client.get('/first'),
        client.get('/late'),
      ]);
      expect(results.every((response) => response.success), isTrue);
      expect(refreshes, 1);
      expect(retries, 2);
    },
  );

  test('Account change during refresh never replays an old mutation with new credentials', () async {
    final started = Completer<void>(), release = Completer<void>();
    var requests = 0;
    client.sessionRefresher = () async {
      started.complete();
      await release.future;
      return true;
    };
    server.listen((request) async {
      requests++;
      await utf8.decoder.bind(request).join();
      request.response.headers.contentType = ContentType.json;
      request.response.statusCode = 401;
      request.response.write(
        jsonEncode({
          'success': false,
          'error': {'code': 'AUTH_INVALID'},
        }),
      );
      await request.response.close();
    });
    final pending = client.post('/mutation', body: {'value': 1});
    await started.future;
    await client.clearToken();
    await client.saveToken('other-account');
    release.complete();
    expect((await pending).success, isFalse);
    expect(requests, 1);
    expect(await client.getToken(), 'other-account');
  });

  test(
    'Network failure after logout does not reconnect to another backend',
    () async {
      final originalBase = ApiConfig.baseUrl;
      var requests = 0;
      server.listen((request) async {
        requests++;
        await client.clearToken();
        final socket = await request.response.detachSocket(writeHeaders: false);
        socket.destroy();
      });
      expect(
        (await client.post('/mutation', body: {'value': 1})).success,
        isFalse,
      );
      expect(requests, 1);
      expect(ApiConfig.baseUrl, originalBase);
    },
  );
}
