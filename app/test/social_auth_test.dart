import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_secure_storage/test/test_flutter_secure_storage_platform.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/screens/auth/login_screen.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/services/social_auth_service.dart';

typedef _MockResponder = ({int statusCode, Map<String, dynamic> body}) Function(
  String method,
  Uri url,
  String requestBody,
);

class _MockJsonHttpOverrides extends HttpOverrides {
  final _MockResponder responder;
  _MockJsonHttpOverrides(this.responder);

  @override
  HttpClient createHttpClient(SecurityContext? context) =>
      _MockJsonHttpClient(responder);
}

class _MockJsonHttpClient implements HttpClient {
  final _MockResponder responder;
  _MockJsonHttpClient(this.responder);

  @override
  bool autoUncompress = true;
  @override
  Duration? connectionTimeout;
  @override
  Duration idleTimeout = const Duration(seconds: 15);
  @override
  int? maxConnectionsPerHost;
  @override
  String? userAgent;

  @override
  void addCredentials(Uri url, String realm, HttpClientCredentials credentials) {}
  @override
  void addProxyCredentials(String host, int port, String realm, HttpClientCredentials credentials) {}
  @override
  set authenticate(Future<bool> Function(Uri url, String scheme, String? realm)? f) {}
  @override
  set authenticateProxy(Future<bool> Function(String host, int port, String scheme, String? realm)? f) {}
  @override
  set badCertificateCallback(bool Function(X509Certificate cert, String host, int port)? callback) {}
  @override
  void close({bool force = false}) {}
  @override
  set findProxy(String Function(Uri url)? f) {}

  @override
  Future<HttpClientRequest> getUrl(Uri url) => openUrl('GET', url);

  @override
  Future<HttpClientRequest> postUrl(Uri url) => openUrl('POST', url);

  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async =>
      _MockJsonHttpRequest(method, url, responder);

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class _MockHttpHeaders implements HttpHeaders {
  final Map<String, List<String>> _values;
  _MockHttpHeaders([Map<String, List<String>>? initial])
      : _values = initial ?? <String, List<String>>{};

  @override
  void add(String name, Object value, {bool preserveHeaderCase = false}) {
    _values.putIfAbsent(name.toLowerCase(), () => <String>[]).add(value.toString());
  }

  @override
  void set(String name, Object value, {bool preserveHeaderCase = false}) {
    _values[name.toLowerCase()] = <String>[value.toString()];
  }

  @override
  List<String>? operator [](String name) => _values[name.toLowerCase()];

  @override
  String? value(String name) => _values[name.toLowerCase()]?.firstOrNull;

  @override
  void forEach(void Function(String name, List<String> values) action) {
    _values.forEach(action);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class _MockJsonHttpRequest implements HttpClientRequest {
  @override
  final String method;
  @override
  final Uri uri;
  final _MockResponder responder;
  final List<int> _buffer = <int>[];
  final Completer<HttpClientResponse> _doneCompleter =
      Completer<HttpClientResponse>();

  _MockJsonHttpRequest(this.method, this.uri, this.responder);

  @override
  final HttpHeaders headers = _MockHttpHeaders();
  @override
  Encoding encoding = utf8;
  @override
  bool bufferOutput = true;
  @override
  int contentLength = -1;
  @override
  bool followRedirects = true;
  @override
  int maxRedirects = 5;
  @override
  bool persistentConnection = true;

  @override
  void add(List<int> data) => _buffer.addAll(data);

  @override
  Future<void> addStream(Stream<List<int>> stream) async {
    await for (final chunk in stream) {
      _buffer.addAll(chunk);
    }
  }

  @override
  Future<HttpClientResponse> close() async {
    final res = responder(method, uri, utf8.decode(_buffer));
    final response = _MockJsonHttpResponse(
      res.statusCode,
      utf8.encode(jsonEncode(res.body)),
    );
    if (!_doneCompleter.isCompleted) {
      _doneCompleter.complete(response);
    }
    return response;
  }

  @override
  Future<HttpClientResponse> get done => _doneCompleter.future;

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

class _MockJsonHttpResponse extends Stream<List<int>>
    implements HttpClientResponse {
  @override
  final int statusCode;
  final List<int> _bytes;

  _MockJsonHttpResponse(this.statusCode, this._bytes);

  @override
  int get contentLength => _bytes.length;
  @override
  String get reasonPhrase => statusCode == 200 ? 'OK' : 'Error';
  @override
  bool get isRedirect => false;
  @override
  bool get persistentConnection => false;
  @override
  List<RedirectInfo> get redirects => const <RedirectInfo>[];
  @override
  HttpClientResponseCompressionState get compressionState =>
      HttpClientResponseCompressionState.notCompressed;
  @override
  final HttpHeaders headers = _MockHttpHeaders(<String, List<String>>{
    'content-type': <String>['application/json; charset=utf-8'],
  });

  @override
  StreamSubscription<List<int>> listen(
    void Function(List<int> event)? onData, {
    Function? onError,
    void Function()? onDone,
    bool? cancelOnError,
  }) {
    return Stream<List<int>>.value(_bytes).listen(
      onData,
      onError: onError,
      onDone: onDone,
      cancelOnError: cancelOnError,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Social Auth API Integration Tests', () {
    late HttpServer server;

    setUp(() async {
      HttpOverrides.global = null;
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
      SocialAuthService().resetTestHandlers();
      await AuthService().logout();
      server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      ApiConfig.setBaseUrl('http://127.0.0.1:${server.port}');
    });

    tearDown(() async {
      SocialAuthService().resetTestHandlers();
      await AuthService().logout();
      await server.close(force: true);
      ApiConfig.resetBaseUrl();
    });

    test('loginWithGoogle sends idToken to /api/v1/auth/google and persists session', () async {
      final seenRequests = <String>[];
      server.listen((req) async {
        seenRequests.add('${req.method} ${req.uri.path}');
        req.response.headers.contentType = ContentType.json;
        if (req.method == 'POST' && req.uri.path == '/api/v1/auth/google') {
          final body = jsonDecode(await utf8.decoder.bind(req).join()) as Map<String, dynamic>;
          expect(body['idToken'], 'firebase-google-token-123');
          req.response.statusCode = 200;
          req.response.write(jsonEncode({
            'success': true,
            'message': 'Đăng nhập Google thành công.',
            'data': {
              'token': 'jwt-google-access',
              'refreshToken': 'jwt-google-refresh',
              'user': {
                'id': 'u-google-1',
                'username': 'google_buyer',
                'fullName': 'Nguyễn Google',
                'email': 'buyer@gmail.com',
                'role': 'buyer',
                'status': 'active',
              },
            },
          }));
        } else {
          req.response.statusCode = 404;
          req.response.write(jsonEncode({'success': false}));
        }
        await req.response.close();
      });

      final emptyOk = await AuthService().loginWithGoogle('   ');
      expect(emptyOk, isFalse);
      expect(seenRequests, isEmpty);

      final ok = await AuthService().loginWithGoogle('firebase-google-token-123');
      expect(ok, isTrue);
      expect(seenRequests, ['POST /api/v1/auth/google']);
      expect(AuthService().isAuthenticated, isTrue);
      expect(AuthService().currentUser?.email, 'buyer@gmail.com');
      expect(AuthService().token, 'jwt-google-access');
    });

    test('loginWithFacebook sends idToken to /api/v1/auth/facebook and surfaces backend error', () async {
      final seenRequests = <String>[];
      var shouldFail = false;
      server.listen((req) async {
        seenRequests.add('${req.method} ${req.uri.path}');
        req.response.headers.contentType = ContentType.json;
        if (req.method == 'POST' && req.uri.path == '/api/v1/auth/facebook') {
          final body = jsonDecode(await utf8.decoder.bind(req).join()) as Map<String, dynamic>;
          expect(body['idToken'], 'firebase-fb-token-456');
          if (shouldFail) {
            req.response.statusCode = 409;
            req.response.write(jsonEncode({
              'success': false,
              'message': 'Email đã tồn tại với phương thức đăng nhập khác.',
              'error': {'code': 'EMAIL_ACCOUNT_EXISTS'},
            }));
          } else {
            req.response.statusCode = 200;
            req.response.write(jsonEncode({
              'success': true,
              'message': 'Đăng nhập Facebook thành công.',
              'data': {
                'token': 'jwt-fb-access',
                'refreshToken': 'jwt-fb-refresh',
                'user': {
                  'id': 'u-fb-1',
                  'username': 'fb_buyer',
                  'fullName': 'Trần Facebook',
                  'email': 'fb@example.com',
                  'role': 'buyer',
                  'status': 'active',
                },
              },
            }));
          }
        } else {
          req.response.statusCode = 404;
          req.response.write(jsonEncode({'success': false}));
        }
        await req.response.close();
      });

      final ok = await AuthService().loginWithFacebook('firebase-fb-token-456');
      expect(ok, isTrue);
      expect(AuthService().currentUser?.fullName, 'Trần Facebook');

      shouldFail = true;
      final failOk = await AuthService().loginWithFacebook('firebase-fb-token-456');
      expect(failOk, isFalse);
      expect(AuthService().lastError, 'Email đã tồn tại với phương thức đăng nhập khác.');
      expect(seenRequests.where((e) => e == 'POST /api/v1/auth/facebook').length, 2);
    });
  });

  group('LoginScreen Website-Parity Google & Facebook Tests', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStoragePlatform.instance =
          TestFlutterSecureStoragePlatform(<String, String>{});
      SocialAuthService().resetTestHandlers();
      ApiConfig.setBaseUrl('http://mock.shopnova.local');
      await AuthService().logout();
    });

    tearDown(() {
      HttpOverrides.global = null;
      SocialAuthService().resetTestHandlers();
      ApiConfig.resetBaseUrl();
    });

    List<({String path, String? idToken})> attachMockBackend() {
      final captured = <({String path, String? idToken})>[];
      HttpOverrides.global = _MockJsonHttpOverrides((method, url, requestBody) {
        if (url.path == '/api/v1/health' || url.path == '/api/v1/ready') {
          return (
            statusCode: 200,
            body: {
              'success': true,
              'message': 'OK',
              'data': {'dataApi': 'connected', 'database': 'connected'},
            },
          );
        }
        if (method == 'POST' &&
            (url.path == '/api/v1/auth/google' ||
                url.path == '/api/v1/auth/facebook')) {
          final decoded = jsonDecode(requestBody) as Map<String, dynamic>;
          captured.add((path: url.path, idToken: decoded['idToken']?.toString()));
          final isGoogle = url.path == '/api/v1/auth/google';
          return (
            statusCode: 200,
            body: {
              'success': true,
              'data': {
                'token': isGoogle ? 'jwt-google' : 'jwt-fb',
                'refreshToken': isGoogle ? 'refresh-google' : 'refresh-fb',
                'user': {
                  'id': isGoogle ? 'u-google' : 'u-fb',
                  'username': isGoogle ? 'google_user' : 'fb_user',
                  'fullName': isGoogle ? 'Lê Google' : 'Phạm Facebook',
                  'role': 'buyer',
                  'status': 'active',
                },
              },
            },
          );
        }
        return (statusCode: 404, body: {'success': false});
      });
      return captured;
    }

    Future<void> pumpUntilSettledWithRealAsync(WidgetTester tester) async {
      for (var i = 0; i < 60; i++) {
        await tester.pump(const Duration(milliseconds: 30));
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 10)),
        );
        if (i >= 15 && !AuthService().isLoading) {
          break;
        }
      }
      await tester.pumpAndSettle(
        const Duration(milliseconds: 50),
        EnginePhase.sendSemanticsUpdate,
        const Duration(seconds: 3),
      );
    }

    Future<void> logoutAndFlushInsideTest(WidgetTester tester) async {
      var done = false;
      AuthService().logout().whenComplete(() => done = true);
      for (var i = 0; i < 40 && !done; i++) {
        await tester.pump(const Duration(milliseconds: 30));
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 10)),
        );
      }
      expect(done, isTrue);
    }

    testWidgets('Renders Google and Facebook buttons matching website without manual token dialog', (tester) async {
      attachMockBackend();
      tester.view.physicalSize = const Size(360, 780);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
      await pumpUntilSettledWithRealAsync(tester);

      expect(find.byKey(const ValueKey('google_login_btn')), findsOneWidget);
      expect(find.byKey(const ValueKey('facebook_login_btn')), findsOneWidget);
      expect(find.text('Tiếp tục với Google'), findsOneWidget);
      expect(find.text('Tiếp tục với Facebook'), findsOneWidget);
      expect(find.byIcon(Icons.apple_rounded), findsNothing);
      expect(find.text('Firebase ID Token'), findsNothing);
    });

    testWidgets('Google and Facebook login buttons authenticate via Firebase tokens and handle cancellation cleanly', (tester) async {
      final captured = attachMockBackend();
      var googleCalls = 0;
      var fbCalls = 0;
      var cancelNextFb = true;
      SocialAuthService().setTestHandlers(
        googleHandler: () async {
          googleCalls++;
          return SocialAuthTokenResult.success('mock-firebase-google-jwt');
        },
        facebookHandler: () async {
          fbCalls++;
          if (cancelNextFb) {
            cancelNextFb = false;
            return SocialAuthTokenResult.cancel();
          }
          return SocialAuthTokenResult.success('mock-firebase-fb-jwt');
        },
      );

      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (ctx) => Scaffold(
              body: ElevatedButton(
                onPressed: () => Navigator.push(
                  ctx,
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                ),
                child: const Text('Mở đăng nhập'),
              ),
            ),
          ),
        ),
      );

      // 1. Google Login flow
      await tester.tap(find.text('Mở đăng nhập'));
      await pumpUntilSettledWithRealAsync(tester);

      await tester.ensureVisible(find.byKey(const ValueKey('google_login_btn')));
      await tester.pumpAndSettle(const Duration(milliseconds: 50), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 2));
      await tester.tap(find.byKey(const ValueKey('google_login_btn')));
      await pumpUntilSettledWithRealAsync(tester);

      expect(googleCalls, 1);
      expect(captured, [(path: '/api/v1/auth/google', idToken: 'mock-firebase-google-jwt')]);
      expect(AuthService().isAuthenticated, isTrue);
      expect(AuthService().currentUser?.fullName, 'Lê Google');
      expect(find.byType(LoginScreen), findsNothing);

      // Logout before testing Facebook flow
      await logoutAndFlushInsideTest(tester);
      expect(AuthService().isAuthenticated, isFalse);

      // 2. Facebook Cancel -> Facebook Success flow
      await tester.tap(find.text('Mở đăng nhập'));
      await pumpUntilSettledWithRealAsync(tester);

      await tester.ensureVisible(find.byKey(const ValueKey('facebook_login_btn')));
      await tester.pumpAndSettle(const Duration(milliseconds: 50), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 2));
      await tester.tap(find.byKey(const ValueKey('facebook_login_btn')));
      await pumpUntilSettledWithRealAsync(tester);

      expect(fbCalls, 1);
      expect(captured.length, 1);
      expect(AuthService().isAuthenticated, isFalse);
      expect(find.text('Bạn đã đóng cửa sổ đăng nhập trước khi hoàn tất.'), findsOneWidget);
      expect(find.byType(LoginScreen), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('facebook_login_btn')));
      await pumpUntilSettledWithRealAsync(tester);

      expect(fbCalls, 2);
      expect(captured.last, (path: '/api/v1/auth/facebook', idToken: 'mock-firebase-fb-jwt'));
      expect(AuthService().isAuthenticated, isTrue);
      expect(AuthService().currentUser?.fullName, 'Phạm Facebook');
      expect(find.byType(LoginScreen), findsNothing);

      await logoutAndFlushInsideTest(tester);
    });
  });
}
