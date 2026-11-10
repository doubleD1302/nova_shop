import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/screens/seller/seller_register_screen.dart';
import 'package:shopnova/services/auth_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('SellerRegisterScreen Widget Tests', () {
    testWidgets('SellerRegisterScreen renders welcome screen and transitions to Step 1', (tester) async {
      AuthService().logout();

      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: SellerRegisterScreen(),
        ),
      );
      await tester.pump();

      // Check Welcome Screen
      expect(find.text('Chào mừng đến với\nKênh Người Bán NovaShop!'), findsOneWidget);
      expect(find.text('Bắt đầu đăng ký'), findsOneWidget);

      // Tap "Bắt đầu đăng ký"
      await tester.tap(find.text('Bắt đầu đăng ký'));
      await tester.pumpAndSettle();

      // Check Header & Stepper
      expect(find.text('Đăng Ký Kênh Người Bán'), findsOneWidget);
      expect(find.text('Thông tin'), findsOneWidget);
      expect(find.text('Vận chuyển'), findsOneWidget);
      expect(find.text('Định danh'), findsOneWidget);
      expect(find.text('Thuế'), findsOneWidget);
      expect(find.text('Hoàn tất'), findsOneWidget);

      // Check Step 1 Form Labels
      expect(find.text('Thông tin cơ bản Shop'), findsOneWidget);
      expect(find.text('Địa chỉ lấy hàng *'), findsOneWidget);
      expect(find.text('Tiếp theo'), findsOneWidget);
    });
  });
}
