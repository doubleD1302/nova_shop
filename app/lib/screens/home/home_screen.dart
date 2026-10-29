import 'package:flutter/material.dart';
import 'package:shopnova/widgets/home/banner_carousel.dart';
import 'package:shopnova/widgets/home/quick_links_section.dart';
import 'package:shopnova/widgets/home/category_grid.dart';
import 'package:shopnova/widgets/home/flash_sale_section.dart';
import 'package:shopnova/widgets/home/featured_shops_section.dart';
import 'package:shopnova/widgets/home/suggestion_tab_bar.dart';
import 'package:shopnova/widgets/home/product_card.dart';
import 'package:shopnova/widgets/home/commitment_strip.dart';
import 'package:shopnova/models/banner_item.dart';
import 'package:shopnova/models/category_item.dart';
import 'package:shopnova/models/flash_sale_item.dart';
import 'package:shopnova/models/product.dart';
import 'package:shopnova/services/catalog_service.dart';
import 'package:shopnova/screens/wallet/deposit_screen.dart';
import 'package:shopnova/theme/app_colors.dart';
import '../search/search_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final CatalogService _catalogService = CatalogService();
  int _suggestionTabIndex = 0;
  bool _isLoading = true;
  String? _errorMessage;

  List<BannerItem> _banners = [];
  List<CategoryItem> _categories = [];
  List<FlashSaleItem> _flashSaleItems = [];
  List<Product> _allProducts = [];

  @override
  void initState() {
    super.initState();
    _loadCatalogData();
  }

  Future<void> _loadCatalogData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final bannersFuture = _catalogService.getBanners();
      final categoriesFuture = _catalogService.getCategories();
      final flashSaleFuture = _catalogService.getFlashSaleItems();
      final productsFuture = _catalogService.getProducts();

      final results = await Future.wait([
        bannersFuture,
        categoriesFuture,
        flashSaleFuture,
        productsFuture,
      ]);

      if (mounted) {
        final banners = results[0] as List<BannerItem>;
        final categories = results[1] as List<CategoryItem>;
        final flashSale = results[2] as List<FlashSaleItem>;
        final products = results[3] as List<Product>;

        setState(() {
          _banners = banners;
          _categories = categories;
          _flashSaleItems = flashSale;
          _allProducts = products;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Không thể kết nối đến máy chủ. Kéo xuống để thử lại.';
          _isLoading = false;
        });
      }
    }
  }

  List<Product> _getFilteredProducts() {
    switch (_suggestionTabIndex) {
      case 1: // FREESHIP EXTRA
        final freeship = _allProducts.where((p) =>
            p.badges.any((b) => b.toLowerCase().contains('freeship'))).toList();
        return freeship.isNotEmpty ? freeship : _allProducts;
      case 2: // GIẢM GIÁ 50%
        final sale50 = _allProducts.where((p) => p.discount >= 40).toList();
        return sale50.isNotEmpty ? sale50 : _allProducts;
      case 3: // HÀNG HIỆU OUTLET
        final outlet = _allProducts.where((p) =>
            p.badges.any((b) => b.toUpperCase().contains('MALL')) || p.price <= 350000).toList();
        return outlet.isNotEmpty ? outlet : _allProducts;
      case 0: // GỢI Ý HÔM NAY
      default:
        return _allProducts;
    }
  }

  @override
  Widget build(BuildContext context) {
    final displayProducts = _getFilteredProducts();

    return Container(
      color: AppColors.background,
      child: RefreshIndicator(
        onRefresh: _loadCatalogData,
        color: AppColors.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            children: [
              // 1. Banner Carousel (Website Hero Banners)
              if (_banners.isNotEmpty)
                BannerCarousel(banners: _banners)
              else if (_isLoading)
                Container(
                  height: 140,
                  margin: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.grey[200],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),

              const SizedBox(height: 8),

              // 2. Quick Links (8 tiện ích nguyên bản website)
              QuickLinksSection(
                onLinkTap: (link) {
                  if (link.contains('flash')) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SearchScreen(
                          title: '⚡ Khung Giờ Flash Sale Chớp Nhoáng',
                          filterFlashSale: true,
                        ),
                      ),
                    );
                  } else if (link.contains('freeship')) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SearchScreen(
                          title: '🚚 Miễn Phí Vận Chuyển Freeship Xtra',
                          filterFreeship: true,
                        ),
                      ),
                    );
                  } else if (link.contains('mall')) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SearchScreen(
                          title: '💎 Nova Mall - 100% Chính Hãng',
                          filterMall: true,
                        ),
                      ),
                    );
                  } else if (link.contains('category=dien-thoai') || link.contains('topup')) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const DepositScreen()),
                    );
                  } else if (link.contains('discount')) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SearchScreen(
                          title: '🎟️ Siêu Mã Giảm Giá & Voucher Khủng',
                          initialSort: 'discount',
                        ),
                      ),
                    );
                  } else if (link.contains('price-asc')) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SearchScreen(
                          title: '🛒 Hàng Tiêu Dùng Giá Rẻ Vô Địch',
                          initialSort: 'price_asc',
                        ),
                      ),
                    );
                  } else if (link.contains('popular')) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SearchScreen(
                          title: '🔮 Xu Hướng Mua Sắm Thịnh Hành Hôm Nay',
                          initialSort: 'popular',
                        ),
                      ),
                    );
                  } else {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SearchScreen(
                          title: '🌍 Hàng Quốc Tế Deal Xịn & Mới Về',
                          initialSort: 'newest',
                        ),
                      ),
                    );
                  }
                },
              ),

              const SizedBox(height: 8),

              // 3. Danh mục ngành hàng (12 ngành hàng nguyên bản website)
              if (_categories.isNotEmpty)
                CategoryGrid(categories: _categories)
              else if (_isLoading)
                Container(
                  height: 120,
                  color: Colors.white,
                  child: const Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),

              const SizedBox(height: 8),

              // 4. Flash Sale Section (Đồng hồ đếm ngược + 5 sản phẩm Flash Sale)
              if (_flashSaleItems.isNotEmpty)
                FlashSaleSection(items: _flashSaleItems),

              const SizedBox(height: 8),

              // 5. Gian hàng nổi bật (Featured Shops: Anker, Cocoon, TechZone, NovaAudio...)
              if (_allProducts.isNotEmpty)
                FeaturedShopsSection(products: _allProducts),

              const SizedBox(height: 8),

              // 6. Suggestion Tab Bar (4 tabs chuẩn Website: Gợi ý, Freeship, Giảm giá 50%, Outlet)
              SuggestionTabBar(
                selectedIndex: _suggestionTabIndex,
                onTabChanged: (i) => setState(() => _suggestionTabIndex = i),
              ),

              // 7. Grid sản phẩm gợi ý (60 sản phẩm đầy đủ với bộ lọc theo tab)
              if (_isLoading && _allProducts.isEmpty)
                Container(
                  height: 200,
                  color: Colors.white,
                  child: const Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              else if (displayProducts.isEmpty)
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.all(24),
                  alignment: Alignment.center,
                  child: Column(
                    children: [
                      const Icon(Icons.inventory_2_outlined, size: 48, color: Colors.grey),
                      const SizedBox(height: 8),
                      Text(
                        _errorMessage ?? 'Chưa tải được sản phẩm. Bấm để làm mới!',
                        style: const TextStyle(color: Colors.grey, fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        onPressed: _loadCatalogData,
                        icon: const Icon(Icons.refresh, size: 18),
                        label: const Text('Tải lại sản phẩm', style: TextStyle(color: Colors.white)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                  child: GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                      childAspectRatio: 0.60,
                    ),
                    itemCount: displayProducts.length,
                    itemBuilder: (ctx, i) => ProductCard(product: displayProducts[i]),
                  ),
                ),

              const SizedBox(height: 8),

              // 8. Cam kết chất lượng (4 cam kết chuẩn website: Chính hãng 100%, 15 ngày đổi trả, Giao 2h, CSKH 24/7)
              const CommitmentStripWidget(),

              Container(
                margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border, width: 1),
                ),
                alignment: Alignment.center,
                child: TextButton(
                  onPressed: _loadCatalogData,
                  child: const Text(
                    'Xem thêm sản phẩm gợi ý >',
                    style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
