import 'package:flutter/material.dart';
import '../../screens/cart/cart_screen.dart';
import '../../screens/nova_ai/nova_ai_screen.dart';
import '../../services/cart_service.dart';

class ShopNovaAppBar extends StatelessWidget {
  const ShopNovaAppBar({super.key});

  void _showSearchModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        final searchCtrl = TextEditingController();
        return Padding(
          padding: EdgeInsets.only(
            left: 18,
            right: 18,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5F5F7),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: TextField(
                        controller: searchCtrl,
                        autofocus: true,
                        decoration: InputDecoration(
                          hintText: 'Tìm kiếm sản phẩm, thương hiệu...',
                          hintStyle: TextStyle(color: Colors.grey.shade500, fontSize: 13.5),
                          prefixIcon: const Icon(Icons.search, color: Color(0xFFEE4D2D), size: 20),
                          suffixIcon: IconButton(
                            icon: const Icon(Icons.clear, size: 18, color: Colors.grey),
                            onPressed: () => searchCtrl.clear(),
                          ),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        onSubmitted: (query) {
                          if (query.trim().isNotEmpty) {
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Đang tìm kiếm: "$query"'),
                                duration: const Duration(seconds: 1),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        },
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      minimumSize: const Size(40, 36),
                    ),
                    child: const Text('Hủy', style: TextStyle(color: Color(0xFF666666), fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              const Row(
                children: [
                  Icon(Icons.local_fire_department, color: Color(0xFFEE4D2D), size: 18),
                  SizedBox(width: 6),
                  Text(
                    'Từ khóa tìm kiếm phổ biến',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF222222)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  '⚡ Flash Sale',
                  '📱 Tai nghe bluetooth',
                  '👕 Áo thun cotton',
                  '🔋 Sạc nhanh 65W',
                  '👟 Giày sneaker',
                  '🍳 Nồi chiên không dầu',
                  '💻 Bàn phím cơ',
                  '👗 Đầm nữ dạo phố',
                ].map((tag) => InkWell(
                  onTap: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Tìm kiếm: "$tag"'),
                        duration: const Duration(seconds: 1),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5F5F7),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFEEEEEE)),
                    ),
                    child: Text(
                      tag,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF444444), fontWeight: FontWeight.w500),
                    ),
                  ),
                )).toList(),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFFEE4D2D), Color(0xFFFF5224)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x33EE4D2D),
            blurRadius: 8,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 6, 10, 10),
          child: Row(
            children: [
              // Logo
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 4,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.shopping_bag, color: Color(0xFFEE4D2D), size: 20),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'ShopNova',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                      letterSpacing: -0.4,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 10),

              // Capsule Search Field
              Expanded(
                child: InkWell(
                  onTap: () => _showSearchModal(context),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    height: 38,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.08),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: const Row(
                      children: [
                        Icon(Icons.search, color: Color(0xFFEE4D2D), size: 19),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Tìm kiếm trên ShopNova...',
                            style: TextStyle(
                              color: Color(0xFF888888),
                              fontSize: 12.5,
                              fontWeight: FontWeight.w400,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Icon(Icons.camera_alt_outlined, color: Color(0xFF999999), size: 18),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),

              // Cart Button with counter badge
              AnimatedBuilder(
                animation: CartService(),
                builder: (context, _) {
                  final count = CartService().itemCount;
                  return InkWell(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const CartScreen()),
                      );
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      width: 38,
                      height: 38,
                      alignment: Alignment.center,
                      child: Stack(
                        clipBehavior: Clip.none,
                        alignment: Alignment.center,
                        children: [
                          const Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 24),
                          if (count > 0)
                            Positioned(
                              top: -3,
                              right: -4,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(10),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.2),
                                      blurRadius: 3,
                                    ),
                                  ],
                                ),
                                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                                child: Center(
                                  child: Text(
                                    count > 99 ? '99+' : '$count',
                                    style: const TextStyle(
                                      color: Color(0xFFEE4D2D),
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w900,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),

              // Nova AI Copilot Action Icon
              InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NovaAIScreen(isStandalone: true)),
                  );
                },
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      const Icon(Icons.auto_awesome, color: Colors.white, size: 22),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: Color(0xFFFFD54F),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
