import 'package:flutter/material.dart';
import '../../models/product.dart';
import '../../services/cart_service.dart';
import '../../services/catalog_service.dart';
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
  });

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  final CatalogService _catalogService = CatalogService();

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

  final List<String> _recentSearches = [
    'Tai nghe bluetooth',
    'Áo thun cotton',
    'Sạc nhanh 65W',
    'Robot hút bụi',
    'Nồi chiên không dầu',
    'Giày sneaker',
  ];

  final List<String> _popularTags = [
    '⚡ Flash Sale',
    '📱 Tai nghe ANC',
    '👕 Áo sơ mi nam',
    '👟 Giày thể thao',
    '🔋 Pin sạc 20000mAh',
    '🍳 Nồi chiên hơi nước',
    '💻 Chuột không dây',
    '💄 Son dưỡng Cocoon',
  ];

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
    _categoryId = widget.categoryId;
    _categoryName = widget.initialCategory;
    _pageTitle = widget.title;

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
      List<Product> list = [];

      if (_filterFlashSale) {
        // Nạp các sản phẩm Flash Sale
        final flashItems = await _catalogService.getFlashSaleItems();
        if (flashItems.isNotEmpty) {
          list = flashItems.map<Product>((f) {
            final origPrice = f.discount > 0 ? (f.price / (1 - f.discount / 100)) : (f.price * 1.35);
            return Product(
              id: f.id,
              name: f.name,
              price: f.price,
              originalPrice: origPrice,
              discount: f.discount,
              imageUrl: f.imageUrl,
              categoryName: 'Flash Sale',
              shopName: 'ShopNova Mall',
              rating: 4.9,
              soldCount: '990',
              badges: const ['FLASH SALE', 'MALL'],
              description: 'Sản phẩm Flash Sale với mức giảm giá chớp nhoáng siêu hấp dẫn.',
            );
          }).toList();
        }
      }

      if (list.isEmpty) {
        final result = await _catalogService.searchProducts(
          _currentQuery,
          categoryId: _categoryId ?? _categoryName,
          mall: _filterMall ? true : null,
          freeship: _filterFreeship ? true : null,
          sort: _selectedSort,
        );
        list = result.products;
      }

      // Áp dụng bộ lọc sắp xếp
      if (_selectedSort == 'discount') {
        list.sort((a, b) {
          final discA = a.originalPrice > a.price ? (a.originalPrice - a.price) / a.originalPrice : 0;
          final discB = b.originalPrice > b.price ? (b.originalPrice - b.price) / b.originalPrice : 0;
          return discB.compareTo(discA);
        });
      } else if (_selectedSort == 'price_asc') {
        list.sort((a, b) => a.price.compareTo(b.price));
      } else if (_selectedSort == 'price_desc') {
        list.sort((a, b) => b.price.compareTo(a.price));
      } else if (_selectedSort == 'popular') {
        list.sort((a, b) => b.soldCount.compareTo(a.soldCount));
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
    }

    try {
      final result = await _catalogService.searchProducts(
        cleanQuery,
        sort: _selectedSort,
        mall: _filterMall ? true : null,
        freeship: _filterFreeship ? true : null,
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
      backgroundColor: const Color(0xFFF6F6F9),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFEEEEF0))),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E2022), size: 18),
                    onPressed: () => Navigator.pop(context),
                  ),
                  Expanded(
                    child: Container(
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F3F5),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFEEEEF0)),
                      ),
                      child: Row(
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(left: 10, right: 6),
                            child: Icon(Icons.search_rounded, color: Color(0xFFEE4D2D), size: 20),
                          ),
                          Expanded(
                            child: TextField(
                              controller: _searchController,
                              focusNode: _focusNode,
                              textInputAction: TextInputAction.search,
                              onSubmitted: _performSearch,
                              style: const TextStyle(fontSize: 13.5, color: Color(0xFF1E2022)),
                              decoration: const InputDecoration(
                                hintText: 'Tìm kiếm trên ShopNova...',
                                hintStyle: TextStyle(color: Color(0xFF8F90A6), fontSize: 13),
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: EdgeInsets.symmetric(vertical: 10),
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
                                child: Icon(Icons.cancel_rounded, color: Color(0xFF8F90A6), size: 16),
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
                                  colors: [Color(0xFFEE4D2D), Color(0xFFFF5224)],
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
                            icon: const Icon(Icons.shopping_bag_outlined, color: Color(0xFF1E2022), size: 22),
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
                                  color: Color(0xFFEE4D2D),
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
        color: Color(0xFFFFF7F5),
        border: Border(bottom: BorderSide(color: Color(0xFFFFDDD4))),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFEE4D2D), Color(0xFFFF5224)],
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
          color: isSelected ? const Color(0xFFFFF0EC) : const Color(0xFFF8F9FA),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFFEE4D2D) : const Color(0xFFEEEEF0),
            width: isSelected ? 1.2 : 1.0,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? const Color(0xFFEE4D2D) : const Color(0xFF1E2022),
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
          CircularProgressIndicator(color: Color(0xFFEE4D2D)),
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
      color: const Color(0xFFEE4D2D),
      onRefresh: () => _performSearch(_currentQuery),
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
                childAspectRatio: 0.64,
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
                  style: const TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.bold),
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

  Widget _buildEmptyState() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 40),
          Container(
            width: 80,
            height: 80,
            decoration: const BoxDecoration(
              color: Color(0xFFFFF0EC),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.search_off_rounded, size: 40, color: Color(0xFFEE4D2D)),
          ),
          const SizedBox(height: 16),
          Text(
            'Không tìm thấy sản phẩm nào cho "$_currentQuery"',
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          const Text(
            'Hãy thử kiểm tra lại chính tả hoặc tìm kiếm bằng từ khóa ngắn gọn hơn như "tai nghe", "áo", "giày"...',
            style: TextStyle(fontSize: 12, color: Color(0xFF8F90A6), height: 1.4),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          const Text('Từ khóa gợi ý phổ biến:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E2022))),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: _popularTags.map((tag) {
              final clean = tag.replaceAll(RegExp(r'^[^\w\s]+'), '').trim();
              return InkWell(
                onTap: () {
                  _searchController.text = clean;
                  _performSearch(clean);
                },
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFEEEEF0)),
                  ),
                  child: Text(
                    tag,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF1E2022), fontWeight: FontWeight.w500),
                  ),
                ),
              );
            }).toList(),
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
                  onTap: () => setState(() => _recentSearches.clear()),
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
                          onTap: () => setState(() => _recentSearches.remove(item)),
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
          const Row(
            children: [
              Icon(Icons.local_fire_department_rounded, color: Color(0xFFEE4D2D), size: 18),
              SizedBox(width: 6),
              Text(
                'Từ khóa xu hướng & hot nhất hôm nay',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E2022)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _popularTags.map((tag) {
              final clean = tag.replaceAll(RegExp(r'^[^\w\s]+'), '').trim();
              return InkWell(
                onTap: () {
                  _searchController.text = clean;
                  _performSearch(clean);
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
        ],
      ),
    );
  }
}
