import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../models/category_item.dart';
import '../../models/product.dart';
import '../../services/cart_service.dart';
import '../../services/catalog_service.dart';
import '../../utils/flash_sale_rotator.dart';
import '../../theme/app_colors.dart';
import '../../widgets/home/product_card.dart';
import '../cart/cart_screen.dart';

class SearchScreen extends StatefulWidget {
  final String? initialQuery;
  final String? initialCategory;
  final String? categoryId;
  final String? title;
  final bool filterMall;
  final bool filterFreeship;
  final bool filterFlashSale;
  final String initialSort;
  final CatalogService? catalogService;

  const SearchScreen({
    super.key,
    this.initialQuery,
    this.initialCategory,
    this.categoryId,
    this.title,
    this.filterMall = false,
    this.filterFreeship = false,
    this.filterFlashSale = false,
    this.initialSort = 'relevance',
    this.catalogService,
  });

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  late final CatalogService _catalogService =
      widget.catalogService ?? CatalogService();

  String _currentQuery = '';
  bool _isLoading = false;
  bool _isExactMatch = true;
  List<Product> _products = [];

  late String _selectedSort;
  late bool _filterMall;
  late bool _filterFreeship;
  late bool _filterFlashSale;
  String? _categoryId;
  String? _categoryName;
  String? _pageTitle;

  static const String _recentSearchPrefsKey = 'shopnova_recent_searches';
  List<String> _recentSearches = [];
  List<String> _popularTags = [];
  List<CategoryItem> _categories = [];

  bool get _isBrowsingMode =>
      _pageTitle != null ||
      _categoryName != null ||
      _categoryId != null ||
      _filterFlashSale ||
      _filterMall ||
      _filterFreeship ||
      _selectedSort != 'relevance';

  @override
  void initState() {
    super.initState();
    _selectedSort = widget.initialSort;
    _filterMall = widget.filterMall;
    _filterFreeship = widget.filterFreeship;
    _filterFlashSale = widget.filterFlashSale;
    final resolvedInitCat = CatalogService.resolveCategorySlug(widget.categoryId);
    _categoryId = resolvedInitCat.isNotEmpty ? resolvedInitCat : null;
    _categoryName = widget.initialCategory;
    _pageTitle = widget.title;
    _loadRecentSearches();
    _loadDynamicSuggestions();

    if (widget.initialQuery != null && widget.initialQuery!.trim().isNotEmpty) {
      _currentQuery = widget.initialQuery!.trim();
      _searchController.text = _currentQuery;
      _performSearch(_currentQuery);
    } else if (_isBrowsingMode) {
      _loadBrowsingProducts();
    } else {
      _focusNode.requestFocus();
    }
  }

  Future<void> _loadRecentSearches() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getStringList(_recentSearchPrefsKey) ?? [];
      if (mounted) {
        setState(() => _recentSearches = saved);
      }
    } catch (_) {}
  }

  Future<void> _saveRecentSearches() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_recentSearchPrefsKey, _recentSearches);
    } catch (_) {}
  }

  Future<void> _loadDynamicSuggestions() async {
    try {
      final cats = await _catalogService.getCategories();
      if (mounted && cats.isNotEmpty) {
        String? resolvedName = _categoryName;
        if (_categoryId != null && (resolvedName == null || resolvedName.isEmpty)) {
          for (final cat in cats) {
            if (CatalogService.resolveCategorySlug(cat.slug ?? cat.id) == _categoryId) {
              resolvedName = cat.name;
              break;
            }
          }
          resolvedName ??= CatalogService.getCategoryName(_categoryId);
        }
        setState(() {
          _categories = cats;
          _categoryName = resolvedName;
          _popularTags = cats.take(8).map((cat) => cat.name).where((name) => name.isNotEmpty).toList();
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _loadBrowsingProducts() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final result = await _catalogService.searchProducts(
        _currentQuery,
        categoryId: _categoryId ?? _categoryName,
        mall: _filterMall ? true : null,
        freeship: _filterFreeship ? true : null,
        flash: _filterFlashSale ? true : null,
        sort: _selectedSort,
      );
      List<Product> list = List<Product>.from(result.products);

      // Nếu đang xem Flash Sale mà API chưa gắn cờ trên DB, dùng xoay tua sản phẩm thật đồng bộ Website
      if (_filterFlashSale && list.isEmpty && _currentQuery.isEmpty && _categoryId == null) {
        final fallbackResult = await _catalogService.searchProducts(
          '',
          mall: _filterMall ? true : null,
          freeship: _filterFreeship ? true : null,
        );
        if (fallbackResult.products.isNotEmpty) {
          list = FlashSaleRotator.rotateProducts(
            apiProducts: fallbackResult.products,
            count: fallbackResult.products.length > 12 ? 12 : fallbackResult.products.length,
          );
        }
      }

      // Áp dụng bộ lọc sắp xếp bổ sung theo thứ tự hiển thị
      if (_selectedSort == 'discount') {
        list.sort((a, b) {
          final discA = a.originalPrice > a.price ? (a.originalPrice - a.price) / a.originalPrice : a.discount / 100.0;
          final discB = b.originalPrice > b.price ? (b.originalPrice - b.price) / b.originalPrice : b.discount / 100.0;
          return discB.compareTo(discA);
        });
      } else if (_selectedSort == 'price_asc') {
        list.sort((a, b) => a.price.compareTo(b.price));
      } else if (_selectedSort == 'price_desc') {
        list.sort((a, b) => b.price.compareTo(a.price));
      } else if (_selectedSort == 'popular') {
        list.sort((a, b) => b.soldNumeric.compareTo(a.soldNumeric));
      } else if (_selectedSort == 'newest') {
        list = list.reversed.toList();
      }

      if (mounted) {
        setState(() {
          _products = list;
          _isExactMatch = true;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _performSearch(String query) async {
    final cleanQuery = query.trim();
    _focusNode.unfocus();
    setState(() {
      _currentQuery = cleanQuery;
      _isLoading = true;
    });

    if (cleanQuery.isNotEmpty && !_recentSearches.contains(cleanQuery)) {
      _recentSearches.insert(0, cleanQuery);
      if (_recentSearches.length > 8) {
        _recentSearches.removeLast();
      }
      _saveRecentSearches();
    }

    try {
      final result = await _catalogService.searchProducts(
        cleanQuery,
        sort: _selectedSort,
        mall: _filterMall ? true : null,
        freeship: _filterFreeship ? true : null,
        flash: _filterFlashSale ? true : null,
        categoryId: _categoryId ?? _categoryName,
      );

      if (mounted) {
        setState(() {
          _products = result.products;
          _isExactMatch = result.isExactMatch;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _onSortChanged(String sort) {
    if (_selectedSort == sort) return;
    setState(() => _selectedSort = sort);
    if (_currentQuery.isNotEmpty) {
      _performSearch(_currentQuery);
    } else if (_isBrowsingMode) {
      _loadBrowsingProducts();
    }
  }

  void _toggleMall() {
    setState(() => _filterMall = !_filterMall);
    if (_currentQuery.isNotEmpty) {
      _performSearch(_currentQuery);
    } else if (_isBrowsingMode) {
      _loadBrowsingProducts();
    }
  }

  void _toggleFreeship() {
    setState(() => _filterFreeship = !_filterFreeship);
    if (_currentQuery.isNotEmpty) {
      _performSearch(_currentQuery);
    } else if (_isBrowsingMode) {
      _loadBrowsingProducts();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 18),
                    onPressed: () => Navigator.pop(context),
                  ),
                  Expanded(
                    child: Container(
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(left: 10, right: 6),
                            child: Icon(Icons.search_rounded, color: AppColors.primary, size: 20),
                          ),
                          Expanded(
                            child: TextField(
                              controller: _searchController,
                              focusNode: _focusNode,
                              textInputAction: TextInputAction.search,
                              onSubmitted: _performSearch,
                              style: const TextStyle(fontSize: 13.5, color: AppColors.textPrimary),
                              decoration: InputDecoration(
                                hintText: _categoryName != null ? 'Tìm trong $_categoryName...' : 'Tìm kiếm trên ShopNova...',
                                hintStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                              ),
                            ),
                          ),
                          if (_searchController.text.isNotEmpty)
                            GestureDetector(
                              onTap: () {
                                _searchController.clear();
                                setState(() {});
                              },
                              child: const Padding(
                                padding: EdgeInsets.symmetric(horizontal: 8),
                                child: Icon(Icons.cancel_rounded, color: AppColors.textSecondary, size: 16),
                              ),
                            ),
                          InkWell(
                            onTap: () => _performSearch(_searchController.text),
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              margin: const EdgeInsets.all(4),
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [AppColors.primary, AppColors.earth],
                                ),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: const Text(
                                'Tìm',
                                style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  ListenableBuilder(
                    listenable: CartService(),
                    builder: (context, _) {
                      final count = CartService().itemCount;
                      return Stack(
                        clipBehavior: Clip.none,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.shopping_bag_outlined, color: AppColors.textPrimary, size: 22),
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const CartScreen()),
                              );
                            },
                          ),
                          if (count > 0)
                            Positioned(
                              top: 6,
                              right: 6,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                decoration: const BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.all(Radius.circular(10)),
                                ),
                                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                                child: Text(
                                  count > 99 ? '99+' : count.toString(),
                                  style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          if (_pageTitle != null) _buildBrowsingTitleHeader(),
          if (_currentQuery.isNotEmpty || _isBrowsingMode) _buildFilterBar(),
          Expanded(
            child: (_currentQuery.isEmpty && !_isBrowsingMode)
                ? _buildRecentAndSuggestions()
                : _isLoading
                    ? _buildLoadingState()
                    : _buildSearchResults(),
          ),
        ],
      ),
    );
  }

  Widget _buildBrowsingTitleHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: const BoxDecoration(
        color: AppColors.surfaceAlt,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.earth],
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.category_rounded, color: Colors.white, size: 16),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _pageTitle ?? (_categoryName != null ? 'Ngành hàng: $_categoryName' : 'Danh mục sản phẩm'),
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E2022),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  _products.isNotEmpty
                      ? 'Hiển thị ${_products.length} sản phẩm theo danh mục & tiện ích'
                      : (_isLoading ? 'Đang nạp các sản phẩm...' : 'Chưa có sản phẩm phù hợp'),
                  style: const TextStyle(fontSize: 11, color: Color(0xFF8F90A6)),
                ),
              ],
            ),
          ),
          if (_categoryId != null || _categoryName != null) ...[
            const SizedBox(width: 8),
            InkWell(
              onTap: () {
                setState(() {
                  _categoryId = null;
                  _categoryName = null;
                  _pageTitle = null;
                });
                if (_currentQuery.isNotEmpty) {
                  _performSearch(_currentQuery);
                } else {
                  _loadBrowsingProducts();
                }
              },
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.close_rounded, size: 14, color: AppColors.primary),
                    SizedBox(width: 2),
                    Text(
                      'Bỏ lọc',
                      style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    return Container(
      height: 46,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFEEEEF0))),
      ),
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: [
          _buildSortChip('Liên quan', 'relevance'),
          const SizedBox(width: 6),
          _buildSortChip('Giảm sốc', 'discount'),
          const SizedBox(width: 6),
          _buildSortChip('Mới nhất', 'newest'),
          const SizedBox(width: 6),
          _buildSortChip('Bán chạy', 'popular'),
          const SizedBox(width: 6),
          _buildSortChip('Giá thấp', 'price_asc'),
          const SizedBox(width: 6),
          _buildSortChip('Giá cao', 'price_desc'),
          const SizedBox(width: 8),
          VerticalDivider(width: 1, indent: 4, endIndent: 4, color: Colors.grey.shade300),
          const SizedBox(width: 8),
          _buildToggleChip(
            label: 'ShopNova Mall',
            isActive: _filterMall,
            onTap: _toggleMall,
            color: const Color(0xFFD0011B),
          ),
          const SizedBox(width: 6),
          _buildToggleChip(
            label: 'Freeship Xtra',
            isActive: _filterFreeship,
            onTap: _toggleFreeship,
            color: const Color(0xFF00BFA5),
          ),
        ],
      ),
    );
  }

  Widget _buildSortChip(String label, String sortValue) {
    final isSelected = _selectedSort == sortValue;
    return InkWell(
      onTap: () => _onSortChanged(sortValue),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surfaceAlt : const Color(0xFFF8F9FA),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 1.2 : 1.0,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? AppColors.primary : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }

  Widget _buildToggleChip({
    required String label,
    required bool isActive,
    required VoidCallback onTap,
    required Color color,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isActive ? color.withOpacity(0.12) : const Color(0xFFF8F9FA),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isActive ? color : const Color(0xFFEEEEF0),
            width: isActive ? 1.2 : 1.0,
          ),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isActive) ...[
              Icon(Icons.check_rounded, color: color, size: 14),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                color: isActive ? color : const Color(0xFF1E2022),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(color: AppColors.primary),
          SizedBox(height: 16),
          Text(
            'Đang tìm kiếm sản phẩm liên quan...',
            style: TextStyle(color: Color(0xFF8F90A6), fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchResults() {
    if (_products.isEmpty) {
      return _buildEmptyState();
    }

    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () => _currentQuery.isNotEmpty
          ? _performSearch(_currentQuery)
          : _loadBrowsingProducts(),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: _buildResultHeaderBanner(),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 20),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
                childAspectRatio: 0.58,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  return ProductCard(product: _products[index]);
                },
                childCount: _products.length,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultHeaderBanner() {
    if (!_isExactMatch) {
      return Container(
        margin: const EdgeInsets.all(12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF8E1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFFFECB3)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline_rounded, color: Color(0xFF856404), size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(color: Color(0xFF856404), fontSize: 12.5, height: 1.3),
                      children: [
                        const TextSpan(text: 'Không có sản phẩm trùng khớp tuyệt đối cho '),
                        TextSpan(
                          text: '"$_currentQuery"',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const TextSpan(text: '.'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 3),
                  const Text(
                    'Dưới đây là các sản phẩm liên quan và bán chạy nhất gợi ý cho bạn:',
                    style: TextStyle(color: Color(0xFF856404), fontSize: 11.5, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          RichText(
            text: TextSpan(
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF8F90A6)),
              children: [
                const TextSpan(text: 'Tìm thấy '),
                TextSpan(
                  text: '${_products.length}',
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                ),
                TextSpan(
                  text: _currentQuery.isNotEmpty
                      ? ' sản phẩm cho "$_currentQuery"'
                      : ' sản phẩm phù hợp',
                  style: const TextStyle(color: Color(0xFF1E2022), fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          const Row(
            children: [
              Icon(Icons.tune_rounded, size: 14, color: Color(0xFF8F90A6)),
              SizedBox(width: 4),
              Text('Bộ lọc nâng cao', style: TextStyle(fontSize: 11.5, color: Color(0xFF8F90A6))),
            ],
          )
        ],
      ),
    );
  }

  void _selectSuggestedCategory(CategoryItem cat) {
    final slug = CatalogService.resolveCategorySlug(cat.slug ?? cat.id);
    setState(() {
      _categoryId = slug.isNotEmpty ? slug : cat.id;
      _categoryName = cat.name;
      _pageTitle = 'Ngành hàng: ${cat.name}';
      _currentQuery = '';
      _searchController.clear();
    });
    _loadBrowsingProducts();
  }

  void _clearAllFilters() {
    setState(() {
      _categoryId = null;
      _categoryName = null;
      _pageTitle = null;
      _currentQuery = '';
      _searchController.clear();
      _filterMall = false;
      _filterFreeship = false;
      _filterFlashSale = false;
      _selectedSort = 'relevance';
    });
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => const SearchScreen(
          title: 'Toàn bộ sản phẩm ShopNova',
          initialSort: 'popular',
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    final isCategoryEmpty = _categoryId != null || _categoryName != null;
    final catDisplay = _categoryName ?? CatalogService.getCategoryName(_categoryId);
    final availableCategories = _categories.where((c) => c.productCount > 0).take(5).toList();
    final fallbackCats = availableCategories.isNotEmpty
        ? availableCategories
        : _categories.take(5).toList();

    final IconData emptyIcon = isCategoryEmpty
        ? Icons.inventory_2_outlined
        : (_currentQuery.isNotEmpty ? Icons.search_off_rounded : Icons.shopping_bag_outlined);

    final String titleText = isCategoryEmpty
        ? 'Ngành hàng “$catDisplay” hiện đang cập nhật sản phẩm'
        : (_currentQuery.isNotEmpty
            ? 'Không tìm thấy sản phẩm cho từ khoá “$_currentQuery”'
            : 'Không có sản phẩm nào khớp với bộ lọc đã chọn');

    final String descText = isCategoryEmpty
        ? 'Hiện chưa có sản phẩm nào thuộc ngành hàng này được đăng bán. Mời bạn khám phá các ngành hàng đang có sẵn hoặc xem toàn bộ sản phẩm trên sàn.'
        : (_currentQuery.isNotEmpty
            ? 'Hãy thử kiểm tra lại chính tả hoặc tìm kiếm bằng từ khoá ngắn gọn, phổ biến hơn.'
            : 'Hãy thử xoá bớt một số bộ lọc để xem nhiều sản phẩm hơn.');

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 28),
          Container(
            width: 80,
            height: 80,
            decoration: const BoxDecoration(
              color: AppColors.surfaceAlt,
              shape: BoxShape.circle,
            ),
            child: Icon(emptyIcon, size: 38, color: AppColors.primary),
          ),
          const SizedBox(height: 16),
          Text(
            titleText,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            descText,
            style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.45),
            textAlign: TextAlign.center,
          ),
          if (isCategoryEmpty && fallbackCats.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Text(
              'Ngành hàng đang có sẵn sản phẩm:',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: fallbackCats.map((cat) {
                final chipText = cat.productCount > 0 ? '${cat.name} (${cat.productCount})' : cat.name;
                return InkWell(
                  onTap: () => _selectSuggestedCategory(cat),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      chipText,
                      style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                    ),
                  ),
                );
              }).toList(),
            ),
          ] else if (!isCategoryEmpty && _popularTags.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Text('Danh mục gợi ý:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5, color: AppColors.textPrimary)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: _popularTags.map((tag) {
                return InkWell(
                  onTap: () {
                    _searchController.text = tag;
                    _performSearch(tag);
                  },
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      tag,
                      style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, fontWeight: FontWeight.w500),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
          const SizedBox(height: 20),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              if (!isCategoryEmpty && _currentQuery.isNotEmpty)
                ElevatedButton(
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _currentQuery = '');
                    if (_isBrowsingMode) _loadBrowsingProducts();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                  ),
                  child: const Text('Xoá từ khoá tìm kiếm', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                ),
              ElevatedButton(
                onPressed: _clearAllFilters,
                style: ElevatedButton.styleFrom(
                  backgroundColor: (isCategoryEmpty || _currentQuery.isEmpty) ? AppColors.primary : AppColors.surface,
                  foregroundColor: (isCategoryEmpty || _currentQuery.isEmpty) ? Colors.white : AppColors.textPrimary,
                  side: (isCategoryEmpty || _currentQuery.isEmpty) ? null : const BorderSide(color: AppColors.border),
                  elevation: 0,
                ),
                child: Text(
                  (!isCategoryEmpty && _currentQuery.isEmpty) ? 'Xoá tất cả bộ lọc' : 'Xem toàn bộ sản phẩm',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                ),
              ),
              if (isCategoryEmpty)
                OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    side: const BorderSide(color: AppColors.border),
                  ),
                  child: const Text('Về trang chủ', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRecentAndSuggestions() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_recentSearches.isNotEmpty) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.history_rounded, size: 18, color: Color(0xFF8F90A6)),
                    SizedBox(width: 6),
                    Text(
                      'Lịch sử tìm kiếm gần đây',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E2022)),
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: () { setState(() => _recentSearches.clear()); _saveRecentSearches(); },
                  child: const Text('Xóa tất cả', style: TextStyle(fontSize: 11, color: Color(0xFF8F90A6))),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _recentSearches.map((item) {
                return InkWell(
                  onTap: () {
                    _searchController.text = item;
                    _performSearch(item);
                  },
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFEEEEF0)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(item, style: const TextStyle(fontSize: 12, color: Color(0xFF1E2022))),
                        const SizedBox(width: 4),
                        GestureDetector(
                          onTap: () { setState(() => _recentSearches.remove(item)); _saveRecentSearches(); },
                          child: const Icon(Icons.close_rounded, size: 14, color: Color(0xFF8F90A6)),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
          ],
          if (_popularTags.isNotEmpty) ...[
            const Row(
              children: [
                Icon(Icons.category_outlined, color: AppColors.primary, size: 18),
                SizedBox(width: 6),
                Text(
                  'Danh mục sản phẩm trên sàn',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E2022)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _popularTags.map((tag) {
                return InkWell(
                  onTap: () {
                    _searchController.text = tag;
                    _performSearch(tag);
                  },
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFEEEEF0)),
                      boxShadow: const [
                        BoxShadow(color: Color(0x04000000), blurRadius: 4, offset: Offset(0, 1)),
                      ],
                    ),
                    child: Text(
                      tag,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF1E2022), fontWeight: FontWeight.w500),
                    ),
                  ),
                );
              }).toList(),
            ),
          ] else if (_recentSearches.isEmpty) ...[
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Text(
                  'Nhập tên sản phẩm bạn cần tìm ở thanh tìm kiếm phía trên.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF8F90A6)),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
