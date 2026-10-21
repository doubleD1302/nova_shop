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
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        final searchCtrl = TextEditingController();
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: searchCtrl,
                      autofocus: true,
                      decoration: InputDecoration(
                        hintText: 'Tìm kiếm trên ShopNova...',
                        prefixIcon: const Icon(Icons.search, color: Color(0xFFEE4D2D)),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () => searchCtrl.clear(),
                        ),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      onSubmitted: (query) {
                        if (query.trim().isNotEmpty) {
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Đang tìm kiếm: "$query"'),
                              duration: const Duration(seconds: 1),
                            ),
                          );
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text('Từ khóa tìm kiếm phổ biến', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  'Áo thun cotton',
                  'Tai nghe bluetooth',
                  'Sạc nhanh 65W',
                  'Giày sneaker',
                  'Ốp lưng iPhone',
                  'Nồi chiên không dầu',
                ].map((tag) => ActionChip(
                  label: Text(tag, style: const TextStyle(fontSize: 11)),
                  onPressed: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Tìm kiếm: "$tag"'), duration: const Duration(seconds: 1)),
                    );
                  },
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
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.shopping_bag, color: Colors.white, size: 22),
                  SizedBox(width: 4),
                  Text(
                    'ShopNova',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                      letterSpacing: -0.3,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),
              Expanded(
                child: InkWell(
                  onTap: () => _showSearchModal(context),
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: const Row(
                      children: [
                        Icon(Icons.search, color: Colors.grey, size: 18),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Tìm kiếm trên ShopNova...',
                            style: TextStyle(color: Colors.grey, fontSize: 13),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 6),
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
                    borderRadius: BorderRadius.circular(18),
                    child: Container(
                      width: 36,
                      height: 36,
                      alignment: Alignment.center,
                      child: Stack(
                        clipBehavior: Clip.none,
                        alignment: Alignment.center,
                        children: [
                          const Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 22),
                          if (count > 0)
                            Positioned(
                              top: -2,
                              right: -4,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                                decoration: const BoxDecoration(
                                  color: Colors.white,
                                  shape: BoxShape.circle,
                                ),
                                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                                child: Center(
                                  child: Text(
                                    count > 99 ? '99+' : '$count',
                                    style: const TextStyle(color: Color(0xFFEE4D2D), fontSize: 9, fontWeight: FontWeight.bold),
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
              const SizedBox(width: 4),
              InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NovaAIScreen(isStandalone: true)),
                  );
                },
                borderRadius: BorderRadius.circular(18),
                child: Container(
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  child: const Icon(Icons.auto_awesome, color: Colors.white, size: 22),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
