import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova_seller/main.dart';
import 'package:shopnova_seller/screens/register_screen.dart';
import 'package:shopnova_seller/screens/seller_main_screen.dart';
import 'package:shopnova_seller/screens/seller_product_form_screen.dart';

void main() {
  testWidgets('ShopNovaSellerApp renders login screen and directs new shop registration to ShopNova app', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    await tester.pumpWidget(const ShopNovaSellerApp());
    expect(find.text('ShopNova Seller Centre'), findsOneWidget);
    expect(find.text('Đăng ký trên App ShopNova'), findsOneWidget);

    await tester.tap(find.text('Đăng ký trên App ShopNova'));
    await tester.pumpAndSettle();

    expect(find.text('Đăng ký bán hàng trên ShopNova'), findsOneWidget);
  });

  testWidgets('SellerMainScreen renders 5 tabs and Drawer without overflow', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    await tester.pumpWidget(const MaterialApp(home: SellerMainScreen()));
    await tester.pump();

    expect(find.text('Kênh Người Bán'), findsOneWidget);
    expect(find.text('Tổng quan'), findsOneWidget);
    expect(find.text('Tài chính'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.menu_rounded));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Mã giảm giá (Vouchers)'), findsOneWidget);
    expect(find.text('Tài chính & Ví Shop'), findsOneWidget);
  });

  testWidgets('RegisterScreen renders welcome screen and transitions to Step 1', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(home: RegisterScreen()));
    await tester.pump();

    expect(find.text('Chào mừng đến với\nKênh Người Bán NovaShop!'), findsOneWidget);
    expect(find.text('Bắt đầu đăng ký'), findsOneWidget);

    // Tap "Bắt đầu đăng ký"
    await tester.tap(find.text('Bắt đầu đăng ký'));
    await tester.pumpAndSettle();

    // Verify Stepper Header and Step 1 fields
    expect(find.text('Đăng Ký Kênh Người Bán'), findsOneWidget);
    expect(find.text('Thông tin'), findsOneWidget);
    expect(find.text('Thông tin cơ bản Shop'), findsOneWidget);
    expect(find.text('Tiếp theo'), findsOneWidget);
  });

  testWidgets('SellerProductFormScreen renders new product creation fields', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: SellerProductFormScreen(
          initialCategories: [
            {'id': 'thoi-trang-nam', 'slug': 'thoi-trang-nam', 'name': 'Thời trang nam'},
            {'id': 'dien-thoai', 'slug': 'dien-thoai', 'name': 'Điện thoại & Phụ kiện'},
          ],
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Đăng Sản Phẩm Mới'), findsOneWidget);
    expect(find.text('Hình ảnh sản phẩm (0/4)'), findsOneWidget);
    expect(find.text('+ Thêm ảnh vị trí 1'), findsOneWidget);
  });

  testWidgets('SellerProductFormScreen shows rejected banner when product was rejected by admin', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: SellerProductFormScreen(
          initialProduct: {
            'id': '101',
            'name': 'Áo phông nam cao cấp',
            'price': 150000,
            'originalPrice': 200000,
            'stock': 25,
            'description': 'Mô tả chi tiết',
            'approvalStatus': 'rejected',
            'rejectionReason': 'Ảnh chụp chưa rõ góc cận cảnh.',
            'images': [],
          },
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Chỉnh Sửa Sản Phẩm'), findsOneWidget);
    expect(find.text('Sản phẩm đã bị Ban Quản Trị từ chối kiểm duyệt'), findsOneWidget);
    expect(find.textContaining('Ảnh chụp chưa rõ góc cận cảnh'), findsOneWidget);
  });

  testWidgets('SellerProductFormScreen shows suspended banner when shop is suspended', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: SellerProductFormScreen(
          shopInfo: {
            'status': 'suspended',
            'suspensionReason': 'Vi phạm quy định hàng giả.',
          },
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Gian hàng của bạn hiện đang bị tạm khóa'), findsOneWidget);
    expect(find.textContaining('Vi phạm quy định hàng giả'), findsOneWidget);
  });
}
