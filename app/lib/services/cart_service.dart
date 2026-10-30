import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/cart_item.dart';
import 'api_client.dart';
import '../config/api_config.dart';
import 'auth_service.dart';

/// Service xử lý toàn bộ thao tác giỏ hàng trên App Mobile
class CartService extends ChangeNotifier {
  static final CartService _instance = CartService._internal();
  factory CartService() => _instance;
  CartService._internal() {
    loadFromPrefs();
  }

  static const String _storageKey = 'shopnova_cart_items_v1';

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

  /// Đọc giỏ hàng đã lưu trong SharedPreferences khi khởi động ứng dụng
  Future<void> loadFromPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw != null && raw.isNotEmpty) {
        final List list = jsonDecode(raw);
        final loaded = list
            .map((e) => CartItemModel.fromJson(e as Map<String, dynamic>))
            .toList();
        if (loaded.isNotEmpty) {
          if (_items.isEmpty) {
            _items.addAll(loaded);
            notifyListeners();
          } else {
            for (final it in loaded) {
              if (!_items.any((i) => i.variantId == it.variantId || (i.id.isNotEmpty && i.id == it.id))) {
                _items.add(it);
              }
            }
            notifyListeners();
          }
        }
      }
    } catch (e) {
      debugPrint('[CartService] loadFromPrefs error: $e');
    }
  }

  /// Lưu danh sách sản phẩm hiện tại vào SharedPreferences
  Future<void> _saveToPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final data = jsonEncode(_items.map((i) => i.toJson()).toList());
      await prefs.setString(_storageKey, data);
    } catch (e) {
      debugPrint('[CartService] _saveToPrefs error: $e');
    }
  }

  /// Nạp giỏ hàng từ Backend API (nếu đã đăng nhập)
  Future<void> fetchCart() async {
    final token = AuthService().token;
    if (token == null) {
      await loadFromPrefs();
      return;
    }

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
        List? rawList;
        if (body['success'] == true && body['data'] != null) {
          if (body['data'] is List) {
            rawList = body['data'] as List;
          } else if (body['data'] is Map && body['data']['items'] is List) {
            rawList = body['data']['items'] as List;
          }
        }
        if (rawList != null) {
          final serverList = rawList
              .map((e) => CartItemModel.fromJson(e as Map<String, dynamic>))
              .toList();

          // SMART MERGE: Tránh việc server trả về rỗng (hoặc chưa kịp sync xong)
          // xóa mất sản phẩm mà người dùng vừa chọn ở trang chi tiết sản phẩm!
          if (serverList.isNotEmpty) {
            // Giữ lại các item local mà server chưa kịp có
            for (final localItem in _items) {
              final existsInServer = serverList.any((s) =>
                  s.variantId == localItem.variantId ||
                  (s.id.isNotEmpty && s.id == localItem.id) ||
                  (s.productId.isNotEmpty && s.productId == localItem.productId && s.variantName == localItem.variantName));
              if (!existsInServer) {
                serverList.add(localItem);
              }
            }
            _items.clear();
            _items.addAll(serverList);
          } else {
            // Server trả về rỗng nhưng local đang có sản phẩm:
            // TUYỆT ĐỐI KHÔNG XÓA _items, giữ nguyên toàn bộ sản phẩm local để không bao giờ bị biến mất sau 1 giây!
            debugPrint('[CartService] Server cart is empty, keeping ${_items.length} local items.');
          }
          await _saveToPrefs();
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
    String? variantId,
    String variantName = 'Mặc định',
    double price = 0.0,
    double? originalPrice,
    int qty = 1,
    String shopId = '1',
    String shopName = 'ShopNova',
    bool shopMall = false,
    String imageUrl = '',
  }) async {
    final cleanProductId = (productId != null && productId.trim().isNotEmpty)
        ? productId.trim()
        : (productSlug != null && productSlug.trim().isNotEmpty ? productSlug.trim() : '1');
    final cleanVariantName = variantName.trim().isNotEmpty ? variantName.trim() : 'Mặc định';

    // Tạo ID biến thể đặc trưng kết hợp mã sản phẩm & phân loại nếu variantId bị trống hoặc bằng '1'
    final effectiveVariantId = (variantId != null && variantId.trim().isNotEmpty && variantId.trim() != '1')
        ? variantId.trim()
        : '${cleanProductId}_${cleanVariantName.replaceAll(RegExp(r'\s+'), '_')}';

    // Sản phẩm CHỈ được gộp số lượng khi:
    // CÙNG mã sản phẩm VÀ CÙNG phân loại (biến thể)
    final index = _items.indexWhere((i) {
      // 1. Trùng chính xác variantId hiệu dụng
      if (i.variantId == effectiveVariantId) {
        return true;
      }
      // 2. Cùng sản phẩm VÀ cùng tên phân loại
      final isSameProduct = (i.productId.isNotEmpty && i.productId == cleanProductId) ||
          (i.productSlug.isNotEmpty && i.productSlug == (productSlug ?? cleanProductId));
      final isSameVariant = cleanVariantName.isNotEmpty &&
          cleanVariantName != 'Mặc định' &&
          i.variantName.trim().toLowerCase() == cleanVariantName.toLowerCase();

      return isSameProduct && isSameVariant;
    });

    if (index >= 0) {
      _items[index].qty += qty;
    } else {
      _items.add(CartItemModel(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        variantId: effectiveVariantId,
        productId: cleanProductId,
        productName: productName ?? 'Sản phẩm',
        productSlug: productSlug ?? cleanProductId,
        variantName: cleanVariantName,
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
    await _saveToPrefs();

    // Đồng bộ lên Backend API nếu có token
    final token = AuthService().token;
    if (token != null) {
      try {
        final currentQty = _items.firstWhere((i) => i.variantId == effectiveVariantId).qty;
        // Trích xuất số nguyên dương hợp lệ cho variantId theo chuẩn backend DB
        int? numVariantId = int.tryParse(effectiveVariantId);
        if (numVariantId == null || numVariantId <= 0) {
          numVariantId = int.tryParse(cleanProductId);
        }
        if (numVariantId == null || numVariantId <= 0) {
          final match = RegExp(r'\d+').firstMatch(cleanProductId) ?? RegExp(r'\d+').firstMatch(effectiveVariantId);
          if (match != null) {
            numVariantId = int.tryParse(match.group(0)!);
          }
        }

        if (numVariantId != null && numVariantId > 0) {
          await http.post(
            Uri.parse(ApiConfig.cartItemsUrl),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'variantId': numVariantId.toString(),
              'qty': currentQty,
              'selected': true,
            }),
          ).timeout(const Duration(seconds: 5));
        }
      } catch (e) {
        debugPrint('[CartService] sync addToCart error: $e');
      }
    }
  }

  /// Cập nhật số lượng
  Future<void> updateQty(String variantId, int newQty) async {
    final index = _items.indexWhere((i) => i.variantId == variantId || i.id == variantId);
    if (index < 0) return;

    if (newQty <= 0) {
      await removeFromCart(variantId);
      return;
    }

    _items[index].qty = newQty.clamp(1, 99);
    final item = _items[index];
    notifyListeners();
    await _saveToPrefs();

    final token = AuthService().token;
    if (token != null) {
      try {
        final targetId = item.id.isNotEmpty ? item.id : item.variantId;
        await http.patch(
          Uri.parse(ApiConfig.cartItemUrl(targetId)),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'qty': item.qty,
            'selected': item.selected,
          }),
        ).timeout(const Duration(seconds: 5));
      } catch (e) {
        debugPrint('[CartService] sync updateQty error: $e');
      }
    }
  }

  /// Xóa sản phẩm khỏi giỏ hàng
  Future<void> removeFromCart(String variantId) async {
    final itemToRemove = _items.cast<CartItemModel?>().firstWhere(
      (i) => i?.variantId == variantId || i?.id == variantId,
      orElse: () => null,
    );
    _items.removeWhere((i) => i.variantId == variantId || i.id == variantId);
    notifyListeners();
    await _saveToPrefs();

    final token = AuthService().token;
    if (token != null && itemToRemove != null) {
      try {
        final targetId = itemToRemove.id.isNotEmpty ? itemToRemove.id : itemToRemove.variantId;
        await http.delete(
          Uri.parse(ApiConfig.cartItemUrl(targetId)),
          headers: {
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
    final index = _items.indexWhere((i) => i.variantId == variantId || i.id == variantId);
    if (index >= 0) {
      _items[index].selected = !_items[index].selected;
      notifyListeners();
      _saveToPrefs();
    }
  }

  /// Chọn tất cả / Bỏ chọn tất cả
  void toggleSelectAll(bool selected) {
    for (final item in _items) {
      item.selected = selected;
    }
    notifyListeners();
    _saveToPrefs();
  }

  /// Xóa các item đã thanh toán khỏi giỏ hàng
  void clearSelected() {
    _items.removeWhere((i) => i.selected);
    notifyListeners();
    _saveToPrefs();
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
