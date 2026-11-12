import 'package:flutter/material.dart';
import 'package:shopnova/models/flash_sale_item.dart';
import 'package:shopnova/screens/search/search_screen.dart';
import 'package:shopnova/theme/app_colors.dart';
import 'package:shopnova/utils/flash_sale_rotator.dart';
import 'package:shopnova/widgets/home/flash_sale_countdown_widget.dart';
import 'package:shopnova/widgets/home/flash_sale_item_card.dart';

class FlashSaleSection extends StatelessWidget {
  final List<FlashSaleItem> items;

  const FlashSaleSection({super.key, required this.items});

  @override
  Widget build(BuildContext context) {
    final campaign = FlashSaleRotator.getCurrentCampaign();
    final sessionLabel = FlashSaleRotator.getSessionRangeLabel();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A80513B),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header gradient đồng bộ Website Terracotta + Cream
          Container(
            padding: const EdgeInsets.fromLTRB(12, 11, 12, 10),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFFF5E7D4), Color(0xFFFDF3E8), Color(0xFFFFFCF7)],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              border: Border(bottom: BorderSide(color: AppColors.border, width: 1)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Dòng 1: Icon sét nền Terracotta + FLASH SALE + Badge chiến dịch + Xem tất cả
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x26BD6E49),
                                blurRadius: 4,
                                offset: Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Icon(Icons.bolt_rounded, color: Color(0xFFFCD34D), size: 18),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'FLASH SALE',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w900,
                            fontSize: 15.5,
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.flashSaleRed,
                            borderRadius: BorderRadius.circular(5),
                          ),
                          child: Text(
                            campaign.badge,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9.5,
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
                      borderRadius: BorderRadius.circular(6),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Xem tất cả',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            SizedBox(width: 2),
                            Icon(Icons.chevron_right_rounded, color: AppColors.primary, size: 16),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Dòng 2: Đồng hồ đếm ngược + Khung giờ phiên Flash Sale
                Row(
                  children: [
                    const FlashSaleCountdownWidget(style: FlashSaleTimerStyle.boxed),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '\u2022 $sessionLabel',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
            child: SizedBox(
              height: 242,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: items.length,
                separatorBuilder: (context, index) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  return FlashSaleItemCard(item: items[index]);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
