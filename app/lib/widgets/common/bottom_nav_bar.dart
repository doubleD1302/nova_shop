import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

class ShopNovaBottomNavBar extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTap;

  const ShopNovaBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return BottomNavigationBar(
      type: BottomNavigationBarType.fixed,
      backgroundColor: AppColors.surface,
      selectedItemColor: AppColors.primary,
      unselectedItemColor: AppColors.bottomNavInactive,
      selectedFontSize: 11,
      unselectedFontSize: 11,
      currentIndex: currentIndex,
      onTap: onTap,
      items: const [
        BottomNavigationBarItem(
          icon: Icon(Icons.home),
          label: 'Trang chủ',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.storefront),
          label: 'Gian hàng',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.explore_outlined),
          label: 'Khám phá',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.notifications_none),
          label: 'Thông báo',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.person_outline),
          label: 'Tài khoản',
        ),
      ],
    );
  }
}
