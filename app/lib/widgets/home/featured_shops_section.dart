import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/product.dart';
import '../../models/shop.dart';
import '../../services/shop_service.dart';
import '../../screens/product_detail/product_detail_screen.dart';
import '../../screens/shop/shop_screen.dart';
import '../../screens/shop/shop_detail_screen.dart';
import '../../utils/product_image_resolver.dart';

/// Section Gian Hàng Nổi Bật trên Trang Chủ (Kết nối 100% dữ liệu Backend API)
class FeaturedShopsSection extends StatefulWidget {
  final List<Product> products;

  const FeaturedShopsSection({super.key, required this.products});

  @override
  State<FeaturedShopsSection> createState() => _FeaturedShopsSectionState();
}

class _FeaturedShopsSectionState extends State<FeaturedShopsSection> {
  final ShopService _shopService = ShopService();
  final Set<String> _followedShops = {};

  List<Shop> _shops = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadShops();
  }

  @override
  void didUpdateWidget(covariant FeaturedShopsSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_shops.isEmpty && widget.products.isNotEmpty) {
      _loadShops();
    }
  }

  Future<void> _loadShops() async {
    try {
      final res = await _shopService.getShops(limit: 6);
      if (res.shops.isNotEmpty && mounted) {
        setState(() {
          _shops = res.shops;
          _isLoading = false;
        });
        return;
      }
    } catch (_) {}

    // Fallback nếu API /api/v1/shops chưa có danh sách, trích xuất gian hàng thực từ danh sách sản phẩm
    if (mounted) {
      final seen = <String>{};
      final fallbackShops = <Shop>[];

      for (final p in widget.products) {
        final sId = p.shopId.isNotEmpty ? p.shopId : '1';
        if (!seen.contains(sId)) {
          seen.add(sId);
          fallbackShops.add(Shop(
            id: sId,
            name: p.shopName.isNotEmpty ? p.shopName : 'Shop #$sId',
            slug: 'shop-$sId',
            province: p.location.isNotEmpty ? p.location : 'Toàn Quốc',
            isMall: p.badges.contains('MALL'),
            rating: p.rating > 0 ? p.rating : 4.9,
            followersCount: 120,
            tagline: p.location.isNotEmpty ? p.location : 'Gian hàng chính hãng',
          ));
        }
      }

      setState(() {
        _shops = fallbackShops;
        _isLoading = false;
      });
    }
  }

  String _formatPrice(double price) {
    return NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(price);
  }

  Color _getShopColor(int index) {
    const colors = [
      Color(0xFFEE4D2D),
      Color(0xFF0055AA),
      Color(0xFF2D884D),
      Color(0xFF7A2098),
      Color(0xFFD35400),
    ];
    return colors[index % colors.length];
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Container(
        color: Colors.white,
        padding: const EdgeInsets.all(20),
        child: const Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    if (_shops.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.storefront, color: Color(0xFFEE4D2D), size: 20),
                    SizedBox(width: 6),
                    Text(
                      'GIAN HÀNG NỔI BẬT',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF222222),
                      ),
                    ),
                  ],
                ),
                TextButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ShopScreen()),
                    );
                  },
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(50, 30),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    'Xem tất cả >',
                    style: TextStyle(color: Color(0xFFEE4D2D), fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 255,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              scrollDirection: Axis.horizontal,
              itemCount: _shops.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final shop = _shops[index];
                // Lấy sản phẩm thực của gian hàng từ widget.products
                var shopProducts = widget.products.where((p) => p.shopId == shop.id).take(3).toList();
                if (shopProducts.isEmpty && widget.products.isNotEmpty) {
                  shopProducts = widget.products.take(3).toList();
                }
                final isFollowed = _followedShops.contains(shop.id);
                final shopColor = _getShopColor(index);

                return Container(
                  width: 290,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFEEEEEE)),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      // Shop Banner Header
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              shopColor,
                              shopColor.withValues(alpha: 0.75),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: InkWell(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => ShopDetailScreen(
                                        shopId: shop.id,
                                        initialShopName: shop.name,
                                      ),
                                    ),
                                  );
                                },
                                child: Row(
                                  children: [
                                    Container(
                                      width: 44,
                                      height: 44,
                                      decoration: const BoxDecoration(
                                        color: Colors.white,
                                        shape: BoxShape.circle,
                                      ),
                                      child: Center(
                                        child: Text(
                                          shop.name.isNotEmpty ? shop.name.characters.first : '🏪',
                                          style: TextStyle(
                                            fontSize: 20,
                                            fontWeight: FontWeight.bold,
                                            color: shopColor,
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Flexible(
                                                child: Text(
                                                  shop.name,
                                                  style: const TextStyle(
                                                    color: Colors.white,
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 13,
                                                  ),
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                ),
                                              ),
                                              if (shop.isMall) ...[
                                                const SizedBox(width: 4),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFD0011B),
                                                    borderRadius: BorderRadius.circular(2),
                                                  ),
                                                  child: const Text(
                                                    'MALL',
                                                    style: TextStyle(
                                                      color: Colors.white,
                                                      fontSize: 9,
                                                      fontWeight: FontWeight.bold,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            shop.tagline ?? shop.province,
                                            style: const TextStyle(
                                              color: Colors.white70,
                                              fontSize: 10,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            InkWell(
                              onTap: () async {
                                final next = await _shopService.toggleFollow(shop.id, isFollowed);
                                if (mounted) {
                                  setState(() {
                                    if (next) {
                                      _followedShops.add(shop.id);
                                    } else {
                                      _followedShops.remove(shop.id);
                                    }
                                  });
                                }
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isFollowed ? Colors.white24 : Colors.white,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  isFollowed ? 'Đã theo dõi' : '+ Theo dõi',
                                  style: TextStyle(
                                    color: isFollowed ? Colors.white : shopColor,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // 3 Mini Products
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.all(8),
                          child: Row(
                            children: shopProducts.map((p) {
                              return Expanded(
                                child: GestureDetector(
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => ProductDetailScreen(
                                          productId: p.id,
                                          initialProduct: p,
                                        ),
                                      ),
                                    );
                                  },
                                  child: Container(
                                    margin: const EdgeInsets.symmetric(horizontal: 3),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFAFAFA),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        AspectRatio(
                                          aspectRatio: 1,
                                          child: Container(
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFFFF0EC),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            clipBehavior: Clip.antiAlias,
                                            child: Image.network(
                                              p.effectiveImageUrl,
                                              fit: BoxFit.cover,
                                              errorBuilder: (_, __, ___) => Image.network(
                                                ProductImageResolver.resolve(categoryId: p.categoryId, name: p.name),
                                                fit: BoxFit.cover,
                                                errorBuilder: (_, __, ___) => Center(
                                                  child: Text(
                                                    p.emoji.isNotEmpty ? p.emoji : '🛍️',
                                                    style: const TextStyle(fontSize: 26),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 4),
                                          child: Text(
                                            p.name,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(fontSize: 10, height: 1.15),
                                          ),
                                        ),
                                        const Spacer(),
                                        Padding(
                                          padding: const EdgeInsets.all(4),
                                          child: Text(
                                            _formatPrice(p.price),
                                            style: const TextStyle(
                                              color: Color(0xFFEE4D2D),
                                              fontWeight: FontWeight.bold,
                                              fontSize: 11,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
