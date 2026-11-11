import 'api_client.dart';

/// Service tổng hợp các API quản trị vận hành mở rộng cho Admin App
class AdminFeatureService {
  static final AdminFeatureService _instance = AdminFeatureService._internal();
  factory AdminFeatureService() => _instance;
  AdminFeatureService._internal();

  final ApiClient _client = ApiClient();

  // --- RUNTIME SETTINGS ---
  Future<Map<String, dynamic>?> getSettings() async {
    final res = await _client.get('/api/v1/admin/settings');
    if (res.success && res.data is Map<String, dynamic>) {
      return res.data as Map<String, dynamic>;
    }
    return null;
  }

  Future<ApiResponse> updateSettings({
    bool? maintenanceMode,
    double? commissionRate,
    int? platformFee,
  }) {
    return _client.put(
      '/api/v1/admin/settings',
      body: {
        if (maintenanceMode != null) 'maintenanceMode': maintenanceMode,
        if (commissionRate != null) 'commissionRate': commissionRate,
        if (platformFee != null) 'platformFee': platformFee,
      },
    );
  }

  // --- MANUAL CRON JOBS ---
  Future<ApiResponse> runCronJob(String jobName) {
    return _client.post(
      '/api/v1/admin/jobs/run',
      body: {'jobName': jobName},
    );
  }

  // --- RETURNS ARBITRATION ---
  Future<List<Map<String, dynamic>>> getAdminReturns({
    String? status,
    int limit = 40,
    int offset = 0,
  }) async {
    final res = await _client.get(
      '/api/v1/admin/returns',
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

  Future<ApiResponse> resolveReturnDispute(
    String returnId, {
    required String resolution,
    required String adminNote,
  }) {
    return _client.patch(
      '/api/v1/admin/returns/$returnId/resolve',
      body: {
        'resolution': resolution,
        'adminNote': adminNote.trim(),
      },
    );
  }

  // --- SELLER PAYOUT APPROVALS ---
  Future<List<Map<String, dynamic>>> getAdminPayouts({
    String? status,
    String? shopId,
    int limit = 40,
    int offset = 0,
  }) async {
    final res = await _client.get(
      '/api/v1/admin/payouts',
      queryParams: {
        'limit': '$limit',
        'offset': '$offset',
        if (status != null && status.isNotEmpty) 'status': status,
        if (shopId != null && shopId.isNotEmpty) 'shopId': shopId,
      },
    );
    if (res.success && res.data is List) {
      return (res.data as List).whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  Future<ApiResponse> updatePayoutStatus(
    String payoutId, {
    required String status,
    String? transactionReference,
    String? rejectionReason,
    String? adminNote,
  }) {
    return _client.patch(
      '/api/v1/admin/payouts/$payoutId',
      body: {
        'status': status,
        if (transactionReference != null && transactionReference.trim().isNotEmpty)
          'transactionReference': transactionReference.trim(),
        if (rejectionReason != null && rejectionReason.trim().isNotEmpty)
          'rejectionReason': rejectionReason.trim(),
        if (adminNote != null && adminNote.trim().isNotEmpty)
          'adminNote': adminNote.trim(),
      },
    );
  }

  // --- PAYMENTS RECONCILIATION & REFUND ---
  Future<List<Map<String, dynamic>>> getPaymentReviewQueue({
    int limit = 50,
    int offset = 0,
  }) async {
    final res = await _client.get(
      '/api/v1/admin/payments/review-queue',
      queryParams: {'limit': '$limit', 'offset': '$offset'},
    );
    if (res.success && res.data is Map && res.data['attempts'] is List) {
      return (res.data['attempts'] as List).whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  Future<ApiResponse> reconcilePayments() {
    return _client.post('/api/v1/admin/payments/reconcile', body: {});
  }

  Future<ApiResponse> refundPayment({
    required String orderId,
    String? shopOrderId,
    num? amount,
    String? reason,
  }) {
    return _client.post(
      '/api/v1/payments/refund',
      body: {
        'orderId': orderId,
        if (shopOrderId != null && shopOrderId.isNotEmpty) 'shopOrderId': shopOrderId,
        if (amount != null && amount > 0) 'amount': amount.round(),
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
  }

  // --- NOTIFICATIONS ---
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

