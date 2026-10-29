import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/screens/seller/seller_register_screen.dart';
import 'package:shopnova/services/auth_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('SellerRegisterScreen Widget Tests', () {
    testWidgets('SellerRegisterScreen renders header, perks, and registration form', (tester) async {
      AuthService().logout();

      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: SellerRegisterScreen(),
        ),
      );
      await tester.pumpAndSettle();

      // Check Header
      expect(find.text('Đăng Ký Đối Tác Bán Hàng'), findsOneWidget);
      expect(find.text('Khởi Nghiệp Bán Hàng 0đ'), findsOneWidget);

      // Check Perks
      expect(find.text('0đ Phí mở shop'), findsOneWidget);
      expect(find.text('Freeship Xtra'), findsOneWidget);
      expect(find.text('Nova AI Bán Hàng'), findsOneWidget);
      expect(find.text('Khung Giờ Flash'), findsOneWidget);

      // Check Section & Form Labels
      expect(find.text('Thông Tin Gian Hàng Của Bạn'), findsOneWidget);
      expect(find.text('Tên Gian Hàng / Shop Name *'), findsOneWidget);
      expect(find.text('Tỉnh / Thành Phố Kho Hàng *'), findsOneWidget);
      expect(find.text('Khẩu Hiệu / Giới Thiệu Ngắn'), findsOneWidget);
      expect(find.text('Ngành Hàng Kinh Doanh Chính'), findsOneWidget);

      // Check category chips
      expect(find.text('Điện thoại & Phụ kiện'), findsOneWidget);

      // Check submit button
      expect(find.text('Hoàn Tất Đăng Ký Mở Gian Hàng'), findsOneWidget);
    });
  });
}
