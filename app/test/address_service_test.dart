import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/services/address_service.dart';
import 'package:shopnova/services/api_client.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('Sổ địa chỉ dùng API và gửi token của tài khoản', () async {
    HttpOverrides.global = null;
    SharedPreferences.setMockInitialValues({});
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    ApiConfig.setBaseUrl('http://127.0.0.1:${server.port}');
    await ApiClient().saveToken('test-token');
    final seen = <String>[];
    server.listen((request) async {
      expect(request.headers.value('authorization'), 'Bearer test-token');
      seen.add('${request.method} ${request.uri.path}');
      request.response.headers.contentType = ContentType.json;
      final address = {'id': '12', 'fullName': 'Người nhận', 'phone': '0900000000', 'province': 'Hà Nội', 'detail': '123 Test', 'isDefault': true};
      if (request.method == 'GET') {
        request.response.write(jsonEncode({'success': true, 'data': {'addresses': [address]}}));
      } else if (request.method == 'POST') {
        final body = jsonDecode(await utf8.decoder.bind(request).join()) as Map<String, dynamic>;
        expect(body['fullName'], 'Người nhận');
        request.response.statusCode = 201;
        request.response.write(jsonEncode({'success': true, 'data': {'address': address}}));
      } else {
        request.response.write(jsonEncode({'success': true, 'data': {}}));
      }
      await request.response.close();
    });
    try {
      final service = AddressService();
      final list = await service.getAddresses();
      expect(list.single.recipientName, 'Người nhận');
      final created = await service.createAddress(recipientName: 'Người nhận', phone: '0900000000', province: 'Hà Nội', detail: '123 Test');
      expect(created?.id, '12');
      expect(await service.setDefaultAddress('12'), isTrue);
      expect(await service.deleteAddress('12'), isTrue);
      expect(seen, ['GET /api/v1/addresses', 'POST /api/v1/addresses', 'PATCH /api/v1/addresses/12/default', 'DELETE /api/v1/addresses/12']);
    } finally {
      await ApiClient().clearToken();
      ApiConfig.resetBaseUrl();
      await server.close(force: true);
    }
  });
}
