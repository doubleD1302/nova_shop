import 'package:flutter/material.dart';
import '../../screens/cart/cart_screen.dart';
import '../../screens/nova_ai/nova_ai_screen.dart';
import '../../screens/search/search_screen.dart';
import '../../services/cart_service.dart';
import '../../theme/app_colors.dart';

class ShopNovaAppBar extends StatelessWidget {
  const ShopNovaAppBar({super.key});

  void _showSearchModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
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
                    color: AppColors.border,
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
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: TextField(
                        controller: searchCtrl,
                        autofocus: true,
                        textInputAction: TextInputAction.search,
                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Tìm kiếm sản phẩm, thương hiệu...',
                          hintStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 13.5),
                          prefixIcon: const Icon(Icons.search, color: AppColors.primary, size: 20),
                          suffixIcon: IconButton(
                            icon: const Icon(Icons.clear, size: 18, color: AppColors.textSecondary),
                            onPressed: () => searchCtrl.clear(),
                          ),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        onSubmitted: (query) {
                          if (query.trim().isNotEmpty) {
                            Navigator.pop(ctx);
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => SearchScreen(initialQuery: query.trim()),
                              ),
                            );
                          }
                        },
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  TextButton(
                    onPressed: () {
                      final q = searchCtrl.text.trim();
                      if (q.isNotEmpty) {
                        Navigator.pop(ctx);
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => SearchScreen(initialQuery: q)),
                        );
                      }
                    },
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    child: const Text('Tìm'),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Text(
                'Tìm kiếm phổ biến',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  '⚡ Flash Sale',
                  '👗 Thời trang nữ',
                  '👔 Thời trang nam',
                  '📱 Điện thoại',
                  '💻 Laptop',
                  '💄 Mỹ phẩm',
                  '👟 Giày sneaker',
                  '👜 Túi xách',
                ].map((tag) {
                  return ActionChip(
                    backgroundColor: AppColors.surfaceAlt,
                    side: const BorderSide(color: AppColors.border),
                    label: Text(tag, style: const TextStyle(fontSize: 12, color: AppColors.textPrimary)),
                    onPressed: () {
                      Navigator.pop(ctx);
                      final q = tag.replaceFirst(RegExp(r'^[^\s]+\s+'), '');
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => SearchScreen(initialQuery: q)),
                      );
                    },
                  );
                }).toList(),
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
        color: AppColors.surface,
        border: Border(
          bottom: BorderSide(color: AppColors.border, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x0A80513B),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 8, 12, 10),
          child: Row(
            children: [
              // Logo NovaShop chuẩn Terracotta
              InkWell(
                onTap: () {
                  Navigator.popUntil(context, (r) => r.isFirst);
                },
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: const Center(
                        child: Icon(Icons.storefront_rounded, color: AppColors.primary, size: 20),
                      ),
                    ),
                    const SizedBox(width: 7),
                    RichText(
                      text: const TextSpan(
                        children: [
                          TextSpan(
                            text: 'Nova',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w900,
                              fontSize: 19,
                              letterSpacing: -0.4,
                            ),
                          ),
                          TextSpan(
                            text: 'Shop',
                            style: TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w900,
                              fontSize: 19,
                              letterSpacing: -0.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),

              // Capsule Search Field
              Expanded(
                child: InkWell(
                  onTap: () => _showSearchModal(context),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    height: 38,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: const Row(
                      children: [
                        Icon(Icons.search, color: AppColors.primary, size: 19),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Tìm kiếm trên NovaShop...',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12.5,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Nút Nova AI Copilot
              InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NovaAIScreen()),
                  );
                },
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Center(
                    child: Icon(Icons.auto_awesome_rounded, color: AppColors.primary, size: 20),
                  ),
                ),
              ),
              const SizedBox(width: 8),

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
                    child: SizedBox(
                      width: 38,
                      height: 38,
                      child: Stack(
                        clipBehavior: Clip.none,
                        alignment: Alignment.center,
                        children: [
                          const Icon(Icons.shopping_cart_outlined, color: AppColors.textPrimary, size: 24),
                          if (count > 0)
                            Positioned(
                              top: 2,
                              right: 1,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: Colors.white, width: 1.5),
                                ),
                                constraints: const BoxConstraints(minWidth: 17, minHeight: 17),
                                child: Center(
                                  child: Text(
                                    count > 99 ? '99+' : '$count',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
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
            ],
          ),
        ),
      ),
    );
  }
}
