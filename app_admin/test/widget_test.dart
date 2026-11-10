import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova_admin/config/api_config.dart';
import 'package:shopnova_admin/main.dart';

void main() {
  testWidgets('ShopNovaAdminApp renders login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const ShopNovaAdminApp());
    expect(find.text('ShopNova Admin'), findsOneWidget);
  });

  test('ApiConfig.resolveImageUrl resolves relative /uploads and full URLs cleanly', () {
    ApiConfig.setBaseUrl('https://novashop-api-952u.onrender.com/');
    expect(
      ApiConfig.resolveImageUrl('/uploads/product-30066.jpg'),
      'https://novashop-api-952u.onrender.com/uploads/product-30066.jpg',
    );
    expect(
      ApiConfig.resolveImageUrl('https://cdn.shopnova.vn/test.jpg'),
      'https://cdn.shopnova.vn/test.jpg',
    );
    expect(ApiConfig.resolveImageUrl(''), '');
    expect(ApiConfig.resolveImageUrl(null), '');
    ApiConfig.resetBaseUrl();
  });
}
