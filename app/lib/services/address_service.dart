import '../models/address.dart';
import 'api_client.dart';

/// Sổ địa chỉ thuộc tài khoản được xác thực tại Backend.
class AddressService {
  static final AddressService _instance = AddressService._internal();
  factory AddressService() => _instance;
  AddressService._internal();

  final ApiClient _client = ApiClient();

  Address _readAddress(Map<String, dynamic> data) => Address.fromJson({
    ...data,
    'recipientName': data['fullName'],
  });

  Future<List<Address>> getAddresses() async {
    final response = await _client.get('/api/v1/addresses', retryOnFailure: false);
    if (!response.success || response.data is! Map<String, dynamic>) {
      throw Exception(response.message.isEmpty ? 'Không thể tải địa chỉ.' : response.message);
    }
    final list = (response.data as Map<String, dynamic>)['addresses'];
    if (list is! List) throw Exception('Dữ liệu địa chỉ không hợp lệ.');
    return list.whereType<Map<String, dynamic>>().map(_readAddress).toList();
  }

  Future<Address?> createAddress({
    required String recipientName,
    required String phone,
    required String province,
    String? district,
    String? ward,
    required String detail,
    bool isDefault = false,
  }) async {
    final response = await _client.post('/api/v1/addresses', retryOnFailure: false, body: {
      'fullName': recipientName.trim(), 'phone': phone.trim(), 'province': province.trim(),
      'district': district?.trim() ?? '', 'ward': ward?.trim() ?? '',
      'detail': detail.trim(), 'isDefault': isDefault,
    });
    final data = response.data;
    if (!response.success || data is! Map<String, dynamic> || data['address'] is! Map<String, dynamic>) return null;
    return _readAddress(data['address'] as Map<String, dynamic>);
  }

  Future<bool> setDefaultAddress(String addressId) async {
    final response = await _client.patch('/api/v1/addresses/${Uri.encodeComponent(addressId)}/default', retryOnFailure: false);
    return response.success;
  }

  Future<bool> deleteAddress(String addressId) async {
    final response = await _client.delete('/api/v1/addresses/${Uri.encodeComponent(addressId)}', retryOnFailure: false);
    return response.success;
  }
}
