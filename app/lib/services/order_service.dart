import '../models/order.dart';
import 'api_client.dart';

/// Kết quả phân trang danh sách đơn hàng
class OrderListResult {
  final List<Order> orders;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  OrderListResult({
    required this.orders,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });
}

/// Service xử lý đặt hàng và quản lý đơn hàng với Backend API
class OrderService {
  static final OrderService _instance = OrderService._internal();
  factory OrderService() => _instance;
  OrderService._internal();

  final ApiClient _client = ApiClient();

  /// Tạo đơn hàng mới từ các mặt hàng trong giỏ hoặc mua ngay
  /// POST /api/v1/orders
  Future<Order?> createOrder({
    required String recipientName,
    required String recipientPhone,
    required String province,
    String? district,
    String? ward,
    required String addressDetail,
    String? note,
    String paymentMethod = 'cod',
    String? idempotencyKey,
    List<Map<String, dynamic>>? items,
  }) async {
    final body = <String, dynamic>{
      'recipientName': recipientName.trim(),
      'recipientPhone': recipientPhone.trim(),
      'province': province.trim(),
      if (district != null) 'district': district.trim(),
      if (ward != null) 'ward': ward.trim(),
      'addressDetail': addressDetail.trim(),
      if (note != null) 'note': note.trim(),
      'paymentMethod': paymentMethod,
      if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
      if (items != null) 'items': items,
    };

    final response = await _client.post('/api/v1/orders', body: body);

    if (response.success && response.data is Map<String, dynamic>) {
      return Order.fromJson(response.data as Map<String, dynamic>);
    }

    return null;
  }

  /// Lấy danh sách lịch sử đơn hàng của người dùng
  /// GET /api/v1/orders
  Future<OrderListResult> getOrders({
    String? status,
    int page = 1,
    int limit = 10,
  }) async {
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };

    if (status != null && status.isNotEmpty) {
      queryParams['status'] = status;
    }

    final response = await _client.get('/api/v1/orders', queryParams: queryParams);

    if (response.success && response.data is List) {
      final list = (response.data as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => Order.fromJson(item))
          .toList();

      final meta = response.meta ?? {};
      final total = (meta['total'] is num) ? (meta['total'] as num).toInt() : list.length;
      final totalPages = (meta['totalPages'] is num) ? (meta['totalPages'] as num).toInt() : 1;

      return OrderListResult(
        orders: list,
        total: total,
        page: page,
        limit: limit,
        totalPages: totalPages,
      );
    }

    return OrderListResult(orders: [], total: 0, page: page, limit: limit, totalPages: 1);
  }

  /// Xem chi tiết một đơn hàng
  /// GET /api/v1/orders/:orderId
  Future<Order?> getOrderDetail(String orderId) async {
    final response = await _client.get('/api/v1/orders/$orderId');

    if (response.success && response.data is Map<String, dynamic>) {
      return Order.fromJson(response.data as Map<String, dynamic>);
    }

    return null;
  }

  /// Hủy đơn hàng khi còn ở trạng thái pending
  /// PATCH /api/v1/orders/:orderId/cancel
  Future<bool> cancelOrder(String orderId, {String reason = 'Khách hàng yêu cầu hủy đơn'}) async {
    final response = await _client.patch(
      '/api/v1/orders/$orderId/cancel',
      body: {'reason': reason},
    );

    return response.success;
  }
}
