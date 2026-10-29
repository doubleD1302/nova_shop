import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/models/user.dart';
import 'package:shopnova/models/product.dart';

void main() {
  group('Kiểm thử Service & Model Mobile App ShopNova', () {
    test('ApiConfig trả về Base URL hợp lệ', () {
      expect(ApiConfig.baseUrl, isNotEmpty);
      expect(ApiConfig.baseUrl.startsWith('http'), isTrue);
    });

    test('User.fromJson parse chính xác dữ liệu từ Backend API', () {
      final json = {
        'id': '10',
        'username': 'buyer_test',
        'fullName': 'Người Mua Test',
        'email': 'buyer@shopnova.vn',
        'phone': '0901234567',
        'role': 'buyer',
        'shopId': null,
      };

      final user = User.fromJson(json);
      expect(user.id, '10');
      expect(user.username, 'buyer_test');
      expect(user.fullName, 'Người Mua Test');
      expect(user.email, 'buyer@shopnova.vn');
      expect(user.phone, '0901234567');
      expect(user.role, 'buyer');
      expect(user.isBuyer, isTrue);
      expect(user.isSeller, isFalse);
    });

    test('Product.fromJson parse chính xác dữ liệu từ Backend API catalog', () {
      final json = {
        'id': '1',
        'name': 'Áo Thun Nam Cotton',
        'imageUrl': 'https://cdn.shopnova.vn/products/ao-thun.jpg',
        'price': 180000,
        'originalPrice': 220000,
        'discount': 18,
        'rating': 4.8,
        'soldCount': 1500,
        'badges': ['Mall', 'Yêu thích'],
        'isFavorite': true,
      };

      final product = Product.fromJson(json);
      expect(product.id, '1');
      expect(product.name, 'Áo Thun Nam Cotton');
      expect(product.price, 180000.0);
      expect(product.originalPrice, 220000.0);
      expect(product.discount, 18);
      expect(product.rating, 4.8);
      expect(product.soldCount, 'Đã bán 1.5k');
      expect(product.badges, contains('Mall'));
      expect(product.badges, contains('Yêu thích'));
      expect(product.isFavorite, isTrue);
    });
  });
}
