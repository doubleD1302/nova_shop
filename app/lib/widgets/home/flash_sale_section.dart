import 'package:flutter/material.dart';
import 'package:shopnova/models/flash_sale_item.dart';
import 'package:shopnova/theme/app_colors.dart';
import 'package:shopnova/widgets/home/flash_sale_item_card.dart';
import 'package:shopnova/widgets/home/flash_sale_countdown_widget.dart';
import 'package:shopnova/utils/flash_sale_rotator.dart';
import 'package:shopnova/screens/search/search_screen.dart';

class FlashSaleSection extends StatelessWidget {
  final List<FlashSaleItem> items;

  const FlashSaleSection({super.key, required this.items});

  @override
  Widget build(BuildContext context) {
    final campaign = FlashSaleRotator.getCurrentCampaign();
    final sessionLabel = FlashSaleRotator.getSessionLabel();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Dòng 1: Tiêu đề Flash Sale + Badge sự kiện + Nút Xem tất cả
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.border, width: 0.8),
                    ),
                    child: const Icon(Icons.local_fire_department, color: AppColors.flashSaleRed, size: 18),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'FLASH SALE',
                    style: TextStyle(
                      color: AppColors.flashSaleRed,
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                      letterSpacing: 0.2,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: AppColors.flashSaleRed,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      campaign.badge,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                ],
              ),
              InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const SearchScreen(
                        title: '⚡ Khung Giờ Flash Sale Chớp Nhoáng',
                        filterFlashSale: true,
                      ),
                    ),
                  );
                },
                child: const Text(
                  'Xem tất cả >',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Dòng 2: Đồng hồ đếm ngược thời gian thực + Khung giờ phiên Shopee
          Row(
            children: [
              const FlashSaleCountdownWidget(style: FlashSaleTimerStyle.boxed),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$sessionLabel • ${campaign.title}',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey.shade700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 190,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: items.length,
              separatorBuilder: (context, index) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                return FlashSaleItemCard(item: items[index]);
              },
            ),
          ),
        ],
      ),
    );
  }
}
