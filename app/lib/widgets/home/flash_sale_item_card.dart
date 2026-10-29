import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shopnova/models/flash_sale_item.dart';
import 'package:shopnova/theme/app_colors.dart';

class FlashSaleItemCard extends StatelessWidget {
  final FlashSaleItem item;

  const FlashSaleItemCard({super.key, required this.item});

  String _formatPrice(double price) {
    final format = NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0);
    return format.format(price);
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 130,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              Container(
                width: 130,
                height: 130,
                decoration: BoxDecoration(
                  color: Colors.grey[200],
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              if (item.discount > 0)
                Positioned(
                  top: 0,
                  left: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    decoration: const BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.only(
                        bottomRight: Radius.circular(4),
                        topLeft: Radius.circular(4),
                      ),
                    ),
                    child: Text(
                      '-${item.discount}%',
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Center(
            child: Text(
              _formatPrice(item.price),
              style: const TextStyle(
                color: Colors.red,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Stack(
            children: [
              Container(
                width: double.infinity,
                height: 18,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFE0E0),
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
              Container(
                width: 130 * item.soldPercentage,
                height: 18,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.primary, Colors.red[800] ?? Colors.red],
                  ),
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
              Positioned.fill(
                child: Center(
                  child: Text(
                    item.soldLabel,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 10,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
