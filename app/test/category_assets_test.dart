import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/models/category_item.dart';
import 'package:shopnova/theme/app_theme.dart';
import 'package:shopnova/widgets/common/category_icon.dart';
import 'package:shopnova/widgets/common/nova_assets.dart';
import 'package:shopnova/widgets/home/category_grid.dart';
import 'package:shopnova/widgets/home/commitment_strip.dart';

void main() {
  testWidgets(
    'API categories retain labels and render shared vectors with large text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 740);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final categories =
          [
                ('dien-thoai', 'Điện thoại và phụ kiện'),
                ('giay-dep', 'Giày dép'),
                ('tui-xach', 'Túi xách'),
                ('nha-cua-doi-song', 'Nhà cửa và đời sống'),
                ('phu-kien-cong-nghe', 'Phụ kiện công nghệ'),
              ]
              .map(
                (item) => CategoryItem.fromJson({
                  'id': item.$1,
                  'slug': item.$1,
                  'name': item.$2,
                  'productCount': 10,
                }),
              )
              .toList();
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: TextScaler.linear(1.6)),
            child: child!,
          ),
          home: Scaffold(
            body: SingleChildScrollView(
              child: Column(
                children: [
                  CategoryGrid(categories: categories),
                  const CommitmentStripWidget(),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(CategoryIcon), findsNWidgets(5));
      for (final category in categories) {
        expect(find.text(category.name), findsOneWidget);
      }
      expect(find.text('🎧'), findsNothing);
      await tester.tap(find.text('Xem tất cả'));
      await tester.pumpAndSettle();
      expect(find.text('Tất cả danh mục'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'All category SVGs, fallback and Nova artwork load without errors',
    (tester) async {
      const slugs = [
        'thoi-trang-nam',
        'thoi-trang-nu',
        'dien-thoai',
        'may-tinh',
        'phu-kien-cong-nghe',
        'giay-dep',
        'tui-xach',
        'my-pham',
        'nha-cua-doi-song',
        'me-be',
        'bach-hoa',
        'the-thao',
        'o-to-xe-may',
        'may-anh',
        'danh-muc-moi',
      ];
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: Column(
                children: [
                  Wrap(
                    children: [
                      for (final slug in slugs) CategoryIcon(slug: slug),
                    ],
                  ),
                  NovaMark(),
                  NovaNotes(),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(CategoryIcon), findsNWidgets(15));
      expect(find.byType(NovaMark), findsOneWidget);
      expect(find.byType(NovaNotes), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
