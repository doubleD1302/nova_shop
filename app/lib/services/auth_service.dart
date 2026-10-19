import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import 'api_config.dart';

class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  String? _token;
  UserModel? _currentUser;
  bool _isLoading = false;
  String? _lastError;

  String? get token => _token;
  UserModel? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get lastError => _lastError;
  bool get isAuthenticated => _token != null && _currentUser != null;

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
      // Nếu cổng hiện tại bị đứt (ví dụ vừa tháo cáp USB), tự động dò tìm
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
    try {
      final response = await http
          .get(Uri.parse(ApiConfig.readyUrl))
          .timeout(const Duration(seconds: 5));
      final data = jsonDecode(response.body);
      return {
        'statusCode': response.statusCode,
        'success': data['success'] == true,
        'data': data['data'],
        'message': data['message'] ?? '',
      };
    } catch (e) {
      debugPrint('[AuthService] checkReadiness error: $e');
      return {
        'statusCode': 0,
        'success': false,
        'error': e.toString(),
      };
    }
  }

  /// Đăng nhập tài khoản
  Future<bool> login(String username, String password) async {
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
        if (data['user'] != null) {
          _currentUser = UserModel.fromJson(data['user'] as Map<String, dynamic>);
        }
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

  /// Đăng ký tài khoản người dùng mới
  Future<bool> register({
    required String username,
    required String password,
    required String fullName,
    String? email,
    String? phone,
    String role = 'buyer',
  }) async {
    _isLoading = true;
    _lastError = null;
    notifyListeners();

    try {
      final response = await http
          .post(
            Uri.parse(ApiConfig.registerUrl),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'username': username.trim().toLowerCase(),
              'password': password,
              'fullName': fullName.trim(),
              'email': email,
              'phone': phone,
              'role': role,
            }),
          )
          .timeout(const Duration(seconds: 10));

      final Map<String, dynamic> body = jsonDecode(response.body);

      if ((response.statusCode == 200 || response.statusCode == 201) && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        _token = data['token'] as String?;
        if (data['user'] != null) {
          _currentUser = UserModel.fromJson(data['user'] as Map<String, dynamic>);
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

  /// Lấy thông tin tài khoản hiện tại với JWT Token
  Future<UserModel?> fetchCurrentUser() async {
    if (_token == null) return null;

    try {
      final response = await http.get(
        Uri.parse(ApiConfig.meUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
        },
      ).timeout(const Duration(seconds: 5));

      final body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        if (data['user'] != null) {
          _currentUser = UserModel.fromJson(data['user'] as Map<String, dynamic>);
          notifyListeners();
          return _currentUser;
        }
      }
    } catch (e) {
      debugPrint('[AuthService] fetchCurrentUser error: $e');
    }
    return null;
  }

  /// Cập nhật thông tin hồ sơ tài khoản
  Future<bool> updateProfile({
    String? fullName,
    String? email,
    String? phone,
    String? avatarUrl,
  }) async {
    if (_token == null) {
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
              'Authorization': 'Bearer $_token',
            },
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 10));

      final body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
        final data = body['data'] as Map<String, dynamic>;
        if (data['user'] != null) {
          _currentUser = UserModel.fromJson(data['user'] as Map<String, dynamic>);
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
    if (_token == null) {
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
              'Authorization': 'Bearer $_token',
            },
            body: jsonEncode({
              'currentPassword': currentPassword,
              'newPassword': newPassword,
            }),
          )
          .timeout(const Duration(seconds: 10));

      final body = jsonDecode(response.body);
      if (response.statusCode == 200 && body['success'] == true) {
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

  /// Lấy thống kê tài khoản (số đơn hàng, tổng chi tiêu)
  Future<Map<String, dynamic>?> fetchUserStats() async {
    if (_token == null) return null;

    try {
      final response = await http.get(
        Uri.parse(ApiConfig.userStatsUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_token',
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

  /// Đăng xuất tài khoản
  void logout() {
    _token = null;
    _currentUser = null;
    _lastError = null;
    notifyListeners();
  }
}
