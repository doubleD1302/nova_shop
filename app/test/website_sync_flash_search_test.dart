import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/models/category_item.dart';
import 'package:shopnova/models/flash_sale_item.dart';
import 'package:shopnova/models/product.dart';
import 'package:shopnova/screens/search/search_screen.dart';
import 'package:shopnova/services/catalog_service.dart';
import 'package:shopnova/utils/flash_sale_rotator.dart';
import 'package:shopnova/widgets/home/flash_sale_section.dart';

http.Response _jsonRes(dynamic body, [int status = 200]) {
  return http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    status,
    headers: {'content-type': 'application/json; charset=utf-8'},
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    ApiConfig.setBaseUrl('http://127.0.0.1:3000');
  });

  tearDown(() {
    ApiConfig.resetBaseUrl();
  });

  group('Website Sync 2b9943b - FlashSaleRotator & Product Pricing', () {
    test('rotateProducts computes 1000d-rounded flashPrice, originalPrice, exactDiscount and variants', () {
      final baseProducts = [
        const Product(
          id: 'p1',
          name: 'Túi đeo chéo Mộc Craft',
          imageUrl: '',
          price: 350000,
          originalPrice: 350000,
          discount: 0,
          rating: 4.9,
          soldCount: 'Đã bán 0',
          soldPercent: 0,
          badges: [],
          categoryId: 'tui-xach',
          stock: 20,
        ),
        const Product(
          id: 'p2',
          name: 'Giày Sneaker Bước Êm',
          imageUrl: '',
          price: 499000,
          originalPrice: 699000,
          discount: 29,
          rating: 4.8,
          soldCount: 'Đã bán 1.2k',
          soldPercent: 72,
          badges: ['Freeship Xtra'],
          categoryId: 'giay-dep',
          stock: 15,
          variants: [
            {'id': 'v1', 'name': 'Size 41', 'price': 699000, 'stock': 10},
          ],
        ),
      ];

      final rotated = FlashSaleRotator.rotateProducts(
        apiProducts: baseProducts,
        count: 2,
        now: DateTime(2026, 11, 18, 14, 15), // Weekday regular day, slot 7 (14:00)
      );

      expect(rotated.length, 2);
      for (final p in rotated) {
        expect(p.isFlashSale, isTrue);
        expect(p.originalPrice, greaterThan(p.price));
        expect(p.price % 1000, 0);
        final expectedExact =
            (((p.originalPrice - p.price) / p.originalPrice) * 100).round();
        expect(p.discount, expectedExact);
        expect(p.variants, isNotEmpty);
        expect(
          (p.variants.first['originalPrice'] as num).toDouble(),
          greaterThan((p.variants.first['price'] as num).toDouble()),
        );
      }

      // Check campaign bonuses & slot range label format
      final doubleDay = FlashSaleRotator.getCurrentCampaign(DateTime(2026, 11, 11, 10));
      expect(doubleDay.bonusDiscount, 10);
      final weekend = FlashSaleRotator.getCurrentCampaign(DateTime(2026, 11, 21, 10));
      expect(weekend.bonusDiscount, 5);
      expect(weekend.badge, 'WEEKEND');
      expect(
        FlashSaleRotator.getSessionRangeLabel(DateTime(2026, 11, 18, 14, 15)),
        '14:00 - 16:00 · Deal Chớp Nhoáng',
      );
    });

    test('Product.fromJson computes discount, soldPercent and soldNumeric when omitted by API', () {
      final p = Product.fromJson({
        'id': '301',
        'name': 'Ấm siêu tốc Living',
        'price': 300000,
        'originalPrice': 500000,
        'sold': 25,
        'stock': 75,
        'categoryName': 'Nhà cửa & đời sống',
      });

      expect(p.discount, 40);
      expect(p.soldPercent, 25);
      expect(p.categoryName, 'Nhà cửa & đời sống');

      final kProd = Product.fromJson({
        'id': '302',
        'name': 'Sản phẩm bán chạy',
        'price': 100000,
        'soldCount': 'Đã bán 1.5k',
      });
      expect(kProd.soldNumeric, 1500);
    });

    testWidgets('FlashSaleSection renders redesigned header, originalPrice strikethrough and SoldProgress states without overflow', (tester) async {
      final items = [
        const FlashSaleItem(
          id: 'fs1',
          name: 'Tai nghe Bluetooth Chống Ồn ANC Pro',
          imageUrl: '',
          price: 299000,
          originalPrice: 599000,
          discount: 50,
          soldPercentage: 0.0,
          soldPercentInt: 0,
          soldLabel: 'VỪA MỞ BÁN',
        ),
        const FlashSaleItem(
          id: 'fs2',
          name: 'Bình giữ nhiệt Thép không gỉ 900ml',
          imageUrl: '',
          price: 120000,
          originalPrice: 240000,
          discount: 50,
          soldPercentage: 0.92,
          soldPercentInt: 92,
          soldLabel: 'SẮP CHÁY HÀNG 92%',
        ),
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: FlashSaleSection(items: items),
            ),
          ),
        ),
      );

      expect(find.text('FLASH SALE'), findsOneWidget);
      expect(find.text('Xem tất cả'), findsOneWidget);
      expect(find.text('-50%'), findsNWidgets(2));
      expect(find.text('VỪA MỞ BÁN'), findsOneWidget);
      expect(find.text('SẮP CHÁY HÀNG 92%'), findsAtLeastNWidgets(1));
      expect(tester.takeException(), isNull);
    });
  });

  group('Website Sync 87d8130 & 1a673f9 - Category Aliases & Search EmptyState', () {
    test('CatalogService resolves category aliases and sends resolved slug + flash param', () async {
      expect(CatalogService.resolveCategorySlug('tui-vi'), 'tui-xach');
      expect(CatalogService.resolveCategorySlug('sac-dep'), 'my-pham');
      expect(CatalogService.resolveCategorySlug('dien-tu'), 'phu-kien-cong-nghe');
      expect(CatalogService.resolveCategorySlug('laptop'), 'dien-thoai');
      expect(CatalogService.resolveCategorySlug('nha-cua'), 'nha-cua-doi-song');
      expect(CatalogService.resolveCategorySlug('sneaker'), 'giay-dep');

      Uri? capturedUri;
      final mockClient = MockClient((request) async {
        capturedUri = request.url;
        return _jsonRes({
          'success': true,
          'data': {'products': [], 'total': 0},
        });
      });

      final service = CatalogService(client: mockClient);
      await service.searchProducts('balo', categoryId: 'tui-vi', flash: true);

      expect(capturedUri?.queryParameters['categoryId'], 'tui-xach');
      expect(capturedUri?.queryParameters['flash'], '1');
      expect(capturedUri?.queryParameters['q'], 'balo');
    });

    test('CategoryItem parses productCount and CatalogService maps category display names', () {
      final cat = CategoryItem.fromJson({
        'id': 'c1',
        'slug': 'phu-kien-cong-nghe',
        'name': 'Phụ kiện công nghệ',
        'productCount': 10,
      });
      expect(cat.productCount, 10);
      expect(cat.icon, Icons.headphones);
      expect(CatalogService.getCategoryName('tui-vi'), 'Túi xách');
    });

    testWidgets('SearchScreen renders category-aware EmptyState with live category suggestions matching Website 87d8130', (tester) async {
      final requestedCategories = <String?>[];
      final mockClient = MockClient((request) async {
        if (request.url.path == '/api/v1/categories') {
          return _jsonRes({
            'success': true,
            'data': [
              {'id': 'c1', 'slug': 'tui-xach', 'name': 'Túi xách', 'productCount': 0},
              {'id': 'c2', 'slug': 'giay-dep', 'name': 'Giày dép', 'productCount': 10},
            ],
          });
        }
        requestedCategories.add(request.url.queryParameters['categoryId']);
        if (request.url.queryParameters['categoryId'] == 'giay-dep') {
          return _jsonRes({
            'success': true,
            'data': {
              'products': [
                {
                  'id': 'g1',
                  'name': 'Giày Chạy Bộ Bước Êm',
                  'price': 450000,
                  'originalPrice': 600000,
                  'categoryId': 'giay-dep',
                  'categoryName': 'Giày dép',
                },
              ],
              'total': 1,
            },
          });
        }
        return _jsonRes({
          'success': true,
          'data': {'products': [], 'total': 0},
        });
      });

      await tester.pumpWidget(
        MaterialApp(
          home: SearchScreen(
            categoryId: 'tui-vi',
            catalogService: CatalogService(client: mockClient),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(requestedCategories, contains('tui-xach'));
      expect(
        find.text('Ngành hàng “Túi xách” hiện đang cập nhật sản phẩm'),
        findsOneWidget,
      );
      expect(find.text('Ngành hàng đang có sẵn sản phẩm:'), findsOneWidget);
      expect(find.text('Giày dép (10)'), findsOneWidget);
      expect(find.text('Xem toàn bộ sản phẩm'), findsOneWidget);
      expect(find.text('Về trang chủ'), findsOneWidget);

      await tester.tap(find.text('Giày dép (10)'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(requestedCategories, contains('giay-dep'));
      expect(find.text('Giày Chạy Bộ Bước Êm'), findsOneWidget);
    });
  });
}
