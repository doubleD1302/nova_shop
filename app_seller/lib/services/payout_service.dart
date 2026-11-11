import 'package:flutter/foundation.dart';
import 'api_client.dart';

/// Service Tài chính & Chi trả Escrow chính thức cho Người Bán (/api/v1/seller/payout/*)
class PayoutService {
  static final PayoutService _instance = PayoutService._internal();
  factory PayoutService() => _instance;
  PayoutService._internal();

  final ApiClient _client = ApiClient();

  /// Lấy thông tin số dư ví Escrow + trạng thái liên kết ngân hàng
  /// GET /api/v1/seller/payout/balance
  Future<Map<String, dynamic>?> getBalance() async {
    try {
      final res = await _client.get('/api/v1/seller/payout/balance');
      if (res.success && res.data is Map<String, dynamic>) {
        return res.data as Map<String, dynamic>;
      }
    } catch (e) {
      debugPrint('[PayoutService] getBalance error: $e');
    }
    return null;
  }

  /// Lấy thông tin tài khoản ngân hàng đã liên kết
  /// GET /api/v1/seller/payout/bank-account
  Future<Map<String, dynamic>?> getBankAccount() async {
    try {
      final res = await _client.get('/api/v1/seller/payout/bank-account');
      if (res.success && res.data is Map<String, dynamic>) {
        return res.data as Map<String, dynamic>;
      }
    } catch (e) {
      debugPrint('[PayoutService] getBankAccount error: $e');
    }
    return null;
  }

  /// Lưu / cập nhật thông tin tài khoản ngân hàng nhận tiền của Shop
  /// POST /api/v1/seller/payout/bank-account
  Future<Map<String, dynamic>> saveBankAccount({
    required String bankName,
    required String bankCode,
    required String accountNumber,
    required String accountHolder,
    String? branch,
  }) async {
    final res = await _client.post(
      '/api/v1/seller/payout/bank-account',
      body: {
        'bankName': bankName.trim(),
        'bankCode': bankCode.trim().toUpperCase(),
        'accountNumber': accountNumber.trim(),
        'accountHolder': accountHolder.trim().toUpperCase(),
        if (branch != null && branch.trim().isNotEmpty) 'branch': branch.trim(),
      },
    );
    return {
      'success': res.success,
      'data': res.data,
      'message': res.message.isNotEmpty
          ? res.message
          : (res.success ? 'Lưu tài khoản ngân hàng thành công!' : 'Không thể lưu tài khoản ngân hàng.'),
    };
  }

  /// Tạo yêu cầu rút tiền từ số dư khả dụng (tối thiểu 50.000₫)
  /// POST /api/v1/seller/payout/request
  Future<Map<String, dynamic>> requestWithdrawal(int amount) async {
    if (amount < 50000) {
      return {
        'success': false,
        'message': 'Số tiền rút tối thiểu là 50.000₫.',
      };
    }

    final idempotencyKey = 'payout_${DateTime.now().millisecondsSinceEpoch}_$amount';
    final res = await _client.post(
      '/api/v1/seller/payout/request',
      body: {'amount': amount},
      headers: {'Idempotency-Key': idempotencyKey},
    );

    return {
      'success': res.success,
      'data': res.data,
      'message': res.message.isNotEmpty
          ? res.message
          : (res.success ? 'Đã gửi yêu cầu rút tiền thành công!' : 'Yêu cầu rút tiền bị từ chối.'),
    };
  }

  /// Lấy lịch sử yêu cầu rút tiền
  /// GET /api/v1/seller/payout/history
  Future<List<Map<String, dynamic>>> getPayoutHistory({
    int limit = 30,
    int offset = 0,
  }) async {
    try {
      final res = await _client.get(
        '/api/v1/seller/payout/history',
        queryParams: {'limit': '$limit', 'offset': '$offset'},
      );
      if (res.success && res.data is List) {
        return (res.data as List).whereType<Map<String, dynamic>>().toList();
      }
    } catch (e) {
      debugPrint('[PayoutService] getPayoutHistory error: $e');
    }
    return [];
  }

  /// Lấy tổng quan ví + lịch sử chi trả cho Seller Finance tab
  Future<Map<String, dynamic>?> getPayoutOverview() async {
    final results = await Future.wait([getBalance(), getPayoutHistory()]);
    final balanceRes = results[0] as Map<String, dynamic>?;
    final history = results[1] as List<Map<String, dynamic>>;
    if (balanceRes == null) return null;

    final balMap = balanceRes['balance'] is Map
        ? Map<String, dynamic>.from(balanceRes['balance'] as Map)
        : <String, dynamic>{};

    return {
      'shopId': balanceRes['shopId'],
      'balance': balMap['available'] ?? 0,
      'pendingBalance': balMap['pendingEscrow'] ?? 0,
      'withdrawing': balMap['withdrawing'] ?? 0,
      'totalPaidOut': balMap['totalPaidOut'] ?? 0,
      'hasLinkedBank': balanceRes['hasLinkedBank'] == true,
      'bankAccount': balanceRes['bankAccount'],
      'withdrawals': history,
    };
  }
}
