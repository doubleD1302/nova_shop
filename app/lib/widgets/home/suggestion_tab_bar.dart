import 'package:flutter/material.dart';
import 'package:shopnova/theme/app_colors.dart';

class SuggestionTabBar extends StatelessWidget {
  final int selectedIndex;
  final Function(int) onTabChanged;

  const SuggestionTabBar({
    super.key,
    required this.selectedIndex,
    required this.onTabChanged,
  });

  static const List<Map<String, dynamic>> tabs = [
    {'title': 'GỢI Ý HÔM NAY', 'icon': Icons.local_fire_department, 'badge': 'HOT'},
    {'title': 'FREESHIP XTRA', 'icon': Icons.local_shipping_outlined, 'badge': 'FREE'},
    {'title': 'GIẢM GIÁ 50%', 'icon': Icons.percent, 'badge': 'SALE'},
    {'title': 'HÀNG HIỆU OUTLET', 'icon': Icons.verified_outlined, 'badge': 'MALL'},
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(
          bottom: BorderSide(color: AppColors.border, width: 1),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Row(
          children: List.generate(tabs.length, (index) {
            final tab = tabs[index];
            final isSelected = selectedIndex == index;
            return InkWell(
              onTap: () => onTabChanged(index),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          tab['icon'] as IconData,
                          size: 16,
                          color: isSelected ? AppColors.primary : AppColors.textSecondary,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          tab['title'] as String,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                            color: isSelected ? AppColors.primary : AppColors.textSecondary,
                            letterSpacing: -0.2,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 7),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      height: 3,
                      width: isSelected ? 48 : 0,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}
