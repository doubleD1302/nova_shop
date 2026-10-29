import 'package:flutter/material.dart';
import '../../models/cart_item.dart';
import '../../services/cart_service.dart';
import '../../theme/app_colors.dart';
import '../checkout/checkout_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final Color primaryColor = AppColors.primary;
  final CartService _cartService = CartService();

  @override
  void initState() {
    super.initState();
    _cartService.fetchCart();
  }

  String _formatVND(num amount) {
    final str = amount.round().toString();
    final reg = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return '${str.replaceAllMapped(reg, (Match m) => '${m[1]}.')}₫';
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _cartService,
      builder: (context, _) {
        final items = _cartService.items;
        final selectedItems = items.where((i) => i.selected).toList();
        final allSelected = items.isNotEmpty && items.every((i) => i.selected);

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            backgroundColor: AppColors.surface,
            elevation: 0,
            surfaceTintColor: Colors.transparent,
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(1),
              child: Container(color: AppColors.border, height: 1),
            ),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
              onPressed: () => Navigator.maybePop(context),
            ),
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border, width: 0.8),
                  ),
                  child: const Icon(Icons.shopping_bag_rounded, color: AppColors.primary, size: 20),
                ),
                const SizedBox(width: 8),
                Text(
                  'Giỏ hàng (${items.length})',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 18,
                  ),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh_rounded, color: Color(0xFF555770)),
                tooltip: 'Làm mới giỏ hàng',
                onPressed: () => _cartService.fetchCart(),
              ),
              IconButton(
                icon: const Icon(Icons.delete_sweep_outlined, color: Color(0xFF555770)),
                tooltip: 'Xóa các mục đã chọn',
                onPressed: selectedItems.isEmpty
                    ? null
                    : () {
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            title: const Text('Xác nhận xóa', style: TextStyle(fontWeight: FontWeight.bold)),
                            content: Text('Xóa ${selectedItems.length} sản phẩm đã chọn khỏi giỏ hàng?'),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx),
                                child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
                              ),
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: primaryColor,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                onPressed: () {
                                  Navigator.pop(ctx);
                                  for (final it in selectedItems) {
                                    _cartService.removeFromCart(it.variantId);
                                  }
                                },
                                child: const Text('Xóa', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ),
                        );
                      },
              ),
              const SizedBox(width: 4),
            ],
          ),
          body: items.isEmpty
              ? _buildEmptyCart()
              : Column(
                  children: [
                    _buildFreeshipBanner(),
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: () => _cartService.fetchCart(),
                        color: primaryColor,
                        child: ListView(
                          padding: const EdgeInsets.only(top: 8, bottom: 20),
                          children: [
                            ..._buildShopGroups(items),
                          ],
                        ),
                      ),
                    ),
                    _buildBottomBar(allSelected, selectedItems),
                  ],
                ),
        );
      },
    );
  }

  Widget _buildEmptyCart() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                gradient: const RadialGradient(
                  colors: [Color(0xFFFFECE5), Color(0xFFFFF7F4)],
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: primaryColor.withOpacity(0.12),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: const Icon(Icons.remove_shopping_cart_rounded, size: 54, color: Color(0xFFEE4D2D)),
            ),
            const SizedBox(height: 24),
            const Text(
              'Giỏ hàng của bạn đang trống',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
            ),
            const SizedBox(height: 8),
            const Text(
              'Hãy khám phá hàng ngàn sản phẩm ưu đãi hấp dẫn trên ShopNova ngay hôm nay!',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF8F90A6), fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 28),
            Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFEE4D2D), Color(0xFFFF5224)],
                ),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: primaryColor.withOpacity(0.28),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: () => Navigator.maybePop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Khám phá ngay', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFreeshipBanner() {
    final subtotal = _cartService.subtotal;
    const target = 1000000.0;
    final progress = (subtotal / target).clamp(0.0, 1.0);
    final remaining = (target - subtotal).clamp(0.0, target);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF0EC),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.local_shipping_rounded, color: Color(0xFFEE4D2D), size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: const TextStyle(color: Color(0xFF28293D), fontSize: 13),
                    children: [
                      if (remaining > 0) ...[
                        const TextSpan(text: 'Mua thêm '),
                        TextSpan(
                          text: _formatVND(remaining),
                          style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold),
                        ),
                        const TextSpan(text: ' để nhận '),
                        const TextSpan(
                          text: 'Freeship Xtra',
                          style: TextStyle(color: Color(0xFF00BFA5), fontWeight: FontWeight.bold),
                        ),
                      ] else ...[
                        const TextSpan(
                          text: '🎉 Chúc mừng! Đơn hàng được Miễn Phí Vận Chuyển',
                          style: TextStyle(color: Color(0xFF00BFA5), fontWeight: FontWeight.bold),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 6,
                    backgroundColor: const Color(0xFFF2F2F5),
                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFEE4D2D)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildShopGroups(List<CartItemModel> items) {
    final Map<String, List<CartItemModel>> shopMap = {};
    for (final it in items) {
      shopMap.putIfAbsent(it.shopName, () => []).add(it);
    }

    return shopMap.entries.map((entry) {
      final shopName = entry.key;
      final shopItems = entry.value;
      final isMall = shopItems.first.shopMall;
      final allShopSelected = shopItems.every((i) => i.selected);

      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFEEEEF0)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x06000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Shop Header
            Row(
              children: [
                SizedBox(
                  width: 24,
                  height: 24,
                  child: Checkbox(
                    value: allShopSelected,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                    onChanged: (val) {
                      final target = val ?? false;
                      for (final item in shopItems) {
                        if (item.selected != target) {
                          _cartService.toggleSelect(item.variantId);
                        }
                      }
                    },
                    activeColor: primaryColor,
                  ),
                ),
                const SizedBox(width: 10),
                if (isMall) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD0011B),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'MALL',
                      style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 6),
                ] else ...[
                  const Icon(Icons.storefront_rounded, size: 18, color: Color(0xFFEE4D2D)),
                  const SizedBox(width: 6),
                ],
                Expanded(
                  child: Text(
                    shopName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: Color(0xFF1E2022),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: Color(0xFF8F90A6), size: 20),
              ],
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Divider(height: 1, color: Color(0xFFEEEEF0)),
            ),
            // Shop Items
            ...shopItems.map((item) => _buildCartItemRow(item)),
          ],
        ),
      );
    }).toList();
  }

  Widget _buildCartItemRow(CartItemModel item) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 24,
            height: 24,
            child: Checkbox(
              value: item.selected,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
              onChanged: (_) => _cartService.toggleSelect(item.variantId),
              activeColor: primaryColor,
            ),
          ),
          const SizedBox(width: 8),
          // Product Image with soft border
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFEEEEF0)),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: 78,
                height: 78,
                color: const Color(0xFFF7F7F8),
                child: item.imageUrl.isNotEmpty
                    ? Image.network(
                        item.imageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(Icons.image_outlined, color: Colors.grey),
                      )
                    : const Icon(Icons.image_outlined, color: Colors.grey),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        item.productName,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          height: 1.3,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E2022),
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF8F90A6)),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () => _cartService.removeFromCart(item.variantId),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F5F7),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'Phân loại: ${item.variantName}',
                    style: const TextStyle(color: Color(0xFF555770), fontSize: 11, fontWeight: FontWeight.w500),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          _formatVND(item.price),
                          style: TextStyle(
                            color: primaryColor,
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                          ),
                        ),
                        if (item.originalPrice != null && item.originalPrice! > item.price) ...[
                          const SizedBox(width: 6),
                          Text(
                            _formatVND(item.originalPrice!),
                            style: const TextStyle(
                              color: Color(0xFF8F90A6),
                              decoration: TextDecoration.lineThrough,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ],
                    ),
                    // Quantity Stepper
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFFF7F7F8),
                        border: Border.all(color: const Color(0xFFE2E2E6)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          InkWell(
                            borderRadius: const BorderRadius.horizontal(left: Radius.circular(7)),
                            onTap: () => _cartService.updateQty(item.variantId, item.qty - 1),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              child: Icon(Icons.remove_rounded, size: 14, color: Color(0xFF28293D)),
                            ),
                          ),
                          Container(
                            constraints: const BoxConstraints(minWidth: 28),
                            alignment: Alignment.center,
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: Text(
                              '${item.qty}',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E2022)),
                            ),
                          ),
                          InkWell(
                            borderRadius: const BorderRadius.horizontal(right: Radius.circular(7)),
                            onTap: () => _cartService.updateQty(item.variantId, item.qty + 1),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              child: Icon(Icons.add_rounded, size: 14, color: Color(0xFF28293D)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(bool allSelected, List<CartItemModel> selectedItems) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Color(0x0C000000),
            offset: Offset(0, -4),
            blurRadius: 12,
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              Row(
                children: [
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: Checkbox(
                      value: allSelected,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                      onChanged: (val) => _cartService.toggleSelectAll(val ?? false),
                      activeColor: primaryColor,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text('Tất cả', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF28293D))),
                ],
              ),
              const Spacer(),
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    children: [
                      const Text('Tổng: ', style: TextStyle(fontSize: 13, color: Color(0xFF555770))),
                      Text(
                        _formatVND(_cartService.subtotal),
                        style: TextStyle(
                          color: primaryColor,
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                        ),
                      ),
                    ],
                  ),
                  if (_cartService.shippingFee == 0 && _cartService.subtotal > 0)
                    const Text('Miễn phí vận chuyển', style: TextStyle(color: Color(0xFF00BFA5), fontSize: 11, fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(width: 12),
              Container(
                decoration: BoxDecoration(
                  gradient: selectedItems.isEmpty
                      ? null
                      : const LinearGradient(
                          colors: [Color(0xFFEE4D2D), Color(0xFFFF5224)],
                        ),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: selectedItems.isEmpty
                      ? null
                      : [
                          BoxShadow(
                            color: primaryColor.withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                ),
                child: ElevatedButton(
                  onPressed: selectedItems.isEmpty
                      ? null
                      : () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => CheckoutScreen(
                                selectedItems: selectedItems,
                              ),
                            ),
                          );
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: selectedItems.isEmpty ? const Color(0xFFE2E2E6) : Colors.transparent,
                    shadowColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    disabledForegroundColor: const Color(0xFF8F90A6),
                    padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text(
                    'Mua Hàng (${selectedItems.length})',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
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
