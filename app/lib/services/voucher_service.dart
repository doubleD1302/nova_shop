import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/voucher.dart';
import 'api_client.dart';
import 'auth_service.dart';

class VoucherService {
  static final VoucherService _instance = VoucherService._internal();
  factory VoucherService() => _instance;
  VoucherService._internal();

  final ApiClient _api = ApiClient();
  static const String _savedVouchersKey = 'saved_voucher_codes';

  /// Lấy toàn bộ danh sách voucher công khai từ API Backend
  /// GET /api/v1/vouchers
  Future<List<Voucher>> getActiveVouchers() async {
    try {
      final res = await _api.get('/api/v1/vouchers');
      if (res.success && res.data != null) {
        List<dynamic> list = [];
        if (res.data is List) {
          list = res.data as List;
        } else if (res.data is Map && res.data['vouchers'] is List) {
          list = res.data['vouchers'] as List;
        }
        return list
            .whereType<Map<String, dynamic>>()
            .map((item) => Voucher.fromJson(item))
            .where((v) => v.isActive)
            .toList();
      }
    } catch (e) {
      debugPrint('[VoucherService] Lỗi tải voucher từ API: $e');
    }
    return [];
  }

  /// Lấy danh sách voucher trong ví của người dùng đã đăng nhập từ API Backend
  /// GET /api/v1/vouchers/wallet?page=1
  Future<List<Voucher>> getWalletVouchers({int page = 1}) async {
    if (!AuthService().isAuthenticated) {
      return [];
    }

    try {
      final res = await _api.get('/api/v1/vouchers/wallet?page=$page');
      if (res.success && res.data != null) {
        List<dynamic> items = [];
        if (res.data is Map && res.data['items'] is List) {
          items = res.data['items'] as List;
        } else if (res.data is List) {
          items = res.data as List;
        }
        return items
            .whereType<Map<String, dynamic>>()
            .map((item) => Voucher.fromJson(item))
            .toList();
      }
    } catch (e) {
      debugPrint('[VoucherService] Lỗi tải ví voucher từ API: $e');
    }

    return [];
  }

  /// Lưu voucher vào ví cá nhân trên API Backend
  /// POST /api/v1/vouchers/wallet
  Future<Map<String, dynamic>> saveVoucherToWallet(String code) async {
    final upperCode = code.trim().toUpperCase();

    if (!AuthService().isAuthenticated) {
      return {
        'success': false,
        'saved': false,
        'message': 'Vui lòng đăng nhập để lưu voucher vào ví.',
      };
    }

    try {
      final res = await _api.post('/api/v1/vouchers/wallet', body: {'code': upperCode});
      if (res.success) {
        await saveVoucher(upperCode);
        final data = res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : {};
        final saved = data['saved'] == true;
        return {
          'success': true,
          'saved': saved,
          'message': saved ? 'Đã lưu thành công mã $upperCode vào ví.' : 'Mã $upperCode đã có sẵn trong ví của bạn.',
        };
      } else {
        return {
          'success': false,
          'saved': false,
          'message': res.message.isNotEmpty
              ? res.message
              : 'Không thể lưu mã voucher này (có thể đã hết hạn hoặc hết lượt).',
        };
      }
    } catch (e) {
      debugPrint('[VoucherService] Lỗi gọi API lưu voucher: $e');
      return {
        'success': false,
        'saved': false,
        'message': 'Không thể kết nối máy chủ để lưu mã voucher.',
      };
    }
  }

  /// Lấy danh sách mã voucher người dùng đã lưu offline
  Future<Set<String>> getSavedVoucherCodes() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_savedVouchersKey) ?? [];
      return list.toSet();
    } catch (_) {
      return {};
    }
  }

  /// Lưu voucher vào ví offline
  Future<bool> saveVoucher(String code) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_savedVouchersKey) ?? [];
      final upper = code.trim().toUpperCase();
      if (!list.contains(upper)) {
        list.add(upper);
        await prefs.setStringList(_savedVouchersKey, list);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Bỏ lưu voucher khỏi ví offline
  Future<bool> removeSavedVoucher(String code) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_savedVouchersKey) ?? [];
      final upper = code.trim().toUpperCase();
      list.remove(upper);
      await prefs.setStringList(_savedVouchersKey, list);
      return true;
    } catch (_) {
      return false;
    }
  }
}
