import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/screens/seller/seller_register_screen.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/widgets/common/nova_logo.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Finder findTextFieldByHint(String hint) {
    return find.byWidgetPredicate(
      (w) => w is TextField && w.decoration?.hintText == hint,
    );
  }

  Finder findTextFieldByLabel(String label) {
    return find.byWidgetPredicate(
      (w) => w is TextField && w.decoration?.labelText == label,
    );
  }

  group('SellerRegisterScreen Widget Tests', () {
    testWidgets('Renders welcome screen with NovaLogo & login link and transitions to Step 1', (tester) async {
      AuthService().logout();

      tester.view.physicalSize = const Size(412, 915);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: SellerRegisterScreen(),
        ),
      );
      await tester.pump();

      // Welcome Screen synced with Website
      expect(find.byType(NovaLogo), findsOneWidget);
      expect(find.text('Chào mừng đến với\nKênh Người Bán NovaShop!'), findsOneWidget);
      expect(find.text('Bắt đầu đăng ký'), findsOneWidget);
      expect(find.text('Đăng nhập ngay'), findsOneWidget);
      expect(find.text('← Quay lại trang chủ mua sắm'), findsOneWidget);

      // Tap "Bắt đầu đăng ký"
      await tester.tap(find.text('Bắt đầu đăng ký'));
      await tester.pumpAndSettle();

      // Check Header & 5-Step Stepper
      expect(find.text('Đăng Ký Kênh Người Bán'), findsOneWidget);
      expect(find.text('Thông tin'), findsOneWidget);
      expect(find.text('Vận chuyển'), findsOneWidget);
      expect(find.text('Định danh'), findsOneWidget);
      expect(find.text('Thuế'), findsOneWidget);
      expect(find.text('Hoàn tất'), findsOneWidget);

      // Check Step 1 Form Labels & Connected +84 Phone Prefix
      expect(find.text('Thông tin cơ bản Shop'), findsOneWidget);
      expect(find.text('Địa chỉ lấy hàng *'), findsOneWidget);
      expect(find.text('+84'), findsOneWidget);
      expect(find.text('Thiết lập tài khoản người bán'), findsOneWidget);
      expect(find.text('Tiếp theo'), findsOneWidget);
    });

    testWidgets('Full 4-step wizard validation, Address Modal with regions, and unchecked terms guard', (tester) async {
      AuthService().logout();

      tester.view.physicalSize = const Size(412, 915);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: SellerRegisterScreen(),
        ),
      );
      await tester.pump();

      await tester.tap(find.text('Bắt đầu đăng ký'));
      await tester.pumpAndSettle();

      // Test Step 1 empty validation
      await tester.tap(find.text('Tiếp theo'));
      await tester.pumpAndSettle();
      expect(find.text('Vui lòng nhập Tên Shop (bắt buộc).'), findsOneWidget);

      // Fill Step 1 Shop info
      await tester.enterText(findTextFieldByLabel('Tên Shop *'), 'Nova Official Store');
      await tester.pump();

      // Open Address Modal
      await tester.ensureVisible(find.text('+ Thêm địa chỉ'));
      await tester.tap(find.text('+ Thêm địa chỉ'));
      await tester.pumpAndSettle();

      expect(find.text('Địa chỉ lấy hàng của Shop'), findsOneWidget);
      expect(find.text('TP. Hồ Chí Minh (Miền Nam)'), findsOneWidget);

      await tester.enterText(
        findTextFieldByHint('Ví dụ: 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1...'),
        '123 Nguyễn Huệ, Quận 1',
      );
      await tester.tap(find.text('Lưu địa chỉ'));
      await tester.pumpAndSettle();

      // Saved pickup address is reflected on Step 1
      expect(find.text('123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh'), findsOneWidget);

      // Fill contact email & phone
      await tester.enterText(findTextFieldByLabel('Email liên hệ nhận đơn *'), 'seller@novashop.vn');
      await tester.enterText(findTextFieldByHint('Nhập số điện thoại...'), '0912345678');

      // Fill guest seller account fields
      final fullNameField = findTextFieldByLabel('Họ và tên chủ sở hữu *');
      await tester.ensureVisible(fullNameField);
      await tester.enterText(fullNameField, 'Nguyễn Văn A');

      final usernameField = findTextFieldByLabel('Tên đăng nhập *');
      await tester.ensureVisible(usernameField);
      await tester.enterText(usernameField, 'nova_seller_01');

      final passwordField = findTextFieldByLabel('Mật khẩu *');
      await tester.ensureVisible(passwordField);
      await tester.enterText(passwordField, 'Password123!');

      final confirmPasswordField = findTextFieldByLabel('Nhập lại mật khẩu *');
      await tester.ensureVisible(confirmPasswordField);
      await tester.enterText(confirmPasswordField, 'Password123!');

      // Proceed to Step 2
      await tester.tap(find.text('Tiếp theo'));
      await tester.pumpAndSettle();

      expect(find.text('Cài đặt phương thức vận chuyển cho Shop'), findsOneWidget);
      expect(find.text('⚡ Vận chuyển Nhanh'), findsOneWidget);
      expect(find.text('TP. Hồ Chí Minh (Miền Nam)'), findsOneWidget);

      // Proceed to Step 3
      await tester.tap(find.text('Tiếp theo'));
      await tester.pumpAndSettle();

      expect(find.text('Loại hình kinh doanh:'), findsOneWidget);
      expect(find.text('Cá nhân'), findsOneWidget);
      expect(find.text('Hộ kinh doanh'), findsOneWidget);
      expect(find.text('Doanh nghiệp'), findsOneWidget);

      // Validate CCCD requirement
      await tester.tap(find.text('Tiếp theo'));
      await tester.pumpAndSettle();
      expect(find.text('Vui lòng nhập số CMND / CCCD / Hộ chiếu của chủ Shop.'), findsOneWidget);

      await tester.enterText(
        findTextFieldByLabel('Số CMND / CCCD / Hộ chiếu (9 - 12 chữ số) *'),
        '001201012345',
      );

      // Proceed to Step 4
      await tester.tap(find.text('Tiếp theo'));
      await tester.pumpAndSettle();

      expect(find.text('Khai báo mã số thuế'), findsOneWidget);
      expect(find.text('Hoàn tất & Gửi duyệt'), findsOneWidget);

      // Checkbox defaults to false and blocks submission until agreed (synced with Website)
      final checkbox = tester.widget<CheckboxListTile>(find.byType(CheckboxListTile));
      expect(checkbox.value, isFalse);

      await tester.tap(find.text('Hoàn tất & Gửi duyệt'));
      await tester.pumpAndSettle();
      expect(
        find.text('Bạn cần đồng ý với Quy chế hoạt động sàn TMĐT NovaShop để tiếp tục.'),
        findsOneWidget,
      );
    });
  });
}
