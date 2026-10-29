import 'package:flutter/material.dart';
import '../../data/website_data.dart';
import '../../theme/app_colors.dart';

class QuickLinksSection extends StatelessWidget {
  final Function(String link)? onLinkTap;

  const QuickLinksSection({super.key, this.onLinkTap});

  @override
  Widget build(BuildContext context) {
    final items = WebsiteData.quickLinks;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border, width: 0.8),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0680513B),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 4,
          childAspectRatio: 0.88,
          mainAxisSpacing: 12,
          crossAxisSpacing: 6,
        ),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          return InkWell(
            onTap: () {
              if (onLinkTap != null) {
                onLinkTap!(item.link);
              }
            },
            borderRadius: BorderRadius.circular(12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border, width: 0.5),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x0680513B),
                        blurRadius: 6,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      item.emoji,
                      style: const TextStyle(fontSize: 22),
                    ),
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  item.label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                    height: 1.15,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
