import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/voucher.dart';
import 'api_client.dart';

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

  /// Lấy danh sách voucher từ API Backend
  Future<List<Voucher>> getActiveVouchers() async {
    try {
      final res = await _api.get('/api/v1/vouchers');
      if (res.success && res.data is List) {
        final list = (res.data as List)
            .map((item) => Voucher.fromJson(item as Map<String, dynamic>))
            .where((v) => v.isActive)
            .toList();
        if (list.isNotEmpty) return list;
      }
    } catch (e) {
      debugPrint('[VoucherService] Lỗi tải voucher từ API: $e');
    }
    return _fallbackVouchers;
  }

  /// Lấy danh sách mã voucher người dùng đã lưu
  Future<Set<String>> getSavedVoucherCodes() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_savedVouchersKey) ?? [];
      return list.toSet();
    } catch (_) {
      return {};
    }
  }

  /// Lưu voucher vào ví
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

  /// Bỏ lưu voucher khỏi ví
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

