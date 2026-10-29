import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shopnova/models/product.dart';
import 'package:shopnova/screens/product_detail/product_detail_screen.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/services/favorite_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/product_image_resolver.dart';

class ProductCard extends StatefulWidget {
  final Product product;

  const ProductCard({super.key, required this.product});

  @override
  State<ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<ProductCard> {
  bool _isFavorite = false;

  @override
  void initState() {
    super.initState();
    _isFavorite = widget.product.isFavorite;
  }

  String _formatPrice(double price) {
    final format = NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0);
    return format.format(price);
  }

  void _toggleFavorite() async {
    if (!AuthService().isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng đăng nhập để lưu sản phẩm yêu thích.'),
          duration: Duration(seconds: 1),
        ),
      );
      return;
    }

    final nextStatus = !_isFavorite;
    setState(() => _isFavorite = nextStatus);
    await FavoriteService().toggleFavorite(widget.product.id, !nextStatus);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(nextStatus ? 'Đã thêm vào danh sách yêu thích' : 'Đã bỏ khỏi danh sách yêu thích'),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ProductDetailScreen(
                productId: product.id,
                initialProduct: product,
              ),
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        splashColor: AppColors.primary.withValues(alpha: 0.1),
        highlightColor: AppColors.primary.withValues(alpha: 0.05),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border, width: 0.8),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0880513B),
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Thumbnail + Badges + Discount Tag + Heart
              AspectRatio(
                aspectRatio: 1.0,
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: _buildThumbnail(product),
                    ),

                    // Left Badges (MALL / YÊU THÍCH+ / Freeship)
                    Positioned(
                      top: 6,
                      left: 0,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (product.badges.contains('MALL'))
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [Color(0xFFD0011B), Color(0xFFA80012)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.only(
                                  topRight: Radius.circular(4),
                                  bottomRight: Radius.circular(4),
                                ),
                              ),
                              child: const Text(
                                'MALL',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          if (product.badges.contains('YÊU THÍCH+') && !product.badges.contains('MALL'))
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [Color(0xFFEE4D2D), Color(0xFFFF5722)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.only(
                                  topRight: Radius.circular(4),
                                  bottomRight: Radius.circular(4),
                                ),
                              ),
                              child: const Text(
                                'YÊU THÍCH+',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          if (product.badges.any((b) => b.toLowerCase().contains('freeship')))
                            Container(
                              margin: const EdgeInsets.only(top: 3),
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF00BFA5),
                                borderRadius: const BorderRadius.only(
                                  topRight: Radius.circular(4),
                                  bottomRight: Radius.circular(4),
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.1),
                                    blurRadius: 3,
                                  ),
                                ],
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.local_shipping, color: Colors.white, size: 10),
                                  SizedBox(width: 2),
                                  Text(
                                    'Freeship Xtra',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 8.5,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),

                    // Top-Right Discount Ribbon Tag
                    if (product.discount > 0)
                      Positioned(
                        top: 0,
                        right: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 4),
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Color(0xFFFFEE22), Color(0xFFFFCC00)],
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                            ),
                            borderRadius: BorderRadius.only(
                              bottomLeft: Radius.circular(4),
                              bottomRight: Radius.circular(4),
                            ),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '-${product.discount}%',
                                style: const TextStyle(
                                  color: Color(0xFFEE4D2D),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const Text(
                                'GIẢM',
                                style: TextStyle(
                                  color: Color(0xFFEE4D2D),
                                  fontSize: 7.5,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                    // Favorite Button Floating
                    Positioned(
                      top: product.discount > 0 ? 36 : 6,
                      right: 6,
                      child: GestureDetector(
                        onTap: _toggleFavorite,
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.85),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.12),
                                blurRadius: 4,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: Icon(
                            _isFavorite ? Icons.favorite : Icons.favorite_border,
                            color: _isFavorite ? const Color(0xFFEE4D2D) : Colors.black45,
                            size: 16,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // 2. Body Details
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 8, 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Product Title (2 lines)
                      Text(
                        product.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12.5,
                          height: 1.25,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),

                      // Price & Discount Line
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                _formatPrice(product.price),
                                style: const TextStyle(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14.5,
                                  letterSpacing: -0.2,
                                ),
                              ),
                            ],
                          ),
                          if (product.originalPrice > product.price)
                            Text(
                              _formatPrice(product.originalPrice),
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                decoration: TextDecoration.lineThrough,
                                fontSize: 10.5,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),

                      // Rating & Sold & Location Line
                      Row(
                        children: [
                          const Icon(Icons.star_rounded, color: AppColors.starYellow, size: 14),
                          const SizedBox(width: 2),
                          Text(
                            product.rating.toStringAsFixed(1),
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            product.soldCount.isNotEmpty ? product.soldCount : 'Đã bán 0',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 10.5,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            product.location.isNotEmpty ? product.location.replaceAll('TP. ', '') : 'HCM',
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 10,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
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
      ),
    );
  }

  Widget _buildThumbnail(Product p) {
    final imgUrl = p.effectiveImageUrl;
    return Image.network(
      imgUrl,
      fit: BoxFit.cover,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return Container(
          color: const Color(0xFFF9F9FA),
          child: Center(
            child: SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                value: progress.expectedTotalBytes != null
                    ? progress.cumulativeBytesLoaded / progress.expectedTotalBytes!
                    : null,
                color: const Color(0xFFEE4D2D),
              ),
            ),
          ),
        );
      },
      errorBuilder: (_, __, ___) => _buildFallbackImage(p),
    );
  }

  Widget _buildFallbackImage(Product p) {
    final fallbackUrl = ProductImageResolver.resolve(categoryId: p.categoryId, name: p.name);
    return Image.network(
      fallbackUrl,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => _buildEmojiFallback(p),
    );
  }

  Widget _buildEmojiFallback(Product p) {
    final Map<String, List<Color>> categoryPalette = {
      'thoi-trang-nam': [const Color(0xFFDBEAFE), const Color(0xFFBFDBFE)],
      'thoi-trang-nu': [const Color(0xFFFCE7F3), const Color(0xFFFBCFE8)],
      'dien-thoai': [const Color(0xFFE0E7FF), const Color(0xFFC7D2FE)],
      'may-tinh': [const Color(0xFFE2E8F0), const Color(0xFFCBD5E1)],
      'thiet-bi-gia-dung': [const Color(0xFFCFFAFE), const Color(0xFFA5F3FC)],
      'sac-dep': [const Color(0xFFFFE4E6), const Color(0xFFFECDD3)],
      'nha-cua': [const Color(0xFFDCFCE7), const Color(0xFFBBF7D0)],
      'me-be': [const Color(0xFFFEF3C7), const Color(0xFFFDE68A)],
      'bach-hoa': [const Color(0xFFECFCCB), const Color(0xFFD9F99D)],
      'the-thao': [const Color(0xFFFFEDD5), const Color(0xFFFED7AA)],
      'o-to-xe-may': [const Color(0xFFE5E7EB), const Color(0xFFD1D5DB)],
      'may-anh': [const Color(0xFFEDE9FE), const Color(0xFFDDD6FE)],
    };

    final colors = categoryPalette[p.categoryId] ?? [const Color(0xFFFFF0ED), const Color(0xFFFFDDD6)];

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: colors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Text(
          p.emoji.isNotEmpty ? p.emoji : '🛍️',
          style: const TextStyle(fontSize: 48),
        ),
      ),
    );
  }
}
