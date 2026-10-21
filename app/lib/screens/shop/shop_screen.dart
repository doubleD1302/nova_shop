import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/product.dart';
import '../../services/auth_service.dart';
import '../../services/catalog_service.dart';
import '../../services/shop_service.dart';
import '../../services/cart_service.dart';
import '../cart/cart_screen.dart';
import '../product_detail/product_detail_screen.dart';
import 'shop_detail_screen.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  final Color primaryColor = const Color(0xFFEE4D2D);
  final CatalogService _catalogService = CatalogService();
  final ShopService _shopService = ShopService();

  int _selectedTabIndex = 0; // 0: Tất cả, 1: Nova Mall, 2: Yêu Thích, 3: Giao Hỏa Tốc
  String _activeFilterChip = ''; // 'Nova Mall', 'Yêu Thích+', 'Giao 2H', 'Đánh giá 4*+'
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  final Set<String> _followingShopIds = {};
  final Set<String> _savedVouchers = {};

  List<Map<String, dynamic>> _shops = [];
  Map<String, List<Product>> _shopProductsMap = {};
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadShops();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadShops() async {
    setState(() => _isLoading = true);
    try {
      // 1. Gọi trực tiếp API Backend /api/v1/shops để lấy danh sách gian hàng thực tế
      final shopListRes = await _shopService.getShops();
      List<Map<String, dynamic>> shops = [];
      if (shopListRes.shops.isNotEmpty) {
        shops = shopListRes.shops.map((s) => {
          'id': s.id,
          'name': s.name,
          'slug': s.slug,
          'logoUrl': s.logoUrl,
          'bannerUrl': s.bannerUrl,
          'tagline': s.tagline,
          'description': s.description,
          'province': s.province,
          'location': s.province,
          'isMall': s.isMall,
          'rating': s.rating,
          'ratingCount': s.ratingCount,
          'followersCount': s.followersCount,
          'productsCount': s.productsCount,
        }).toList();
      } else {
        shops = await _catalogService.getShops();
      }

      // 2. Nạp sản phẩm thực tế từ Backend API cho từng gian hàng
      final Map<String, List<Product>> pMap = {};
      final allProducts = await _catalogService.getProducts();
      for (final p in allProducts) {
        final sid = p.shopId.isNotEmpty ? p.shopId : '1';
        pMap.putIfAbsent(sid, () => []).add(p);
      }

      // Nạp riêng theo endpoint /api/v1/shops/:id/products cho các shop trong danh sách
      for (final s in shops.take(5)) {
        final sId = s['id']?.toString() ?? '';
        if (sId.isNotEmpty && (!pMap.containsKey(sId) || pMap[sId]!.isEmpty)) {
          try {
            final res = await _shopService.getShopProducts(sId, limit: 4);
            if (res.products.isNotEmpty) {
              pMap[sId] = res.products;
            }
          } catch (_) {}
        }
      }

      // 3. Kiểm tra trạng thái theo dõi thật từ Backend nếu đã đăng nhập
      if (AuthService().isAuthenticated) {
        for (final s in shops) {
          final sId = s['id']?.toString();
          if (sId != null) {
            try {
              final isFol = await _shopService.getFollowStatus(sId);
              if (isFol) _followingShopIds.add(sId);
            } catch (_) {}
          }
        }
      }

      if (mounted) {
        setState(() {
          _shops = shops;
          _shopProductsMap = pMap;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _toggleFollowShop(String shopId, String shopName, bool isCurrentlyFollowing) async {
    if (!AuthService().isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng đăng nhập để theo dõi gian hàng.')),
      );
      return;
    }

    final nextStatus = !isCurrentlyFollowing;
    setState(() {
      if (nextStatus) {
        _followingShopIds.add(shopId);
      } else {
        _followingShopIds.remove(shopId);
      }
    });

    final ok = await _shopService.toggleFollow(shopId, !nextStatus);
    if (mounted) {
      setState(() {
        if (ok) {
          _followingShopIds.add(shopId);
        } else {
          _followingShopIds.remove(shopId);
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ok ? 'Đã theo dõi $shopName!' : 'Đã hủy theo dõi $shopName'),
          duration: const Duration(seconds: 1),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  List<Map<String, dynamic>> _getFilteredShops() {
    List<Map<String, dynamic>> list = List.from(_shops);

    // Filter theo tab
    if (_selectedTabIndex == 1) {
      list = list.where((s) => s['isMall'] == true || s['is_mall'] == true).toList();
    } else if (_selectedTabIndex == 2) {
      list = list.where((s) => _followingShopIds.contains(s['id']?.toString())).toList();
    }

    // Filter theo chip
    if (_activeFilterChip == 'Nova Mall') {
      list = list.where((s) => s['isMall'] == true || s['is_mall'] == true).toList();
    } else if (_activeFilterChip == 'Yêu Thích+') {
      list = list.where((s) => _followingShopIds.contains(s['id']?.toString())).toList();
    }

    // Filter theo từ khóa tìm kiếm
    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      list = list.where((s) {
        final name = (s['name'] ?? '').toString().toLowerCase();
        final desc = (s['description'] ?? '').toString().toLowerCase();
        return name.contains(q) || desc.contains(q);
      }).toList();
    }

    return list;
  }

  @override
  Widget build(BuildContext context) {
    final filteredShops = _getFilteredShops();

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        titleSpacing: 0,
        leadingWidth: 110,
        leading: const Padding(
          padding: EdgeInsets.only(left: 12),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shopping_bag, color: Color(0xFFEE4D2D), size: 20),
              SizedBox(width: 4),
              Text(
                'ShopNova',
                style: TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.bold, fontSize: 15),
              ),
            ],
          ),
        ),
        title: Container(
          height: 36,
          margin: const EdgeInsets.only(right: 4),
          decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(6)),
          child: TextField(
            controller: _searchController,
            onChanged: (val) => setState(() => _searchQuery = val),
            style: const TextStyle(fontSize: 13),
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Tìm kiếm gian hàng, thương hiệu...',
              hintStyle: const TextStyle(fontSize: 12, color: Colors.grey, overflow: TextOverflow.ellipsis),
              prefixIcon: const Icon(Icons.storefront, size: 18, color: Colors.grey),
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
              return Container(
                width: 40,
                height: 40,
                margin: const EdgeInsets.only(right: 6),
                child: Stack(
                  alignment: Alignment.center,
                  clipBehavior: Clip.none,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.shopping_cart_outlined, color: Colors.black87, size: 22),
                      onPressed: () {
                        Navigator.push(context, MaterialPageRoute(builder: (ctx) => const CartScreen()));
                      },
                    ),
                    if (count > 0)
                      Positioned(
                        top: 2,
                        right: 2,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                          decoration: const BoxDecoration(color: Color(0xFFEE4D2D), shape: BoxShape.circle),
                          constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                          child: Center(
                            child: Text(
                              count > 99 ? '99+' : '$count',
                              style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(88),
          child: Column(
            children: [
              // Filter Chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    _buildFilterChip('Nova Mall', Icons.stars, Colors.red),
                    _buildFilterChip('Yêu Thích+', Icons.favorite_border, Colors.orange),
                    _buildFilterChip('Giao 2H', Icons.bolt, Colors.green),
                    _buildFilterChip('Đánh giá 4*+', Icons.star_border, Colors.amber),
                  ],
                ),
              ),
              // Category Tabs
              Container(
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.grey[200]!))),
                child: Row(
                  children: [
                    _buildTab(0, 'Tất cả Shop'),
                    _buildTab(1, 'Nova Mall'),
                    _buildTab(2, 'Shop Yêu Thích'),
                    _buildTab(3, 'Giao Hỏa Tốc'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadShops,
        color: primaryColor,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            children: [
              _buildMainBanner(),
              _buildAiBanner(),
              if (_isLoading)
                Container(
                  height: 160,
                  alignment: Alignment.center,
                  child: CircularProgressIndicator(color: primaryColor),
                )
              else if (filteredShops.isEmpty)
                Container(
                  margin: const EdgeInsets.all(24),
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                  child: Column(
                    children: [
                      Icon(Icons.store_outlined, size: 56, color: Colors.grey[400]),
                      const SizedBox(height: 12),
                      const Text(
                        'Không tìm thấy gian hàng phù hợp',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Hãy thử đổi từ khóa tìm kiếm hoặc chọn bộ lọc "Tất cả Shop".',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () {
                          setState(() {
                            _selectedTabIndex = 0;
                            _activeFilterChip = '';
                            _searchQuery = '';
                            _searchController.clear();
                          });
                        },
                        style: ElevatedButton.styleFrom(backgroundColor: primaryColor),
                        child: const Text('Xem tất cả Shop', style: TextStyle(color: Colors.white)),
                      ),
                    ],
                  ),
                )
              else
                ..._buildShopsList(filteredShops),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, IconData icon, Color iconColor) {
    final isActive = _activeFilterChip == label;
    return GestureDetector(
      onTap: () {
        setState(() {
          _activeFilterChip = isActive ? '' : label;
        });
      },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? primaryColor.withOpacity(0.08) : Colors.white,
          border: Border.all(color: isActive ? primaryColor : Colors.grey[300]!, width: isActive ? 1.5 : 1),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          children: [
            Icon(icon, size: 14, color: isActive ? primaryColor : iconColor),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                color: isActive ? primaryColor : Colors.black87,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTab(int index, String title) {
    final isActive = _selectedTabIndex == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedTabIndex = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: isActive ? primaryColor : Colors.transparent, width: 2.5)),
          ),
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isActive ? primaryColor : Colors.grey[600],
              fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMainBanner() {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [Colors.red[800]!, Colors.orange[700]!]),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.orange.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: Colors.black.withOpacity(0.3), borderRadius: BorderRadius.circular(4)),
                child: const Text('SIÊU ĐẠI HỘI THƯƠNG HIỆU', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              const Icon(Icons.stars, color: Colors.amber, size: 20),
            ],
          ),
          const SizedBox(height: 8),
          const Text('Tuần Lễ Thương Hiệu & Siêu Sale Gian Hàng', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Voucher đến 100k, đại tiệc giảm giá tới 50% + Freeship toàn quốc.', style: TextStyle(color: Colors.white70, fontSize: 12)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: Colors.amber, borderRadius: BorderRadius.circular(4)),
                child: const Text('MÃ: MALLWEEK80', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 12)),
              ),
              ElevatedButton(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Đã thu thập mã MALLWEEK80 giảm 50% vào kho voucher của bạn!'),
                      backgroundColor: Colors.green,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: primaryColor,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                child: const Text('Lấy Mã Ngay', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAiBanner() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.red.shade100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(color: primaryColor, shape: BoxShape.circle),
                child: const Icon(Icons.auto_awesome, color: Colors.white, size: 14),
              ),
              const SizedBox(width: 8),
              const Text('Nova AI • Gợi Ý Gian Hàng Cho Bạn', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(3)),
                child: const Text('ĐỀ XUẤT', style: TextStyle(color: Colors.red, fontSize: 9, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Dựa vào sản phẩm bạn vừa xem, Nova AI đề xuất các gian hàng chính hãng giao hỏa tốc 2H uy tín nhất.',
            style: TextStyle(color: Colors.grey, fontSize: 11, height: 1.3),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildShopsList(List<Map<String, dynamic>> shops) {
    return shops.map((shop) {
      final id = (shop['id'] ?? '1').toString();
      final name = shop['name'] ?? 'Gian hàng Nova';
      final isMall = shop['isMall'] == true || shop['is_mall'] == true;
      final rating = shop['rating']?.toString() ?? '4.9';
      final location = shop['location'] ?? 'TP. Hồ Chí Minh';
      final isFollowing = _followingShopIds.contains(id);
      final isVoucherSaved = _savedVouchers.contains(id);
      final shopProducts = _shopProductsMap[id] ?? [];

      return Container(
        margin: const EdgeInsets.only(top: 8),
        color: Colors.white,
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Shop Header
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    width: 48,
                    height: 48,
                    color: Colors.grey.shade100,
                    child: shop['logoUrl'] != null && shop['logoUrl'].toString().isNotEmpty
                        ? Image.network(shop['logoUrl'], fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.store, color: Colors.grey))
                        : Icon(Icons.storefront, color: primaryColor, size: 28),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (isMall) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              decoration: BoxDecoration(color: const Color(0xFF003366), borderRadius: BorderRadius.circular(3)),
                              child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                            ),
                            const SizedBox(width: 6),
                          ],
                          Expanded(
                            child: Text(
                              name,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          const Icon(Icons.star, color: Colors.amber, size: 13),
                          Text(' $rating • $location', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    ],
                  ),
                ),
                // Nút Follow thật kết nối Backend API
                OutlinedButton(
                  onPressed: () => _toggleFollowShop(id, name, isFollowing),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    minimumSize: const Size(0, 32),
                    side: BorderSide(color: isFollowing ? Colors.green : primaryColor),
                  ),
                  child: Row(
                    children: [
                      Icon(isFollowing ? Icons.check : Icons.add, size: 13, color: isFollowing ? Colors.green : primaryColor),
                      const SizedBox(width: 3),
                      Text(
                        isFollowing ? 'Đã theo dõi' : 'Theo dõi',
                        style: TextStyle(color: isFollowing ? Colors.green : primaryColor, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                // Nút Vào Shop mở ShopDetailScreen
                ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ShopDetailScreen(shopId: id, initialShopName: name),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    minimumSize: const Size(0, 32),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  ),
                  child: const Text('Vào Shop', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Voucher Shop
            InkWell(
              onTap: () {
                setState(() {
                  if (isVoucherSaved) {
                    _savedVouchers.remove(id);
                  } else {
                    _savedVouchers.add(id);
                  }
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(isVoucherSaved ? 'Đã bỏ lưu voucher' : 'Đã lưu voucher giảm 50k của $name!'),
                    backgroundColor: isVoucherSaved ? Colors.grey : Colors.green,
                    duration: const Duration(seconds: 1),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(4)),
                child: Row(
                  children: [
                    const Icon(Icons.local_activity, color: Colors.red, size: 14),
                    const SizedBox(width: 6),
                    const Expanded(
                      child: Text(
                        'Voucher: Giảm 50.000đ cho đơn hàng từ 300k',
                        style: TextStyle(color: Colors.red, fontSize: 11),
                      ),
                    ),
                    Text(
                      isVoucherSaved ? 'Đã lưu' : 'Lưu mã',
                      style: TextStyle(
                        color: isVoucherSaved ? Colors.green : Colors.red,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            // Sản phẩm thực tế của Shop (Đã loại bỏ dữ liệu tĩnh)
            if (shopProducts.isNotEmpty)
              Row(
                children: shopProducts.take(3).map((p) {
                  final priceFormatted = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0).format(p.price);
                  return _buildShopProductPreview(p.name, priceFormatted, p.id, p.imageUrl, p.emoji);
                }).toList(),
              )
            else
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.inventory_2_outlined, size: 15, color: Colors.grey.shade600),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Gian hàng chính hãng • Chạm "Vào Shop" để xem danh mục sản phẩm',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      );
    }).toList();
  }

  Widget _buildShopProductPreview(String name, String price, String productId, String imageUrl, String emoji) {
    return Expanded(
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (ctx) => ProductDetailScreen(productId: productId),
            ),
          );
        },
        child: Container(
          margin: const EdgeInsets.only(right: 6),
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: imageUrl.startsWith('http')
                        ? Image.network(
                            imageUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Center(
                              child: Text(emoji.isNotEmpty ? emoji : '🛍️', style: const TextStyle(fontSize: 24)),
                            ),
                          )
                        : Center(
                            child: Text(emoji.isNotEmpty ? emoji : '🛍️', style: const TextStyle(fontSize: 24)),
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11),
              ),
              const SizedBox(height: 2),
              Text(
                price,
                style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
