import 'package:flutter/material.dart';

class ShopNovaAppBar extends StatelessWidget {
  const ShopNovaAppBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFFEE4D2D), Color(0xFFFF6633)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              const Row(
                children: [
                  Icon(Icons.shopping_bag, color: Colors.white, size: 24),
                  SizedBox(width: 4),
                  Text(
                    'ShopNova',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 20,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: const Row(
                    children: [
                      Icon(Icons.search, color: Colors.grey, size: 18),
                      SizedBox(width: 4),
                      Text(
                        'Trang Chủ',
                        style: TextStyle(color: Colors.grey, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 24),
                  Positioned(
                    top: -4,
                    right: -4,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        color: Colors.red,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 14,
                        minHeight: 14,
                      ),
                      child: const Center(
                        child: Text(
                          '5',
                          style: TextStyle(color: Colors.white, fontSize: 10),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chat_bubble_outline, color: Colors.white, size: 24),
            ],
          ),
        ),
      ),
    );
  }
}
