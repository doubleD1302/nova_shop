import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/screens/admin/admin_screen.dart';
import 'package:shopnova/widgets/common/report_content_sheet.dart';

void main() {
  group('Admin & Report Content Screen Tests', () {
    testWidgets('AdminScreen renders 8-module portal header, Về Chợ button, and drawer', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const MaterialApp(
          home: AdminScreen(),
        ),
      );
      await tester.pump();

      expect(find.text('Quản Trị'), findsOneWidget);
      expect(find.text('Tổng quan'), findsOneWidget);
      expect(find.text('Về Chợ'), findsOneWidget);

      // Open drawer to verify all 8 admin modules and return action
      await tester.tap(find.byIcon(Icons.menu_rounded));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Quản lý Shop'), findsOneWidget);
      expect(find.text('Người dùng'), findsOneWidget);
      expect(find.text('Sản phẩm'), findsOneWidget);
      expect(find.text('Đơn hàng'), findsOneWidget);
      expect(find.text('Doanh thu'), findsOneWidget);
      expect(find.text('Báo cáo vi phạm'), findsOneWidget);
      expect(find.text('Cài đặt hệ thống'), findsOneWidget);
      expect(find.text('Quay lại Chợ NovaShop'), findsOneWidget);
    });

    testWidgets('ReportContentSheet renders title, options, and submit button', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: ReportContentSheet(
              targetType: 'product',
              targetId: '1',
              targetName: 'Áo Thun Nam Cotton',
              shopName: 'Shop Nova Flagship',
            ),
          ),
        ),
      );

      expect(find.text('Báo Cáo Vi Phạm Nội Dung'), findsOneWidget);
      expect(find.text('Áo Thun Nam Cotton'), findsOneWidget);
      expect(find.text('Gian hàng: Shop Nova Flagship'), findsOneWidget);
      expect(find.text('Gửi Báo Cáo Vi Phạm'), findsOneWidget);
      expect(find.text('Hàng giả, hàng nhái, vi phạm thương hiệu'), findsOneWidget);
    });
  });
}
