import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/screens/account/account_screen.dart';
import 'package:shopnova/services/auth_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ShopNova Buyer App Separation Tests', () {
    testWidgets('AccountScreen shows Seller Registration and ShopNova Seller app redirect notice', (tester) async {
      AuthService().logout();
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: AccountScreen(),
        ),
      );
      await tester.pump();

      expect(find.text('Đăng Ký Mở Shop'), findsOneWidget);
      expect(find.text('Quản Lý Shop'), findsOneWidget);

      await tester.tap(find.text('Quản Lý Shop'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Ứng dụng: ShopNova Seller'), findsOneWidget);
      expect(find.text('Đăng ký mở shop mới'), findsOneWidget);
    });
  });
}
