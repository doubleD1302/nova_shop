import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/main.dart';

void main() {
  testWidgets('ShopNova app smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const ShopNovaApp());

    // Verify that the app bar title is displayed.
    expect(find.text('Trang Chủ'), findsOneWidget);

    // Verify bottom navigation is displayed.
    expect(find.text('Trang chủ'), findsOneWidget);
    expect(find.text('Gian hàng'), findsOneWidget);
    expect(find.text('Khám phá'), findsOneWidget);
    expect(find.text('Thông báo'), findsOneWidget);
    expect(find.text('Tài khoản'), findsOneWidget);
  });
}
