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
      // 1. Lấy chi tiết gian hàng từ Backend
      final shopData = await _shopService.getShopDetail(widget.shopId);

      // 2. Lấy danh sách sản phẩm thực tế của gian hàng từ Backend
      final prodResult = await _shopService.getShopProducts(widget.shopId);

      // 3. Kiểm tra trạng thái theo dõi nếu đã đăng nhập
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
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: Container(
          height: 36,
          margin: const EdgeInsets.only(right: 8),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(6),
          ),
          child: TextField(
            controller: _searchController,
            onChanged: (val) => setState(() => _searchQuery = val),
            style: const TextStyle(fontSize: 13),
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Tìm kiếm trong gian hàng...',
              hintStyle: const TextStyle(fontSize: 12, color: Colors.grey, overflow: TextOverflow.ellipsis),
              prefixIcon: const Icon(Icons.search, size: 18, color: Colors.grey),
              prefixIconConstraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 16, color: Colors.grey),
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
              return Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.shopping_cart_outlined, color: Colors.black87),
                    onPressed: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const CartScreen()));
                    },
                  ),
                  if (count > 0)
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: primaryColor,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                        child: Text(
                          '$count',
                          style: const TextStyle(color: Colors.white, fontSize: 10),
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
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Banner background gradient
          Container(
            height: 90,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isMall
                    ? [const Color(0xFF003366), const Color(0xFF001A33)]
                    : [const Color(0xFFEE4D2D), const Color(0xFFFF7337)],
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
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 6),
                          ],
                        ),
                        child: ClipOval(
                          child: _shop?.logoUrl != null && _shop!.logoUrl!.isNotEmpty
                              ? Image.network(
                                  _shop!.logoUrl!,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Icon(Icons.store, color: primaryColor, size: 36),
                                )
                              : Icon(Icons.storefront, color: primaryColor, size: 36),
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
                                    color: const Color(0xFF003366),
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                  child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                                ),
                                const SizedBox(width: 6),
                              ],
                              Expanded(
                                child: Text(
                                  displayName,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _shop?.tagline?.isNotEmpty == true ? _shop!.tagline! : 'Chính hãng • Giao hàng toàn quốc',
                            style: const TextStyle(fontSize: 11, color: Colors.grey),
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
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        minimumSize: const Size(0, 32),
                        side: BorderSide(color: _isFollowing ? Colors.green : primaryColor),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(_isFollowing ? Icons.check : Icons.add, size: 14, color: _isFollowing ? Colors.green : primaryColor),
                          const SizedBox(width: 4),
                          Text(
                            _isFollowing ? 'Đã theo dõi' : 'Theo dõi',
                            style: TextStyle(
                              color: _isFollowing ? Colors.green : primaryColor,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const Divider(height: 16),
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
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }

  Widget _buildSortBar() {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.white,
      child: Row(
        children: [
          const Text('Sắp xếp:', style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold)),
          const SizedBox(width: 12),
          _buildSortChip('Phổ biến', 'popular'),
          const SizedBox(width: 8),
          _buildSortChip('Mới nhất', 'newest'),
          const SizedBox(width: 8),
          _buildSortChip('Giá ↑', 'price_asc'),
          const SizedBox(width: 8),
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? primaryColor : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.black87,
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
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
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.inventory_2_outlined, size: 56, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            const Text(
              'Gian hàng chưa có sản phẩm nào',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            const SizedBox(height: 4),
            Text(
              _searchQuery.isNotEmpty
                  ? 'Không có sản phẩm nào khớp với từ khóa "$_searchQuery".'
                  : 'Người bán đang cập nhật danh mục sản phẩm.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.grey, fontSize: 12),
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
          childAspectRatio: 0.70,
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
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 1)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            Expanded(
              flex: 5,
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
                child: Container(
                  width: double.infinity,
                  color: Colors.grey.shade100,
                  child: p.imageUrl.startsWith('http')
                      ? Image.network(
                          p.imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Center(
                            child: Text(p.emoji.isNotEmpty ? p.emoji : '🛍️', style: const TextStyle(fontSize: 40)),
                          ),
                        )
                      : Center(
                          child: Text(p.emoji.isNotEmpty ? p.emoji : '🛍️', style: const TextStyle(fontSize: 40)),
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
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, height: 1.2),
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
                              style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            if (p.discount > 0) ...[
                              const SizedBox(width: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(2)),
                                child: Text('-${p.discount}%', style: TextStyle(color: primaryColor, fontSize: 9, fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('⭐ ${p.rating.toStringAsFixed(1)}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                            Text('Đã bán ${p.soldCount}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
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
