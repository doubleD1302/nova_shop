import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova_admin/main.dart';

void main() {
  testWidgets('ShopNovaAdminApp renders login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const ShopNovaAdminApp());
    expect(find.text('ShopNova Admin'), findsOneWidget);
  });
}
