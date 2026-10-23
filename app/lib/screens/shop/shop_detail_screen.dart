import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/product.dart';
import '../../models/shop.dart';
import '../../services/auth_service.dart';
import '../../services/cart_service.dart';
import '../../services/shop_service.dart';
import '../cart/cart_screen.dart';
import '../product_detail/product_detail_screen.dart';

/// Màn hình Chi Tiết Gian Hàng (Kết nối trực tiếp Backend API)
class ShopDetailScreen extends StatefulWidget {
  final String shopId;
  final String? initialShopName;

  const ShopDetailScreen({
    super.key,
    required this.shopId,
    this.initialShopName,
  });

  @override
  State<ShopDetailScreen> createState() => _ShopDetailScreenState();
}

class _ShopDetailScreenState extends State<ShopDetailScreen> {
  final Color primaryColor = const Color(0xFFEE4D2D);
  final ShopService _shopService = ShopService();

  Shop? _shop;
  List<Product> _products = [];
  bool _isLoading = true;
  bool _isFollowing = false;
  String _selectedSort = 'popular'; // 'popular', 'newest', 'price_asc', 'price_desc'
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadShopData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadShopData() async {
    setState(() => _isLoading = true);

    try {
      final shopData = await _shopService.getShopDetail(widget.shopId);
      final prodResult = await _shopService.getShopProducts(widget.shopId);

      bool isFol = false;
      if (AuthService().isAuthenticated) {
        try {
          isFol = await _shopService.getFollowStatus(widget.shopId);
        } catch (_) {}
      }

      if (mounted) {
        setState(() {
          _shop = shopData;
          _products = prodResult.products;
          _isFollowing = isFol;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleFollow() async {
    if (!AuthService().isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng đăng nhập để theo dõi gian hàng.')),
      );
      return;
    }

    final nextStatus = !_isFollowing;
    setState(() => _isFollowing = nextStatus);

    final ok = await _shopService.toggleFollow(widget.shopId, !nextStatus);
    if (mounted) {
      setState(() => _isFollowing = ok);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ok ? 'Đã theo dõi gian hàng thành công!' : 'Đã hủy theo dõi gian hàng'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  List<Product> _getFilteredProducts() {
    List<Product> list = List.from(_products);

    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      list = list.where((p) => p.name.toLowerCase().contains(q)).toList();
    }

    if (_selectedSort == 'price_asc') {
      list.sort((a, b) => a.price.compareTo(b.price));
    } else if (_selectedSort == 'price_desc') {
      list.sort((a, b) => b.price.compareTo(a.price));
    } else if (_selectedSort == 'newest') {
      list = list.reversed.toList();
    }

    return list;
  }

  @override
  Widget build(BuildContext context) {
    final displayName = _shop?.name ?? widget.initialShopName ?? 'Gian Hàng ShopNova';
    final filtered = _getFilteredProducts();

    return Scaffold(
      backgroundColor: const Color(0xFFF6F7F9),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFEEEEF0), height: 1),
        ),
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E2022), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Container(
          height: 38,
          margin: const EdgeInsets.only(right: 8),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F7),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E2E6)),
          ),
          child: TextField(
            controller: _searchController,
            onChanged: (val) => setState(() => _searchQuery = val),
            style: const TextStyle(fontSize: 13, color: Color(0xFF1E2022)),
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Tìm kiếm trong gian hàng...',
              hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF8F90A6), overflow: TextOverflow.ellipsis),
              prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF8F90A6)),
              prefixIconConstraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, size: 16, color: Color(0xFF8F90A6)),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _searchQuery = '');
                      },
                    )
                  : null,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
            ),
          ),
        ),
        actions: [
          AnimatedBuilder(
            animation: CartService(),
            builder: (context, _) {
              final count = CartService().itemCount;
              return Container(
                margin: const EdgeInsets.only(right: 6),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.shopping_cart_outlined, color: Color(0xFF1E2022), size: 22),
                      onPressed: () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const CartScreen()));
                      },
                    ),
                    if (count > 0)
                      Positioned(
                        right: 6,
                        top: 6,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: const BoxDecoration(
                            color: Color(0xFFEE4D2D),
                            shape: BoxShape.circle,
                          ),
                          constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                          child: Text(
                            '$count',
                            style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator(color: primaryColor))
          : RefreshIndicator(
              onRefresh: _loadShopData,
              color: primaryColor,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  children: [
                    _buildShopHeaderCard(displayName),
                    _buildSortBar(),
                    if (filtered.isEmpty)
                      _buildEmptyProducts()
                    else
                      _buildProductGrid(filtered),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildShopHeaderCard(String displayName) {
    final isMall = _shop?.isMall == true;
    final rating = _shop?.rating ?? 4.9;
    final followers = _shop?.followersCount ?? 0;
    final totalProd = _products.length;
    final province = _shop?.province.isNotEmpty == true ? _shop!.province : 'Toàn quốc';

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Banner background gradient
          Container(
            height: 96,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isMall
                    ? [const Color(0xFFD0011B), const Color(0xFF8B0000)]
                    : [const Color(0xFFEE4D2D), const Color(0xFFFF5224)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    // Shop Avatar
                    Transform.translate(
                      offset: const Offset(0, -28),
                      child: Container(
                        width: 74,
                        height: 74,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                          boxShadow: const [
                            BoxShadow(color: Color(0x18000000), blurRadius: 8, offset: Offset(0, 3)),
                          ],
                        ),
                        child: ClipOval(
                          child: _shop?.logoUrl != null && _shop!.logoUrl!.isNotEmpty
                              ? Image.network(
                                  _shop!.logoUrl!,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Icon(Icons.storefront_rounded, color: primaryColor, size: 36),
                                )
                              : Icon(Icons.storefront_rounded, color: primaryColor, size: 36),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              if (isMall) ...[
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFD0011B),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                                ),
                                const SizedBox(width: 6),
                              ],
                              Expanded(
                                child: Text(
                                  displayName,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Color(0xFF1E2022)),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            _shop?.tagline?.isNotEmpty == true ? _shop!.tagline! : 'Chính hãng • Giao hàng toàn quốc',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF8F90A6)),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Nút Theo Dõi
                    OutlinedButton(
                      onPressed: _toggleFollow,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        minimumSize: const Size(0, 32),
                        side: BorderSide(color: _isFollowing ? const Color(0xFF00BFA5) : primaryColor),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(_isFollowing ? Icons.check_rounded : Icons.add_rounded, size: 14, color: _isFollowing ? const Color(0xFF00BFA5) : primaryColor),
                          const SizedBox(width: 4),
                          Text(
                            _isFollowing ? 'Đã theo dõi' : 'Theo dõi',
                            style: TextStyle(
                              color: _isFollowing ? const Color(0xFF00BFA5) : primaryColor,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: Divider(height: 1, color: Color(0xFFEEEEF0)),
                ),
                // Shop Stats Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatItem('Sản phẩm', '$totalProd'),
                    _buildStatItem('Đánh giá', '${rating.toStringAsFixed(1)} ⭐'),
                    _buildStatItem('Người theo dõi', followers > 0 ? '$followers' : 'Chưa có'),
                    _buildStatItem('Khu vực', province),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF1E2022))),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF8F90A6))),
      ],
    );
  }

  Widget _buildSortBar() {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border.symmetric(horizontal: BorderSide(color: Color(0xFFEEEEF0))),
      ),
      child: Row(
        children: [
          const Text('Sắp xếp:', style: TextStyle(fontSize: 12, color: Color(0xFF555770), fontWeight: FontWeight.bold)),
          const SizedBox(width: 10),
          _buildSortChip('Phổ biến', 'popular'),
          const SizedBox(width: 6),
          _buildSortChip('Mới nhất', 'newest'),
          const SizedBox(width: 6),
          _buildSortChip('Giá ↑', 'price_asc'),
          const SizedBox(width: 6),
          _buildSortChip('Giá ↓', 'price_desc'),
        ],
      ),
    );
  }

  Widget _buildSortChip(String label, String value) {
    final isSelected = _selectedSort == value;
    return GestureDetector(
      onTap: () => setState(() => _selectedSort = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? primaryColor : const Color(0xFFF5F5F7),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : const Color(0xFF555770),
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyProducts() {
    return Container(
      margin: const EdgeInsets.all(24),
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEEEEF0)),
      ),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.inventory_2_outlined, size: 54, color: Color(0xFF8F90A6)),
            const SizedBox(height: 12),
            const Text(
              'Gian hàng chưa có sản phẩm nào',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E2022)),
            ),
            const SizedBox(height: 4),
            Text(
              _searchQuery.isNotEmpty
                  ? 'Không có sản phẩm nào khớp với từ khóa "$_searchQuery".'
                  : 'Người bán đang cập nhật danh mục sản phẩm.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductGrid(List<Product> products) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: products.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 0.65,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
        ),
        itemBuilder: (context, index) {
          final p = products[index];
          return _buildProductCard(p);
        },
      ),
    );
  }

  Widget _buildProductCard(Product p) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ProductDetailScreen(productId: p.id, initialProduct: p),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFEEEEF0)),
          boxShadow: const [
            BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            Expanded(
              flex: 5,
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
                child: Container(
                  width: double.infinity,
                  color: const Color(0xFFF7F7F8),
                  child: Image.network(
                    p.effectiveImageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Center(
                      child: Text(p.emoji.isNotEmpty ? p.emoji : '🛍️', style: const TextStyle(fontSize: 36)),
                    ),
                  ),
                ),
              ),
            ),
            // Info
            Expanded(
              flex: 4,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      p.name,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, height: 1.25, color: Color(0xFF1E2022)),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0).format(p.price),
                              style: TextStyle(color: primaryColor, fontWeight: FontWeight.w800, fontSize: 13),
                            ),
                            if (p.discount > 0) ...[
                              const SizedBox(width: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                decoration: BoxDecoration(color: const Color(0xFFFFF0EC), borderRadius: BorderRadius.circular(3)),
                                child: Text('-${p.discount}%', style: TextStyle(color: primaryColor, fontSize: 9, fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('⭐ ${p.rating.toStringAsFixed(1)}', style: const TextStyle(fontSize: 10, color: Color(0xFF8F90A6))),
                            Text('Đã bán ${p.soldCount}', style: const TextStyle(fontSize: 10, color: Color(0xFF8F90A6))),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
