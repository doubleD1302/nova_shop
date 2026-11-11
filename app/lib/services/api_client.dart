import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'session_store.dart';
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
          meta: decoded['meta'] is Map<String, dynamic>
              ? decoded['meta'] as Map<String, dynamic>
              : null,
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

  factory ApiResponse.error(
    String message, {
    int statusCode = 500,
    dynamic error,
  }) {
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

  final SessionStore _sessionStore = SessionStore();
  http.Client? _testHttpClient;
  String? _cachedToken;

  void setHttpClientForTest(http.Client client) {
    _testHttpClient = client;
  }
  Future<bool> Function()? sessionRefresher;
  Future<bool>? _refreshing;
  int _sessionEpoch = 0;
  int _tokenVersion = 0;
  bool _tokenLoaded = false;

  // Invalidate requests immediately, before asynchronous logout cleanup finishes.
  void invalidateSession({bool clearToken = true}) {
    _sessionEpoch++;
    _tokenVersion++;
    if (clearToken) {
      _cachedToken = null;
      _tokenLoaded = true;
    }
    _refreshing = null;
  }

  Future<String?> getToken() async {
    if (_tokenLoaded) return _cachedToken;
    final version = _tokenVersion;
    final token = await _sessionStore.read(SessionStore.accessKey);
    if (version == _tokenVersion) {
      _cachedToken = token;
      _tokenLoaded = true;
    }
    return _cachedToken;
  }

  Future<void> saveToken(String token) async {
    final version = ++_tokenVersion;
    _tokenLoaded = true;
    await _sessionStore.write(SessionStore.accessKey, token);
    if (version == _tokenVersion) _cachedToken = token;
  }

  Future<void> clearToken({bool invalidate = true}) async {
    if (invalidate) invalidateSession();
    await _sessionStore.delete(SessionStore.accessKey);
  }

  Future<bool> _refreshOnce() async {
    if (sessionRefresher == null) return false;
    if (_refreshing != null) return _refreshing!;
    final pending = sessionRefresher!();
    _refreshing = pending;
    try {
      return await pending;
    } finally {
      if (identical(_refreshing, pending)) _refreshing = null;
    }
  }

  /// Tạo headers mặc định kèm Bearer token (nếu có)
  Map<String, String> _buildHeaders(
    String? token,
    Map<String, String>? customHeaders,
  ) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    if (customHeaders != null) {
      headers.addAll(customHeaders);
    }

    return headers;
  }

  Future<ApiResponse> _executeWithAutoReconnect(
    Future<http.Response> Function(Map<String, String> headers, String baseUrl)
    doRequest, {
    Map<String, String>? headers,
    bool retryOnFailure = true,
  }) async {
    final epoch = _sessionEpoch;
    final baseUrl = ApiConfig.baseUrl;
    String? sentToken;
    final customAuth =
        headers?.keys.any((key) => key.toLowerCase() == 'authorization') ??
        false;
    ApiResponse sessionChanged() => ApiResponse.error(
      'Phiên đăng nhập đã thay đổi. Vui lòng thử lại.',
      statusCode: 401,
    );
    try {
      sentToken = await getToken();
      if (epoch != _sessionEpoch) return sessionChanged();
      final res = await doRequest(_buildHeaders(sentToken, headers), baseUrl);
      if (epoch != _sessionEpoch || baseUrl != ApiConfig.baseUrl) {
        return sessionChanged();
      }
      final result = ApiResponse.fromResponse(res);
      final code = result.error is Map ? result.error['code'] : null;
      if (!customAuth &&
          sentToken != null &&
          res.statusCode == 401 &&
          (code == 'AUTH_EXPIRED' || code == 'AUTH_INVALID')) {
        // A late 401 may arrive after another request already refreshed this session.
        if (sentToken == await getToken() && !await _refreshOnce()) {
          return result;
        }
        if (epoch != _sessionEpoch || baseUrl != ApiConfig.baseUrl) {
          return sessionChanged();
        }
        final token = await getToken();
        if (token != null && token != sentToken) {
          final retried = await doRequest(
            _buildHeaders(token, headers),
            baseUrl,
          );
          if (epoch != _sessionEpoch || baseUrl != ApiConfig.baseUrl) {
            return sessionChanged();
          }
          return ApiResponse.fromResponse(retried);
        }
      }
      return result;
    } catch (_) {
      // Không gửi token của phiên sang một Backend khác khi dò lại máy chủ.
      if (!retryOnFailure ||
          sentToken != null ||
          customAuth ||
          epoch != _sessionEpoch ||
          !_tokenLoaded ||
          _cachedToken != null) {
        return ApiResponse.error(
          'Không nhận được phản hồi. Hãy kiểm tra lại kết quả trước khi thử lại.',
        );
      }
      try {
        ApiConfig.resetBaseUrl();
        await ApiConfig.autoDetectBaseUrl();
        if (epoch != _sessionEpoch || await getToken() != null) {
          return sessionChanged();
        }
        final retryRes = await doRequest(
          _buildHeaders(null, headers),
          ApiConfig.baseUrl,
        );
        return ApiResponse.fromResponse(retryRes);
      } on SocketException {
        return ApiResponse.error(
          'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng internet.',
        );
      } on TimeoutException {
        return ApiResponse.error(
          'Kết nối quá thời gian chờ (Timeout). Vui lòng thử lại sau.',
        );
      } catch (e) {
        return ApiResponse.error('Không thể kết nối đến máy chủ API: $e');
      }
    }
  }

  /// Gửi HTTP GET
  Future<ApiResponse> get(
    String endpoint, {
    Map<String, String>? queryParams,
    Map<String, String>? headers,
    bool retryOnFailure = true,
  }) async {
    return _executeWithAutoReconnect(
      (reqHeaders, baseUrl) async {
        final uri = _buildUri(baseUrl, endpoint, queryParams);
        return await (_testHttpClient != null ? _testHttpClient!.get(uri, headers: reqHeaders) : http.get(uri, headers: reqHeaders))
            .timeout(ApiConfig.timeout);
      },
      headers: headers,
      retryOnFailure: retryOnFailure,
    );
  }

  /// Gửi HTTP POST
  Future<ApiResponse> post(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    bool retryOnFailure = true,
  }) async {
    return _executeWithAutoReconnect(
      (reqHeaders, baseUrl) async {
        final uri = _buildUri(baseUrl, endpoint);
        final jsonBody = body != null ? jsonEncode(body) : null;
        return await (_testHttpClient != null ? _testHttpClient!.post(uri, headers: reqHeaders, body: jsonBody) : http.post(uri, headers: reqHeaders, body: jsonBody))
            .timeout(ApiConfig.timeout);
      },
      headers: headers,
      retryOnFailure: retryOnFailure,
    );
  }

  /// Gửi HTTP PUT
  Future<ApiResponse> put(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
  }) async {
    return _executeWithAutoReconnect((reqHeaders, baseUrl) async {
      final uri = _buildUri(baseUrl, endpoint);
      final jsonBody = body != null ? jsonEncode(body) : null;
      return await (_testHttpClient != null ? _testHttpClient!.put(uri, headers: reqHeaders, body: jsonBody) : http.put(uri, headers: reqHeaders, body: jsonBody))
          .timeout(ApiConfig.timeout);
    }, headers: headers);
  }

  /// Gửi HTTP DELETE
  Future<ApiResponse> delete(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    bool retryOnFailure = true,
  }) async {
    return _executeWithAutoReconnect(
      (reqHeaders, baseUrl) async {
        final uri = _buildUri(baseUrl, endpoint);
        final jsonBody = body != null ? jsonEncode(body) : null;
        return await (_testHttpClient != null ? _testHttpClient!.delete(uri, headers: reqHeaders, body: jsonBody) : http.delete(uri, headers: reqHeaders, body: jsonBody))
            .timeout(ApiConfig.timeout);
      },
      headers: headers,
      retryOnFailure: retryOnFailure,
    );
  }

  /// Gửi HTTP PATCH
  Future<ApiResponse> patch(
    String endpoint, {
    dynamic body,
    Map<String, String>? headers,
    bool retryOnFailure = true,
  }) async {
    return _executeWithAutoReconnect(
      (reqHeaders, baseUrl) async {
        final uri = _buildUri(baseUrl, endpoint);
        final jsonBody = body != null ? jsonEncode(body) : null;
        return await (_testHttpClient != null ? _testHttpClient!.patch(uri, headers: reqHeaders, body: jsonBody) : http.patch(uri, headers: reqHeaders, body: jsonBody))
            .timeout(ApiConfig.timeout);
      },
      headers: headers,
      retryOnFailure: retryOnFailure,
    );
  }

  /// Ghép base URL với endpoint và query parameters
  Uri _buildUri(
    String baseUrl,
    String endpoint, [
    Map<String, String>? queryParams,
  ]) {
    final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    final fullUrl = '$baseUrl$cleanEndpoint';
    final parsed = Uri.parse(fullUrl);

    if (queryParams != null && queryParams.isNotEmpty) {
      final merged = Map<String, String>.from(parsed.queryParameters)
        ..addAll(queryParams);
      return parsed.replace(queryParameters: merged);
    }

    return parsed;
  }
}
