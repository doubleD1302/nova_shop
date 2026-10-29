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

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      child: Row(
        children: [
          _buildTab(0, 'GỢI Ý HÔM NAY'),
          _buildTab(1, 'NOVA MALL'),
        ],
      ),
    );
  }

  Widget _buildTab(int index, String title) {
    final isSelected = selectedIndex == index;
    return Expanded(
      child: InkWell(
        onTap: () => onTabChanged(index),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? AppColors.primary : Colors.grey,
                ),
              ),
              const SizedBox(height: 8),
              if (isSelected)
                Container(
                  height: 3,
                  width: 40,
                  color: AppColors.primary,
                )
              else
                const SizedBox(height: 3),
            ],
          ),
        ),
      ),
    );
  }
}
