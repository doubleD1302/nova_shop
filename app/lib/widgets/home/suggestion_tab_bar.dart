import 'package:flutter/material.dart';

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
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(
          bottom: BorderSide(color: Color(0xFFEEEEEE), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
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
                          color: isSelected ? const Color(0xFFEE4D2D) : Colors.grey.shade600,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          tab['title'] as String,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                            color: isSelected ? const Color(0xFFEE4D2D) : const Color(0xFF555555),
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
                        color: const Color(0xFFEE4D2D),
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
