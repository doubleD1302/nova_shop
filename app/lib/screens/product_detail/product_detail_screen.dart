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
import 'package:shopnova/theme/app_colors.dart';

class ProductDetailScreen extends StatefulWidget {
  final String? productId;
  final Product? initialProduct;

  const ProductDetailScreen({super.key, this.productId, this.initialProduct});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
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

  String selectedColor = 'Trắng Basic';
  String selectedSize = 'L (55-65kg)';
  int quantity = 1;

  @override
  void initState() {
    super.initState();
    _product = widget.initialProduct;
    final pId = widget.productId ?? widget.initialProduct?.id;
    if (pId != null) {
      _loadProduct(pId);
      _loadReviewsAndSocial(pId);
    }
  }

  Future<void> _loadProduct(String id) async {
    setState(() => _isLoading = _product == null);
    final p = await _catalogService.getProductDetail(id);
    if (mounted && p != null) {
      setState(() {
        _product = p;
        _isLoading = false;
      });
      _loadReviewsAndSocial(p.id);
    } else if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _loadReviewsAndSocial(String productId) async {
    setState(() => _isLoadingReviews = true);
    try {
      final res = await _reviewService.getReviews(productId);
      if (mounted) {
        setState(() {
          _reviews = res.reviews;
          _avgRating = res.averageRating;
          _totalReviews = res.totalReviews;
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

    final nextStatus = !_isFavorite;
    setState(() => _isFavorite = nextStatus);
    final ok = await _favoriteService.toggleFavorite(pId, !nextStatus);
    if (!ok && mounted) {
      setState(() => _isFavorite = !nextStatus);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(nextStatus ? 'Đã thêm vào danh sách yêu thích' : 'Đã bỏ khỏi danh sách yêu thích'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  Future<void> _toggleFollowShop() async {
    final sId = _product?.shopId;
    if (sId == null || sId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Chưa có thông tin gian hàng để theo dõi.')),
      );
      return;
    }

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
                        hintText: 'Hãy chia sẻ cảm nhận của bạn về chất lượng sản phẩm, dịch vụ vận chuyển...',
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

  final List<String> colors = ['Trắng Basic', 'Đen Classic', 'Be Vintage', 'Xanh Sage'];
  final List<String> sizes = ['M', 'L (55-65kg)', 'XL', 'XXL'];

  Color getColorFromString(String colorStr) {
    switch (colorStr) {
      case 'Trắng Basic': return Colors.white;
      case 'Đen Classic': return Colors.black;
      case 'Be Vintage': return const Color(0xFFF5F5DC);
      case 'Xanh Sage': return const Color(0xFF9DC183);
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[200],
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        title: const Text(
          'Shopnova Chi Tiết Sản Phẩm',
          style: TextStyle(color: Colors.black87, fontSize: 16),
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
                          style: const TextStyle(color: Colors.white, fontSize: 10),
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
            _buildImageSection(),
            if (_product?.discount != null && _product!.discount > 0)
              _buildFlashSaleBanner(),
            _buildPriceAndTitleSection(),
            _buildVariantsSection(),
            _buildShopInfoSection(),
            _buildDescriptionSection(),
            _buildReviewsSection(),
            _buildBuyerProtectionSection(),
            const SizedBox(height: 100),
          ],
        ),
      ),
      bottomSheet: _buildBottomBar(),
    );
  }

  Widget _buildBuyerProtectionSection() {
    if (_product == null) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border, width: 0.8),
                ),
                child: const Icon(Icons.verified_user_outlined, color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Bảo vệ người mua hàng NovaShop',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Hoàn tiền 100% nếu phát hiện hàng giả, hàng nhái',
                      style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Nếu phát hiện sản phẩm có dấu hiệu hàng giả, hàng nhái hoặc vi phạm chính sách của sàn, hãy gửi báo cáo để Ban Quản Trị xác minh và xử lý ngay.',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              icon: const Icon(Icons.flag_outlined, size: 16, color: AppColors.primary),
              label: const Text(
                'Báo cáo sản phẩm vi phạm / hàng giả',
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.primary),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.border),
                backgroundColor: AppColors.surfaceAlt,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 10),
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

  Widget _buildImageSection() {
    return Container(
      color: Colors.white,
      child: Stack(
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFFFF5F2), Color(0xFFFFEAE3)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Center(
                child: _product != null
                    ? Image.network(
                        _product!.effectiveImageUrl,
                        fit: BoxFit.cover,
                        width: double.infinity,
                        height: double.infinity,
                        loadingBuilder: (context, child, progress) {
                          if (progress == null) return child;
                          return Container(
                            color: AppColors.surfaceAlt,
                            child: const Center(
                              child: CircularProgressIndicator(color: AppColors.primary),
                            ),
                          );
                        },
                        errorBuilder: (_, __, ___) => Text(
                          _product?.emoji.isNotEmpty == true ? _product!.emoji : '🛍️',
                          style: const TextStyle(fontSize: 100),
                        ),
                      )
                    : const Center(
                        child: CircularProgressIndicator(color: AppColors.primary),
                      ),
              ),
            ),
          ),
          Positioned(
            top: 10,
            left: 10,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFF003366), borderRadius: BorderRadius.circular(2)),
                  child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(2)),
                  child: const Text('Yêu Thích+', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
          Positioned(
            bottom: 10,
            right: 10,
            child: Row(
              children: [
                GestureDetector(
                  onTap: _toggleFavorite,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                    child: Icon(
                      _isFavorite ? Icons.favorite : Icons.favorite_border,
                      color: _isFavorite ? Colors.red : Colors.white,
                      size: 20,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(12)),
                  child: const Text('1/5', style: TextStyle(color: Colors.white, fontSize: 12)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFlashSaleBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.flashSaleRed, AppColors.primary],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '⚡ FLASH SALE',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16, fontStyle: FontStyle.italic),
              ),
              Text(
                'Đang bán rất chạy - Sắp hết hạn',
                style: TextStyle(color: Colors.white, fontSize: 12),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(4)),
            child: const Text(
              '02 : 45 : 05',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildPriceAndTitleSection() {
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
                NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(_product?.price ?? 99000.0),
                style: TextStyle(color: primaryColor, fontSize: 24, fontWeight: FontWeight.bold),
              ),
              if ((_product?.originalPrice ?? 180000.0) > (_product?.price ?? 99000.0)) ...[
                const SizedBox(width: 8),
                Text(
                  NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(_product?.originalPrice ?? 180000.0),
                  style: const TextStyle(color: Colors.grey, fontSize: 14, decoration: TextDecoration.lineThrough),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(2)),
                  child: Text('-${_product?.discount ?? 45}%', style: TextStyle(color: primaryColor, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.green),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text('Freeship Xtra', style: TextStyle(color: Colors.green, fontSize: 10)),
          ),
          const SizedBox(height: 8),
          Text(
            _product?.name ?? 'Áo Thun Cotton Unisex Form Rộng Trơn Thoáng Khí ShopNova Official Co Dãn 4 Chiều Cao Cấp',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500, height: 1.4),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text('⭐ ${_avgRating.toStringAsFixed(1)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              const SizedBox(width: 8),
              Container(width: 1, height: 12, color: Colors.grey[400]),
              const SizedBox(width: 8),
              Text('$_totalReviews đánh giá', style: const TextStyle(fontSize: 13, color: Colors.black87)),
              const SizedBox(width: 8),
              Container(width: 1, height: 12, color: Colors.grey[400]),
              const SizedBox(width: 8),
              Text('Đã bán ${_product?.soldCount.isNotEmpty == true ? _product!.soldCount : "12.8k"}', style: const TextStyle(fontSize: 13, color: Colors.black87)),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: Colors.orange[50], borderRadius: BorderRadius.circular(4)),
            child: const Text('⚡ Hỏa Tốc 2H', style: TextStyle(color: Colors.deepOrange, fontSize: 12)),
          )
        ],
      ),
    );
  }

  Widget _buildVariantsSection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Tùy chọn biến thể', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              Text('Kho: 342 sản phẩm', style: TextStyle(color: Colors.grey, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Màu sắc:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: colors.map((color) {
              final isSelected = selectedColor == color;
              return GestureDetector(
                onTap: () => setState(() => selectedColor = color),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.red[50] : Colors.grey[100],
                    border: Border.all(color: isSelected ? primaryColor : Colors.transparent),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: getColorFromString(color),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.grey[400]!),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(color, style: TextStyle(fontSize: 12, color: isSelected ? primaryColor : Colors.black87)),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          const Text('Kích thước:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: sizes.map((size) {
              final isSelected = selectedSize == size;
              return GestureDetector(
                onTap: () => setState(() => selectedSize = size),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.red[50] : Colors.grey[100],
                    border: Border.all(color: isSelected ? primaryColor : Colors.transparent),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(size, style: TextStyle(fontSize: 12, color: isSelected ? primaryColor : Colors.black87)),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Text('Số lượng:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              const Spacer(),
              Row(
                children: [
                  InkWell(
                    onTap: () {
                      if (quantity > 1) setState(() => quantity--);
                    },
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(border: Border.all(color: Colors.grey[300]!), borderRadius: const BorderRadius.horizontal(left: Radius.circular(4))),
                      child: const Icon(Icons.remove, size: 16, color: Colors.black54),
                    ),
                  ),
                  Container(
                    width: 40,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(border: Border.symmetric(horizontal: BorderSide(color: Colors.grey[300]!))),
                    child: Text('$quantity', style: const TextStyle(fontSize: 14)),
                  ),
                  InkWell(
                    onTap: () => setState(() => quantity++),
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(border: Border.all(color: Colors.grey[300]!), borderRadius: const BorderRadius.horizontal(right: Radius.circular(4))),
                      child: const Icon(Icons.add, size: 16, color: Colors.black54),
                    ),
                  ),
                ],
              )
            ],
          )
        ],
      ),
    );
  }

  Widget _buildShopInfoSection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          Row(
            children: [
              const CircleAvatar(
                radius: 24,
                backgroundColor: Colors.grey,
                child: Icon(Icons.store, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${_product?.shopName.isNotEmpty == true ? _product!.shopName : "Nova Official Store"} [MALL]', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 4),
                    Text('Online 5 phút trước', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                  ],
                ),
              ),
              OutlinedButton(
                onPressed: () {
                  final sId = _product?.shopId;
                  if (sId != null && sId.isNotEmpty) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ShopDetailScreen(
                          shopId: sId,
                          initialShopName: _product?.shopName,
                        ),
                      ),
                    );
                  } else {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ShopScreen()),
                    );
                  }
                },
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: const Size(0, 32),
                ),
                child: const Text('Xem Shop', style: TextStyle(fontSize: 12, color: Colors.black87)),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _toggleFollowShop,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _isFollowing ? Colors.grey.shade300 : primaryColor,
                  foregroundColor: _isFollowing ? Colors.black87 : Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  minimumSize: const Size(0, 32),
                ),
                child: Text(_isFollowing ? '✓ Đã theo dõi' : '+ Theo dõi', style: const TextStyle(fontSize: 12)),
              )
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildShopStat('${_avgRating.toStringAsFixed(1)}/5.0', '($_totalReviews Đánh giá)'),
              _buildShopStat('99%', '(Phản hồi)'),
              _buildShopStat('100%', '(Chính hãng)'),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildShopStat(String title, String subtitle) {
    return Column(
      children: [
        Text(title, style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 4),
        Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 11)),
      ],
    );
  }

  Widget _buildDescriptionSection() {
    final desc = _product?.description.isNotEmpty == true ? _product!.description : 'Chất liệu 100% cotton cao cấp, thấm hút mồ hôi, co giãn 4 chiều.';
    final specs = _product?.specs ?? {};

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Mô tả sản phẩm', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 12),
          Text(desc, style: const TextStyle(fontSize: 13, height: 1.5)),
          if (specs.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Chi tiết thông số', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 8),
            ...specs.entries.map((e) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Text('• ${e.key}: ${e.value}', style: const TextStyle(fontSize: 13, color: Colors.black87)),
            )),
          ],
        ],
      ),
    );
  }

  Widget _buildReviewsSection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(top: 8),
      width: double.infinity,
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
                        style: TextStyle(color: primaryColor, fontSize: 16, fontWeight: FontWeight.bold),
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
                      Text('($_totalReviews đánh giá)', style: const TextStyle(fontSize: 12, color: Colors.grey)),
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
          const Divider(height: 1),
          const SizedBox(height: 12),
          if (_isLoadingReviews)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: CircularProgressIndicator(color: primaryColor, strokeWidth: 2),
              ),
            )
          else if (_reviews.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.rate_review_outlined, size: 40, color: Colors.grey.shade400),
                    const SizedBox(height: 8),
                    const Text('Chưa có đánh giá nào cho sản phẩm này.', style: TextStyle(color: Colors.grey, fontSize: 13)),
                    const SizedBox(height: 4),
                    const Text('Hãy là người đầu tiên trải nghiệm và chia sẻ nhận xét!', style: TextStyle(color: Colors.grey, fontSize: 11)),
                  ],
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _reviews.length > 5 ? 5 : _reviews.length,
              separatorBuilder: (_, __) => const Divider(height: 24),
              itemBuilder: (context, index) {
                final r = _reviews[index];
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
                          backgroundColor: Colors.grey.shade200,
                          backgroundImage: (r.reviewerAvatar != null && r.reviewerAvatar!.isNotEmpty)
                              ? NetworkImage(r.reviewerAvatar!)
                              : null,
                          child: (r.reviewerAvatar == null || r.reviewerAvatar!.isEmpty)
                              ? Text(
                                  r.reviewerName.isNotEmpty ? r.reviewerName[0].toUpperCase() : 'U',
                                  style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13),
                                )
                              : null,
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
                                    children: List.generate(5, (starIdx) {
                                      return Icon(
                                        starIdx < r.rating ? Icons.star : Icons.star_border,
                                        color: Colors.amber,
                                        size: 12,
                                      );
                                    }),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(dateStr, style: const TextStyle(color: Colors.grey, fontSize: 11)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(r.comment, style: const TextStyle(fontSize: 13, height: 1.4)),
                    if (r.images.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 60,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: r.images.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 6),
                          itemBuilder: (_, imgIdx) => ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: Image.network(
                              r.images[imgIdx],
                              width: 60,
                              height: 60,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 60,
                                height: 60,
                                color: Colors.grey.shade200,
                                child: const Icon(Icons.image_not_supported, size: 20, color: Colors.grey),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                    if (r.sellerReply != null && r.sellerReply!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Phản Hồi Từ Người Bán:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black87)),
                            const SizedBox(height: 4),
                            Text(r.sellerReply!, style: TextStyle(fontSize: 12, color: Colors.grey.shade800)),
                          ],
                        ),
                      ),
                    ],
                  ],
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 60,
          child: Row(
            children: [
              Expanded(
                flex: 2,
                child: InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const NovaAIScreen(isStandalone: true),
                      ),
                    );
                  },
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.chat_bubble_outline_rounded, size: 20, color: Color(0xFF555555)),
                      SizedBox(height: 2),
                      Text('Chat Shop', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Color(0xFF555555))),
                    ],
                  ),
                ),
              ),
              Container(width: 0.8, height: 36, color: Colors.grey.shade200),
              Expanded(
                flex: 2,
                child: InkWell(
                  onTap: () async {
                    final p = _product;
                    final pId = widget.productId ?? p?.id ?? '1';
                    final vName = '$selectedColor - $selectedSize';
                    final vId = '${pId}_${selectedColor.replaceAll(RegExp(r'\s+'), '_')}_${selectedSize.replaceAll(RegExp(r'\s+'), '_')}';
                    final sId = (p?.shopId != null && p!.shopId.isNotEmpty) ? p.shopId : '1';
                    final sName = (p?.shopName != null && p!.shopName.isNotEmpty) ? p.shopName : 'ShopNova';
                    final sMall = p?.badges.any((b) => b.toUpperCase().contains('MALL')) == true;
                    final img = (p?.images != null && p!.images.isNotEmpty) ? p.images.first : (p?.imageUrl ?? '');

                    await CartService().addToCart(
                      productId: pId,
                      productName: p?.name ?? 'Sản phẩm ShopNova',
                      productSlug: p?.id ?? pId,
                      variantId: vId,
                      variantName: vName,
                      price: p?.price ?? 180000,
                      originalPrice: p?.originalPrice,
                      qty: quantity,
                      shopId: sId,
                      shopName: sName,
                      shopMall: sMall,
                      imageUrl: img,
                    );
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Đã thêm sản phẩm vào giỏ hàng thành công!'),
                        backgroundColor: Color(0xFF2E7D32),
                        duration: Duration(seconds: 2),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  child: const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_shopping_cart_rounded, size: 20, color: AppColors.primary),
                      SizedBox(height: 2),
                      Text('Thêm giỏ', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
                    ],
                  ),
                ),
              ),
              Expanded(
                flex: 5,
                child: InkWell(
                  onTap: () async {
                    final p = _product;
                    final pId = widget.productId ?? p?.id ?? '1';
                    final vName = '$selectedColor - $selectedSize';
                    final vId = '${pId}_${selectedColor.replaceAll(RegExp(r'\s+'), '_')}_${selectedSize.replaceAll(RegExp(r'\s+'), '_')}';
                    final sId = (p?.shopId != null && p!.shopId.isNotEmpty) ? p.shopId : '1';
                    final sName = (p?.shopName != null && p!.shopName.isNotEmpty) ? p.shopName : 'ShopNova';
                    final sMall = p?.badges.any((b) => b.toUpperCase().contains('MALL')) == true;
                    final img = (p?.images != null && p!.images.isNotEmpty) ? p.images.first : (p?.imageUrl ?? '');

                    await CartService().addToCart(
                      productId: pId,
                      productName: p?.name ?? 'Sản phẩm ShopNova',
                      productSlug: p?.id ?? pId,
                      variantId: vId,
                      variantName: vName,
                      price: p?.price ?? 180000,
                      originalPrice: p?.originalPrice,
                      qty: quantity,
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
                        Text('MUA VỚI VOUCHER', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13.5, letterSpacing: 0.2)),
                        SizedBox(height: 2),
                        Text('Giảm thêm tại bước thanh toán', style: TextStyle(color: Colors.white70, fontSize: 10)),
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
