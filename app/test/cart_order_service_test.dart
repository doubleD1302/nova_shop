import 'package:flutter_test/flutter_test.dart';
import 'package:shopnova/models/cart_item.dart';
import 'package:shopnova/services/cart_service.dart';
import 'package:shopnova/services/order_service.dart';

void main() {
  group('CartItemModel Tests', () {
    test('CartItemModel parses JSON correctly', () {
      final json = {
        'id': '101',
        'variantId': '2',
        'productId': '15',
        'productName': 'Áo Thun Cotton Form Rộng',
        'productSlug': 'ao-thun-cotton-form-rong',
        'variantName': 'Trắng, Size L',
        'price': 120000,
        'originalPrice': 180000,
        'qty': 2,
        'selected': true,
        'shopId': '1',
        'shopName': 'Nova Official Store',
        'shopMall': true,
        'imageUrl': 'https://example.com/item.jpg',
      };

      final item = CartItemModel.fromJson(json);

      expect(item.id, '101');
      expect(item.variantId, '2');
      expect(item.productName, 'Áo Thun Cotton Form Rộng');
      expect(item.price, 120000);
      expect(item.qty, 2);
      expect(item.selected, true);
      expect(item.shopMall, true);
    });
  });

  group('CartService Local Calculations', () {
    test('addToCart, updateQty, subtotal, and shippingFee calculations', () async {
      final cart = CartService();
      // Clear any prior items
      cart.clearSelected();
      for (final it in List.from(cart.items)) {
        await cart.removeFromCart(it.variantId);
      }
      expect(cart.items.isEmpty, true);
      expect(cart.subtotal, 0.0);
      expect(cart.shippingFee, 0.0);

      // Add item 1
      await cart.addToCart(
        productId: '1',
        productName: 'Sản phẩm thử nghiệm A',
        productSlug: 'san-pham-thu-nghiem-a',
        variantId: 'v10',
        variantName: 'Đỏ',
        price: 200000,
        qty: 1,
      );

      expect(cart.items.length, 1);
      expect(cart.subtotal, 200000.0);
      expect(cart.shippingFee, 16500.0);
      expect(cart.totalAmount, 216500.0);

      // Increase quantity
      await cart.updateQty('v10', 3);
      expect(cart.subtotal, 600000.0);

      // Add high value item to test free shipping threshold >= 1,000,000
      await cart.addToCart(
        productId: '2',
        productName: 'Tai nghe Nova Pro',
        productSlug: 'tai-nghe-nova-pro',
        variantId: 'v20',
        variantName: 'Đen',
        price: 500000,
        qty: 1,
      );

      expect(cart.items.length, 2);
      expect(cart.subtotal, 1100000.0);
      expect(cart.shippingFee, 0.0); // Freeship
      expect(cart.totalAmount, 1100000.0);

      // Toggle select
      cart.toggleSelect('v20');
      expect(cart.subtotal, 600000.0);
      expect(cart.shippingFee, 16500.0);

      // Clear selected
      cart.clearSelected();
      expect(cart.items.length, 1);
      expect(cart.items.first.variantId, 'v20');

      // Cleanup
      await cart.removeFromCart('v20');
      expect(cart.items.isEmpty, true);
    });
  });

  group('OrderService Tests', () {
    test('OrderService initial state and error handling', () {
      final orderService = OrderService();
      expect(orderService.lastError, null);
    });
  });
}

