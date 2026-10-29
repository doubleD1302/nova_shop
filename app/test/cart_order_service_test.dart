import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shopnova/models/cart_item.dart';
import 'package:shopnova/models/order.dart';
import 'package:shopnova/services/cart_service.dart';
import 'package:shopnova/services/order_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

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

    test('Adding 2 different products does NOT merge into the first product', () async {
      final cart = CartService();
      cart.clearSelected();
      for (final it in List.from(cart.items)) {
        await cart.removeFromCart(it.variantId);
      }
      expect(cart.items.isEmpty, true);

      // Thêm sản phẩm 1 (ví dụ: Áo sơ mi)
      await cart.addToCart(
        productId: '101',
        productName: 'Áo sơ mi Oxford',
        productSlug: 'ao-so-mi-oxford',
        variantName: 'Trắng - L',
        price: 250000,
        qty: 1,
      );

      expect(cart.items.length, 1);
      expect(cart.items[0].productId, '101');
      expect(cart.items[0].qty, 1);

      // Thêm sản phẩm 2 hoàn toàn khác (ví dụ: Quần Jean)
      await cart.addToCart(
        productId: '202',
        productName: 'Quần Jeans Slimfit',
        productSlug: 'quan-jeans-slimfit',
        variantName: 'Xanh - 32',
        price: 350000,
        qty: 1,
      );

      // Phải có đúng 2 sản phẩm riêng biệt trong giỏ hàng!
      expect(cart.items.length, 2);
      expect(cart.items[0].productId, '101');
      expect(cart.items[0].qty, 1);
      expect(cart.items[1].productId, '202');
      expect(cart.items[1].qty, 1);

      // Thêm cùng sản phẩm 1 với đúng phân loại đó -> số lượng tăng lên 2
      await cart.addToCart(
        productId: '101',
        productName: 'Áo sơ mi Oxford',
        productSlug: 'ao-so-mi-oxford',
        variantName: 'Trắng - L',
        price: 250000,
        qty: 1,
      );

      expect(cart.items.length, 2);
      expect(cart.items[0].qty, 2);
      expect(cart.items[1].qty, 1);

      // Thêm sản phẩm 1 nhưng với biến thể khác (Đen - M) -> tạo dòng sản phẩm mới riêng biệt
      await cart.addToCart(
        productId: '101',
        productName: 'Áo sơ mi Oxford',
        productSlug: 'ao-so-mi-oxford',
        variantName: 'Đen - M',
        price: 250000,
        qty: 1,
      );

      expect(cart.items.length, 3);
      expect(cart.items[2].productId, '101');
      expect(cart.items[2].variantName, 'Đen - M');
      expect(cart.items[2].qty, 1);

      // Cleanup
      for (final it in List.from(cart.items)) {
        await cart.removeFromCart(it.variantId);
      }
      expect(cart.items.isEmpty, true);
    });

    test('Cart items persist and are NOT wiped out when fetchCart runs', () async {
      final cart = CartService();
      // Ensure clean start
      for (final it in List.from(cart.items)) {
        await cart.removeFromCart(it.variantId);
      }
      expect(cart.items.isEmpty, true);

      // Add item as user does when clicking "MUA VỚI VOUCHER"
      await cart.addToCart(
        productId: '1',
        productName: 'Áo thun ShopNova',
        variantId: '1_Trắng_M',
        variantName: 'Trắng - M',
        price: 180000,
        qty: 1,
      );

      expect(cart.items.length, 1);
      expect(cart.items.first.productName, 'Áo thun ShopNova');

      // Now simulate fetchCart (when user navigates to CartScreen)
      // fetchCart should preserve local items and never wipe them out
      await cart.fetchCart();

      // Product must STILL be in cart!
      expect(cart.items.length, 1);
      expect(cart.items.first.productName, 'Áo thun ShopNova');
      expect(cart.subtotal, 180000.0);

      // Cleanup
      for (final it in List.from(cart.items)) {
        await cart.removeFromCart(it.variantId);
      }
      expect(cart.items.isEmpty, true);
    });
  });

  group('OrderService Tests', () {
    test('OrderService initial state and error handling', () {
      final orderService = OrderService();
      expect(orderService.lastError, null);
    });

    test('OrderItem.fromJson correctly parses price and unit_price fallbacks', () {
      // Test when backend or checkout only provides 'price'
      final jsonWithPrice = {
        'id': '1',
        'productName': 'Bàn Phím Cơ',
        'price': 649000,
        'qty': 1,
      };
      final item1 = OrderItem.fromJson(jsonWithPrice);
      expect(item1.unitPrice, 649000);
      expect(item1.lineTotal, 649000);

      // Test when payload has 'unit_price'
      final jsonWithSnakeCase = {
        'id': '2',
        'product_name': 'Sạc Dự Phòng 20000mAh',
        'unit_price': 350000,
        'quantity': 2,
      };
      final item2 = OrderItem.fromJson(jsonWithSnakeCase);
      expect(item2.unitPrice, 350000);
      expect(item2.qty, 2);
      expect(item2.lineTotal, 700000);
      expect(item2.productName, 'Sạc Dự Phòng 20000mAh');
    });

    test('createOrder fallback preserves item unitPrice, productName, and total amount', () async {
      final orderService = OrderService();
      final order = await orderService.createOrder(
        recipientName: 'Nguyen Van A',
        recipientPhone: '0901234567',
        province: 'TP. Hồ Chí Minh',
        addressDetail: '123 Đường Lê Lợi',
        items: [
          {
            'variantId': 1,
            'qty': 1,
            'price': 499000,
            'unitPrice': 499000,
            'productName': 'Sạc dự phòng 20000mAh',
            'variantName': 'Đen',
          },
          {
            'variantId': 2,
            'qty': 1,
            'price': 500000,
            'unitPrice': 500000,
            'productName': 'Bàn Phím Cơ',
            'variantName': 'Trắng',
          },
        ],
      );

      expect(order, isNotNull);
      expect(order!['totalAmount'], 999000);
      final items = order['items'] as List;
      expect(items.length, 2);
      expect(items[0]['unitPrice'], 499000);
      expect(items[1]['unitPrice'], 500000);
      expect(items[0]['variantName'], 'Đen');
      expect(items[1]['variantName'], 'Trắng');
    });
  });
}

