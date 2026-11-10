import '../config/api_config.dart';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';

class SellerUser {
  final String id;
  final String username;
  final String fullName;
  final String? email;
  final String? phone;
  final String role;
  final String? shopId;
  final String status;

  SellerUser({
    required this.id,
    required this.username,
    required this.fullName,
    this.email,
    this.phone,
    required this.role,
    this.shopId,
    required this.status,
  });

  bool get isSeller => role == 'seller' || role == 'admin' || (shopId != null && shopId!.isNotEmpty);

  factory SellerUser.fromJson(Map<String, dynamic> json) {
    return SellerUser(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? json['full_name']?.toString() ?? json['username']?.toString() ?? 'Chủ Shop',
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      role: json['role']?.toString() ?? 'seller',
      shopId: json['shopId']?.toString() ?? json['shop_id']?.toString(),
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
    'shopId': shopId,
    'status': status,
  };
}

class AuthService extends ChangeNotifier {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final ApiClient _api = ApiClient();
  SellerUser? _currentUser;
  bool _isAuthenticated = false;

  SellerUser? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;

  static const String _userKey = 'shopnova_seller_user_profile';
  static const String _refreshTokenKey = 'shopnova_seller_refresh_token';

  /// Lấy danh sách tài khoản demo từ Backend API
  /// GET /api/v1/auth/demo-accounts
  Future<List<Map<String, dynamic>>> fetchDemoAccounts() async {
    try {
      final res = await _api.get('/api/v1/auth/demo-accounts');
      if (res.success && res.data is Map) {
        final accounts = res.data['accounts'];
        if (accounts is List) {
          return accounts.whereType<Map<String, dynamic>>().toList();
        }
      }
    } catch (_) {}
    return [];
  }

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
        _currentUser = SellerUser.fromJson(userData);
        _isAuthenticated = true;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_userKey, jsonEncode(_currentUser!.toJson()));
        notifyListeners();
      } else if (res.statusCode == 401) {
        final refreshed = await refreshSession();
        if (!refreshed) {
          await logout();
        }
      } else {
        final prefs = await SharedPreferences.getInstance();
        final userJson = prefs.getString(_userKey);
        if (userJson != null) {
          _currentUser = SellerUser.fromJson(jsonDecode(userJson));
          _isAuthenticated = true;
          notifyListeners();
        }
      }
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      final userJson = prefs.getString(_userKey);
      if (userJson != null) {
        try {
          _currentUser = SellerUser.fromJson(jsonDecode(userJson));
          _isAuthenticated = true;
          notifyListeners();
        } catch (_) {}
      }
    }
  }

  Future<bool> refreshSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rt = prefs.getString(_refreshTokenKey);
      if (rt == null || rt.isEmpty) return false;
      final res = await _api.post('/api/v1/auth/refresh', body: {'refreshToken': rt});
      if (res.success && res.data is Map) {
        final token = res.data['token'];
        if (token != null) await _api.saveToken(token.toString());
        if (res.data['refreshToken'] != null) {
          await prefs.setString(_refreshTokenKey, res.data['refreshToken'].toString());
        }
        if (res.data['user'] is Map<String, dynamic>) {
          _currentUser = SellerUser.fromJson(res.data['user'] as Map<String, dynamic>);
          _isAuthenticated = true;
          await prefs.setString(_userKey, jsonEncode(_currentUser!.toJson()));
          notifyListeners();
        }
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<ApiResponse> login(String usernameOrEmail, String password) async {
    try {
      final res = await _api.post('/api/v1/auth/login', body: {
        'username': usernameOrEmail.trim(),
        'password': password,
      });

      if (res.success && res.data != null) {
        final token = res.data['accessToken'] ?? res.data['token'];
        final refreshToken = res.data['refreshToken'];
        final userData = res.data['user'] ?? res.data;
        if (token != null) {
          await _api.saveToken(token.toString());
        }
        _currentUser = SellerUser.fromJson(userData);
        _isAuthenticated = true;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_userKey, jsonEncode(_currentUser!.toJson()));
        if (refreshToken != null) {
          await prefs.setString(_refreshTokenKey, refreshToken.toString());
        }

        notifyListeners();
        return res;
      }
      return res;
    } catch (e) {
      return ApiResponse.error('Lỗi khi đăng nhập Kênh Người Bán: $e');
    }
  }

  Future<ApiResponse> registerSeller({
    required String username,
    required String password,
    required String fullName,
    required String email,
    String? phone,
    required String shopName,
    String? shopTagline,
    Map<String, dynamic>? sellerProfile,
  }) async {
    try {
      final res = await _api.post('/api/v1/auth/register', body: {
        'username': username.trim().toLowerCase(),
        'password': password,
        'fullName': fullName.trim(),
        'email': email.trim().toLowerCase(),
        if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
        'role': 'seller',
        'shopName': shopName.trim(),
        if (shopTagline != null && shopTagline.trim().isNotEmpty) 'shopTagline': shopTagline.trim(),
        if (sellerProfile != null) 'sellerProfile': sellerProfile,
      });

      if (res.success && res.data != null) {
        final token = res.data['accessToken'] ?? res.data['token'];
        final refreshToken = res.data['refreshToken'];
        final userData = res.data['user'] ?? res.data;
        if (token != null) {
          await _api.saveToken(token.toString());
        }
        _currentUser = SellerUser.fromJson(userData);
        _isAuthenticated = true;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_userKey, jsonEncode(_currentUser!.toJson()));
        if (refreshToken != null) {
          await prefs.setString(_refreshTokenKey, refreshToken.toString());
        }

        notifyListeners();
        return res;
      }
      return res;
    } catch (e) {
      return ApiResponse.error('Lỗi khi đăng ký gian hàng: $e');
    }
  }

  Future<ApiResponse> openSellerShop({
    required String shopName,
    String? shopTagline,
    required Map<String, dynamic> sellerProfile,
  }) async {
    try {
      final res = await _api.post('/api/v1/auth/seller-shop', body: {
        'shopName': shopName.trim(),
        if (shopTagline != null && shopTagline.trim().isNotEmpty) 'shopTagline': shopTagline.trim(),
        'sellerProfile': sellerProfile,
      });

      if (res.success && res.data != null) {
        final token = res.data['token'] ?? res.data['accessToken'];
        final refreshToken = res.data['refreshToken'];
        final userData = res.data['user'] ?? res.data;
        if (token != null) {
          await _api.saveToken(token.toString());
        }
        if (userData != null) {
          _currentUser = SellerUser.fromJson(userData);
          _isAuthenticated = true;
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString(_userKey, jsonEncode(_currentUser!.toJson()));
          if (refreshToken != null) {
            await prefs.setString(_refreshTokenKey, refreshToken.toString());
          }
          notifyListeners();
        }
      }
      return res;
    } catch (e) {
      return ApiResponse.error('Lỗi khi mở gian hàng người bán: $e');
    }
  }

  Future<void> logout() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final rt = prefs.getString(_refreshTokenKey);
      await _api.post('/api/v1/auth/logout', body: {
        if (rt != null && rt.isNotEmpty) 'refreshToken': rt,
      });
      await prefs.remove(_refreshTokenKey);
      await prefs.remove(_userKey);
    } catch (_) {}
    await _api.clearToken();
    _currentUser = null;
    _isAuthenticated = false;
    notifyListeners();
  }
}
