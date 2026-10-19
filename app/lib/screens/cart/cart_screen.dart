import 'package:flutter/material.dart';
import '../../models/cart_item.dart';
import '../../services/cart_service.dart';
import '../checkout/checkout_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final Color primaryColor = const Color(0xFFEE4D2D);
  final CartService _cartService = CartService();

  @override
  void initState() {
    super.initState();
    // Tải giỏ hàng mới nhất từ backend nếu người dùng đã đăng nhập
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
          backgroundColor: const Color(0xFFF5F5F5),
          appBar: AppBar(
            backgroundColor: Colors.white,
            elevation: 0.5,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.black87),
              onPressed: () => Navigator.maybePop(context),
            ),
            title: Row(
              children: [
                const Icon(Icons.shopping_bag, color: Color(0xFFEE4D2D), size: 22),
                const SizedBox(width: 6),
                Text(
                  'Giỏ hàng (${items.length})',
                  style: const TextStyle(
                    color: Colors.black87,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh, color: Colors.black87),
                tooltip: 'Làm mới giỏ hàng',
                onPressed: () => _cartService.fetchCart(),
              ),
              IconButton(
                icon: const Icon(Icons.delete_sweep_outlined, color: Colors.black87),
                tooltip: 'Xóa các mục đã chọn',
                onPressed: selectedItems.isEmpty
                    ? null
                    : () {
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Xác nhận xóa'),
                            content: Text('Xóa ${selectedItems.length} sản phẩm đã chọn khỏi giỏ hàng?'),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx),
                                child: const Text('Hủy'),
                              ),
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(backgroundColor: primaryColor),
                                onPressed: () {
                                  Navigator.pop(ctx);
                                  for (final it in selectedItems) {
                                    _cartService.removeFromCart(it.variantId);
                                  }
                                },
                                child: const Text('Xóa', style: TextStyle(color: Colors.white)),
                              ),
                            ],
                          ),
                        );
                      },
              ),
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
                          padding: const EdgeInsets.only(bottom: 16),
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
              width: 110,
              height: 110,
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.shopping_cart_outlined, size: 56, color: primaryColor),
            ),
            const SizedBox(height: 20),
            const Text(
              'Giỏ hàng của bạn đang trống',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
            ),
            const SizedBox(height: 8),
            const Text(
              'Hãy khám phá hàng ngàn sản phẩm ưu đãi hấp dẫn trên ShopNova ngay hôm nay!',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.maybePop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Khám phá ngay', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
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
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: Colors.red.shade50, shape: BoxShape.circle),
            child: Icon(Icons.local_shipping, color: primaryColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: const TextStyle(color: Colors.black87, fontSize: 13),
                    children: [
                      if (remaining > 0) ...[
                        const TextSpan(text: 'Mua thêm '),
                        TextSpan(
                          text: _formatVND(remaining),
                          style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold),
                        ),
                        const TextSpan(text: ' để được '),
                        const TextSpan(text: 'Miễn phí vận chuyển', style: TextStyle(fontWeight: FontWeight.bold)),
                      ] else ...[
                        const TextSpan(
                          text: 'Chúc mừng! Đơn hàng đủ điều kiện FREESHIP toàn quốc',
                          style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 5,
                    backgroundColor: Colors.grey.shade200,
                    valueColor: AlwaysStoppedAnimation<Color>(primaryColor),
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
    // Nhóm items theo shopName
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
        margin: const EdgeInsets.only(top: 8),
        color: Colors.white,
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Shop Header
            Row(
              children: [
                Checkbox(
                  value: allShopSelected,
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
                if (isMall) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFF003366), borderRadius: BorderRadius.circular(3)),
                    child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 6),
                ],
                Expanded(
                  child: Text(
                    shopName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const Icon(Icons.chevron_right, color: Colors.grey, size: 18),
              ],
            ),
            const Divider(height: 12),
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
          Checkbox(
            value: item.selected,
            onChanged: (_) => _cartService.toggleSelect(item.variantId),
            activeColor: primaryColor,
          ),
          // Product Image
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Container(
              width: 76,
              height: 76,
              color: Colors.grey.shade100,
              child: item.imageUrl.isNotEmpty
                  ? Image.network(
                      item.imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(Icons.image, color: Colors.grey),
                    )
                  : const Icon(Icons.image, color: Colors.grey),
            ),
          ),
          const SizedBox(width: 10),
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
                        style: const TextStyle(fontSize: 13, height: 1.3, fontWeight: FontWeight.w500),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 16, color: Colors.grey),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () => _cartService.removeFromCart(item.variantId),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(3)),
                  child: Text(
                    'Phân loại: ${item.variantName}',
                    style: TextStyle(color: Colors.grey.shade700, fontSize: 11),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Text(
                          _formatVND(item.price),
                          style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        if (item.originalPrice != null && item.originalPrice! > item.price) ...[
                          const SizedBox(width: 6),
                          Text(
                            _formatVND(item.originalPrice!),
                            style: const TextStyle(
                              color: Colors.grey,
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
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        children: [
                          InkWell(
                            onTap: () => _cartService.updateQty(item.variantId, item.qty - 1),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              child: Icon(Icons.remove, size: 14, color: Colors.black87),
                            ),
                          ),
                          Container(
                            constraints: const BoxConstraints(minWidth: 28),
                            alignment: Alignment.center,
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: Text('${item.qty}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                          ),
                          InkWell(
                            onTap: () => _cartService.updateQty(item.variantId, item.qty + 1),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              child: Icon(Icons.add, size: 14, color: Colors.black87),
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
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            offset: const Offset(0, -3),
            blurRadius: 6,
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              Row(
                children: [
                  Checkbox(
                    value: allSelected,
                    onChanged: (val) => _cartService.toggleSelectAll(val ?? false),
                    activeColor: primaryColor,
                  ),
                  const Text('Tất cả', style: TextStyle(fontSize: 13)),
                ],
              ),
              const Spacer(),
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    children: [
                      const Text('Tổng: ', style: TextStyle(fontSize: 13)),
                      Text(
                        _formatVND(_cartService.subtotal),
                        style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ],
                  ),
                  if (_cartService.shippingFee == 0 && _cartService.subtotal > 0)
                    const Text('Miễn phí vận chuyển', style: TextStyle(color: Colors.green, fontSize: 11)),
                ],
              ),
              const SizedBox(width: 12),
              ElevatedButton(
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
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: Colors.grey.shade300,
                  disabledForegroundColor: Colors.grey.shade600,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                child: Text(
                  'Mua Hàng (${selectedItems.length})',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
