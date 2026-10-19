import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/cart_item.dart';
import 'api_client.dart';
import 'api_config.dart';
import 'auth_service.dart';

/// Service xử lý toàn bộ thao tác giỏ hàng trên App Mobile
class CartService extends ChangeNotifier {
  static final CartService _instance = CartService._internal();
  factory CartService() => _instance;
  CartService._internal();

  final ApiClient _client = ApiClient();
  final List<CartItemModel> _items = [];
  bool _isLoading = false;

  List<CartItemModel> get items => List.unmodifiable(_items);
  bool get isLoading => _isLoading;
  int get itemCount => _items.fold(0, (sum, i) => sum + i.qty);

  double get subtotal => _items
      .where((i) => i.selected)
      .fold(0.0, (sum, i) => sum + (i.price * i.qty));

  double get shippingFee => subtotal >= 1000000 || subtotal == 0 ? 0 : 16500;
  double get totalAmount => subtotal + shippingFee;

  /// Nạp giỏ hàng từ Backend API (nếu đã đăng nhập)
  Future<void> fetchCart() async {
    final token = AuthService().token;
    if (token == null) return;

    _isLoading = true;
    notifyListeners();

    try {
      final response = await http.get(
        Uri.parse(ApiConfig.cartUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true && body['data'] is List) {
          final list = (body['data'] as List)
              .map((e) => CartItemModel.fromJson(e as Map<String, dynamic>))
              .toList();
          _items.clear();
          _items.addAll(list);
        }
      }
    } catch (e) {
      debugPrint('[CartService] fetchCart error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Thêm hoặc tăng số lượng sản phẩm vào giỏ hàng
  Future<void> addToCart({
    String? productId,
    String? productName,
    String? productSlug,
    String variantId = '1',
    String variantName = 'Mặc định',
    double price = 0.0,
    double? originalPrice,
    int qty = 1,
    String shopId = '1',
    String shopName = 'ShopNova',
    bool shopMall = false,
    String imageUrl = '',
  }) async {
    final index = _items.indexWhere((i) => i.variantId == variantId);
    if (index >= 0) {
      _items[index].qty += qty;
    } else {
      _items.add(CartItemModel(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        variantId: variantId,
        productId: productId ?? '',
        productName: productName ?? '',
        productSlug: productSlug ?? '',
        variantName: variantName,
        price: price,
        originalPrice: originalPrice,
        qty: qty,
        selected: true,
        shopId: shopId,
        shopName: shopName,
        shopMall: shopMall,
        imageUrl: imageUrl,
      ));
    }
    notifyListeners();

    // Đồng bộ lên Backend API nếu có token
    final token = AuthService().token;
    if (token != null) {
      try {
        final currentQty = _items.firstWhere((i) => i.variantId == variantId).qty;
        await http.post(
          Uri.parse(ApiConfig.cartUrl),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'variantId': int.tryParse(variantId) ?? 1,
            'qty': currentQty,
            'selected': true,
          }),
        ).timeout(const Duration(seconds: 5));
      } catch (e) {
        debugPrint('[CartService] sync addToCart error: $e');
      }
    }
  }

  /// Cập nhật số lượng
  Future<void> updateQty(String variantId, int newQty) async {
    final index = _items.indexWhere((i) => i.variantId == variantId);
    if (index < 0) return;

    if (newQty <= 0) {
      await removeFromCart(variantId);
      return;
    }

    _items[index].qty = newQty.clamp(1, 99);
    notifyListeners();

    final token = AuthService().token;
    if (token != null) {
      try {
        await http.post(
          Uri.parse(ApiConfig.cartUrl),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'variantId': int.tryParse(variantId) ?? 1,
            'qty': _items[index].qty,
            'selected': _items[index].selected,
          }),
        ).timeout(const Duration(seconds: 5));
      } catch (e) {
        debugPrint('[CartService] sync updateQty error: $e');
      }
    }
  }

  /// Xóa sản phẩm khỏi giỏ hàng
  Future<void> removeFromCart(String variantId) async {
    _items.removeWhere((i) => i.variantId == variantId);
    notifyListeners();

    final token = AuthService().token;
    if (token != null) {
      try {
        await http.delete(
          Uri.parse(ApiConfig.cartItemUrl(variantId)),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
        ).timeout(const Duration(seconds: 5));
      } catch (e) {
        debugPrint('[CartService] sync removeFromCart error: $e');
      }
    }
  }

  /// Chọn / Bỏ chọn một dòng
  void toggleSelect(String variantId) {
    final index = _items.indexWhere((i) => i.variantId == variantId);
    if (index >= 0) {
      _items[index].selected = !_items[index].selected;
      notifyListeners();
    }
  }

  /// Chọn tất cả / Bỏ chọn tất cả
  void toggleSelectAll(bool selected) {
    for (final item in _items) {
      item.selected = selected;
    }
    notifyListeners();
  }

  /// Xóa các item đã thanh toán khỏi giỏ hàng
  void clearSelected() {
    _items.removeWhere((i) => i.selected);
    notifyListeners();
  }

  // --- API Client Direct Methods ---

  /// Lấy toàn bộ thông tin giỏ hàng của người dùng đang đăng nhập
  /// GET /api/v1/cart
  Future<ApiResponse> getCart() async {
    return await _client.get('/api/v1/cart');
  }

  /// Thêm một SKU biến thể vào giỏ hàng qua API Client
  /// POST /api/v1/cart/items
  Future<ApiResponse> addToCartApi({
    required String variantId,
    int qty = 1,
    bool selected = true,
  }) async {
    return await _client.post(
      '/api/v1/cart/items',
      body: {
        'variantId': variantId,
        'qty': qty,
        'selected': selected,
      },
    );
  }

  /// Cập nhật số lượng hoặc trạng thái chọn của sản phẩm trong giỏ
  /// PATCH /api/v1/cart/items/:itemId
  Future<ApiResponse> updateItem(
    String itemId, {
    int? qty,
    bool? selected,
  }) async {
    final body = <String, dynamic>{};
    if (qty != null) body['qty'] = qty;
    if (selected != null) body['selected'] = selected;

    return await _client.patch('/api/v1/cart/items/$itemId', body: body);
  }

  /// Xóa một sản phẩm khỏi giỏ hàng
  /// DELETE /api/v1/cart/items/:itemId
  Future<ApiResponse> removeItem(String itemId) async {
    return await _client.delete('/api/v1/cart/items/$itemId');
  }

  /// Làm sạch toàn bộ giỏ hàng
  /// DELETE /api/v1/cart/items
  Future<ApiResponse> clearCart() async {
    return await _client.delete('/api/v1/cart/items');
  }
}
