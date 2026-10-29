import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/screens/search/search_screen.dart';

void main() {
  testWidgets('SearchScreen renders search bar, filters and handles query', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: SearchScreen(initialQuery: 'tai nghe'),
      ),
    );

    // Initial pump and wait for future to settle
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byType(TextField), findsOneWidget);
    expect(find.text('Liên quan'), findsOneWidget);
    expect(find.text('Bán chạy'), findsOneWidget);
    expect(find.text('Mới nhất'), findsOneWidget);
  });
}
