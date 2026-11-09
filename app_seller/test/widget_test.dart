import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova_seller/main.dart';

void main() {
  testWidgets('ShopNovaSellerApp renders login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const ShopNovaSellerApp());
    expect(find.text('ShopNova Seller Centre'), findsOneWidget);
  });
}
