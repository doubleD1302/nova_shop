import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/models/user.dart';
import 'package:shopnova/screens/seller/seller_hub_screen.dart';
import 'package:shopnova/screens/seller/seller_product_form_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Unified Mobile App Portal Tests', () {
    test('User model role getters identify buyer, seller, and admin accurately', () {
      const buyer = User(id: '1', username: 'b', fullName: 'Buyer', role: 'buyer');
      const seller = User(id: '2', username: 's', fullName: 'Seller', role: 'seller');
      const admin = User(id: '3', username: 'a', fullName: 'Admin', role: 'admin');

      expect(buyer.isBuyer, isTrue);
      expect(buyer.isSeller, isFalse);
      expect(buyer.isAdmin, isFalse);

      expect(seller.isSeller, isTrue);
      expect(seller.isAdmin, isFalse);

      expect(admin.isAdmin, isTrue);
      expect(admin.isSeller, isFalse);
    });

    testWidgets('SellerHubScreen renders unified AppBar, Về Chợ return button, 5 tabs, and Drawer', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: SellerHubScreen(),
        ),
      );
      await tester.pump();

      expect(find.text('Kênh Người Bán'), findsOneWidget);
      expect(find.text('Về Chợ'), findsOneWidget);
      expect(find.text('Tổng quan'), findsOneWidget);
      expect(find.text('Sản phẩm'), findsWidgets);
      expect(find.text('Đơn hàng'), findsWidgets);
      expect(find.text('Gian hàng'), findsWidgets);
      expect(find.text('Tài chính'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.menu_rounded));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Mã giảm giá (Vouchers)'), findsOneWidget);
      expect(find.text('Quảng cáo & Flash Sale'), findsOneWidget);
      expect(find.text('Chăm sóc khách hàng'), findsOneWidget);
      expect(find.text('Quay lại Chợ NovaShop'), findsOneWidget);
    });

    testWidgets('SellerProductFormScreen renders product creation form in unified app', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: SellerProductFormScreen(),
        ),
      );
      await tester.pump();

      expect(find.text('Đăng Sản Phẩm Mới'), findsOneWidget);
      expect(find.text('Thông tin cơ bản sản phẩm'), findsOneWidget);
      expect(find.text('Đăng bán'), findsOneWidget);
    });
  });
}
