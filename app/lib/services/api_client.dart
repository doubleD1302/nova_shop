import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

/// Kết quả phản hồi chuẩn từ Backend ShopNova
class ApiResponse {
  final bool success;
  final int statusCode;
  final String message;
  final dynamic data;
  final dynamic error;
  final Map<String, dynamic>? meta;

  const ApiResponse({
    required this.success,
    required this.statusCode,
    required this.message,
    this.data,
    this.error,
    this.meta,
  });

  factory ApiResponse.fromResponse(http.Response res) {
    try {
      final decoded = jsonDecode(utf8.decode(res.bodyBytes));
      if (decoded is Map<String, dynamic>) {
        return ApiResponse(
          success: decoded['success'] == true,
          statusCode: res.statusCode,
          message: decoded['message']?.toString() ?? '',
          data: decoded['data'],
          error: decoded['error'],
          meta: decoded['meta'] is Map<String, dynamic> ? decoded['meta'] as Map<String, dynamic> : null,
        );
      }
    } catch (_) {}

    return ApiResponse(
      success: res.statusCode >= 200 && res.statusCode < 300,
      statusCode: res.statusCode,
      message: res.statusCode >= 200 && res.statusCode < 300
          ? 'Thành công'
          : 'Lỗi máy chủ (${res.statusCode})',
      data: null,
    );
  }

  factory ApiResponse.error(String message, {int statusCode = 500, dynamic error}) {
    return ApiResponse(
      success: false,
      statusCode: statusCode,
      message: message,
      error: error,
    );
  }
}

/// HTTP Client Singleton cho ứng dụng Flutter ShopNova
class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  static const String _tokenKey = 'novashop_jwt_token';
  String? _cachedToken;

  /// Lấy access token hiện tại
  Future<String?> getToken() async {
    if (_cachedToken != null) return _cachedToken;
    final prefs = await SharedPreferences.getInstance();
    _cachedToken = prefs.getString(_tokenKey);
    return _cachedToken;
  }

  /// Lưu access token mới
  Future<void> saveToken(String token) async {
    _cachedToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  /// Xóa token khi đăng xuất
  Future<void> clearToken() async {
    _cachedToken = null;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_tokenKey);
    } catch (_) {}
  }

  /// Tạo headers mặc định kèm Bearer token (nếu có)
  Future<Map<String, String>> _buildHeaders([Map<String, String>? customHeaders]) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    final token = await getToken();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    if (customHeaders != null) {
      headers.addAll(customHeaders);
    }

    return headers;
  }

  /// Gửi HTTP GET
  Future<ApiResponse> get(String endpoint, {Map<String, String>? queryParams, Map<String, String>? headers}) async {
    try {
      final uri = _buildUri(endpoint, queryParams);
      final reqHeaders = await _buildHeaders(headers);
      final res = await http.get(uri, headers: reqHeaders).timeout(ApiConfig.timeout);
      return ApiResponse.fromResponse(res);
    } on SocketException {
      return ApiResponse.error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng internet.');
    } on TimeoutException {
      return ApiResponse.error('Kết nối quá thời gian chờ (Timeout). Vui lòng thử lại sau.');
    } catch (e) {
      return ApiResponse.error('Đã xảy ra lỗi không xác định: $e');
    }
  }

  /// Gửi HTTP POST
  Future<ApiResponse> post(String endpoint, {dynamic body, Map<String, String>? headers}) async {
    try {
      final uri = _buildUri(endpoint);
      final reqHeaders = await _buildHeaders(headers);
      final jsonBody = body != null ? jsonEncode(body) : null;
      final res = await http.post(uri, headers: reqHeaders, body: jsonBody).timeout(ApiConfig.timeout);
      return ApiResponse.fromResponse(res);
    } on SocketException {
      return ApiResponse.error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng internet.');
    } on TimeoutException {
      return ApiResponse.error('Kết nối quá thời gian chờ (Timeout). Vui lòng thử lại sau.');
    } catch (e) {
      return ApiResponse.error('Đã xảy ra lỗi không xác định: $e');
    }
  }

  /// Gửi HTTP PUT
  Future<ApiResponse> put(String endpoint, {dynamic body, Map<String, String>? headers}) async {
    try {
      final uri = _buildUri(endpoint);
      final reqHeaders = await _buildHeaders(headers);
      final jsonBody = body != null ? jsonEncode(body) : null;
      final res = await http.put(uri, headers: reqHeaders, body: jsonBody).timeout(ApiConfig.timeout);
      return ApiResponse.fromResponse(res);
    } on SocketException {
      return ApiResponse.error('Không thể kết nối đến máy chủ.');
    } on TimeoutException {
      return ApiResponse.error('Kết nối quá thời gian chờ.');
    } catch (e) {
      return ApiResponse.error('Đã xảy ra lỗi: $e');
    }
  }

  /// Gửi HTTP DELETE
  Future<ApiResponse> delete(String endpoint, {Map<String, String>? headers}) async {
    try {
      final uri = _buildUri(endpoint);
      final reqHeaders = await _buildHeaders(headers);
      final res = await http.delete(uri, headers: reqHeaders).timeout(ApiConfig.timeout);
      return ApiResponse.fromResponse(res);
    } on SocketException {
      return ApiResponse.error('Không thể kết nối đến máy chủ.');
    } on TimeoutException {
      return ApiResponse.error('Kết nối quá thời gian chờ.');
    } catch (e) {
      return ApiResponse.error('Đã xảy ra lỗi: $e');
    }
  }

  /// Gửi HTTP PATCH
  Future<ApiResponse> patch(String endpoint, {dynamic body, Map<String, String>? headers}) async {
    try {
      final uri = _buildUri(endpoint);
      final reqHeaders = await _buildHeaders(headers);
      final jsonBody = body != null ? jsonEncode(body) : null;
      final res = await http.patch(uri, headers: reqHeaders, body: jsonBody).timeout(ApiConfig.timeout);
      return ApiResponse.fromResponse(res);
    } on SocketException {
      return ApiResponse.error('Không thể kết nối đến máy chủ.');
    } on TimeoutException {
      return ApiResponse.error('Kết nối quá thời gian chờ.');
    } catch (e) {
      return ApiResponse.error('Đã xảy ra lỗi: $e');
    }
  }

  /// Ghép base URL với endpoint và query parameters
  Uri _buildUri(String endpoint, [Map<String, String>? queryParams]) {
    final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    final fullUrl = '${ApiConfig.baseUrl}$cleanEndpoint';
    final parsed = Uri.parse(fullUrl);

    if (queryParams != null && queryParams.isNotEmpty) {
      final merged = Map<String, String>.from(parsed.queryParameters)..addAll(queryParams);
      return parsed.replace(queryParameters: merged);
    }

    return parsed;
  }
}
