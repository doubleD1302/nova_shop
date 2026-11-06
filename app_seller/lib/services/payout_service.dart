import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'api_client.dart';

class PayoutService {
  static final PayoutService _instance = PayoutService._internal();
  factory PayoutService() => _instance;
  PayoutService._internal();

  final ApiClient _client = ApiClient();

  /// Lấy thông tin ví doanh thu và lịch sử nhận tiền minh họa của shop
  /// GET /api/v1/seller/demo-payout
  Future<Map<String, dynamic>?> getPayoutStatus() async {
    try {
      final res = await _client.get('/api/v1/seller/demo-payout');
      if (res.success && res.data is Map<String, dynamic>) {
        return res.data as Map<String, dynamic>;
      }
    } catch (e) {
      debugPrint('[PayoutService] Lỗi lấy thông tin payout: $e');
    }
    return null;
  }

  /// Khởi tạo tài khoản ví nhận tiền minh họa (1.000.000₫ số dư ban đầu)
  /// POST /api/v1/seller/demo-payout/setup
  Future<Map<String, dynamic>> setupPayout() async {
    try {
      final res = await _client.post('/api/v1/seller/demo-payout/setup');
      if (res.success && res.data is Map<String, dynamic>) {
        return {
          'success': true,
          'data': res.data,
          'message': 'Kích hoạt ví nhận tiền thành công! Số dư khởi tạo: 1.000.000₫',
        };
      }
      return {
        'success': false,
        'message': res.message ?? 'Không thể khởi tạo ví nhận tiền.',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Lỗi kết nối máy chủ: $e',
      };
    }
  }

  /// Yêu cầu rút tiền mô phỏng từ số dư doanh thu shop
  /// POST /api/v1/seller/demo-payout/withdrawals
  Future<Map<String, dynamic>> requestWithdrawal(int amount) async {
    if (amount <= 0 || amount > 1000000) {
      return {
        'success': false,
        'message': 'Số tiền rút phải từ 1₫ đến 1.000.000₫.',
      };
    }

    try {
      final idempotencyKey = 'payout_${DateTime.now().millisecondsSinceEpoch}_$amount';
      final res = await _client.post(
        '/api/v1/seller/demo-payout/withdrawals',
        body: {'amount': amount},
        headers: {'Idempotency-Key': idempotencyKey},
      );

      if (res.success && res.data is Map<String, dynamic>) {
        return {
          'success': true,
          'data': res.data,
          'message': 'Yêu cầu rút tiền thành công! Trạng thái: Mô phỏng (Simulated)',
        };
      }

      return {
        'success': false,
        'message': res.message ?? 'Số dư không đủ hoặc giao dịch bị từ chối.',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Lỗi giao dịch: $e',
      };
    }
  }
}

