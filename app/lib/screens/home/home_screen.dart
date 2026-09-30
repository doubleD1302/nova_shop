import 'package:flutter/material.dart';
import 'package:shopnova/widgets/home/banner_carousel.dart';
import 'package:shopnova/widgets/home/wallet_section.dart';
import 'package:shopnova/widgets/home/category_grid.dart';
import 'package:shopnova/widgets/home/flash_sale_section.dart';
import 'package:shopnova/widgets/home/suggestion_tab_bar.dart';
import 'package:shopnova/widgets/home/product_card.dart';
import 'package:shopnova/data/mock_data.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _suggestionTabIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF5F5F5),
      child: SingleChildScrollView(
        child: Column(
          children: [
            BannerCarousel(banners: MockData.banners),
            const SizedBox(height: 8),
            const WalletSection(),
            const SizedBox(height: 8),
            CategoryGrid(categories: MockData.categories),
            const SizedBox(height: 8),
            FlashSaleSection(items: MockData.flashSaleItems),
            const SizedBox(height: 8),
            SuggestionTabBar(
              selectedIndex: _suggestionTabIndex,
              onTabChanged: (i) => setState(() => _suggestionTabIndex = i),
            ),
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(8),
              child: GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                  childAspectRatio: 0.55,
                ),
                itemCount: MockData.suggestedProducts.length,
                itemBuilder: (ctx, i) => ProductCard(product: MockData.suggestedProducts[i]),
              ),
            ),
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(16),
              alignment: Alignment.center,
              child: TextButton(
                onPressed: () {},
                child: const Text(
                  'Xem thêm gợi ý hôm nay >',
                  style: TextStyle(color: Color(0xFFEE4D2D)), // AppColors.primary
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
