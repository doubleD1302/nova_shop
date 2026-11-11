import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/data/website_data.dart';
import 'package:shopnova/widgets/home/quick_links_section.dart';

void main() {
  testWidgets('QuickLinksSection renders 8 ShopNova-themed vector icons without raw emojis or overflow', (tester) async {
    tester.view.physicalSize = const Size(360, 780);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final tappedLinks = <String>[];

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SafeArea(
            child: SingleChildScrollView(
              child: QuickLinksSection(
                onLinkTap: (link) => tappedLinks.add(link),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    for (final item in WebsiteData.quickLinks) {
      expect(find.byIcon(item.icon), findsOneWidget);
      expect(find.text(item.label), findsOneWidget);
    }

    // Confirm legacy colorful OS emojis were removed from quick links
    for (final legacyEmoji in const ['⚡', '🎟️', '🚚', '💎', '✨', '📱', '🛒', '🔎']) {
      expect(find.text(legacyEmoji), findsNothing);
    }

    await tester.tap(find.byIcon(Icons.bolt_rounded));
    await tester.tap(find.byIcon(Icons.local_shipping_outlined));
    await tester.tap(find.byIcon(Icons.local_fire_department_outlined));
    await tester.pump();

    expect(tappedLinks, [
      '/tim-kiem?flash=1',
      '/tim-kiem?freeship=1',
      '/tim-kiem?sort=popular',
    ]);
  });
}

