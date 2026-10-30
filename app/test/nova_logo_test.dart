import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/widgets/common/nova_logo.dart';

void main() {
  testWidgets('NovaLogo renders authentic logo image and brand text', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: NovaLogo(),
        ),
      ),
    );

    // Verify Nova & Shop text spans
    expect(find.byType(RichText), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);
  });

  testWidgets('NovaLogo with subtitle renders subtitle text', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: NovaLogo(subtitle: 'Kênh Người Bán'),
        ),
      ),
    );

    expect(find.text('Kênh Người Bán'), findsOneWidget);
  });
}
