import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import 'api_client.dart';
import 'api_config.dart';

/// Service xử lý xác thực tài khoản (Đăng nhập, Đăng ký, Hồ sơ cá nhân)
class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final ApiClient _client = ApiClient();
  static const String _userKey = 'novashop_current_user';
  static const String _savedCredsKey = 'novashop_saved_credentials';

  String? _token;
  User? _currentUser;
  bool _isLoading = false;
  String? _lastError;

  String? get token => _token;
  User? get currentUser => _currentUser;
  User? get user => _currentUser;
  bool get isLoading => _isLoading;
  String? get lastError => _lastError;
  bool get isAuthenticated => _currentUser != null;

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
        // Backend vẫn phản hồi nhưng Data API hoặc Database gặp sự cố
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
      // Nếu readyUrl timeout hoặc lỗi, thử kiểm tra health xem backend liveness có phản hồi không
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

      final Map<String, dynamic> body = jsonDecode(response.body);

      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        _token = data['token'] as String?;
        if (_token != null) {
          await _client.saveToken(_token!);
        }
        if (data['user'] != null) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          await _saveUserToLocal(_currentUser!);
        }

        // Lưu thông tin đăng nhập tự động nếu người dùng ghi nhớ
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

  /// Đăng ký tài khoản người dùng mới
  Future<bool> register({
    required String username,
    required String password,
    required String fullName,
    String? email,
    String? phone,
    String role = 'buyer',
    String? shopName,
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
      if (email != null && email.trim().isNotEmpty) payload['email'] = email.trim();
      if (phone != null && phone.trim().isNotEmpty) payload['phone'] = phone.trim();
      if (role == 'seller' && shopName != null && shopName.trim().isNotEmpty) {
        payload['shopName'] = shopName.trim();
      }

      final response = await http
          .post(
            Uri.parse(ApiConfig.registerUrl),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 10));

      final Map<String, dynamic> body = jsonDecode(response.body);

      if ((response.statusCode == 200 || response.statusCode == 201) && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        _token = data['token'] as String?;
        if (_token != null) {
          await _client.saveToken(_token!);
        }
        if (data['user'] != null) {
          _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
          await _saveUserToLocal(_currentUser!);
        }
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _lastError = body['message'] as String? ?? 'Đăng ký không thành công.';
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

  /// Khôi phục thông tin user đã lưu trong máy khi mở app (duy trì phiên bền vững)
  Future<User?> restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();

      // 1. Nạp ngay lập tức thông tin user từ cache máy để hiển thị UI không giật lag
      final userJsonStr = prefs.getString(_userKey);
      if (userJsonStr != null) {
        try {
          _currentUser = User.fromJson(jsonDecode(userJsonStr));
        } catch (_) {}
      }

      // 2. Lấy token JWT đã lưu
      final t = await _client.getToken();
      if (t != null && t.isNotEmpty) {
        _token = t;
      }

      // Báo UI ngay lập tức nếu đã có dữ liệu user trong máy
      if (_currentUser != null) {
        notifyListeners();
      }

      // 3. Thử đồng bộ dữ liệu mới nhất từ server
      if (_token != null && _token!.isNotEmpty) {
        final freshUser = await fetchCurrentUser();
        if (freshUser != null) {
          _currentUser = freshUser;
          notifyListeners();
          return _currentUser;
        }
      }

      // 4. Nếu token hết hạn hoặc chưa có token nhưng máy còn lưu thông tin đăng nhập tự động
      final credsStr = prefs.getString(_savedCredsKey);
      if (credsStr != null) {
        try {
          final creds = jsonDecode(credsStr) as Map<String, dynamic>;
          final savedUsername = creds['username'] as String?;
          final savedPassword = creds['password'] as String?;
          if (savedUsername != null && savedPassword != null) {
            debugPrint('[AuthService] Tự động duy trì phiên đăng nhập ngầm...');
            final ok = await silentLogin(savedUsername, savedPassword);
            if (ok) return _currentUser;
          }
        } catch (_) {}
      }
    } catch (e) {
      debugPrint('[AuthService] restoreSession error: $e');
    }

    // Không tự động đăng xuất người dùng, chỉ đăng xuất khi người dùng chủ động nhấn Đăng xuất
    return _currentUser;
  }

  /// Cập nhật thông tin hồ sơ tài khoản
  Future<bool> updateProfile({
    String? fullName,
    String? phone,
    String? email,
    String? avatarUrl,
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
      if (avatarUrl != null) payload['avatarUrl'] = avatarUrl.trim();

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

  /// Đổi mật khẩu tài khoản
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
          .put(
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
        // Cập nhật lại mật khẩu mới vào bộ nhớ đăng nhập tự động
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
      } else if (response.statusCode == 404) {
        _lastError = 'Chưa có API đổi mật khẩu trên máy chủ Backend hoặc máy chủ đang cập nhật.';
        _isLoading = false;
        notifyListeners();
        return false;
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

  /// Lấy thống kê tài khoản (số đơn hàng, tổng chi tiêu)
  Future<Map<String, dynamic>?> fetchUserStats() async {
    final t = _token ?? await _client.getToken();
    if (t == null) return null;

    try {
      final response = await http.get(
        Uri.parse(ApiConfig.userStatsUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $t',
        },
      ).timeout(const Duration(seconds: 5));

      final body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
        return body['data'] as Map<String, dynamic>?;
      }
    } catch (e) {
      debugPrint('[AuthService] fetchUserStats error: $e');
    }
    return null;
  }

  /// Đăng xuất tài khoản (chỉ khi người dùng chủ động nhấn nút Đăng xuất)
  void logout() {
    _token = null;
    _currentUser = null;
    _lastError = null;
    try {
      _client.clearToken().catchError((_) {});
    } catch (_) {}
    try {
      SharedPreferences.getInstance().then((prefs) {
        prefs.remove(_userKey);
        prefs.remove(_savedCredsKey);
      }).catchError((_) {});
    } catch (_) {}
    notifyListeners();
  }

  Future<void> _saveUserToLocal(User user) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_userKey, jsonEncode(user.toJson()));
    } catch (_) {}
  }
}
