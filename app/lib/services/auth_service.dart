import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/user.dart';
import 'api_client.dart';
import 'session_store.dart';
import '../config/api_config.dart';

/// Service xử lý xác thực tài khoản (Đăng nhập, Đăng ký, Hồ sơ cá nhân)
class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal() {
    _client.sessionRefresher = refreshSession;
    restoreSession();
  }

  final ApiClient _client = ApiClient();
  static const String _userKey = 'novashop_current_user';
  static const String _savedCredsKey = 'novashop_saved_credentials';
  final SessionStore _sessionStore = SessionStore();
  Future<bool>? _refreshInFlight;
  int _sessionVersion = 0;
  Future<void> _pendingPersistence = Future<void>.value();
  static const _disabledSessionKey = SessionStore.disabledSessionKey;
  static const String _userKeyId = 'novashop_user_id';
  static const String _userKeyUsername = 'novashop_user_username';
  static const String _userKeyFullName = 'novashop_user_fullname';
  static const String _userKeyEmail = 'novashop_user_email';
  static const String _userKeyPhone = 'novashop_user_phone';
  static const String _userKeyRole = 'novashop_user_role';
  static const String _userKeyShopId = 'novashop_user_shopid';
  static const String _userKeyAvatar = 'novashop_user_avatar';
  static const String _userKeyStatus = 'novashop_user_status';
  static const String _userKeyIsLoggedIn = 'novashop_is_logged_in';

  String? _token;
  String? _refreshToken;
  User? _currentUser;
  bool _isLoading = false;
  String? _lastError;
  String? _sellerShopStatus;

  String? get token => _token;
  String? get refreshToken => _refreshToken;
  User? get currentUser => _currentUser;
  User? get user => _currentUser;
  bool get isLoading => _isLoading;
  String? get lastError => _lastError;
  String? get sellerShopStatus => _sellerShopStatus;
  bool get isAuthenticated => _currentUser != null;

  Future<T> _persist<T>(Future<T> Function() action) {
    final result = _pendingPersistence.then((_) => action());
    _pendingPersistence = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace _) {},
    );
    return result;
  }

  int _beginSessionChange({bool clear = false}) {
    final version = ++_sessionVersion;
    _refreshInFlight = null;
    _client.invalidateSession(clearToken: clear);
    if (clear) {
      _token = null;
      _refreshToken = null;
      _currentUser = null;
      _sellerShopStatus = null;
      _persist(_clearStoredSession).catchError((_) {
        debugPrint('[AuthService] SESSION_CLEANUP_FAILED');
      });
    }
    return version;
  }

  Future<void> _clearStoredSession() async {
    final prefs = await SharedPreferences.getInstance();
    // Keep a durable sign-out marker if the OS credential store cannot delete.
    await prefs.setBool(_disabledSessionKey, true);
    for (final key in [
      _userKey,
      _savedCredsKey,
      _userKeyId,
      _userKeyUsername,
      _userKeyFullName,
      _userKeyEmail,
      _userKeyPhone,
      _userKeyRole,
      _userKeyShopId,
      _userKeyAvatar,
      _userKeyStatus,
      _userKeyIsLoggedIn,
    ]) {
      await prefs.remove(key);
    }
    try {
      await _client.clearToken(invalidate: false);
    } finally {
      await _sessionStore.delete(SessionStore.refreshKey);
    }
  }

  Future<bool> _acceptSession(
    Map<String, dynamic> data,
    int version,
  ) => _persist(() async {
    if (version != _sessionVersion) return false;
    try {
      final token = data['token'];
      if (token is! String || token.isEmpty) {
        throw const FormatException('Invalid session');
      }
      final refresh =
          data['refreshToken'] is String &&
              (data['refreshToken'] as String).isNotEmpty
          ? data['refreshToken'] as String
          : _refreshToken;
      final user = data['user'] is Map<String, dynamic>
          ? User.fromJson(data['user'] as Map<String, dynamic>)
          : _currentUser;
      await _client.saveToken(token);
      if (version != _sessionVersion) return false;
      if (refresh != null) {
        await _sessionStore.write(SessionStore.refreshKey, refresh);
      }
      if (version != _sessionVersion) return false;
      if (user != null) await _saveUserToLocal(user);
      if (version != _sessionVersion) return false;
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_disabledSessionKey);
      await _sessionStore.removeLegacyCredentials();
      if (version != _sessionVersion) return false;
      _token = token;
      _refreshToken = refresh;
      _currentUser = user;
      notifyListeners();
      return version == _sessionVersion;
    } catch (_) {
      if (version == _sessionVersion) {
        _beginSessionChange(clear: true);
        _isLoading = false;
        _lastError =
            'Không thể lưu phiên đăng nhập an toàn. Vui lòng đăng nhập lại.';
        notifyListeners();
      }
      return false;
    }
  });

  Future<User?> _acceptUser(User user, int version) => _persist(() async {
    if (version != _sessionVersion) return null;
    await _saveUserToLocal(user);
    if (version != _sessionVersion) return null;
    _currentUser = user;
    notifyListeners();
    return user;
  });

  /// Làm mới phiên đăng nhập qua refresh token
  /// POST /api/v1/auth/refresh
  Future<bool> refreshSession() {
    if (_refreshInFlight != null) return _refreshInFlight!;
    final pending = _performRefresh();
    _refreshInFlight = pending;
    return pending.whenComplete(() {
      if (identical(_refreshInFlight, pending)) _refreshInFlight = null;
    });
  }

  Future<bool> _performRefresh() async {
    final version = _sessionVersion;
    final baseUrl = ApiConfig.baseUrl;
    try {
      final rt =
          _refreshToken ?? await _sessionStore.read(SessionStore.refreshKey);
      if (version != _sessionVersion || rt == null || rt.isEmpty) return false;

      final response = await http
          .post(
            Uri.parse('$baseUrl/api/v1/auth/refresh'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'refreshToken': rt}),
          )
          .timeout(const Duration(seconds: 8));

      final Map<String, dynamic> body = jsonDecode(response.body);
      if (response.statusCode == 200 &&
          body['success'] == true &&
          body['data'] is Map<String, dynamic>) {
        final data = body['data'] as Map<String, dynamic>;
        if (version != _sessionVersion || baseUrl != ApiConfig.baseUrl) {
          await _revokeSupersededRefresh(baseUrl, data['refreshToken']);
          return false;
        }
        final accepted = await _acceptSession(data, version);
        if (!accepted) {
          await _revokeSupersededRefresh(baseUrl, data['refreshToken']);
        }
        return accepted;
      }
    } catch (e) {
      debugPrint('[AuthService] REFRESH_FAILED');
    }
    return false;
  }

  Future<void> _revokeSupersededRefresh(String baseUrl, dynamic token) async {
    if (token is! String || token.isEmpty) return;
    try {
      await http.post(
        Uri.parse('$baseUrl/api/v1/auth/logout'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': token}),
      ).timeout(const Duration(seconds: 3));
    } catch (_) {
      debugPrint('[AuthService] SUPERSEDED_SESSION_REVOKE_FAILED');
    }
  }

  /// Kiểm tra trạng thái đã đăng nhập
  Future<bool> isLoggedIn() async {
    final t = _token ?? await _client.getToken();
    return t != null && t.isNotEmpty;
  }

  /// Kiểm tra kết nối Liveness của Backend (tự động thử dự phòng nếu rút cáp USB)
  Future<bool> checkHealth() async {
    try {
      final response = await http
          .get(Uri.parse(ApiConfig.healthUrl))
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['success'] == true;
      }
    } catch (_) {
      try {
        final workingUrl = await ApiConfig.autoDetectBaseUrl();
        final response = await http
            .get(Uri.parse('$workingUrl/api/v1/health'))
            .timeout(const Duration(seconds: 5));
        if (response.statusCode == 200) {
          ApiConfig.setBaseUrl(workingUrl);
          final data = jsonDecode(response.body);
          return data['success'] == true;
        }
      } catch (e) {
        debugPrint('[AuthService] checkHealth fallback error: $e');
      }
    }
    return false;
  }

  /// Kiểm tra Readiness (Backend + Data API + MySQL)
  Future<Map<String, dynamic>> checkReadiness() async {
    final sw = Stopwatch()..start();
    try {
      final response = await http
          .get(Uri.parse(ApiConfig.readyUrl))
          .timeout(const Duration(seconds: 6));
      sw.stop();
      final data = jsonDecode(response.body);
      return {
        'statusCode': response.statusCode,
        'success': data['success'] == true,
        'data': data['data'],
        'message': data['message'] ?? '',
        'latencyMs': sw.elapsedMilliseconds,
      };
    } catch (e) {
      sw.stop();
      debugPrint('[AuthService] checkReadiness error: $e');
      return {
        'statusCode': 0,
        'success': false,
        'error': e.toString(),
        'latencyMs': sw.elapsedMilliseconds,
      };
    }
  }

  /// Kiểm tra toàn diện kết nối (Backend, Data API, Cơ sở dữ liệu MySQL và độ trễ Ping)
  Future<Map<String, dynamic>> checkFullConnectionStatus() async {
    final sw = Stopwatch()..start();
    try {
      final response = await http
          .get(Uri.parse(ApiConfig.readyUrl))
          .timeout(const Duration(seconds: 6));
      sw.stop();

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        final data = body['data'] as Map<String, dynamic>? ?? {};
        return {
          'isOnline': true,
          'isReady': true,
          'backend': 'OK',
          'dataApi': data['dataApi'] == 'connected'
              ? 'Đã kết nối'
              : 'Không phản hồi',
          'database': data['database'] == 'connected'
              ? 'Đã kết nối'
              : 'Mất kết nối',
          'latencyMs': sw.elapsedMilliseconds,
          'url': ApiConfig.baseUrl,
          'message': body['message'] ?? 'Máy chủ và cơ sở dữ liệu đã sẵn sàng.',
        };
      } else {
        try {
          final body = jsonDecode(response.body);
          final isDbIssue = body['error']?['code'] == 'DATABASE_UNAVAILABLE';
          return {
            'isOnline': true,
            'isReady': false,
            'backend': 'OK',
            'dataApi': isDbIssue ? 'Đã kết nối' : 'Lỗi kết nối',
            'database': isDbIssue ? 'Mất kết nối CSDL' : 'Lỗi kết nối',
            'latencyMs': sw.elapsedMilliseconds,
            'url': ApiConfig.baseUrl,
            'message':
                body['message'] ??
                'Dịch vụ chưa sẵn sàng (Mã: ${response.statusCode})',
          };
        } catch (_) {
          return {
            'isOnline': false,
            'isReady': false,
            'backend': 'Lỗi HTTP ${response.statusCode}',
            'dataApi': 'Chưa kết nối',
            'database': 'Chưa kết nối',
            'latencyMs': sw.elapsedMilliseconds,
            'url': ApiConfig.baseUrl,
            'message': 'Máy chủ trả về mã lỗi ${response.statusCode}',
          };
        }
      }
    } catch (e) {
      sw.stop();
      try {
        final healthRes = await http
            .get(Uri.parse(ApiConfig.healthUrl))
            .timeout(const Duration(seconds: 3));
        if (healthRes.statusCode == 200) {
          return {
            'isOnline': true,
            'isReady': false,
            'backend': 'OK',
            'dataApi': 'Mất kết nối',
            'database': 'Mất kết nối',
            'latencyMs': sw.elapsedMilliseconds,
            'url': ApiConfig.baseUrl,
            'message':
                'Backend đang hoạt động nhưng mất kết nối đến Data API/CSDL.',
          };
        }
      } catch (_) {}

      return {
        'isOnline': false,
        'isReady': false,
        'backend': 'Mất kết nối',
        'dataApi': 'Mất kết nối',
        'database': 'Mất kết nối',
        'latencyMs': sw.elapsedMilliseconds,
        'url': ApiConfig.baseUrl,
        'message': 'Không thể kết nối đến máy chủ: $e',
      };
    }
  }

  /// Đăng nhập tài khoản với tùy chọn ghi nhớ phiên đăng nhập bền vững
  Future<bool> login(
    String username,
    String password, {
    bool rememberMe = true,
  }) async {
    final version = _beginSessionChange(clear: true);
    _isLoading = true;
    _lastError = null;
    notifyListeners();

    try {
      final response = await http
          .post(
            Uri.parse(ApiConfig.loginUrl),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'username': username.trim(),
              'password': password,
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (version != _sessionVersion) return false;
      final Map<String, dynamic> body = jsonDecode(response.body);

      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        if (!await _acceptSession(data, version)) return false;

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _lastError =
            body['message'] as String? ?? 'Đăng nhập không thành công.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      if (version != _sessionVersion) return false;
      debugPrint('[AuthService] LOGIN_FAILED');
      _lastError = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Đăng ký tài khoản người dùng mới (Buyer hoặc Seller kèm sellerProfile)
  Future<bool> register({
    required String username,
    required String password,
    required String fullName,
    String? email,
    String? phone,
    String role = 'buyer',
    String? shopName,
    String? shopTagline,
    Map<String, dynamic>? sellerProfile,
  }) async {
    final version = _beginSessionChange(clear: true);
    _isLoading = true;
    _lastError = null;
    notifyListeners();

    try {
      final payload = <String, dynamic>{
        'username': username.trim().toLowerCase(),
        'password': password,
        'fullName': fullName.trim(),
        'role': role,
      };
      if (email != null && email.trim().isNotEmpty) {
        payload['email'] = email.trim().toLowerCase();
      }
      if (phone != null && phone.trim().isNotEmpty) {
        payload['phone'] = phone.trim();
      }
      if (role == 'seller' && shopName != null && shopName.trim().isNotEmpty) {
        payload['shopName'] = shopName.trim();
      }
      if (role == 'seller' &&
          shopTagline != null &&
          shopTagline.trim().isNotEmpty) {
        payload['shopTagline'] = shopTagline.trim();
      }
      if (role == 'seller' && sellerProfile != null) {
        payload['sellerProfile'] = sellerProfile;
      }

      final response = await _client.post('/api/v1/auth/register', body: payload);

      if (version != _sessionVersion) return false;
      if (response.success && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        if (!await _acceptSession(data, version)) return false;
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _lastError = response.message.isNotEmpty ? response.message : 'Đăng ký không thành công.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      if (version != _sessionVersion) return false;
      debugPrint('[AuthService] REGISTER_FAILED');
      _lastError = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Đăng ký mở gian hàng đối tác người bán cho tài khoản đang đăng nhập
  /// Gọi đúng API Website: POST /api/v1/auth/seller-shop
  Future<bool> registerSellerShop({
    required String shopName,
    String? province,
    String? tagline,
    Map<String, dynamic>? sellerProfile,
  }) async {
    final version = _beginSessionChange();
    _isLoading = true;
    _lastError = null;
    notifyListeners();

    try {
      final response = await _client.post(
        '/api/v1/auth/seller-shop',
        body: {
          'shopName': shopName.trim(),
          'shopTagline': (tagline ?? '').trim(),
          if (sellerProfile != null) 'sellerProfile': sellerProfile,
        },
      );

      if (response.success && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        _sellerShopStatus = data['shopStatus']?.toString() ?? 'pending';

        if (!await _acceptSession(data, version)) return false;

        if (version != _sessionVersion) return false;

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _lastError = response.message.isNotEmpty
            ? response.message
            : 'Đăng ký gian hàng thất bại. Vui lòng kiểm tra lại.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      if (version != _sessionVersion) return false;
      debugPrint('[AuthService] registerSellerShop error: $e');
      _lastError = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Lấy hồ sơ đăng ký KYC hiện tại của gian hàng: GET /api/v1/seller/shop/registration
  Future<Map<String, dynamic>?> getSellerRegistration() async {
    final res = await _client.get('/api/v1/seller/shop/registration');
    if (res.success && res.data is Map<String, dynamic>) {
      final data = res.data as Map<String, dynamic>;
      if (data['profile'] is Map<String, dynamic>) {
        return data['profile'] as Map<String, dynamic>;
      }
    }
    return null;
  }

  /// Cập nhật hồ sơ đăng ký KYC khi shop đang pending hoặc rejected: PUT /api/v1/seller/shop/registration
  Future<ApiResponse> updateSellerRegistration(Map<String, dynamic> sellerProfile) async {
    return await _client.put('/api/v1/seller/shop/registration', body: sellerProfile);
  }

  /// Lấy thông tin tài khoản hiện tại từ Backend qua JWT token
  Future<User?> getMe() async {
    return fetchCurrentUser();
  }

  /// Lấy thông tin tài khoản hiện tại với JWT Token
  Future<User?> fetchCurrentUser() async {
    final version = _sessionVersion;
    final t = _token ?? await _client.getToken();
    if (t == null || t.isEmpty) return null;

    try {
      final response = await http
          .get(
            Uri.parse(ApiConfig.meUrl),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $t',
            },
          )
          .timeout(const Duration(seconds: 5));

      final body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        if (data['user'] != null) {
          return await _acceptUser(
            User.fromJson(data['user'] as Map<String, dynamic>),
            version,
          );
        }
      }
    } catch (e) {
      debugPrint('[AuthService] fetchCurrentUser error: $e');
    }
    return null;
  }

  /// Khôi phục thông tin user tức thì từ bộ nhớ máy
  Future<User?> restoreSession() async {
    final version = _sessionVersion;
    try {
      final prefs = await SharedPreferences.getInstance();
      try {
        await prefs.reload();
      } catch (_) {}

      await _sessionStore.removeLegacyCredentials();
      if (version != _sessionVersion ||
          prefs.getBool(_disabledSessionKey) == true) {
        return _currentUser;
      }
      final t = await _client.getToken();
      if (version != _sessionVersion) return _currentUser;
      if (t != null && t.isNotEmpty) {
        _token = t;
      }
      final restoredRefresh = await _sessionStore.read(SessionStore.refreshKey);
      if (version != _sessionVersion) return _currentUser;
      _refreshToken = restoredRefresh;

      final userJsonStr = prefs.getString(_userKey);
      if (userJsonStr != null && userJsonStr.isNotEmpty) {
        try {
          _currentUser = User.fromJson(jsonDecode(userJsonStr));
        } catch (_) {}
      }

      if (_currentUser == null) {
        final isLoggedIn = prefs.getBool(_userKeyIsLoggedIn) ?? false;
        final savedUsername = prefs.getString(_userKeyUsername);
        if (isLoggedIn && savedUsername != null && savedUsername.isNotEmpty) {
          _currentUser = User(
            id: prefs.getString(_userKeyId) ?? '',
            username: savedUsername,
            fullName: prefs.getString(_userKeyFullName) ?? savedUsername,
            email: prefs.getString(_userKeyEmail),
            phone: prefs.getString(_userKeyPhone),
            role: prefs.getString(_userKeyRole) ?? 'buyer',
            avatarUrl: prefs.getString(_userKeyAvatar),
            status: prefs.getString(_userKeyStatus) ?? 'active',
            shopId: prefs.getString(_userKeyShopId),
          );
        }
      }

      if (_currentUser != null) {
        notifyListeners();
      }

      _syncSessionInBackground(version);
    } catch (e) {
      debugPrint('[AuthService] RESTORE_FAILED');
    }

    return _currentUser;
  }

  /// Đồng bộ phiên đăng nhập ngầm trong nền
  void _syncSessionInBackground(int version) async {
    try {
      if (version != _sessionVersion) return;
      if (_token != null && _token!.isNotEmpty) {
        final freshUser = await fetchCurrentUser();
        if (version != _sessionVersion) return;
        if (freshUser != null) return;
      }

      if (version != _sessionVersion) return;
      final refreshed = await refreshSession();
      if (refreshed) return;
    } catch (e) {
      debugPrint('[AuthService] _syncSessionInBackground error: $e');
    }
  }

  /// Cập nhật thông tin hồ sơ tài khoản
  Future<bool> updateProfile({
    String? fullName,
    String? phone,
    String? email,
    String? avatarUrl,
    bool clearAvatar = false,
  }) async {
    final version = _sessionVersion;
    final t = _token ?? await _client.getToken();
    if (t == null) {
      _lastError = 'Phiên đăng nhập đã hết hạn.';
      return false;
    }

    _isLoading = true;
    _lastError = null;
    notifyListeners();

    try {
      final payload = <String, dynamic>{};
      if (fullName != null) payload['fullName'] = fullName.trim();
      if (email != null) payload['email'] = email.trim();
      if (phone != null) payload['phone'] = phone.trim();
      if (clearAvatar) {
        payload['avatarUrl'] = null;
      } else if (avatarUrl != null) {
        payload['avatarUrl'] = avatarUrl.trim();
      }

      final response = await http
          .put(
            Uri.parse(ApiConfig.updateProfileUrl),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $t',
            },
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 10));

      if (version != _sessionVersion) return false;
      final body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        if (data['user'] != null) {
          if (await _acceptUser(
                User.fromJson(data['user'] as Map<String, dynamic>),
                version,
              ) ==
              null) {
            return false;
          }
        }
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _lastError = body['message'] as String? ?? 'Cập nhật hồ sơ thất bại.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      debugPrint('[AuthService] updateProfile error: $e');
      _lastError = 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Lấy thông tin hồ sơ gian hàng của seller hiện tại
  Future<Map<String, dynamic>?> getSellerShop() async {
    final response = await _client.get('/api/v1/seller/shop');
    if (response.success && response.data is Map<String, dynamic>) {
      final data = response.data as Map<String, dynamic>;
      if (data['shop'] is Map<String, dynamic>) {
        return data['shop'] as Map<String, dynamic>;
      }
    }
    return null;
  }

  /// Gửi lại hồ sơ gian hàng sau khi bị từ chối duyệt (rejected -> pending)
  Future<ApiResponse> resubmitSellerShop() async {
    return await _client.post('/api/v1/seller/shop/resubmit');
  }

  /// Đổi mật khẩu tài khoản
  /// POST /api/v1/auth/change-password
  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final t = _token ?? await _client.getToken();
    if (t == null) {
      _lastError = 'Phiên đăng nhập đã hết hạn.';
      return false;
    }

    final version = _beginSessionChange();
    _isLoading = true;
    _lastError = null;
    notifyListeners();

    try {
      final response = await http
          .post(
            Uri.parse(ApiConfig.changePasswordUrl),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $t',
            },
            body: jsonEncode({
              'currentPassword': currentPassword,
              'newPassword': newPassword,
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (version != _sessionVersion) return false;
      final body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'];
        if (data is! Map<String, dynamic> ||
            !await _acceptSession(data, version)) {
          return false;
        }

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _lastError = body['message'] as String? ?? 'Đổi mật khẩu thất bại.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      if (version != _sessionVersion) return false;
      debugPrint('[AuthService] changePassword error: $e');
      _lastError = 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Lấy thống kê tài khoản thực tế từ API đơn hàng và ví voucher
  /// (GET /api/v1/orders & GET /api/v1/vouchers/wallet)
  Future<Map<String, dynamic>?> fetchUserStats() async {
    final t = _token ?? await _client.getToken();
    if (t == null) return null;

    try {
      final ordersRes = await _client.get(
        '/api/v1/orders',
        queryParams: {'limit': '50', 'offset': '0'},
      );
      final walletRes = await _client.get(
        '/api/v1/vouchers/wallet',
        queryParams: {'page': '1'},
      );

      int orderCount = 0;
      double totalSpent = 0;
      if (ordersRes.success && ordersRes.data != null) {
        List<dynamic> list = [];
        if (ordersRes.data is Map && ordersRes.data['orders'] is List) {
          list = ordersRes.data['orders'] as List;
          orderCount =
              (ordersRes.data['total'] as num?)?.toInt() ?? list.length;
        } else if (ordersRes.data is List) {
          list = ordersRes.data as List;
          orderCount = list.length;
        }
        for (final o in list) {
          if (o is Map && o['status']?.toString() != 'cancelled') {
            final amt =
                num.tryParse(
                  (o['totalAmount'] ?? o['total_amount'] ?? 0).toString(),
                ) ??
                0;
            totalSpent += amt.toDouble();
          }
        }
      }

      int voucherCount = 0;
      if (walletRes.success && walletRes.data != null) {
        if (walletRes.data is Map && walletRes.data['items'] is List) {
          voucherCount = (walletRes.data['items'] as List).length;
        } else if (walletRes.data is List) {
          voucherCount = (walletRes.data as List).length;
        }
      }

      return {
        'orderCount': orderCount,
        'totalSpent': totalSpent,
        'voucherCount': voucherCount,
      };
    } catch (e) {
      debugPrint('[AuthService] fetchUserStats error: $e');
    }
    return null;
  }

  /// Đăng xuất tài khoản (gọi POST /api/v1/auth/logout và xóa phiên lưu trữ)
  Future<void> logout() {
    final oldToken = _token;
    final oldRefreshToken = _refreshToken;
    _beginSessionChange(clear: true);
    _isLoading = false;
    _lastError = null;
    if (oldToken != null) {
      http
          .post(
            Uri.parse(ApiConfig.logoutUrl),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $oldToken',
            },
            body: jsonEncode({'refreshToken': ?oldRefreshToken}),
          )
          .timeout(const Duration(seconds: 8))
          .catchError((_) => http.Response('', 500));
    }
    notifyListeners();
    return _pendingPersistence;
  }

  Future<void> _saveUserToLocal(User user) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_userKey, jsonEncode(user.toJson()));
      await prefs.setString(_userKeyId, user.id);
      await prefs.setString(_userKeyUsername, user.username);
      await prefs.setString(_userKeyFullName, user.fullName);
      if (user.email != null) await prefs.setString(_userKeyEmail, user.email!);
      if (user.phone != null) await prefs.setString(_userKeyPhone, user.phone!);
      await prefs.setString(_userKeyRole, user.role);
      if (user.shopId != null) {
        await prefs.setString(_userKeyShopId, user.shopId!);
      }
      if (user.avatarUrl != null) {
        await prefs.setString(_userKeyAvatar, user.avatarUrl!);
      }
      await prefs.setString(_userKeyStatus, user.status);
      await prefs.setBool(_userKeyIsLoggedIn, true);
    } catch (e) {
      debugPrint('[AuthService] _saveUserToLocal error: $e');
    }
  }
}
