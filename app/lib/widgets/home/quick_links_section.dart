import 'package:flutter/material.dart';
import '../../data/website_data.dart';

class QuickLinksSection extends StatelessWidget {
  final Function(String link)? onLinkTap;

  const QuickLinksSection({super.key, this.onLinkTap});

  @override
  Widget build(BuildContext context) {
    final items = WebsiteData.quickLinks;

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
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
                    color: item.backgroundColor,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      item.emoji,
                      style: const TextStyle(fontSize: 24),
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
                    color: Color(0xFF333333),
                    height: 1.18,
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
