import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shopnova/models/flash_sale_item.dart';
import 'package:shopnova/screens/product_detail/product_detail_screen.dart';

class FlashSaleItemCard extends StatelessWidget {
  final FlashSaleItem item;

  const FlashSaleItemCard({super.key, required this.item});

  String _formatPrice(double price) {
    final format = NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0);
    return format.format(price);
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ProductDetailScreen(productId: item.id),
            ),
          );
        },
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: 132,
          padding: const EdgeInsets.all(5),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFEEEEEE), width: 0.8),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 5,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Image Thumbnail with Discount Tag
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: double.infinity,
                  height: 122,
                  child: Stack(
                    children: [
                      Container(
                        width: double.infinity,
                        height: double.infinity,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFFFFF0EC), Color(0xFFFFDDD2)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Center(
                          child: item.imageUrl.isNotEmpty && item.imageUrl.startsWith('http')
                              ? Image.network(
                                  item.imageUrl,
                                  fit: BoxFit.cover,
                                  width: double.infinity,
                                  height: double.infinity,
                                  errorBuilder: (_, __, ___) => Center(
                                    child: Text(item.emoji, style: const TextStyle(fontSize: 44)),
                                  ),
                                )
                              : Text(item.emoji, style: const TextStyle(fontSize: 44)),
                        ),
                      ),
                      if (item.discount > 0)
                        Positioned(
                          top: 0,
                          left: 0,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Color(0xFFEE4D2D), Color(0xFFFF5722)],
                              ),
                              borderRadius: BorderRadius.only(
                                bottomRight: Radius.circular(6),
                              ),
                            ),
                            child: Text(
                              '-${item.discount}%',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9.5,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),

              // 2. Price
              Center(
                child: Text(
                  _formatPrice(item.price),
                  style: const TextStyle(
                    color: Color(0xFFEE4D2D),
                    fontWeight: FontWeight.w900,
                    fontSize: 14,
                    letterSpacing: -0.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(height: 5),

              // 3. Fiery Progress Bar
              Stack(
                children: [
                  Container(
                    width: double.infinity,
                    height: 18,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFE0D9),
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  FractionallySizedBox(
                    widthFactor: item.soldPercentage.clamp(0.08, 1.0),
                    child: Container(
                      height: 18,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFEE4D2D), Color(0xFFFF6633)],
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  Positioned.fill(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.local_fire_department, color: Colors.white, size: 12),
                        const SizedBox(width: 2),
                        Text(
                          item.soldLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 9.5,
                            letterSpacing: -0.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
