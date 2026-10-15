import '../models/address.dart';
import 'api_client.dart';

/// Service quản lý sổ địa chỉ nhận hàng của người dùng
class AddressService {
  static final AddressService _instance = AddressService._internal();
  factory AddressService() => _instance;
  AddressService._internal();

  final ApiClient _client = ApiClient();

  /// Lấy danh sách địa chỉ nhận hàng của người dùng
  /// GET /api/v1/addresses
  Future<List<Address>> getAddresses() async {
    final response = await _client.get('/api/v1/addresses');

    if (response.success && response.data is List) {
      return (response.data as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => Address.fromJson(item))
          .toList();
    }

    return [];
  }

  /// Thêm địa chỉ nhận hàng mới
  /// POST /api/v1/addresses
  Future<Address?> createAddress({
    required String recipientName,
    required String phone,
    required String province,
    String? district,
    String? ward,
    required String detail,
    bool isDefault = false,
  }) async {
    final body = <String, dynamic>{
      'recipientName': recipientName.trim(),
      'phone': phone.trim(),
      'province': province.trim(),
      if (district != null) 'district': district.trim(),
      if (ward != null) 'ward': ward.trim(),
      'detail': detail.trim(),
      'isDefault': isDefault,
    };

    final response = await _client.post('/api/v1/addresses', body: body);

    if (response.success && response.data is Map<String, dynamic>) {
      return Address.fromJson(response.data as Map<String, dynamic>);
    }

    return null;
  }

  /// Đặt làm địa chỉ mặc định
  /// PATCH /api/v1/addresses/:addressId/default
  Future<bool> setDefaultAddress(String addressId) async {
    final response = await _client.patch('/api/v1/addresses/$addressId/default');
    return response.success;
  }

  /// Xóa địa chỉ nhận hàng
  /// DELETE /api/v1/addresses/:addressId
  Future<bool> deleteAddress(String addressId) async {
    final response = await _client.delete('/api/v1/addresses/$addressId');
    return response.success;
  }
}
