import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import '../config/api_config.dart';
import 'api_client.dart';

/// Service tổng hợp các API nghiệp vụ Người Bán mới nhất từ Backend
class SellerFeatureService {
  static final SellerFeatureService _instance = SellerFeatureService._internal();
  factory SellerFeatureService() => _instance;
  SellerFeatureService._internal();

  final ApiClient _client = ApiClient();
  final StreamController<Map<String, dynamic>> _wsController =
      StreamController<Map<String, dynamic>>.broadcast();
  WebSocket? _socket;
  StreamSubscription? _wsSub;
  bool _connecting = false;

  Stream<Map<String, dynamic>> get wsEvents => _wsController.stream;
  bool get isSocketConnected =>
      _socket != null && _socket!.readyState == WebSocket.open;

  // --- DASHBOARD ---
  Future<Map<String, dynamic>?> getDashboard() async {
    final res = await _client.get('/api/v1/seller/dashboard');
    if (res.success && res.data is Map<String, dynamic>) {
      return res.data as Map<String, dynamic>;
    }
    return null;
  }

  // --- 3PL DISPATCH & TRACKING ---
  Future<ApiResponse> dispatchOrder3Pl(String shopOrderId, {required String carrier}) {
    return _client.post(
      '/api/v1/seller/orders/$shopOrderId/dispatch',
      body: {'carrier': carrier},
    );
  }

  Future<ApiResponse> updateOrderTracking(
    String shopOrderId, {
    required String trackingCode,
    String? carrier,
    bool autoAdvanceStatus = true,
  }) {
    return _client.patch(
      '/api/v1/seller/orders/$shopOrderId/tracking',
      body: {
        'trackingCode': trackingCode.trim(),
        if (carrier != null && carrier.trim().isNotEmpty) 'carrier': carrier.trim(),
        'autoAdvanceStatus': autoAdvanceStatus,
      },
    );
  }

  // --- RETURNS ---
  Future<List<Map<String, dynamic>>> getSellerReturns({
    String? status,
    int limit = 30,
    int offset = 0,
  }) async {
    final res = await _client.get(
      '/api/v1/seller/returns',
      queryParams: {
        'limit': '$limit',
        'offset': '$offset',
        if (status != null && status.isNotEmpty) 'status': status,
      },
    );
    if (res.success && res.data is List) {
      return (res.data as List).whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  Future<ApiResponse> updateSellerReturnStatus(
    String returnId, {
    required String status,
    String? sellerNote,
  }) {
    return _client.patch(
      '/api/v1/seller/returns/$returnId/status',
      body: {
        'status': status,
        if (sellerNote != null && sellerNote.trim().isNotEmpty)
          'sellerNote': sellerNote.trim(),
      },
    );
  }

  // --- VOUCHERS ---
  Future<List<Map<String, dynamic>>> getVouchers() async {
    final res = await _client.get('/api/v1/seller/vouchers');
    if (res.success && res.data != null) {
      if (res.data is List) {
        return (res.data as List).whereType<Map<String, dynamic>>().toList();
      }
      if (res.data is Map && res.data['items'] is List) {
        return (res.data['items'] as List).whereType<Map<String, dynamic>>().toList();
      }
    }
    return [];
  }

  Future<ApiResponse> createVoucher({
    required String code,
    required String name,
    required int discountAmount,
    int? minSubtotal,
    int? usageLimit,
    int? perUserLimit,
    String? startsAt,
    String? endsAt,
  }) {
    return _client.post(
      '/api/v1/seller/vouchers',
      body: {
        'code': code.trim().toUpperCase(),
        'name': name.trim(),
        'discountAmount': discountAmount,
        if (minSubtotal != null && minSubtotal > 0) 'minSubtotal': minSubtotal,
        if (usageLimit != null && usageLimit > 0) 'usageLimit': usageLimit,
        if (perUserLimit != null && perUserLimit > 0) 'perUserLimit': perUserLimit,
        if (startsAt != null && startsAt.isNotEmpty) 'startsAt': startsAt,
        if (endsAt != null && endsAt.isNotEmpty) 'endsAt': endsAt,
      },
    );
  }

  Future<ApiResponse> toggleVoucherStatus(String id, bool isActive) {
    return _client.patch(
      '/api/v1/seller/vouchers/$id/status',
      body: {'isActive': isActive},
    );
  }

  Future<ApiResponse> deleteVoucher(String id) {
    return _client.delete('/api/v1/seller/vouchers/$id');
  }

  // --- MARKETING & BOOST ---
  Future<List<Map<String, dynamic>>> getCampaigns() async {
    final res = await _client.get('/api/v1/seller/marketing/campaigns');
    if (res.success && res.data is Map && res.data['items'] is List) {
      return (res.data['items'] as List).whereType<Map<String, dynamic>>().toList();
    }
    if (res.success && res.data is List) {
      return (res.data as List).whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  Future<ApiResponse> registerCampaign({
    required String campaignId,
    required String productId,
    required int discountPrice,
    String? note,
  }) {
    return _client.post(
      '/api/v1/seller/marketing/campaigns/register',
      body: {
        'campaignId': campaignId,
        'productId': productId,
        'discountPrice': discountPrice,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      },
    );
  }

  Future<List<Map<String, dynamic>>> getCampaignRegistrations() async {
    final res = await _client.get('/api/v1/seller/marketing/registrations');
    if (res.success && res.data is Map && res.data['items'] is List) {
      return (res.data['items'] as List).whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  Future<ApiResponse> buyProductBoost({
    required String productId,
    required String packageType,
  }) {
    return _client.post(
      '/api/v1/seller/marketing/boost',
      body: {'productId': productId, 'packageType': packageType},
    );
  }

  Future<List<Map<String, dynamic>>> getProductBoosts() async {
    final res = await _client.get('/api/v1/seller/marketing/boosts');
    if (res.success && res.data is Map && res.data['items'] is List) {
      return (res.data['items'] as List).whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  // --- REPORTS & EXCEL EXPORT ---
  Future<Map<String, dynamic>?> getRevenueReport({String? startDate, String? endDate}) async {
    final res = await _client.get(
      '/api/v1/seller/reports/revenue',
      queryParams: {
        if (startDate != null && startDate.isNotEmpty) 'startDate': startDate,
        if (endDate != null && endDate.isNotEmpty) 'endDate': endDate,
      },
    );
    if (res.success && res.data is Map<String, dynamic>) {
      return res.data as Map<String, dynamic>;
    }
    return null;
  }

  Future<Map<String, dynamic>?> getInventoryReport() async {
    final res = await _client.get('/api/v1/seller/reports/inventory');
    if (res.success && res.data is Map<String, dynamic>) {
      return res.data as Map<String, dynamic>;
    }
    return null;
  }

  Future<String?> downloadExcelToTemp({
    required String endpoint,
    required String fileName,
    Map<String, String>? queryParams,
  }) async {
    final bytes = await _client.getBytes(endpoint, queryParams: queryParams);
    if (bytes == null || bytes.isEmpty) return null;
    final file = File('${Directory.systemTemp.path}/$fileName');
    await file.writeAsBytes(bytes, flush: true);
    return file.path;
  }

  // --- LIVE CHAT & NOTIFICATIONS ---
  Future<List<Map<String, dynamic>>> getConversations() async {
    final res = await _client.get('/api/v1/chat/conversations');
    if (res.success && res.data is List) {
      return (res.data as List).whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getMessages(String conversationId) async {
    final res = await _client.get('/api/v1/chat/conversations/$conversationId/messages');
    if (res.success && res.data is Map && res.data['messages'] is List) {
      return (res.data['messages'] as List).whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  Future<Map<String, dynamic>?> sendMessage(String conversationId, String message) async {
    final res = await _client.post(
      '/api/v1/chat/conversations/$conversationId/messages',
      body: {'message': message.trim()},
    );
    if (res.success && res.data is Map<String, dynamic>) {
      return res.data as Map<String, dynamic>;
    }
    return null;
  }

  Future<void> connectSocket() async {
    if (_connecting || isSocketConnected) return;
    _connecting = true;
    try {
      final token = await _client.getToken();
      if (token == null || token.isEmpty) return;
      final baseUri = Uri.parse(ApiConfig.baseUrl);
      final wsUri = baseUri.replace(
        scheme: baseUri.scheme == 'https' ? 'wss' : 'ws',
        path: '/ws/chat',
        queryParameters: {'token': token},
      );
      final sock = await WebSocket.connect(wsUri.toString());
      _socket = sock;
      _wsSub = sock.listen(
        (raw) {
          try {
            final decoded = jsonDecode(raw.toString());
            if (decoded is Map<String, dynamic>) _wsController.add(decoded);
          } catch (_) {}
        },
        onError: (_) => disconnectSocket(),
        onDone: () => disconnectSocket(),
      );
    } catch (e) {
      debugPrint('[SellerFeatureService] WS warning: $e');
    } finally {
      _connecting = false;
    }
  }

  Future<void> disconnectSocket() async {
    await _wsSub?.cancel();
    _wsSub = null;
    try {
      await _socket?.close();
    } catch (_) {}
    _socket = null;
  }

  Future<Map<String, dynamic>> getNotifications({int page = 1, int limit = 30}) async {
    final res = await _client.get(
      '/api/v1/notifications',
      queryParams: {'page': '$page', 'limit': '$limit'},
    );
    if (res.success && res.data is Map<String, dynamic>) {
      return res.data as Map<String, dynamic>;
    }
    return {'items': [], 'unreadCount': 0};
  }

  Future<bool> markNotificationRead(String id) async {
    final res = await _client.patch('/api/v1/notifications/$id/read', body: {});
    return res.success;
  }

  Future<bool> markAllNotificationsRead() async {
    final res = await _client.patch('/api/v1/notifications/read-all', body: {});
    return res.success;
  }
}

