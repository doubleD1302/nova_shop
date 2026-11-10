import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/main.dart';
import 'package:shopnova/models/user.dart';
import 'package:shopnova/screens/account/account_screen.dart';
import 'package:shopnova/screens/seller/seller_hub_screen.dart';
import 'package:shopnova/screens/seller/seller_product_form_screen.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/services/portal_controller.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Website-Parity Role Isolation & Portal Tests', () {
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

    test('PortalController defaults unauthenticated session to buyer mode and ignores unauthorized switches', () {
      AuthService().logout();
      final portal = PortalController();
      portal.syncFromAuth(forceResetToRole: true);

      expect(portal.mode, PortalMode.buyer);
      portal.switchToSeller();
      expect(portal.mode, PortalMode.buyer);
      portal.switchToAdmin();
      expect(portal.mode, PortalMode.buyer);
    });

    testWidgets('AppRootScreen renders isolated Buyer storefront by default without Seller/Admin tabs mixed in', (tester) async {
      AuthService().logout();
      PortalController().syncFromAuth(forceResetToRole: true);

      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(const ShopNovaApp());
      await tester.pump();

      expect(find.text('Trang chủ'), findsOneWidget);
      expect(find.text('Giỏ hàng'), findsOneWidget);
      expect(find.text('Kênh Người Bán'), findsNothing);
      expect(find.text('Quản Trị'), findsNothing);
    });

    testWidgets('AccountScreen in guest/buyer mode only displays Seller Registration CTA, not Quản Lý Shop', (tester) async {
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

      expect(find.text('Đăng Ký Bán Hàng Miễn Phí'), findsOneWidget);
      expect(find.text('Quản Lý Shop'), findsNothing);
      expect(find.text('Kênh Người Bán (Quản Lý Shop)'), findsNothing);
    });

    testWidgets('SellerHubScreen renders standalone Seller Centre with Về trang mua sắm action and 5 tabs', (tester) async {
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
      expect(find.text('Mua sắm'), findsOneWidget);
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
      expect(find.text('Về trang mua sắm'), findsOneWidget);
    });

    testWidgets('SellerProductFormScreen renders product creation form cleanly', (tester) async {
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
