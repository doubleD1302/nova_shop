import 'api_client.dart';

/// Service xử lý toàn bộ thao tác giỏ hàng trên App Mobile
class CartService {
  static final CartService _instance = CartService._internal();
  factory CartService() => _instance;
  CartService._internal();

  final ApiClient _client = ApiClient();

  /// Lấy toàn bộ thông tin giỏ hàng của người dùng đang đăng nhập
  /// GET /api/v1/cart
  Future<ApiResponse> getCart() async {
    return await _client.get('/api/v1/cart');
  }

  /// Thêm một SKU biến thể vào giỏ hàng
  /// POST /api/v1/cart/items
  Future<ApiResponse> addToCart({
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
  /// DELETE /api/v1/cart/items (với clearAll: true)
  Future<ApiResponse> clearCart() async {
    return await _client.delete(
      '/api/v1/cart/items',
    );
  }
}
