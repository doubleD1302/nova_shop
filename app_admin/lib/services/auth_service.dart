import '../config/api_config.dart';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';

class AdminUser {
  final String id;
  final String username;
  final String fullName;
  final String? email;
  final String? phone;
  final String role;
  final String status;

  AdminUser({
    required this.id,
    required this.username,
    required this.fullName,
    this.email,
    this.phone,
    required this.role,
    required this.status,
  });

  factory AdminUser.fromJson(Map<String, dynamic> json) {
    return AdminUser(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? json['full_name']?.toString() ?? json['username']?.toString() ?? 'Admin',
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      role: json['role']?.toString() ?? 'admin',
      status: json['status']?.toString() ?? 'active',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'fullName': fullName,
    'email': email,
    'phone': phone,
    'role': role,
    'status': status,
  };
}

class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final ApiClient _api = ApiClient();
  AdminUser? _currentUser;
  bool _isAuthenticated = false;

  AdminUser? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;

  static const String _userKey = 'shopnova_admin_user_profile';

  Future<void> restoreSession() async {
    final token = await _api.getToken();
    if (token == null || token.isEmpty) {
      _isAuthenticated = false;
      return;
    }

    try {
      await ApiConfig.autoDetectBaseUrl();
      final res = await _api.get('/api/v1/auth/me');
      if (res.success && res.data != null) {
        final userData = res.data['user'] ?? res.data;
        _currentUser = AdminUser.fromJson(userData);
        _isAuthenticated = true;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_userKey, jsonEncode(_currentUser!.toJson()));
        notifyListeners();
      } else if (res.statusCode == 401) {
        // Token hết hạn -> đăng xuất tự động để người dùng đăng nhập lại nhận dữ liệu mới
        await logout();
      } else {
        // Có thể server đang offline tạm thời nhưng có profile cũ
        final prefs = await SharedPreferences.getInstance();
        final userJson = prefs.getString(_userKey);
        if (userJson != null) {
          _currentUser = AdminUser.fromJson(jsonDecode(userJson));
          _isAuthenticated = true;
          notifyListeners();
        }
      }
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      final userJson = prefs.getString(_userKey);
      if (userJson != null) {
        try {
          _currentUser = AdminUser.fromJson(jsonDecode(userJson));
          _isAuthenticated = true;
          notifyListeners();
        } catch (_) {}
      }
    }
  }

  Future<ApiResponse> login(String usernameOrEmail, String password) async {
    try {
      final res = await _api.post('/api/v1/auth/login', body: {
        'username': usernameOrEmail.trim(),
        'usernameOrEmail': usernameOrEmail.trim(),
        'password': password,
      });

      if (res.success && res.data != null) {
        final token = res.data['accessToken'] ?? res.data['token'];
        final userData = res.data['user'] ?? res.data;
        if (token != null) {
          await _api.saveToken(token.toString());
        }
        _currentUser = AdminUser.fromJson(userData);
        _isAuthenticated = true;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_userKey, jsonEncode(_currentUser!.toJson()));

        notifyListeners();
        return res;
      }
      return res;
    } catch (e) {
      return ApiResponse.error('Lỗi khi đăng nhập quản trị: $e');
    }
  }

  Future<void> logout() async {
    try {
      await _api.post('/api/v1/auth/logout');
    } catch (_) {}
    await _api.clearToken();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
    _currentUser = null;
    _isAuthenticated = false;
    notifyListeners();
  }
}

