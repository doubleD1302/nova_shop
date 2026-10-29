import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/screens/admin/admin_screen.dart';
import 'package:shopnova/widgets/common/report_content_sheet.dart';

void main() {
  group('Admin & Report Content Screen Tests', () {
    testWidgets('AdminScreen renders tabs and header', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AdminScreen(),
        ),
      );

      expect(find.text('Trung Tâm Quản Trị Admin'), findsOneWidget);
      expect(find.text('Báo Cáo Vi Phạm'), findsOneWidget);
      expect(find.text('Duyệt Sản Phẩm'), findsOneWidget);
      expect(find.text('Quản Lý Shop'), findsOneWidget);
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
