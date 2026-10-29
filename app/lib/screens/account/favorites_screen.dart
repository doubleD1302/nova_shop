import 'package:flutter/material.dart';
import '../../models/product.dart';
import '../../services/favorite_service.dart';
import '../product_detail/product_detail_screen.dart';

/// Màn hình Danh Sách Sản Phẩm Yêu Thích (Kết nối trực tiếp Backend API)
class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  final Color primaryColor = const Color(0xFFEE4D2D);
  final FavoriteService _favoriteService = FavoriteService();

  List<Product> _favorites = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadFavorites();
  }

  Future<void> _loadFavorites() async {
    setState(() => _isLoading = true);
    try {
      final list = await _favoriteService.getFavorites();
      if (mounted) {
        setState(() {
          _favorites = list;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _remove(Product product) async {
    final success = await _favoriteService.removeFavorite(product.id);
    if (success && mounted) {
      setState(() {
        _favorites.removeWhere((p) => p.id == product.id);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đã bỏ "${product.name}" khỏi danh sách yêu thích.'),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  String _formatVND(num amount) {
    final str = amount.round().toString();
    final reg = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return '${str.replaceAllMapped(reg, (Match m) => '${m[1]}.')}₫';
  }

  @override
  Widget build(BuildContext context) {
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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E2022), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Sản Phẩm Yêu Thích (${_favorites.length})',
          style: const TextStyle(color: Color(0xFF1E2022), fontWeight: FontWeight.w700, fontSize: 17),
        ),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator(color: primaryColor))
          : _favorites.isEmpty
              ? _buildEmptyState()
              : RefreshIndicator(
                  onRefresh: _loadFavorites,
                  color: primaryColor,
                  child: GridView.builder(
                    padding: const EdgeInsets.all(12),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      childAspectRatio: 0.62,
                    ),
                    itemCount: _favorites.length,
                    itemBuilder: (ctx, index) {
                      final p = _favorites[index];
                      return _buildProductCard(p);
                    },
                  ),
                ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 90,
              height: 90,
              decoration: const BoxDecoration(color: Color(0xFFFFF0EC), shape: BoxShape.circle),
              child: const Icon(Icons.favorite_border_rounded, size: 48, color: Color(0xFFEE4D2D)),
            ),
            const SizedBox(height: 18),
            const Text(
              'Chưa có sản phẩm yêu thích nào',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
            ),
            const SizedBox(height: 8),
            const Text(
              'Nhấn biểu tượng trái tim khi xem sản phẩm để lưu lại vào bộ sưu tập của bạn!',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFF8F90A6), height: 1.4),
            ),
            const SizedBox(height: 24),
            Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFEE4D2D), Color(0xFFFF5224)],
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Khám phá ngay', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductCard(Product product) {
    return InkWell(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ProductDetailScreen(productId: product.id, initialProduct: product),
          ),
        ).then((_) => _loadFavorites());
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFEEEEF0)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x06000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Ảnh sản phẩm + Nút xóa yêu thích
            Expanded(
              flex: 5,
              child: Stack(
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(11)),
                    child: Container(
                      width: double.infinity,
                      height: double.infinity,
                      color: const Color(0xFFF7F7F8),
                      child: product.imageUrl.isNotEmpty
                          ? Image.network(
                              product.imageUrl,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => _buildPlaceholderImage(),
                            )
                          : _buildPlaceholderImage(),
                    ),
                  ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: InkWell(
                      onTap: () => _remove(product),
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.92),
                          shape: BoxShape.circle,
                          boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 4)],
                        ),
                        child: const Icon(Icons.favorite_rounded, color: Color(0xFFEE4D2D), size: 18),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              flex: 4,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, height: 1.25, color: Color(0xFF1E2022)),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _formatVND(product.price),
                          style: TextStyle(
                            color: primaryColor,
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.star_rounded, size: 14, color: Color(0xFFFFB800)),
                            const SizedBox(width: 2),
                            Text(
                              product.rating.toStringAsFixed(1),
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
                            ),
                            const Spacer(),
                            Text(
                              product.soldCount,
                              style: const TextStyle(fontSize: 11, color: Color(0xFF8F90A6)),
                            ),
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

  Widget _buildPlaceholderImage() {
    return Container(
      color: const Color(0xFFF7F7F8),
      alignment: Alignment.center,
      child: const Icon(Icons.image_outlined, size: 36, color: Color(0xFF8F90A6)),
    );
  }
}
