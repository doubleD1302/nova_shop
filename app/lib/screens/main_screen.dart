import 'package:flutter/material.dart';
import 'package:shopnova/screens/home/home_screen.dart';
import 'package:shopnova/screens/shop/shop_screen.dart';
import 'package:shopnova/screens/cart/cart_screen.dart';
import 'package:shopnova/widgets/common/shopnova_app_bar.dart';
import 'package:shopnova/screens/account/account_screen.dart';
import 'package:shopnova/screens/nova_ai/nova_ai_screen.dart';
import 'package:shopnova/services/cart_service.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentTabIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          if (_currentTabIndex == 0) const ShopNovaAppBar(), // Only show custom appbar on Home screen
          Expanded(
            child: IndexedStack(
              index: _currentTabIndex,
              children: const [
                HomeScreen(),
                ShopScreen(),
                NovaAIScreen(isStandalone: false),
                CartScreen(),
                AccountScreen(),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentTabIndex,
          onTap: (i) => setState(() => _currentTabIndex = i),
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          elevation: 0,
          selectedItemColor: const Color(0xFFEE4D2D),
          unselectedItemColor: const Color(0xFF757575),
          selectedFontSize: 10.5,
          unselectedFontSize: 10.5,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500),
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home),
              label: 'Trang chủ',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.storefront_outlined),
              activeIcon: Icon(Icons.storefront),
              label: 'Gian hàng',
            ),
            BottomNavigationBarItem(
              icon: Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEE4D2D), Color(0xFFFF5722)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFEE4D2D).withValues(alpha: 0.4),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Icon(Icons.auto_awesome, color: Colors.white, size: 20),
              ),
              label: 'Nova AI',
            ),
            BottomNavigationBarItem(
              icon: AnimatedBuilder(
                animation: CartService(),
                builder: (context, _) {
                  final count = CartService().itemCount;
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      const Icon(Icons.shopping_cart_outlined),
                      if (count > 0)
                        Positioned(
                          right: -6,
                          top: -4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEE4D2D),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            constraints: const BoxConstraints(minWidth: 15, minHeight: 15),
                            child: Text(
                              count > 99 ? '99+' : '$count',
                              style: const TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.w900),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
              activeIcon: AnimatedBuilder(
                animation: CartService(),
                builder: (context, _) {
                  final count = CartService().itemCount;
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      const Icon(Icons.shopping_cart),
                      if (count > 0)
                        Positioned(
                          right: -6,
                          top: -4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEE4D2D),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            constraints: const BoxConstraints(minWidth: 15, minHeight: 15),
                            child: Text(
                              count > 99 ? '99+' : '$count',
                              style: const TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.w900),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
              label: 'Giỏ hàng',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person),
              label: 'Tài khoản',
            ),
          ],
        ),
      ),
    );
  }
}
