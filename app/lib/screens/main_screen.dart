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
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentTabIndex,
        onTap: (i) => setState(() => _currentTabIndex = i),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFFEE4D2D),
        unselectedItemColor: Colors.grey,
        selectedFontSize: 10,
        unselectedFontSize: 10,
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
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFEE4D2D),
                shape: BoxShape.circle,
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
                        right: -5,
                        top: -5,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                          constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                          child: Text(
                            count > 99 ? '99+' : '$count',
                            style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
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
                        right: -5,
                        top: -5,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                          constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                          child: Text(
                            count > 99 ? '99+' : '$count',
                            style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
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
    );
  }
}
