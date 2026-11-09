import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/address.dart';
import 'api_client.dart';

/// Service quản lý sổ địa chỉ nhận hàng của người dùng
/// Đồng bộ địa chỉ mặc định trực tiếp với Backend API (/api/v1/auth/me & PUT /api/v1/auth/profile)
class AddressService {
  static final AddressService _instance = AddressService._internal();
  factory AddressService() => _instance;
  AddressService._internal();

  final ApiClient _client = ApiClient();
  static const String _storageKey = 'shopnova_user_addresses_v1';

  /// Lấy danh sách địa chỉ nhận hàng của người dùng (kết hợp Backend user.address & bộ nhớ máy)
  Future<List<Address>> getAddresses() async {
    List<Address> localList = [];
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw) as List;
        localList = decoded
            .whereType<Map<String, dynamic>>()
            .map((item) => Address.fromJson(item))
            .toList();
      }
    } catch (_) {}

    // Đồng bộ địa chỉ mặc định từ hồ sơ người dùng trên Backend: GET /api/v1/auth/me
    final response = await _client.get('/api/v1/auth/me');
    if (response.success && response.data is Map<String, dynamic>) {
      final userMap = response.data['user'] as Map<String, dynamic>? ?? response.data as Map<String, dynamic>;
      final addrMap = userMap['address'];
      if (addrMap is Map<String, dynamic> && (addrMap['detail'] != null || addrMap['province'] != null)) {
        final backendAddress = Address(
          id: 'default_profile_address',
          userId: (userMap['id'] ?? '').toString(),
          recipientName: (addrMap['fullName'] ?? userMap['fullName'] ?? 'Người nhận').toString(),
          phone: (addrMap['phone'] ?? userMap['phone'] ?? '').toString(),
          province: (addrMap['province'] ?? 'TP. Hồ Chí Minh').toString(),
          district: addrMap['district']?.toString(),
          ward: addrMap['ward']?.toString(),
          detail: (addrMap['detail'] ?? '').toString(),
          isDefault: true,
        );
        if (!localList.any((a) => a.detail == backendAddress.detail && a.province == backendAddress.province)) {
          localList.insert(0, backendAddress);
        }
      }
    }

    return localList;
  }

  Future<void> _saveLocalAddresses(List<Address> list) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final encoded = jsonEncode(list.map((a) => {
        'id': a.id,
        'userId': a.userId,
        'recipientName': a.recipientName,
        'phone': a.phone,
        'province': a.province,
        'district': a.district,
        'ward': a.ward,
        'detail': a.detail,
        'isDefault': a.isDefault,
      }).toList());
      await prefs.setString(_storageKey, encoded);
    } catch (_) {}
  }

  /// Thêm địa chỉ nhận hàng mới và đồng bộ lên hồ sơ Backend qua PUT /api/v1/auth/profile
  Future<Address?> createAddress({
    required String recipientName,
    required String phone,
    required String province,
    String? district,
    String? ward,
    required String detail,
    bool isDefault = false,
  }) async {
    final current = await getAddresses();
    final shouldBeDefault = isDefault || current.isEmpty;

    final newAddr = Address(
      id: 'addr_${DateTime.now().millisecondsSinceEpoch}',
      userId: '',
      recipientName: recipientName.trim(),
      phone: phone.trim(),
      province: province.trim(),
      district: district?.trim(),
      ward: ward?.trim(),
      detail: detail.trim(),
      isDefault: shouldBeDefault,
    );

    final updated = current.map<Address>((a) => shouldBeDefault ? Address(
      id: a.id,
      userId: a.userId,
      recipientName: a.recipientName,
      phone: a.phone,
      province: a.province,
      district: a.district,
      ward: a.ward,
      detail: a.detail,
      isDefault: false,
    ) : a).toList();

    updated.insert(0, newAddr);
    await _saveLocalAddresses(updated);

    if (shouldBeDefault) {
      await _client.put(
        '/api/v1/auth/profile',
        body: {
          'address': {
            'fullName': newAddr.recipientName,
            'phone': newAddr.phone,
            'province': newAddr.province,
            'district': newAddr.district ?? 'Quận 1',
            'ward': newAddr.ward ?? 'Phường Bến Nghé',
            'detail': newAddr.detail,
          },
        },
      );
    }

    return newAddr;
  }

  /// Đặt làm địa chỉ mặc định và đồng bộ lên PUT /api/v1/auth/profile
  Future<bool> setDefaultAddress(String addressId) async {
    final current = await getAddresses();
    Address? target;
    final updated = current.map<Address>((a) {
      final isMatch = a.id == addressId;
      if (isMatch) target = a;
      return Address(
        id: a.id,
        userId: a.userId,
        recipientName: a.recipientName,
        phone: a.phone,
        province: a.province,
        district: a.district,
        ward: a.ward,
        detail: a.detail,
        isDefault: isMatch,
      );
    }).toList();

    await _saveLocalAddresses(updated);

    if (target != null) {
      await _client.put(
        '/api/v1/auth/profile',
        body: {
          'address': {
            'fullName': target!.recipientName,
            'phone': target!.phone,
            'province': target!.province,
            'district': target!.district ?? 'Quận 1',
            'ward': target!.ward ?? 'Phường Bến Nghé',
            'detail': target!.detail,
          },
        },
      );
    }
    return true;
  }

  /// Xóa địa chỉ nhận hàng
  Future<bool> deleteAddress(String addressId) async {
    final current = await getAddresses();
    current.removeWhere((a) => a.id == addressId);
    await _saveLocalAddresses(current);
    return true;
  }
}
