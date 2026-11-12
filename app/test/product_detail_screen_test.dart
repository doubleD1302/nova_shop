import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/models/product.dart';
import 'package:shopnova/screens/product_detail/product_detail_screen.dart';

void main() {
  final testProduct = Product(
    id: 'prod_test_1',
    name: 'Samsung Galaxy A17 5G 8GB 128GB',
    imageUrl: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=600&q=80',
    price: 4990000,
    originalPrice: 5990000,
    discount: 17,
    rating: 4.8,
    soldCount: '1.2k',
    badges: ['Chính Hãng', 'MALL'],
    shopName: 'Sao Mai Mobile',
    categoryName: 'Điện thoại và phụ kiện',
    description: 'Samsung Galaxy A17 5G với hiệu năng ổn định, màn hình rực rỡ và pin dung lượng lớn.',
    location: 'TP. Hồ Chí Minh',
    stock: 100,
    specs: {
      'Màn hình': '6.6 inch Super AMOLED',
      'RAM': '8GB',
      'Bộ nhớ trong': '128GB',
      'Pin': '5000 mAh',
    },
  );

  testWidgets('ProductDetailScreen renders shop stats, tabs and switches cleanly without overflow', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(() => tester.view.resetPhysicalSize());

    await tester.pumpWidget(
      MaterialApp(
        home: ProductDetailScreen(initialProduct: testProduct),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    // 1. Verify commitment banner & shop info
    expect(find.text('Sao Mai Mobile'), findsWidgets);
    expect(find.text('Đánh giá shop'), findsOneWidget);
    expect(find.text('Tỷ lệ phản hồi'), findsOneWidget);
    expect(find.text('Hàng chính hãng'), findsOneWidget);

    // 2. Scroll to tabs
    final tabFinder = find.byType(TabBar);
    await tester.ensureVisible(tabFinder);
    await tester.pump(const Duration(milliseconds: 200));

    // Verify Tab labels exist
    expect(find.text('Chi Tiết'), findsOneWidget);
    expect(find.text('Thông Số'), findsOneWidget);
    expect(find.text('Vận Chuyển'), findsOneWidget);

    // 3. Tab 1 content: Metadata and description
    expect(find.text('Danh Mục'), findsOneWidget);
    expect(find.text('Kho hàng'), findsOneWidget);
    expect(find.text('Mô Tả Sản Phẩm'), findsOneWidget);
    expect(find.text('#ChínhHãng100%'), findsOneWidget);
    expect(find.text('#FreeshipExtra'), findsOneWidget);

    // 4. Tap Tab 2: Thông Số (index 1)
    await tester.tap(find.text('Thông Số'));
    await tester.pump(const Duration(milliseconds: 300));

    // Verify Specs Table
    expect(find.text('Màn hình'), findsOneWidget);
    expect(find.text('6.6 inch Super AMOLED'), findsOneWidget);
    expect(find.text('RAM'), findsOneWidget);
    expect(find.text('8GB'), findsOneWidget);
    expect(find.text('Pin'), findsOneWidget);
    expect(find.text('5000 mAh'), findsOneWidget);

    // 5. Tap Tab 3: Vận Chuyển (index 2)
    await tester.tap(find.text('Vận Chuyển'));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Phí Vận Chuyển & Giao Hàng'), findsOneWidget);
    expect(find.text('Chính Sách Đổi Trả & Bảo Hành'), findsOneWidget);

    // 6. Tap back to Tab 1 (Chi Tiết)
    await tester.tap(find.text('Chi Tiết'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Mô Tả Sản Phẩm'), findsOneWidget);

    // 7. Verify Reviews section
    final reviewFinder = find.text('ĐÁNH GIÁ SẢN PHẨM');
    await tester.ensureVisible(reviewFinder);
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('ĐÁNH GIÁ SẢN PHẨM'), findsOneWidget);
    expect(find.text('Viết đánh giá'), findsOneWidget);
  });
}
