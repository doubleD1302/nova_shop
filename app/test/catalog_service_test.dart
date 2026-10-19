import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'dart:convert';
import 'package:shopnova/services/catalog_service.dart';
import 'package:shopnova/models/category_item.dart';
import 'package:shopnova/models/product.dart';
import 'package:shopnova/models/banner_item.dart';

void main() {
  group('CatalogService Tests', () {
    test('getCategories parse JSON correctly', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'message': 'OK',
            'data': [
              {
                'id': '1',
                'slug': 'thoi-trang-nam',
                'name': 'Thời trang nam',
                'imageUrl': null,
                'sortOrder': 1,
              },
              {
                'id': '2',
                'slug': 'dien-thoai',
                'name': 'Điện thoại & Phụ kiện',
                'imageUrl': null,
                'sortOrder': 2,
              }
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = CatalogService(client: mockClient);
      final categories = await service.getCategories(mergeWebsiteData: false);

      expect(categories.length, 2);
      expect(categories[0].id, '1');
      expect(categories[0].name, 'Thời trang nam');
      expect(categories[1].name, 'Điện thoại & Phụ kiện');
    });

    test('getProducts parse JSON correctly', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'message': 'OK',
            'data': [
              {
                'id': '10',
                'name': 'Áo thun cotton cao cấp',
                'price': 99000,
                'originalPrice': 189000,
                'discount': 48,
                'rating': 4.9,
                'soldCount': 'Đã bán 1.2k',
                'badges': ['YÊU THÍCH+', 'Freeship Xtra'],
                'imageUrl': '',
                'isFlashSale': true,
                'isFeatured': true,
              }
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = CatalogService(client: mockClient);
      final products = await service.getProducts(mergeWebsiteData: false);

      expect(products.length, 1);
      expect(products[0].id, '10');
      expect(products[0].name, 'Áo thun cotton cao cấp');
      expect(products[0].price, 99000.0);
      expect(products[0].badges.contains('MALL'), false);
      expect(products[0].badges.contains('YÊU THÍCH+'), true);
      expect(products[0].isFlashSale, true);
    });

    test('getBanners parse JSON correctly', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'message': 'OK',
            'data': [
              {
                'id': '1',
                'title': 'Freeship Toàn Quốc',
                'subtitle': 'Voucher giảm 50%',
                'backgroundColor': '#EE4D2D',
                'imageUrl': '',
              }
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = CatalogService(client: mockClient);
      final banners = await service.getBanners();

      expect(banners.length, 1);
      expect(banners[0].title, 'Freeship Toàn Quốc');
    });
  });
}
