import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import 'api_client.dart';

/// Service xử lý xác thực tài khoản (Đăng nhập, Đăng ký, Hồ sơ cá nhân)
class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final ApiClient _client = ApiClient();
  static const String _userKey = 'novashop_current_user';
  User? _currentUser;

  User? get currentUser => _currentUser;

  /// Đăng nhập tài khoản bằng username và password
  Future<ApiResponse> login(String username, String password) async {
    final response = await _client.post(
      '/api/v1/auth/login',
      body: {
        'username': username.trim(),
        'password': password,
      },
    );

    if (response.success && response.data is Map<String, dynamic>) {
      final data = response.data as Map<String, dynamic>;
      final token = data['token']?.toString();
      if (token != null && token.isNotEmpty) {
        await _client.saveToken(token);
      }

      if (data['user'] is Map<String, dynamic>) {
        _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
        await _saveUserToLocal(_currentUser!);
      }
    }

    return response;
  }

  /// Đăng ký tài khoản người mua hoặc người bán mới
  Future<ApiResponse> register({
    required String username,
    required String password,
    required String fullName,
    String? email,
    String? phone,
    String role = 'buyer',
    String? shopName,
  }) async {
    final body = <String, dynamic>{
      'username': username.trim(),
      'password': password,
      'fullName': fullName.trim(),
      'role': role,
    };

    if (email != null && email.trim().isNotEmpty) body['email'] = email.trim();
    if (phone != null && phone.trim().isNotEmpty) body['phone'] = phone.trim();
    if (role == 'seller' && shopName != null && shopName.trim().isNotEmpty) {
      body['shopName'] = shopName.trim();
    }

    final response = await _client.post('/api/v1/auth/register', body: body);

    if (response.success && response.data is Map<String, dynamic>) {
      final data = response.data as Map<String, dynamic>;
      final token = data['token']?.toString();
      if (token != null && token.isNotEmpty) {
        await _client.saveToken(token);
      }

      if (data['user'] is Map<String, dynamic>) {
        _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
        await _saveUserToLocal(_currentUser!);
      }
    }

    return response;
  }

  /// Lấy thông tin tài khoản hiện tại từ Backend qua JWT token
  Future<User?> getMe() async {
    final token = await _client.getToken();
    if (token == null || token.isEmpty) return null;

    final response = await _client.get('/api/v1/auth/me');
    if (response.success && response.data is Map<String, dynamic>) {
      final data = response.data as Map<String, dynamic>;
      if (data['user'] is Map<String, dynamic>) {
        _currentUser = User.fromJson(data['user'] as Map<String, dynamic>);
        await _saveUserToLocal(_currentUser!);
        return _currentUser;
      }
    }

    return null;
  }

  /// Khôi phục thông tin user đã lưu trong máy khi mở app
  Future<User?> restoreSession() async {
    final token = await _client.getToken();
    if (token == null || token.isEmpty) {
      _currentUser = null;
      return null;
    }

    // Nạp tạm user từ SharedPreferences để hiển thị UI nhanh
    final prefs = await SharedPreferences.getInstance();
    final userJsonStr = prefs.getString(_userKey);
    if (userJsonStr != null) {
      try {
        _currentUser = User.fromJson(jsonDecode(userJsonStr));
      } catch (_) {}
    }

    // Đồng bộ thông tin mới nhất từ server
    try {
      final freshUser = await getMe();
      if (freshUser != null) {
        _currentUser = freshUser;
      }
    } catch (_) {}

    return _currentUser;
  }

  /// Đăng xuất tài khoản và xóa token
  Future<void> logout() async {
    _currentUser = null;
    await _client.clearToken();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
  }

  /// Kiểm tra xem người dùng đã đăng nhập chưa
  Future<bool> isLoggedIn() async {
    final token = await _client.getToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> _saveUserToLocal(User user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
  }
}
