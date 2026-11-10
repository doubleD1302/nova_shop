import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/test/test_flutter_secure_storage_platform.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/services/api_client.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/services/session_store.dart';

class ControlledStorage extends TestFlutterSecureStoragePlatform {
  ControlledStorage() : super({});
  String? pausedValue;
  final entered = Completer<void>();
  final release = Completer<void>();
  bool failWrites = false;
  bool failDeletes = false;

  @override
  Future<void> write({
    required String key,
    required String value,
    required Map<String, String> options,
  }) async {
    if (value == pausedValue) {
      entered.complete();
      await release.future;
    }
    if (failWrites) throw PlatformException(code: 'storage_unavailable');
    return super.write(key: key, value: value, options: options);
  }

  @override
  Future<void> delete({
    required String key,
    required Map<String, String> options,
  }) async {
    if (failDeletes) throw PlatformException(code: 'storage_unavailable');
    return super.delete(key: key, options: options);
  }
}

Map<String, dynamic> session(String name, {String? access}) => {
  'success': true,
  'data': {
    'token': access ?? '$name-access',
    'refreshToken': '$name-refresh',
    'user': {
      'id': name == 'a' ? '1' : '2',
      'username': name,
      'fullName': name,
      'role': 'buyer',
    },
  },
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  SharedPreferences.setMockInitialValues({});
  FlutterSecureStoragePlatform.instance = ControlledStorage();
  final auth = AuthService();
  late ControlledStorage secure;
  late HttpServer server;
  late Future<void> Function(HttpRequest) handler;

  setUp(() async {
    HttpOverrides.global = null;
    await auth.logout();
    SharedPreferences.setMockInitialValues({});
    secure = ControlledStorage();
    FlutterSecureStoragePlatform.instance = secure;
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    ApiConfig.setBaseUrl('http://127.0.0.1:${server.port}');
    handler = (request) async {
      if (request.uri.path.endsWith('/login')) {
        final body = jsonDecode(await utf8.decoder.bind(request).join());
        request.response.write(jsonEncode(session(body['username'] as String)));
      } else if (request.uri.path.endsWith('/refresh')) {
        request.response.write(
          jsonEncode(session('a', access: 'refreshed-access')),
        );
      } else {
        request.response.write(jsonEncode({'success': true, 'data': {}}));
      }
    };
    server.listen((request) async {
      request.response.headers.contentType = ContentType.json;
      await handler(request);
      await request.response.close();
    });
  });

  tearDown(() async {
    if (secure.entered.isCompleted && !secure.release.isCompleted) {
      secure.release.complete();
    }
    secure.failWrites = false;
    secure.failDeletes = false;
    await auth.logout();
    await server.close(force: true);
    ApiConfig.resetBaseUrl();
  });

  test(
    'Logout while refresh writes secure storage cannot restore tokens or user',
    () async {
      expect(await auth.login('a', 'test-password'), isTrue);
      secure.pausedValue = 'refreshed-access';
      final refresh = auth.refreshSession();
      await secure.entered.future;
      final logout = auth.logout();
      expect(auth.currentUser, isNull);
      expect(await ApiClient().getToken(), isNull);
      secure.release.complete();
      expect(await refresh, isFalse);
      await logout;
      expect(secure.data[SessionStore.accessKey], isNull);
      expect(secure.data[SessionStore.refreshKey], isNull);
      expect(
        (await SharedPreferences.getInstance()).getString(
          'novashop_current_user',
        ),
        isNull,
      );
    },
  );

  test(
    'Old refresh cannot overwrite a new account or block its refresh',
    () async {
      final started = Completer<void>(), release = Completer<void>();
      final normal = handler;
      handler = (request) async {
        if (request.uri.path.endsWith('/refresh')) {
          final body = jsonDecode(await utf8.decoder.bind(request).join());
          if (body['refreshToken'] == 'a-refresh') {
            started.complete();
            await release.future;
            request.response.write(
              jsonEncode(session('a', access: 'old-refreshed')),
            );
          } else {
            expect(body['refreshToken'], 'b-refresh');
            request.response.write(
              jsonEncode(session('b', access: 'b-refreshed')),
            );
          }
        } else {
          await normal(request);
        }
      };
      try {
        expect(await auth.login('a', 'test-password'), isTrue);
        final old = auth.refreshSession();
        await started.future;
        expect(await auth.login('b', 'test-password'), isTrue);
        expect(await auth.refreshSession(), isTrue);
        release.complete();
        expect(await old, isFalse);
        expect(auth.user?.username, 'b');
        expect(auth.token, 'b-refreshed');
        expect(secure.data[SessionStore.accessKey], 'b-refreshed');
        expect(secure.data[SessionStore.refreshKey], 'b-refresh');
      } finally {
        if (!release.isCompleted) release.complete();
      }
    },
  );

  test('Late profile response cannot restore a logged-out user', () async {
    final started = Completer<void>(), release = Completer<void>();
    final normal = handler;
    handler = (request) async {
      if (request.uri.path.endsWith('/me')) {
        started.complete();
        await release.future;
        request.response.write(jsonEncode(session('a')));
      } else {
        await normal(request);
      }
    };
    try {
      expect(await auth.login('a', 'test-password'), isTrue);
      final profile = auth.fetchCurrentUser();
      await started.future;
      await auth.logout();
      release.complete();
      expect(await profile, isNull);
      expect(auth.user, isNull);
      expect(
        (await SharedPreferences.getInstance()).getString(
          'novashop_current_user',
        ),
        isNull,
      );
    } finally {
      if (!release.isCompleted) release.complete();
    }
  });

  test('Late login response cannot replace a more recent login', () async {
    final started = Completer<void>(), release = Completer<void>();
    final normal = handler;
    handler = (request) async {
      if (request.uri.path.endsWith('/login')) {
        final body = jsonDecode(await utf8.decoder.bind(request).join());
        if (body['username'] == 'a') {
          started.complete();
          await release.future;
        }
        request.response.write(jsonEncode(session(body['username'] as String)));
      } else {
        await normal(request);
      }
    };
    try {
      final old = auth.login('a', 'test-password');
      await started.future;
      expect(await auth.login('b', 'test-password'), isTrue);
      release.complete();
      expect(await old, isFalse);
      expect(auth.user?.username, 'b');
      expect(secure.data[SessionStore.accessKey], 'b-access');
    } finally {
      if (!release.isCompleted) release.complete();
    }
  });

  test(
    'Failed migration keeps legacy tokens until secure write succeeds',
    () async {
      SharedPreferences.setMockInitialValues({
        SessionStore.accessKey: 'legacy-token',
        SessionStore.legacyCredentialsKey: 'old-password',
      });
      final store = SessionStore();
      secure.failWrites = true;
      await store.removeLegacyCredentials();
      await expectLater(
        store.read(SessionStore.accessKey),
        throwsA(isA<PlatformException>()),
      );
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(SessionStore.accessKey), 'legacy-token');
      expect(prefs.containsKey(SessionStore.legacyCredentialsKey), isFalse);
      secure.failWrites = false;
      expect(await store.read(SessionStore.accessKey), 'legacy-token');
      expect(prefs.containsKey(SessionStore.accessKey), isFalse);
    },
  );

  test('Storage failure during refresh fails closed even if OS deletion also fails', () async {
    expect(await auth.login('a', 'test-password'), isTrue);
    secure.failWrites = true;
    secure.failDeletes = true;
    expect(await auth.refreshSession(), isFalse);
    await auth.logout();
    expect(auth.user, isNull);
    expect(await ApiClient().getToken(), isNull);
    expect(
      (await SharedPreferences.getInstance()).getBool(
        SessionStore.disabledSessionKey,
      ),
      isTrue,
    );
    expect(await auth.restoreSession(), isNull);
    expect(await SessionStore().read(SessionStore.refreshKey), isNull);
  });
}
