import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import 'api_client.dart';
import '../config/api_config.dart';

/// Service xử lý xác thực tài khoản (Đăng nhập, Đăng ký, Hồ sơ cá nhân)
class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal() {
    restoreSession();
  }

  final ApiClient _client = ApiClient();
  static const String _userKey = 'novashop_current_user';
  static const String _savedCredsKey = 'novashop_saved_credentials';
  static const String _refreshTokenKey = 'novashop_refresh_token';
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

  /// Lấy danh sách tài khoản demo từ Backend API
  /// GET /api/v1/auth/demo-accounts
  Future<List<Map<String, dynamic>>> fetchDemoAccounts() async {
    try {
      final response = await http
          .get(
            Uri.parse(ApiConfig.demoAccountsUrl),
            headers: {'Accept': 'application/json'},
          )
          .timeout(const Duration(seconds: 6));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true && body['data'] is Map) {
          final accounts = body['data']['accounts'];
          if (accounts is List) {
            return accounts.whereType<Map<String, dynamic>>().toList();
          }
        }
      }
    } catch (e) {
      debugPrint('[AuthService] fetchDemoAccounts error: $e');
    }
    return [];
  }

  /// Làm mới phiên đăng nhập qua refresh token
  /// POST /api/v1/auth/refresh
  Future<bool> refreshSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rt = _refreshToken ?? prefs.getString(_refreshTokenKey);
      if (rt == null || rt.isEmpty) return false;

      final response = await http
          .post(
            Uri.parse(ApiConfig.refreshUrl),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'refreshToken': rt}),
          )
          .timeout(const Duration(seconds: 8));

      final Map<String, dynamic> body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true && body['data'] is Map<String, dynamic>) {
        final data = body['data'] as Map<String, dynamic>;
        _token = data['token'] as String?;
        if (_token != null) {
          await _client.saveToken(_token!);
        }
        if (data['refreshToken'] != null) {
          _refreshToken = data['refreshToken'].toString();
          await prefs.setString(_refreshTokenKey, _refreshToken!);
        }
        if (data['user'] is Map<String, dynamic>) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          await _saveUserToLocal(_currentUser!);
        }
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('[AuthService] refreshSession error: $e');
    }
    return false;
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
          'dataApi': data['dataApi'] == 'connected' ? 'Đã kết nối' : 'Không phản hồi',
          'database': data['database'] == 'connected' ? 'Đã kết nối' : 'Mất kết nối',
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
            'message': body['message'] ?? 'Dịch vụ chưa sẵn sàng (Mã: ${response.statusCode})',
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
            'message': 'Backend đang hoạt động nhưng mất kết nối đến Data API/CSDL.',
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
  Future<bool> login(String username, String password, {bool rememberMe = true}) async {
    _isLoading = true;
    _lastError = null;
    notifyListeners();

    try {
      http.Response response;
      try {
        response = await http
            .post(
              Uri.parse(ApiConfig.loginUrl),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'username': username.trim(),
                'password': password,
              }),
            )
            .timeout(const Duration(seconds: 6));
      } catch (_) {
        ApiConfig.resetBaseUrl();
        await ApiConfig.autoDetectBaseUrl();
        response = await http
            .post(
              Uri.parse(ApiConfig.loginUrl),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'username': username.trim(),
                'password': password,
              }),
            )
            .timeout(const Duration(seconds: 10));
      }

      final Map<String, dynamic> body = jsonDecode(response.body);

      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        _token = data['token'] as String?;
        if (_token != null) {
          await _client.saveToken(_token!);
        }
        if (data['refreshToken'] != null) {
          _refreshToken = data['refreshToken'].toString();
          try {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString(_refreshTokenKey, _refreshToken!);
          } catch (_) {}
        }
        if (data['user'] != null) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          await _saveUserToLocal(_currentUser!);
        }

        try {
          final prefs = await SharedPreferences.getInstance();
          if (rememberMe) {
            await prefs.setString(
              _savedCredsKey,
              jsonEncode({
                'username': username.trim(),
                'password': password,
              }),
            );
          } else {
            await prefs.remove(_savedCredsKey);
          }
        } catch (_) {}

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _lastError = body['message'] as String? ?? 'Đăng nhập không thành công.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      debugPrint('[AuthService] login error: $e');
      _lastError = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Đăng nhập ngầm trong nền để làm mới token tự động mà không làm gián đoạn người dùng
  Future<bool> silentLogin(String username, String password) async {
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
          .timeout(const Duration(seconds: 8));

      final Map<String, dynamic> body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        _token = data['token'] as String?;
        if (_token != null) {
          await _client.saveToken(_token!);
        }
        if (data['refreshToken'] != null) {
          _refreshToken = data['refreshToken'].toString();
          try {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString(_refreshTokenKey, _refreshToken!);
          } catch (_) {}
        }
        if (data['user'] != null) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          await _saveUserToLocal(_currentUser!);
        }
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('[AuthService] silentLogin error: $e');
    }
    return false;
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
      if (email != null && email.trim().isNotEmpty) payload['email'] = email.trim().toLowerCase();
      if (phone != null && phone.trim().isNotEmpty) payload['phone'] = phone.trim();
      if (role == 'seller' && shopName != null && shopName.trim().isNotEmpty) {
        payload['shopName'] = shopName.trim();
      }
      if (role == 'seller' && shopTagline != null) {
        payload['shopTagline'] = shopTagline.trim();
      }
      if (role == 'seller' && sellerProfile != null) {
        payload['sellerProfile'] = sellerProfile;
      }

      final response = await _client.post('/api/v1/auth/register', body: payload);

      if (response.success && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        _token = data['token']?.toString();
        if (_token != null && _token!.isNotEmpty) {
          await _client.saveToken(_token!);
        }
        if (data['refreshToken'] != null) {
          _refreshToken = data['refreshToken'].toString();
          try {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString(_refreshTokenKey, _refreshToken!);
          } catch (_) {}
        }
        if (data['user'] is Map<String, dynamic>) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          await _saveUserToLocal(_currentUser!);
        }
        try {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(
            _savedCredsKey,
            jsonEncode({
              'username': username.trim().toLowerCase(),
              'password': password,
            }),
          );
        } catch (_) {}
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
      debugPrint('[AuthService] register error: $e');
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

        // 1. Cập nhật JWT Token & RefreshToken mới mang quyền seller
        if (data['token'] != null) {
          _token = data['token'].toString();
          await _client.saveToken(_token!);
        }
        if (data['refreshToken'] != null) {
          _refreshToken = data['refreshToken'].toString();
          try {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString(_refreshTokenKey, _refreshToken!);
          } catch (_) {}
        }

        // 2. Cập nhật User hiện tại sang role seller và shopId
        final shopObj = data['shop'];
        final newShopId = (shopObj is Map && shopObj['shopId'] != null)
            ? shopObj['shopId'].toString()
            : (data['user']?['shopId']?.toString() ?? '');

        if (data['user'] is Map<String, dynamic>) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          await _saveUserToLocal(_currentUser!);
        } else if (_currentUser != null) {
          _currentUser = _currentUser!.copyWith(
            role: 'seller',
            shopId: newShopId.isNotEmpty ? newShopId : _currentUser!.shopId,
          );
          await _saveUserToLocal(_currentUser!);
        }

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
    final t = _token ?? await _client.getToken();
    if (t == null || t.isEmpty) return null;

    try {
      final response = await http.get(
        Uri.parse(ApiConfig.meUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $t',
        },
      ).timeout(const Duration(seconds: 5));

      final body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        if (data['user'] != null) {
          _token = t;
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          await _saveUserToLocal(_currentUser!);
          notifyListeners();
          return _currentUser;
        }
      }
    } catch (e) {
      debugPrint('[AuthService] fetchCurrentUser error: $e');
    }
    return null;
  }

  /// Khôi phục thông tin user tức thì từ bộ nhớ máy
  Future<User?> restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      try {
        await prefs.reload();
      } catch (_) {}

      final t = await _client.getToken();
      if (t != null && t.isNotEmpty) {
        _token = t;
      }
      _refreshToken = prefs.getString(_refreshTokenKey);

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

      _syncSessionInBackground(prefs);
    } catch (e) {
      debugPrint('[AuthService] restoreSession error: $e');
    }

    return _currentUser;
  }

  /// Đồng bộ phiên đăng nhập ngầm trong nền
  void _syncSessionInBackground(SharedPreferences prefs) async {
    try {
      if (_token != null && _token!.isNotEmpty) {
        final freshUser = await fetchCurrentUser();
        if (freshUser != null) {
          _currentUser = freshUser;
          await _saveUserToLocal(freshUser);
          notifyListeners();
          return;
        }
      }

      final refreshed = await refreshSession();
      if (refreshed) return;

      final credsStr = prefs.getString(_savedCredsKey);
      if (credsStr != null) {
        final creds = jsonDecode(credsStr) as Map<String, dynamic>;
        final savedUsername = creds['username'] as String?;
        final savedPassword = creds['password'] as String?;
        if (savedUsername != null && savedPassword != null) {
          debugPrint('[AuthService] Đang gia hạn token ngầm...');
          await silentLogin(savedUsername, savedPassword);
        }
      }
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

      final body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        if (data['user'] != null) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          await _saveUserToLocal(_currentUser!);
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

      final body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'];
        if (data is Map<String, dynamic>) {
          if (data['token'] != null) {
            _token = data['token'].toString();
            await _client.saveToken(_token!);
          }
          if (data['refreshToken'] != null) {
            _refreshToken = data['refreshToken'].toString();
            try {
              final prefs = await SharedPreferences.getInstance();
              await prefs.setString(_refreshTokenKey, _refreshToken!);
            } catch (_) {}
          }
        }
        try {
          final prefs = await SharedPreferences.getInstance();
          final credsStr = prefs.getString(_savedCredsKey);
          if (credsStr != null) {
            final creds = jsonDecode(credsStr) as Map<String, dynamic>;
            creds['password'] = newPassword;
            await prefs.setString(_savedCredsKey, jsonEncode(creds));
          }
        } catch (_) {}

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
      final ordersRes = await _client.get('/api/v1/orders', queryParams: {'limit': '50', 'offset': '0'});
      final walletRes = await _client.get('/api/v1/vouchers/wallet', queryParams: {'page': '1'});

      int orderCount = 0;
      double totalSpent = 0;
      if (ordersRes.success && ordersRes.data != null) {
        List<dynamic> list = [];
        if (ordersRes.data is Map && ordersRes.data['orders'] is List) {
          list = ordersRes.data['orders'] as List;
          orderCount = (ordersRes.data['total'] as num?)?.toInt() ?? list.length;
        } else if (ordersRes.data is List) {
          list = ordersRes.data as List;
          orderCount = list.length;
        }
        for (final o in list) {
          if (o is Map && o['status']?.toString() != 'cancelled') {
            final amt = num.tryParse((o['totalAmount'] ?? o['total_amount'] ?? 0).toString()) ?? 0;
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
  void logout() {
    final oldToken = _token;
    final oldRefreshToken = _refreshToken;
    _token = null;
    _refreshToken = null;
    _currentUser = null;
    _lastError = null;
    try {
      if (oldToken != null) {
        http.post(
          Uri.parse(ApiConfig.logoutUrl),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $oldToken',
          },
          body: jsonEncode({
            if (oldRefreshToken != null) 'refreshToken': oldRefreshToken,
          }),
        ).catchError((_) => http.Response('', 500));
      }
    } catch (_) {}
    try {
      _client.clearToken().catchError((_) {});
    } catch (_) {}
    try {
      SharedPreferences.getInstance().then((prefs) {
        prefs.remove(_userKey);
        prefs.remove(_refreshTokenKey);
        prefs.remove(_userKeyId);
        prefs.remove(_userKeyUsername);
        prefs.remove(_userKeyFullName);
        prefs.remove(_userKeyEmail);
        prefs.remove(_userKeyPhone);
        prefs.remove(_userKeyRole);
        prefs.remove(_userKeyShopId);
        prefs.remove(_userKeyAvatar);
        prefs.remove(_userKeyStatus);
        prefs.remove(_userKeyIsLoggedIn);
        prefs.remove(_savedCredsKey);
      }).catchError((_) {});
    } catch (_) {}
    notifyListeners();
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
      if (user.shopId != null) await prefs.setString(_userKeyShopId, user.shopId!);
      if (user.avatarUrl != null) await prefs.setString(_userKeyAvatar, user.avatarUrl!);
      await prefs.setString(_userKeyStatus, user.status);
      await prefs.setBool(_userKeyIsLoggedIn, true);
    } catch (e) {
      debugPrint('[AuthService] _saveUserToLocal error: $e');
    }
  }
}
