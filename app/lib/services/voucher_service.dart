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

  /// Fallback danh sách voucher tiêu chuẩn nếu chưa kết nối mạng
  static final List<Voucher> _fallbackVouchers = [
    Voucher(
      id: 1,
      code: 'NOVA20K',
      name: 'Voucher ShopNova - Giảm 20.000₫',
      discountAmount: 20000,
      minSubtotal: 200000,
    ),
    Voucher(
      id: 2,
      code: 'FREESHIPMAX',
      name: 'Freeship Max - Giảm 30.000₫ phí vận chuyển',
      discountAmount: 30000,
      minSubtotal: 99000,
    ),
    Voucher(
      id: 3,
      code: 'CHAOBANMOI',
      name: 'Chào bạn mới - Giảm 50.000₫ cho đơn từ 150k',
      discountAmount: 50000,
      minSubtotal: 150000,
    ),
    Voucher(
      id: 4,
      code: 'NOVAMEGA50',
      name: 'Nova Mega Sale - Giảm 50.000₫ cho đơn từ 350k',
      discountAmount: 50000,
      minSubtotal: 350000,
    ),
  ];

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
        final vouchers = list
            .whereType<Map<String, dynamic>>()
            .map((item) => Voucher.fromJson(item))
            .where((v) => v.isActive)
            .toList();
        if (vouchers.isNotEmpty) return vouchers;
      }
    } catch (e) {
      debugPrint('[VoucherService] Lỗi tải voucher từ API: $e');
    }
    return _fallbackVouchers;
  }

  /// Lấy danh sách voucher trong ví của người dùng đã đăng nhập từ API Backend
  /// GET /api/v1/vouchers/wallet?page=1
  Future<List<Voucher>> getWalletVouchers({int page = 1}) async {
    if (!AuthService().isAuthenticated) {
      // Nếu chưa đăng nhập, trả về voucher đã lưu trong SharedPreferences cục bộ
      final savedCodes = await getSavedVoucherCodes();
      final allVouchers = await getActiveVouchers();
      return allVouchers.where((v) => savedCodes.contains(v.code)).toList();
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

    // Fallback: nếu lỗi API, lấy từ bộ nhớ máy
    final savedCodes = await getSavedVoucherCodes();
    final allVouchers = await getActiveVouchers();
    return allVouchers.where((v) => savedCodes.contains(v.code)).toList();
  }

  /// Lưu voucher vào ví cá nhân trên API Backend và bộ nhớ máy
  /// POST /api/v1/vouchers/wallet
  Future<Map<String, dynamic>> saveVoucherToWallet(String code) async {
    final upperCode = code.trim().toUpperCase();

    // Luôn lưu vào SharedPreferences cục bộ để offline vẫn dùng được
    await saveVoucher(upperCode);

    if (!AuthService().isAuthenticated) {
      return {
        'success': true,
        'saved': true,
        'message': 'Đã lưu voucher $upperCode vào ví thiết bị.',
      };
    }

    try {
      final res = await _api.post('/api/v1/vouchers/wallet', body: {'code': upperCode});
      if (res.success) {
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
          'message': res.message ?? 'Không thể lưu mã voucher này (có thể đã hết hạn hoặc hết lượt).',
        };
      }
    } catch (e) {
      debugPrint('[VoucherService] Lỗi gọi API lưu voucher: $e');
      return {
        'success': true,
        'saved': true,
        'message': 'Đã lưu mã $upperCode vào ví.',
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
