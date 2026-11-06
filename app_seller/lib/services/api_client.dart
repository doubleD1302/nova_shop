import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiResponse {
  final bool success;
  final int statusCode;
  final String message;
  final dynamic data;
  final dynamic error;

  const ApiResponse({
    required this.success,
    required this.statusCode,
    required this.message,
    this.data,
    this.error,
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

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  final http.Client _client = http.Client();
  static const Duration _defaultTimeout = Duration(seconds: 15);
  static const String _tokenKey = 'shopnova_seller_access_token';

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  Future<Map<String, String>> _buildHeaders({Map<String, String>? extra}) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    final token = await getToken();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    if (extra != null) {
      headers.addAll(extra);
    }
    return headers;
  }

  Future<ApiResponse> get(String endpoint, {Map<String, String>? queryParams, Map<String, String>? headers}) async {
    return _sendRequest(() async {
      final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
      final fullUrl = '${ApiConfig.baseUrl}$cleanEndpoint';
      var uri = Uri.parse(fullUrl);
      if (queryParams != null && queryParams.isNotEmpty) {
        uri = uri.replace(queryParameters: queryParams);
      }
      final allHeaders = await _buildHeaders(extra: headers);
      final response = await _client.get(uri, headers: allHeaders).timeout(_defaultTimeout);
      return ApiResponse.fromResponse(response);
    });
  }

  Future<ApiResponse> post(String endpoint, {dynamic body, Map<String, String>? headers}) async {
    return _sendRequest(() async {
      final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
      final uri = Uri.parse('${ApiConfig.baseUrl}$cleanEndpoint');
      final allHeaders = await _buildHeaders(extra: headers);
      final response = await _client.post(
        uri,
        headers: allHeaders,
        body: body != null ? jsonEncode(body) : null,
      ).timeout(_defaultTimeout);
      return ApiResponse.fromResponse(response);
    });
  }

  Future<ApiResponse> patch(String endpoint, {dynamic body, Map<String, String>? headers}) async {
    return _sendRequest(() async {
      final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
      final uri = Uri.parse('${ApiConfig.baseUrl}$cleanEndpoint');
      final allHeaders = await _buildHeaders(extra: headers);
      final response = await _client.patch(
        uri,
        headers: allHeaders,
        body: body != null ? jsonEncode(body) : null,
      ).timeout(_defaultTimeout);
      return ApiResponse.fromResponse(response);
    });
  }

  Future<ApiResponse> put(String endpoint, {dynamic body, Map<String, String>? headers}) async {
    return _sendRequest(() async {
      final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
      final uri = Uri.parse('${ApiConfig.baseUrl}$cleanEndpoint');
      final allHeaders = await _buildHeaders(extra: headers);
      final response = await _client.put(
        uri,
        headers: allHeaders,
        body: body != null ? jsonEncode(body) : null,
      ).timeout(_defaultTimeout);
      return ApiResponse.fromResponse(response);
    });
  }

  Future<ApiResponse> delete(String endpoint, {Map<String, String>? headers}) async {
    return _sendRequest(() async {
      final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
      final uri = Uri.parse('${ApiConfig.baseUrl}$cleanEndpoint');
      final allHeaders = await _buildHeaders(extra: headers);
      final response = await _client.delete(uri, headers: allHeaders).timeout(_defaultTimeout);
      return ApiResponse.fromResponse(response);
    });
  }

  Future<ApiResponse> _sendRequest(Future<ApiResponse> Function() requestFn) async {
    try {
      return await requestFn();
    } on SocketException {
      return ApiResponse.error('Không thể kết nối tới máy chủ ShopNova. Vui lòng kiểm tra mạng.');
    } on TimeoutException {
      return ApiResponse.error('Yêu cầu hết thời gian chờ (Timeout). Vui lòng thử lại.');
    } catch (e) {
      return ApiResponse.error('Đã xảy ra lỗi kết nối: $e');
    }
  }
}

