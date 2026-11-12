import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shopnova/models/flash_sale_item.dart';
import 'package:shopnova/screens/product_detail/product_detail_screen.dart';
import 'package:shopnova/theme/app_colors.dart';

class FlashSaleItemCard extends StatelessWidget {
  final FlashSaleItem item;

  const FlashSaleItemCard({super.key, required this.item});

  String _formatPrice(double price) {
    final format = NumberFormat.currency(locale: 'vi_VN', symbol: '\u20ab', decimalDigits: 0);
    return format.format(price);
  }

  @override
  Widget build(BuildContext context) {
    final hasOriginal = item.originalPrice > item.price;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ProductDetailScreen(
                productId: item.id,
                initialProduct: item.product,
              ),
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 144,
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border, width: 0.9),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A80513B),
                blurRadius: 6,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Ảnh sản phẩm + Badge sét giảm % góc trên trái
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: double.infinity,
                  height: 118,
                  child: Stack(
                    children: [
                      Container(
                        width: double.infinity,
                        height: double.infinity,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceAlt,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: item.effectiveImageUrl.isEmpty
                            ? Center(
                                child: Text(item.emoji, style: const TextStyle(fontSize: 40)),
                              )
                            : Image.network(
                                item.effectiveImageUrl,
                                fit: BoxFit.cover,
                                width: double.infinity,
                                height: double.infinity,
                                loadingBuilder: (context, child, progress) {
                                  if (progress == null) return child;
                                  return Container(
                                    color: AppColors.surfaceAlt,
                                    child: const Center(
                                      child: SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    ),
                                  );
                                },
                                errorBuilder: (_, _, _) => Center(
                                  child: Text(item.emoji, style: const TextStyle(fontSize: 40)),
                                ),
                              ),
                      ),
                      if (item.discount > 0)
                        Positioned(
                          top: 5,
                          left: 5,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [AppColors.flashSaleRed, AppColors.primary],
                              ),
                              borderRadius: BorderRadius.circular(6),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x26000000),
                                  blurRadius: 3,
                                  offset: Offset(0, 1),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.bolt_rounded, color: Color(0xFFFCD34D), size: 11.5),
                                const SizedBox(width: 2),
                                Text(
                                  '-${item.discount}%',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),

              // 2. Tên sản phẩm (tối đa 2 dòng)
              Text(
                item.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 11.5,
                  height: 1.25,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),

              // 3. Giá đã giảm nổi bật & giá gốc gạch ngang
              Text(
                _formatPrice(item.price),
                style: const TextStyle(
                  color: AppColors.flashSaleRed,
                  fontWeight: FontWeight.w900,
                  fontSize: 13.5,
                  letterSpacing: -0.2,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (hasOriginal)
                Text(
                  _formatPrice(item.originalPrice),
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 10.5,
                    decoration: TextDecoration.lineThrough,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              const SizedBox(height: 6),

              // 4. Thanh tiến độ bán hàng đồng bộ Website SoldProgress
              _SoldProgressBar(
                soldPercentage: item.soldPercentage,
                soldLabel: item.soldLabel,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SoldProgressBar extends StatelessWidget {
  final double soldPercentage;
  final String soldLabel;

  const _SoldProgressBar({
    required this.soldPercentage,
    required this.soldLabel,
  });

  @override
  Widget build(BuildContext context) {
    final clamped = soldPercentage.clamp(0.0, 1.0);
    if (clamped <= 0) {
      return Container(
        width: double.infinity,
        height: 20,
        decoration: BoxDecoration(
          color: AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border, width: 0.8),
        ),
        alignment: Alignment.center,
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.bolt_rounded, color: AppColors.primary, size: 12),
            SizedBox(width: 2),
            Text(
              'VỪA MỞ BÁN',
              style: TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w800,
                fontSize: 9.5,
                letterSpacing: 0.2,
              ),
            ),
          ],
        ),
      );
    }

    final Color fgColor = clamped >= 0.5 ? AppColors.surface : AppColors.earth;

    return Container(
      width: double.infinity,
      height: 20,
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        alignment: Alignment.centerLeft,
        children: [
          FractionallySizedBox(
            widthFactor: clamped.clamp(0.12, 1.0),
            child: Container(
              height: double.infinity,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.flashSaleRed],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          Positioned.fill(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.local_fire_department_rounded, color: fgColor, size: 12),
                    const SizedBox(width: 2),
                    Text(
                      soldLabel,
                      style: TextStyle(
                        color: fgColor,
                        fontWeight: FontWeight.w800,
                        fontSize: 9.5,
                        letterSpacing: 0.1,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
