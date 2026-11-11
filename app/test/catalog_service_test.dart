import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shopnova/services/catalog_service.dart';
import 'package:shopnova/data/website_data.dart';
import 'package:shopnova/utils/product_image_resolver.dart';
import 'package:shopnova/utils/flash_sale_rotator.dart';
import 'package:shopnova/models/product.dart';

void main() {
  group('CatalogService Tests (API-only, no static data fallback)', () {
    test('getCategories parses backend JSON correctly', () async {
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
      final categories = await service.getCategories();

      expect(categories.length, 2);
      expect(categories[0].id, '1');
      expect(categories[0].name, 'Thời trang nam');
      expect(categories[1].name, 'Điện thoại & Phụ kiện');
    });

    test('getCategories returns empty list on server error (no static fallback)', () async {
      final mockClient = MockClient((request) async => http.Response('Server Error', 500));
      final service = CatalogService(client: mockClient);
      final categories = await service.getCategories();

      expect(categories, isEmpty);
    });

    test('getProducts parses backend JSON correctly', () async {
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
                'imageUrl': '/uploads/product-10.jpg',
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
      final products = await service.getProducts();

      expect(products.length, 1);
      expect(products[0].id, '10');
      expect(products[0].name, 'Áo thun cotton cao cấp');
      expect(products[0].price, 99000.0);
      expect(products[0].badges.contains('YÊU THÍCH+'), true);
      expect(products[0].isFlashSale, true);
    });

    test('getProducts returns empty list on server error (no static fallback)', () async {
      final mockClient = MockClient((request) async => http.Response('Error', 503));
      final service = CatalogService(client: mockClient);
      final products = await service.getProducts();

      expect(products, isEmpty);
    });

    test('getBanners returns website-synced UI banners', () async {
      final offlineClient = MockClient((_) async => http.Response('Offline', 503));
      final service = CatalogService(client: offlineClient);
      final banners = await service.getBanners();

      expect(banners.isNotEmpty, true);
      expect(banners.length, WebsiteData.banners.length);
      expect(banners.first.imageUrl.startsWith('https://'), true);
      for (final b in banners) {
        expect(b.title.isNotEmpty, true);
      }
    });

    test('searchProducts returns API results without injecting static catalog products', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'message': 'OK',
            'data': [
              {
                'id': '21',
                'name': 'Tai nghe Bluetooth ANC',
                'price': 499000,
                'imageUrl': 'https://example.com/tai-nghe.jpg',
              },
            ],
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final service = CatalogService(client: mockClient);
      final result = await service.searchProducts('tai nghe');

      expect(result.products.length, 1);
      expect(result.isExactMatch, true);
      expect(result.products.first.name, 'Tai nghe Bluetooth ANC');
    });

    test('searchProducts returns empty result on API failure', () async {
      final mockClient = MockClient((request) async => http.Response('Not Found', 404));
      final service = CatalogService(client: mockClient);
      final result = await service.searchProducts('tai nghe');

      expect(result.products, isEmpty);
    });

    test('ProductImageResolver returns only real server URLs and empty string otherwise', () {
      expect(ProductImageResolver.resolve(id: 'p01', name: 'Test'), isEmpty);
      expect(
        ProductImageResolver.resolve(imageUrl: 'https://cdn.example.com/a.jpg'),
        isEmpty,
      );
      expect(
        ProductImageResolver.resolve(imageUrl: '/uploads/product-1.jpg'),
        contains('/uploads/product-1.jpg'),
      );
      expect(
        ProductImageResolver.resolve(imageUrl: 'https://cdn.novashop-live.vn/a.jpg'),
        'https://cdn.novashop-live.vn/a.jpg',
      );
    });

    test('FlashSaleRotator returns empty list when API products list is empty or null', () {
      expect(FlashSaleRotator.rotateItems(apiProducts: null), isEmpty);
      expect(FlashSaleRotator.rotateItems(apiProducts: const <Product>[]), isEmpty);
      expect(FlashSaleRotator.getSessionLabel(), matches(RegExp(r'^\d{2}:00$')));
    });
  });
}
