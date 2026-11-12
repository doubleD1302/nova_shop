import 'package:flutter/material.dart';

import '../../screens/account/notifications_screen.dart';
import '../../screens/cart/cart_screen.dart';
import '../../screens/chat/chat_list_screen.dart';
import '../../screens/nova_ai/nova_ai_screen.dart';
import '../../screens/search/search_screen.dart';
import '../../services/cart_service.dart';
import '../../services/notification_service.dart';
import '../../theme/app_colors.dart';
import 'nova_logo.dart';
import 'nova_assets.dart';

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
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                        ),
                        decoration: InputDecoration(
                          hintText: 'Tìm kiếm sản phẩm, thương hiệu...',
                          hintStyle: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13.5,
                          ),
                          prefixIcon: const Icon(
                            Icons.search,
                            color: AppColors.primary,
                            size: 20,
                          ),
                          suffixIcon: IconButton(
                            icon: const Icon(
                              Icons.clear,
                              size: 18,
                              color: AppColors.textSecondary,
                            ),
                            onPressed: () => searchCtrl.clear(),
                          ),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                        ),
                        onSubmitted: (query) {
                          if (query.trim().isNotEmpty) {
                            Navigator.pop(ctx);
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    SearchScreen(initialQuery: query.trim()),
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
                          MaterialPageRoute(
                            builder: (_) => SearchScreen(initialQuery: q),
                          ),
                        );
                      }
                    },
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
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
                children:
                    const <String, IconData>{
                      'Flash Sale': Icons.bolt_outlined,
                      'Thời trang nữ': Icons.checkroom_outlined,
                      'Thời trang nam': Icons.checkroom_outlined,
                      'Điện thoại': Icons.phone_android_outlined,
                      'Laptop': Icons.laptop_outlined,
                      'Mỹ phẩm': Icons.spa_outlined,
                      'Giày sneaker': Icons.directions_walk_outlined,
                      'Túi xách': Icons.shopping_bag_outlined,
                    }.entries.map((topic) {
                      final tag = topic.key;
                      return ActionChip(
                        avatar: Icon(
                          topic.value,
                          size: 16,
                          color: AppColors.earth,
                        ),
                        backgroundColor: AppColors.surfaceAlt,
                        side: const BorderSide(color: AppColors.border),
                        label: Text(
                          tag,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          final q = tag;
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => SearchScreen(initialQuery: q),
                            ),
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
        border: Border(bottom: BorderSide(color: AppColors.border, width: 1)),
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
              NovaLogo(
                size: 32,
                fontSize: 19,
                onTap: () {
                  Navigator.popUntil(context, (r) => r.isFirst);
                },
              ),
              const SizedBox(width: 8),

              // Capsule Search Field
              Expanded(
                child: InkWell(
                  onTap: () => _showSearchModal(context),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: const Row(
                      children: [
                        Icon(Icons.search, color: AppColors.primary, size: 18),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Tìm kiếm trên NovaShop...',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
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
              const SizedBox(width: 6),

              Tooltip(
                message: 'Hỏi Nova',
                child: InkWell(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const NovaAIScreen(isStandalone: true),
                    ),
                  ),
                  borderRadius: BorderRadius.circular(10),
                  child: const SizedBox(
                    width: 40,
                    height: 40,
                    child: Center(child: NovaMark(size: 26)),
                  ),
                ),
              ),
              const SizedBox(width: 4),

              // Hộp thư Thông báo
              ValueListenableBuilder<int>(
                valueListenable: NotificationService().unreadCountNotifier,
                builder: (context, unread, _) {
                  return InkWell(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const NotificationsScreen(),
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: SizedBox(
                      width: 34,
                      height: 34,
                      child: Stack(
                        clipBehavior: Clip.none,
                        alignment: Alignment.center,
                        children: [
                          const Icon(
                            Icons.notifications_none_rounded,
                            color: AppColors.textPrimary,
                            size: 22,
                          ),
                          if (unread > 0)
                            Positioned(
                              top: 2,
                              right: 1,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 3,
                                  vertical: 1,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFD0011B),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 1,
                                  ),
                                ),
                                constraints: const BoxConstraints(
                                  minWidth: 15,
                                  minHeight: 15,
                                ),
                                child: Text(
                                  unread > 99 ? '99+' : '$unread',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 8.5,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(width: 2),

              // Tin nhắn Shop (Live Chat)
              InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ChatListScreen()),
                  );
                },
                borderRadius: BorderRadius.circular(20),
                child: const SizedBox(
                  width: 34,
                  height: 34,
                  child: Icon(
                    Icons.chat_bubble_outline_rounded,
                    color: AppColors.textPrimary,
                    size: 20,
                  ),
                ),
              ),
              const SizedBox(width: 2),

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
                      width: 34,
                      height: 34,
                      child: Stack(
                        clipBehavior: Clip.none,
                        alignment: Alignment.center,
                        children: [
                          const Icon(
                            Icons.shopping_cart_outlined,
                            color: AppColors.textPrimary,
                            size: 22,
                          ),
                          if (count > 0)
                            Positioned(
                              top: 2,
                              right: 1,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                  vertical: 1,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 1.5,
                                  ),
                                ),
                                constraints: const BoxConstraints(
                                  minWidth: 17,
                                  minHeight: 17,
                                ),
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
