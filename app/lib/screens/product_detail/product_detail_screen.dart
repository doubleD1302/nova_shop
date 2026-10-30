import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shopnova/models/product.dart';
import 'package:shopnova/services/catalog_service.dart';
import 'package:shopnova/services/cart_service.dart';
import 'package:shopnova/services/favorite_service.dart';
import 'package:shopnova/services/review_service.dart';
import 'package:shopnova/services/shop_service.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/screens/cart/cart_screen.dart';
import 'package:shopnova/screens/shop/shop_screen.dart';
import 'package:shopnova/screens/shop/shop_detail_screen.dart';
import 'package:shopnova/screens/nova_ai/nova_ai_screen.dart';
import 'package:shopnova/widgets/common/report_content_sheet.dart';
import 'package:shopnova/widgets/home/product_card.dart';
import 'package:shopnova/theme/app_colors.dart';

class ProductDetailScreen extends StatefulWidget {
  final String? productId;
  final Product? initialProduct;

  const ProductDetailScreen({super.key, this.productId, this.initialProduct});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> with SingleTickerProviderStateMixin {
  final Color primaryColor = AppColors.primary;
  final CatalogService _catalogService = CatalogService();
  final FavoriteService _favoriteService = FavoriteService();
  final ReviewService _reviewService = ReviewService();
  final ShopService _shopService = ShopService();

  Product? _product;
  bool _isLoading = false;

  // Social & Review states
  bool _isFavorite = false;
  bool _isFollowing = false;
  bool _isLoadingReviews = false;
  double _avgRating = 5.0;
  int _totalReviews = 0;
  List<ProductReview> _reviews = [];
  int _selectedStarFilter = 0; // 0 = all

  // Related products
  List<Product> _sameShopProducts = [];
  List<Product> _sameCategoryProducts = [];
  bool _isLoadingRelated = false;

  // Gallery
  int _activeImageIndex = 0;
  late final PageController _pageController;

  // Dynamic variants & quantity
  List<String> _optionGroup1 = [];
  List<String> _optionGroup2 = [];
  String _selectedOption1 = '';
  String _selectedOption2 = '';
  int _quantity = 1;

  // Tabs controller for Detail / Specs / Shipping
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _tabController = TabController(length: 3, vsync: this);
    _product = widget.initialProduct;

    if (_product != null) {
      _initDynamicVariants(_product!);
    }

    final pId = widget.productId ?? widget.initialProduct?.id;
    if (pId != null) {
      _loadProduct(pId);
      _loadReviewsAndSocial(pId);
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  void _initDynamicVariants(Product p) {
    // 1. Phân tích biến thể từ danh sách variants của sản phẩm nếu có
    final g1 = <String>{};
    final g2 = <String>{};

    if (p.variants.isNotEmpty) {
      for (final v in p.variants) {
        final name = v['name']?.toString() ?? '';
        if (name.contains('/')) {
          final parts = name.split('/');
          if (parts.isNotEmpty) g1.add(parts[0].trim());
          if (parts.length > 1) g2.add(parts[1].trim());
        } else if (name.isNotEmpty) {
          g1.add(name.trim());
        }
      }
    }

    // 2. Phân tích biến thể từ specs nếu chưa có
    if (g1.isEmpty) {
      final colorSpec = p.specs['Màu sắc'] ?? p.specs['Màu'] ?? p.specs['Color'];
      if (colorSpec != null) {
        for (final item in colorSpec.toString().split(RegExp(r'[,/|]'))) {
          if (item.trim().isNotEmpty) g1.add(item.trim());
        }
      }
    }

    if (g2.isEmpty) {
      final sizeSpec = p.specs['Kích thước'] ?? p.specs['Size'] ?? p.specs['Dung lượng'] ?? p.specs['Bộ nhớ'];
      if (sizeSpec != null) {
        for (final item in sizeSpec.toString().split(RegExp(r'[,/|]'))) {
          if (item.trim().isNotEmpty) g2.add(item.trim());
        }
      }
    }

    // 3. Fallback thông minh dựa trên ngành hàng thực tế của sản phẩm
    if (g1.isEmpty) {
      final cId = p.categoryId.toLowerCase();
      if (cId.contains('thoi-trang') || cId.contains('ao') || cId.contains('quan')) {
        g1.addAll(['Trắng Basic', 'Đen Classic', 'Be Vintage', 'Xanh Sage']);
      } else if (cId.contains('dien-thoai') || cId.contains('may-tinh')) {
        g1.addAll(['Titan Tự Nhiên', 'Đen Midnight', 'Bạc Sang Trọng']);
      } else if (cId.contains('sac-dep')) {
        g1.addAll(['Hương Dịu Nhẹ', 'Da Nhạy Cảm', 'Dưỡng Sâu']);
      } else {
        g1.addAll(['Phiên bản Tiêu Chuẩn', 'Phiên bản Nâng Cấp Pro']);
      }
    }

    if (g2.isEmpty) {
      final cId = p.categoryId.toLowerCase();
      if (cId.contains('thoi-trang') || cId.contains('ao') || cId.contains('quan')) {
        g2.addAll(['Size S', 'Size M', 'Size L (55-65kg)', 'Size XL']);
      } else if (cId.contains('dien-thoai') || cId.contains('may-tinh')) {
        g2.addAll(['128GB', '256GB', '512GB']);
      } else if (cId.contains('sac-dep')) {
        g2.addAll(['Dung tích 50ml', 'Dung tích 100ml']);
      }
    }

    setState(() {
      _optionGroup1 = g1.toList();
      _optionGroup2 = g2.toList();
      if (_optionGroup1.isNotEmpty && (_selectedOption1.isEmpty || !_optionGroup1.contains(_selectedOption1))) {
        _selectedOption1 = _optionGroup1.first;
      }
      if (_optionGroup2.isNotEmpty && (_selectedOption2.isEmpty || !_optionGroup2.contains(_selectedOption2))) {
        _selectedOption2 = _optionGroup2.first;
      }
    });
  }

  Future<void> _loadProduct(String id) async {
    setState(() => _isLoading = _product == null);
    final p = await _catalogService.getProductDetail(id);
    if (mounted && p != null) {
      setState(() {
        _product = p;
        _isLoading = false;
      });
      _initDynamicVariants(p);
      _loadReviewsAndSocial(p.id);
      _loadRelatedProducts(p);
    } else if (mounted) {
      setState(() => _isLoading = false);
      if (_product != null) {
        _loadRelatedProducts(_product!);
      }
    }
  }

  Future<void> _loadRelatedProducts(Product p) async {
    setState(() => _isLoadingRelated = true);
    try {
      final all = await _catalogService.getProducts();
      if (mounted) {
        setState(() {
          _sameShopProducts = all.where((item) => item.shopId == p.shopId && item.id != p.id).take(6).toList();
          _sameCategoryProducts = all.where((item) => item.categoryId == p.categoryId && item.id != p.id).take(8).toList();
          if (_sameCategoryProducts.isEmpty) {
            _sameCategoryProducts = all.where((item) => item.id != p.id).take(8).toList();
          }
          _isLoadingRelated = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingRelated = false);
    }
  }

  Future<void> _loadReviewsAndSocial(String productId) async {
    setState(() => _isLoadingReviews = true);
    try {
      final res = await _reviewService.getReviews(productId);
      if (mounted) {
        setState(() {
          _reviews = res.reviews;
          _avgRating = res.averageRating > 0 ? res.averageRating : (_product?.rating ?? 4.9);
          _totalReviews = res.totalReviews > 0 ? res.totalReviews : _reviews.length;
          _isLoadingReviews = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingReviews = false);
    }

    if (AuthService().isAuthenticated) {
      try {
        final favs = await _favoriteService.getFavorites();
        if (mounted) {
          setState(() {
            _isFavorite = favs.any((p) => p.id == productId);
          });
        }
      } catch (_) {}

      final shopId = _product?.shopId;
      if (shopId != null && shopId.isNotEmpty) {
        try {
          final isFol = await _shopService.getFollowStatus(shopId);
          if (mounted) {
            setState(() {
              _isFollowing = isFol;
            });
          }
        } catch (_) {}
      }
    }
  }

  Future<void> _toggleFavorite() async {
    final pId = widget.productId ?? _product?.id;
    if (pId == null) return;

    if (!AuthService().isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng đăng nhập để lưu sản phẩm yêu thích.')),
      );
      return;
    }

    final prevStatus = _isFavorite;
    final nextStatus = !prevStatus;
    setState(() => _isFavorite = nextStatus);
    final ok = await _favoriteService.toggleFavorite(pId, prevStatus);
    if (!ok && mounted) {
      setState(() => _isFavorite = prevStatus);
      return;
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(nextStatus ? 'Đã thêm vào danh sách yêu thích' : 'Đã xóa khỏi danh sách yêu thích'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  Future<void> _toggleFollowShop() async {
    final sId = _product?.shopId;
    if (sId == null || sId.isEmpty) return;

    if (!AuthService().isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng đăng nhập để theo dõi gian hàng.')),
      );
      return;
    }

    final nextStatus = !_isFollowing;
    setState(() => _isFollowing = nextStatus);
    final ok = await _shopService.toggleFollow(sId, !nextStatus);
    if (mounted) {
      setState(() => _isFollowing = ok);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ok ? 'Đã theo dõi gian hàng thành công' : 'Đã hủy theo dõi gian hàng'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  void _showAddReviewDialog() {
    if (!AuthService().isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng đăng nhập để viết đánh giá sản phẩm.')),
      );
      return;
    }

    int selectedRating = 5;
    final commentCtrl = TextEditingController();
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Đánh giá sản phẩm', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _product?.name ?? 'Sản phẩm ShopNova',
                      style: const TextStyle(fontSize: 13, color: Colors.grey),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 16),
                    const Text('Mức độ hài lòng:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final star = index + 1;
                        return IconButton(
                          icon: Icon(
                            star <= selectedRating ? Icons.star : Icons.star_border,
                            color: Colors.amber,
                            size: 36,
                          ),
                          onPressed: () {
                            setModalState(() => selectedRating = star);
                          },
                        );
                      }),
                    ),
                    Center(
                      child: Text(
                        selectedRating == 5
                            ? 'Tuyệt vời ⭐⭐⭐⭐⭐'
                            : selectedRating == 4
                                ? 'Hài lòng ⭐⭐⭐⭐'
                                : selectedRating == 3
                                    ? 'Bình thường ⭐⭐⭐'
                                    : selectedRating == 2
                                        ? 'Không hài lòng ⭐⭐'
                                        : 'Tệ ⭐',
                        style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: commentCtrl,
                      maxLines: 4,
                      decoration: InputDecoration(
                        hintText: 'Hãy chia sẻ cảm nhận thực tế của bạn về chất lượng sản phẩm, dịch vụ vận chuyển...',
                        hintStyle: const TextStyle(fontSize: 13, color: Colors.grey),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                final text = commentCtrl.text.trim();
                                if (text.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Vui lòng nhập nhận xét của bạn.')),
                                  );
                                  return;
                                }

                                setModalState(() => isSubmitting = true);
                                final pId = widget.productId ?? _product?.id ?? '';
                                final res = await _reviewService.createReview(
                                  orderItemId: pId,
                                  rating: selectedRating,
                                  comment: text,
                                );
                                setModalState(() => isSubmitting = false);

                                if (mounted) {
                                  Navigator.pop(ctx);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(res.success ? 'Cảm ơn bạn đã gửi đánh giá!' : (res.message.isNotEmpty ? res.message : 'Đánh giá đã được ghi nhận!')),
                                      backgroundColor: Colors.green,
                                    ),
                                  );
                                  _loadReviewsAndSocial(pId);
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: isSubmitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Gửi đánh giá', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Color _getColorFromLabel(String label) {
    final lower = label.toLowerCase();
    if (lower.contains('trắng')) return Colors.white;
    if (lower.contains('đen')) return Colors.black;
    if (lower.contains('be')) return const Color(0xFFF5F5DC);
    if (lower.contains('sage') || lower.contains('xanh lá')) return const Color(0xFF9DC183);
    if (lower.contains('titan') || lower.contains('xám')) return const Color(0xFF8E8E93);
    if (lower.contains('bạc')) return const Color(0xFFC0C0C0);
    if (lower.contains('hồng')) return const Color(0xFFFFB6C1);
    if (lower.contains('xanh')) return const Color(0xFF1E88E5);
    if (lower.contains('đỏ')) return const Color(0xFFE53935);
    if (lower.contains('vàng')) return const Color(0xFFFFD54F);
    return primaryColor;
  }

  String _formatVND(num amount) {
    return NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(amount);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _product == null) {
      return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black87, size: 20),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text('Đang tải sản phẩm...', style: TextStyle(fontSize: 15, color: Colors.black87)),
        ),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    final p = _product;
    final images = (p?.images != null && p!.images.isNotEmpty)
        ? p.images
        : [p?.effectiveImageUrl ?? ''];

    return Scaffold(
      backgroundColor: const Color(0xFFF6F6F9),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          p?.name ?? 'Chi Tiết Sản Phẩm ShopNova',
          style: const TextStyle(color: Colors.black87, fontSize: 15, fontWeight: FontWeight.bold),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Đã sao chép liên kết sản phẩm!'), duration: Duration(seconds: 1)),
              );
            },
          ),
          IconButton(
            icon: Icon(
              _isFavorite ? Icons.favorite : Icons.favorite_border,
              color: _isFavorite ? Colors.red : Colors.black87,
            ),
            onPressed: _toggleFavorite,
          ),
          AnimatedBuilder(
            animation: CartService(),
            builder: (context, _) {
              final count = CartService().itemCount;
              return Stack(
                alignment: Alignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.shopping_cart_outlined),
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const CartScreen()),
                      );
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
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.home_outlined),
            onPressed: () {
              Navigator.popUntil(context, (r) => r.isFirst);
            },
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(32),
          child: Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              color: AppColors.surfaceAlt,
              border: Border(
                top: BorderSide(color: AppColors.border, width: 0.8),
                bottom: BorderSide(color: AppColors.border, width: 0.8),
              ),
            ),
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
            child: const Row(
              children: [
                Icon(Icons.verified_outlined, size: 15, color: AppColors.primary),
                SizedBox(width: 6),
                Text(
                  'HÀNG CHÍNH HÃNG 100% • ĐỔI TRẢ MIỄN PHÍ 15 NGÀY',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary, letterSpacing: 0.2),
                ),
              ],
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // 1. Image Gallery
            _buildGallerySection(images),

            // 2. Flash Sale Banner
            if (p?.isFlashSale == true || (p?.discount ?? 0) >= 30)
              _buildFlashSaleBanner(),

            // 3. Price & Main Title Section
            _buildPriceAndTitleSection(),

            // 4. Dynamic Variants Picker
            _buildVariantsSection(),

            // 5. Shop Info Card
            _buildShopInfoSection(),

            // 6. Comprehensive Tabs (Mô tả, Thông số, Vận chuyển)
            _buildProductTabsSection(),

            // 7. Customer Reviews Section
            _buildReviewsSection(),

            // 8. Buyer Protection Section
            _buildBuyerProtectionSection(),

            // 9. Related products from Same Shop & Category
            _buildRelatedProductsSection(),

            const SizedBox(height: 100),
          ],
        ),
      ),
      bottomSheet: _buildBottomBar(),
    );
  }

  // 1. GALLERY VỚI ẢNH CHÍNH & DẢI THUMBNAIL
  Widget _buildGallerySection(List<String> images) {
    final p = _product;
    final isMall = p?.badges.any((b) => b.toUpperCase().contains('MALL')) == true;

    return Container(
      color: Colors.white,
      child: Column(
        children: [
          Stack(
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: images.length,
                  onPageChanged: (i) => setState(() => _activeImageIndex = i),
                  itemBuilder: (ctx, i) {
                    return Image.network(
                      images[i],
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        color: AppColors.surfaceAlt,
                        child: Center(
                          child: Text(
                            p?.emoji.isNotEmpty == true ? p!.emoji : '🛍️',
                            style: const TextStyle(fontSize: 80),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              // Mall Badge
              if (isMall)
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: const Color(0xFF28313F), borderRadius: BorderRadius.circular(4)),
                    child: const Text('SHOP MALL', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.4)),
                  ),
                ),
              // Index Counter
              Positioned(
                bottom: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.55),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    '${_activeImageIndex + 1}/${images.length}',
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
          // Thumbnails Strip
          if (images.length > 1)
            Container(
              height: 70,
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: images.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (ctx, i) {
                  final isSelected = i == _activeImageIndex;
                  return GestureDetector(
                    onTap: () {
                      _pageController.animateToPage(
                        i,
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeOut,
                      );
                    },
                    child: Container(
                      width: 54,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected ? primaryColor : Colors.grey.shade300,
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: Image.network(images[i], fit: BoxFit.cover),
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  // 2. FLASH SALE BANNER
  Widget _buildFlashSaleBanner() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFFE53935), Color(0xFFFF6F00)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Row(
            children: [
              Icon(Icons.bolt, color: Colors.yellowAccent, size: 22),
              SizedBox(width: 4),
              Text(
                'FLASH SALE SHOPNOVA',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 0.5),
              ),
            ],
          ),
          Row(
            children: [
              const Text('KẾT THÚC TRONG ', style: TextStyle(color: Colors.white70, fontSize: 10.5, fontWeight: FontWeight.bold)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.black.withOpacity(0.6), borderRadius: BorderRadius.circular(4)),
                child: const Text('02:45:10', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // 3. GIÁ, TIÊU ĐỀ & ĐÁNH GIÁ CHÍNH
  Widget _buildPriceAndTitleSection() {
    final p = _product;
    final price = p?.price ?? 150000.0;
    final origPrice = p?.originalPrice ?? (price * 1.3);
    final discount = p?.discount ?? (origPrice > price ? (((origPrice - price) / origPrice) * 100).round() : 0);

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _formatVND(price),
                style: TextStyle(color: primaryColor, fontSize: 24, fontWeight: FontWeight.w900),
              ),
              if (origPrice > price) ...[
                const SizedBox(width: 8),
                Text(
                  _formatVND(origPrice),
                  style: const TextStyle(color: Colors.grey, fontSize: 14, decoration: TextDecoration.lineThrough),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(4)),
                  child: Text('-$discount%', style: TextStyle(color: primaryColor, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  border: Border.all(color: const Color(0xFF2E7D32)),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text('Freeship Xtra', style: TextStyle(color: Color(0xFF2E7D32), fontSize: 11, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(4)),
                child: const Text('⚡ Hỏa Tốc 2H', style: TextStyle(color: Colors.deepOrange, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            p?.name ?? 'Sản phẩm chính hãng ShopNova',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, height: 1.4, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.star, color: Colors.amber, size: 16),
              const SizedBox(width: 4),
              Text(
                _avgRating.toStringAsFixed(1),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 8),
              Container(width: 1, height: 12, color: Colors.grey.shade300),
              const SizedBox(width: 8),
              Text('$_totalReviews đánh giá', style: const TextStyle(fontSize: 13, color: Colors.black87)),
              const SizedBox(width: 8),
              Container(width: 1, height: 12, color: Colors.grey.shade300),
              const SizedBox(width: 8),
              Text(p?.soldCount.isNotEmpty == true ? p!.soldCount : 'Đã bán 500+', style: const TextStyle(fontSize: 13, color: Colors.black87)),
            ],
          ),
        ],
      ),
    );
  }

  // 4. BIẾN THỂ ĐỘNG THEO SẢN PHẨM & SỐ LƯỢNG
  Widget _buildVariantsSection() {
    final stock = _product?.stock ?? 120;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Phân loại & Tùy chọn', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              Text('Kho hàng: $stock sản phẩm', style: TextStyle(color: Colors.grey.shade600, fontSize: 12.5)),
            ],
          ),
          // Group 1
          if (_optionGroup1.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              _product?.categoryId.contains('dien-thoai') == true ? 'Màu máy / Phiên bản:' : 'Màu sắc / Mẫu mã:',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _optionGroup1.map((opt) {
                final isSelected = _selectedOption1 == opt;
                return GestureDetector(
                  onTap: () => setState(() => _selectedOption1 = opt),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.surfaceAlt : Colors.grey.shade100,
                      border: Border.all(color: isSelected ? primaryColor : Colors.transparent, width: 1.5),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: _getColorFromLabel(opt),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.grey.shade400),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          opt,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            color: isSelected ? primaryColor : Colors.black87,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
          // Group 2
          if (_optionGroup2.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              _product?.categoryId.contains('dien-thoai') == true ? 'Dung lượng bộ nhớ:' : 'Kích cỡ / Phân loại:',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _optionGroup2.map((opt) {
                final isSelected = _selectedOption2 == opt;
                return GestureDetector(
                  onTap: () => setState(() => _selectedOption2 = opt),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.surfaceAlt : Colors.grey.shade100,
                      border: Border.all(color: isSelected ? primaryColor : Colors.transparent, width: 1.5),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      opt,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        color: isSelected ? primaryColor : Colors.black87,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
          const SizedBox(height: 16),
          // Quantity Stepper
          Row(
            children: [
              const Text('Số lượng đặt mua:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              const Spacer(),
              Row(
                children: [
                  InkWell(
                    onTap: () {
                      if (_quantity > 1) setState(() => _quantity--);
                    },
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: const BorderRadius.horizontal(left: Radius.circular(6)),
                      ),
                      child: const Icon(Icons.remove, size: 16, color: Colors.black87),
                    ),
                  ),
                  Container(
                    width: 44,
                    height: 32,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(border: Border.symmetric(horizontal: BorderSide(color: Colors.grey.shade300))),
                    child: Text('$_quantity', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                  ),
                  InkWell(
                    onTap: () {
                      if (_quantity < stock) setState(() => _quantity++);
                    },
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: const BorderRadius.horizontal(right: Radius.circular(6)),
                      ),
                      child: const Icon(Icons.add, size: 16, color: Colors.black87),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  // 5. THÔNG TIN GIAN HÀNG THỰC TẾ
  Widget _buildShopInfoSection() {
    final p = _product;
    final sName = p?.shopName.isNotEmpty == true ? p!.shopName : 'ShopNova Official Store';
    final isMall = p?.badges.any((b) => b.toUpperCase().contains('MALL')) == true;
    final location = p?.location ?? 'TP. Hồ Chí Minh';

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: AppColors.surfaceAlt,
                child: const Icon(Icons.storefront_outlined, color: AppColors.primary, size: 26),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(sName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5), overflow: TextOverflow.ellipsis),
                        ),
                        if (isMall) ...[
                          const SizedBox(width: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(color: const Color(0xFF28313F), borderRadius: BorderRadius.circular(3)),
                            child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text('📍 Kho hàng tại $location', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                  ],
                ),
              ),
              OutlinedButton(
                onPressed: () {
                  final sId = p?.shopId;
                  if (sId != null && sId.isNotEmpty) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ShopDetailScreen(shopId: sId, initialShopName: sName),
                      ),
                    );
                  } else {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const ShopScreen()));
                  }
                },
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: Colors.grey.shade400),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  minimumSize: const Size(0, 32),
                ),
                child: const Text('Xem Shop', style: TextStyle(fontSize: 12, color: Colors.black87, fontWeight: FontWeight.w600)),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _toggleFollowShop,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _isFollowing ? Colors.grey.shade200 : primaryColor,
                  foregroundColor: _isFollowing ? Colors.black87 : Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  minimumSize: const Size(0, 32),
                  elevation: 0,
                ),
                child: Text(_isFollowing ? '✓ Đã theo dõi' : '+ Theo dõi', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildShopStat('${_avgRating.toStringAsFixed(1)}/5.0', 'Đánh giá shop'),
              _buildShopStat('99%', 'Tỷ lệ phản hồi'),
              _buildShopStat('100%', 'Hàng chính hãng'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildShopStat(String title, String subtitle) {
    return Column(
      children: [
        Text(title, style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13.5)),
        const SizedBox(height: 3),
        Text(subtitle, style: TextStyle(color: Colors.grey.shade600, fontSize: 11)),
      ],
    );
  }

  // 6. TABS CHI TIẾT SẢN PHẨM, THÔNG SỐ VÀ CHÍNH SÁCH
  Widget _buildProductTabsSection() {
    final p = _product;
    final specs = p?.specs ?? {};
    final categoryName = p?.categoryName.isNotEmpty == true ? p!.categoryName : 'Ngành hàng ShopNova';

    return Container(
      color: Colors.white,
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TabBar(
            controller: _tabController,
            labelColor: primaryColor,
            unselectedLabelColor: Colors.grey.shade600,
            indicatorColor: primaryColor,
            indicatorWeight: 3,
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            tabs: const [
              Tab(text: 'Chi Tiết & Mô Tả'),
              Tab(text: 'Thông Số Kỹ Thuật'),
              Tab(text: 'Vận Chuyển & Đổi Trả'),
            ],
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: [
              // Tab 1: Mô tả
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildDetailRow('Ngành hàng', categoryName),
                  _buildDetailRow('Gian hàng', p?.shopName ?? 'ShopNova Official'),
                  _buildDetailRow('Tồn kho', '${p?.stock ?? 120} sản phẩm sẵn có'),
                  _buildDetailRow('Khu vực gửi hàng', p?.location ?? 'TP. Hồ Chí Minh'),
                  const SizedBox(height: 12),
                  const Text('Mô tả sản phẩm:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                  const SizedBox(height: 8),
                  Text(
                    p?.description.isNotEmpty == true
                        ? p!.description
                        : 'Sản phẩm chính hãng ShopNova được kiểm định chất lượng nghiêm ngặt, nguồn gốc rõ ràng và cam kết bảo hành uy tín.',
                    style: const TextStyle(fontSize: 13, height: 1.55, color: Color(0xFF2D3748)),
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      _buildTagChip('#ChinhHang100%'),
                      _buildTagChip('#FreeshipXtra'),
                      _buildTagChip('#Giao2H'),
                      _buildTagChip('#DoiTra15Ngay'),
                    ],
                  ),
                ],
              ),
              // Tab 2: Thông số
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (specs.isNotEmpty)
                    ...specs.entries.map((e) => Container(
                          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                          margin: const EdgeInsets.only(bottom: 6),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SizedBox(
                                width: 130,
                                child: Text(e.key, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: Colors.black87)),
                              ),
                              Expanded(
                                child: Text('${e.value}', style: TextStyle(fontSize: 12.5, color: Colors.grey.shade800)),
                              ),
                            ],
                          ),
                        ))
                  else ...[
                    _buildDetailRow('Thương hiệu', p?.shopName ?? 'ShopNova'),
                    _buildDetailRow('Xuất xứ', 'Chính hãng Việt Nam / Nhập khẩu'),
                    _buildDetailRow('Bảo hành', '12 tháng chính hãng'),
                    _buildDetailRow('Quy cách đóng gói', 'Hộp nguyên seal đầy đủ phụ kiện'),
                  ],
                ],
              ),
              // Tab 3: Vận chuyển
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildPolicyTile(Icons.local_shipping_outlined, 'Vận chuyển hỏa tốc 2H', 'Hỗ trợ giao nhanh trong 2 giờ tại nội thành Hà Nội & TP.HCM.'),
                  _buildPolicyTile(Icons.sync_alt_rounded, 'Đổi trả miễn phí 15 ngày', 'Đổi mới miễn phí nếu phát sinh lỗi nhà sản xuất hoặc sai phân loại.'),
                  _buildPolicyTile(Icons.verified_user_outlined, 'Bảo đảm hàng chính hãng', 'Hoàn tiền 100% nếu phát hiện hàng giả, hàng nhái.'),
                ],
              ),
            ][_tabController.index],
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.black87)),
          ),
        ],
      ),
    );
  }

  Widget _buildTagChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: AppColors.surfaceAlt, borderRadius: BorderRadius.circular(12)),
      child: Text(label, style: const TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildPolicyTile(IconData icon, String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: primaryColor, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 2),
                Text(subtitle, style: TextStyle(color: Colors.grey.shade700, fontSize: 12, height: 1.35)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // 7. ĐÁNH GIÁ THỰC TẾ & BỘ LỌC SAO
  Widget _buildReviewsSection() {
    final filteredReviews = _selectedStarFilter == 0
        ? _reviews
        : _reviews.where((r) => r.rating == _selectedStarFilter).toList();

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('ĐÁNH GIÁ SẢN PHẨM', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        _avgRating.toStringAsFixed(1),
                        style: TextStyle(color: primaryColor, fontSize: 16, fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(width: 4),
                      Row(
                        children: List.generate(5, (index) {
                          return Icon(
                            index < _avgRating.round() ? Icons.star : Icons.star_border,
                            color: Colors.amber,
                            size: 16,
                          );
                        }),
                      ),
                      const SizedBox(width: 6),
                      Text('($_totalReviews đánh giá)', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                    ],
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: _showAddReviewDialog,
                icon: Icon(Icons.rate_review_outlined, size: 14, color: primaryColor),
                label: Text('Viết đánh giá', style: TextStyle(color: primaryColor, fontSize: 12, fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: primaryColor),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildStarFilterChip(0, 'Tất cả (${_reviews.length})'),
                _buildStarFilterChip(5, '5 ⭐'),
                _buildStarFilterChip(4, '4 ⭐'),
                _buildStarFilterChip(3, '3 ⭐'),
                _buildStarFilterChip(2, '2 ⭐'),
                _buildStarFilterChip(1, '1 ⭐'),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const Divider(height: 1),
          const SizedBox(height: 12),
          if (_isLoadingReviews)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: CircularProgressIndicator(color: primaryColor, strokeWidth: 2),
              ),
            )
          else if (filteredReviews.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.rate_review_outlined, size: 36, color: Colors.grey.shade400),
                    const SizedBox(height: 8),
                    const Text('Chưa có đánh giá nào cho mục này.', style: TextStyle(color: Colors.grey, fontSize: 13)),
                  ],
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filteredReviews.length > 5 ? 5 : filteredReviews.length,
              separatorBuilder: (_, __) => const Divider(height: 20),
              itemBuilder: (context, index) {
                final r = filteredReviews[index];
                final dateStr = r.createdAt != null
                    ? DateFormat('dd/MM/yyyy HH:mm').format(r.createdAt!)
                    : 'Gần đây';

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundColor: AppColors.surfaceAlt,
                          child: Text(
                            r.reviewerName.isNotEmpty ? r.reviewerName[0].toUpperCase() : 'U',
                            style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(r.reviewerName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              Row(
                                children: [
                                  Row(
                                    children: List.generate(5, (sIdx) {
                                      return Icon(
                                        sIdx < r.rating ? Icons.star : Icons.star_border,
                                        color: Colors.amber,
                                        size: 12,
                                      );
                                    }),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(dateStr, style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(r.comment, style: const TextStyle(fontSize: 13, height: 1.45, color: Colors.black87)),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildStarFilterChip(int star, String label) {
    final isSelected = _selectedStarFilter == star;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(label, style: TextStyle(fontSize: 11.5, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal, color: isSelected ? Colors.white : Colors.black87)),
        selected: isSelected,
        selectedColor: primaryColor,
        backgroundColor: Colors.grey.shade100,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        onSelected: (_) => setState(() => _selectedStarFilter = star),
      ),
    );
  }

  // 8. BẢO VỆ NGƯỜI MUA HÀNG
  Widget _buildBuyerProtectionSection() {
    if (_product == null) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: AppColors.surfaceAlt, borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.verified_user_outlined, color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Bảo vệ người mua hàng ShopNova', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                    SizedBox(height: 2),
                    Text('Hoàn tiền 100% nếu sản phẩm có dấu hiệu giả mạo', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.flag_outlined, size: 16, color: AppColors.primary),
              label: const Text('Báo cáo sản phẩm vi phạm / hàng giả', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.border),
                backgroundColor: AppColors.surfaceAlt,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                ReportContentSheet.show(
                  context,
                  targetType: 'product',
                  targetId: _product!.id,
                  targetName: _product!.name,
                  shopName: _product!.shopName,
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // 9. SẢN PHẨM KHÁC CỦA SHOP & CÓ THỂ BẠN CŨNG THÍCH
  Widget _buildRelatedProductsSection() {
    return Column(
      children: [
        if (_sameShopProducts.isNotEmpty) ...[
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            margin: const EdgeInsets.only(top: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('SẢN PHẨM KHÁC CỦA SHOP', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, letterSpacing: 0.3)),
                    InkWell(
                      onTap: () {
                        final sId = _product?.shopId;
                        if (sId != null && sId.isNotEmpty) {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => ShopDetailScreen(shopId: sId, initialShopName: _product?.shopName)));
                        }
                      },
                      child: Text('Xem tất cả >', style: TextStyle(color: primaryColor, fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 250,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _sameShopProducts.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemBuilder: (ctx, i) => SizedBox(
                      width: 155,
                      child: ProductCard(product: _sameShopProducts[i]),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        if (_sameCategoryProducts.isNotEmpty) ...[
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            margin: const EdgeInsets.only(top: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('CÓ THỂ BẠN CŨNG THÍCH', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, letterSpacing: 0.3)),
                const SizedBox(height: 12),
                SizedBox(
                  height: 250,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _sameCategoryProducts.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemBuilder: (ctx, i) => SizedBox(
                      width: 155,
                      child: ProductCard(product: _sameCategoryProducts[i]),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  // 10. BOTTOM ACTION BAR (THÊM GIỎ & MUA NGAY)
  Widget _buildBottomBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            offset: const Offset(0, -3),
            blurRadius: 6,
          ),
        ],
      ),
      child: SafeArea(
        child: SizedBox(
          height: 60,
          child: Row(
            children: [
              // Chat AI / Shop
              Expanded(
                flex: 2,
                child: InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => NovaAIScreen(
                          isStandalone: true,
                          initialQuery: 'Tư vấn giúp mình về sản phẩm "${_product?.name ?? "này"}"',
                        ),
                      ),
                    );
                  },
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.auto_awesome, size: 20, color: primaryColor),
                      const SizedBox(height: 2),
                      const Text('Nova AI', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: AppColors.primary)),
                    ],
                  ),
                ),
              ),
              Container(width: 0.8, height: 36, color: Colors.grey.shade200),
              // Thêm Giỏ Hàng
              Expanded(
                flex: 3,
                child: InkWell(
                  onTap: () async {
                    final p = _product;
                    final pId = widget.productId ?? p?.id ?? '1';
                    final vName = [_selectedOption1, _selectedOption2].where((s) => s.isNotEmpty).join(' - ');
                    final vId = '${pId}_${vName.replaceAll(RegExp(r'\s+'), '_')}';
                    final sId = (p?.shopId != null && p!.shopId.isNotEmpty) ? p.shopId : '1';
                    final sName = (p?.shopName != null && p!.shopName.isNotEmpty) ? p.shopName : 'ShopNova';
                    final sMall = p?.badges.any((b) => b.toUpperCase().contains('MALL')) == true;
                    final img = (p?.images != null && p!.images.isNotEmpty) ? p.images.first : (p?.effectiveImageUrl ?? '');

                    await CartService().addToCart(
                      productId: pId,
                      productName: p?.name ?? 'Sản phẩm ShopNova',
                      productSlug: p?.id ?? pId,
                      variantId: vId,
                      variantName: vName.isNotEmpty ? vName : 'Tiêu chuẩn',
                      price: p?.price ?? 180000,
                      originalPrice: p?.originalPrice,
                      qty: _quantity,
                      shopId: sId,
                      shopName: sName,
                      shopMall: sMall,
                      imageUrl: img,
                    );
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Đã thêm $_quantity sản phẩm vào giỏ hàng!'),
                        backgroundColor: const Color(0xFF2E7D32),
                        duration: const Duration(seconds: 2),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_shopping_cart_rounded, size: 20, color: primaryColor),
                      const SizedBox(height: 2),
                      Text('Thêm vào giỏ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: primaryColor)),
                    ],
                  ),
                ),
              ),
              // Mua Ngay
              Expanded(
                flex: 4,
                child: InkWell(
                  onTap: () async {
                    final p = _product;
                    final pId = widget.productId ?? p?.id ?? '1';
                    final vName = [_selectedOption1, _selectedOption2].where((s) => s.isNotEmpty).join(' - ');
                    final vId = '${pId}_${vName.replaceAll(RegExp(r'\s+'), '_')}';
                    final sId = (p?.shopId != null && p!.shopId.isNotEmpty) ? p.shopId : '1';
                    final sName = (p?.shopName != null && p!.shopName.isNotEmpty) ? p.shopName : 'ShopNova';
                    final sMall = p?.badges.any((b) => b.toUpperCase().contains('MALL')) == true;
                    final img = (p?.images != null && p!.images.isNotEmpty) ? p.images.first : (p?.effectiveImageUrl ?? '');

                    await CartService().addToCart(
                      productId: pId,
                      productName: p?.name ?? 'Sản phẩm ShopNova',
                      productSlug: p?.id ?? pId,
                      variantId: vId,
                      variantName: vName.isNotEmpty ? vName : 'Tiêu chuẩn',
                      price: p?.price ?? 180000,
                      originalPrice: p?.originalPrice,
                      qty: _quantity,
                      shopId: sId,
                      shopName: sName,
                      shopMall: sMall,
                      imageUrl: img,
                    );
                    if (!mounted) return;
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const CartScreen()),
                    );
                  },
                  child: Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.primary, AppColors.earth],
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                      ),
                    ),
                    child: const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('MUA NGAY', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13.5, letterSpacing: 0.3)),
                        SizedBox(height: 2),
                        Text('Giảm thêm với Voucher', style: TextStyle(color: Colors.white70, fontSize: 10)),
                      ],
                    ),
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
