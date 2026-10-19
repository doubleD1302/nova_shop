import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shopnova/models/product.dart';

import 'package:shopnova/screens/product_detail/product_detail_screen.dart';

class ProductCard extends StatelessWidget {
  final Product product;

  const ProductCard({super.key, required this.product});

  String _formatPrice(double price) {
    final format = NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0);
    return format.format(price);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
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
      child: Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1.0,
            child: Stack(
              children: [
                Positioned.fill(
                  child: _buildThumbnail(product),
                ),
                Positioned(
                  top: 0,
                  left: 0,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (product.badges.contains('YÊU THÍCH+'))
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                          decoration: const BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.only(
                              bottomRight: Radius.circular(4),
                              topRight: Radius.circular(4),
                            ),
                          ),
                          child: const Text(
                            'YÊU THÍCH+',
                            style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                      if (product.badges.contains('MALL'))
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                          decoration: const BoxDecoration(
                            color: Colors.redAccent,
                            borderRadius: BorderRadius.only(
                              bottomRight: Radius.circular(4),
                              topRight: Radius.circular(4),
                            ),
                          ),
                          child: const Text(
                            'MALL',
                            style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                      if (product.badges.contains('Freeship Xtra'))
                        Container(
                          margin: const EdgeInsets.only(top: 2),
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                          decoration: const BoxDecoration(
                            color: Colors.green,
                          ),
                          child: const Text(
                            'Freeship Xtra',
                            style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                    ],
                  ),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: InkWell(
                    onTap: () {},
                    child: Container(
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black26,
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.favorite_border,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12),
                ),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      _formatPrice(product.price),
                      style: const TextStyle(
                        color: Colors.red,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(width: 4),
                    if (product.originalPrice > product.price)
                      Expanded(
                        child: Text(
                          _formatPrice(product.originalPrice),
                          style: const TextStyle(
                            color: Colors.grey,
                            decoration: TextDecoration.lineThrough,
                            fontSize: 11,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    if (product.discount > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 1),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(2),
                        ),
                        child: Text(
                          '-${product.discount}%',
                          style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.star, color: Colors.yellow, size: 12),
                    const SizedBox(width: 2),
                    Text(
                      product.rating.toStringAsFixed(1),
                      style: const TextStyle(fontSize: 12),
                    ),
                    const Spacer(),
                    Text(
                      product.soldCount,
                      style: const TextStyle(color: Colors.grey, fontSize: 11),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ));
  }

  Widget _buildThumbnail(Product p) {
    if (p.imageUrl.isNotEmpty && p.imageUrl.startsWith('http')) {
      return Image.network(
        p.imageUrl,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _buildEmojiFallback(p),
      );
    }
    return _buildEmojiFallback(p);
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
